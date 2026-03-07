import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/utils/db";
import { APIError } from "@/lib/utils/api-error";

const USAGE_CACHE_TTL_MS = 15 * 60 * 1000;
const DECIMAL_BYTES_PER_GB = 1_000_000_000;

type UsagePeriod = {
  from: Date;
  to: Date;
};

type UsageMetrics = {
  trafficGb: number | null;
  storageGb: number | null;
  transcodingMinutes: number | null;
  amountMinor: number | null;
  rawJson: unknown;
};

type ProductUsageAccumulator = {
  trafficBytes: number;
  storageBytes: number;
  transcodingMinutes: number;
  amountMinor: number;
  latestStorageAt: number | null;
};

export type KinescopeUsageDebugSummary = {
  rowCount: number;
  projectIds: string[];
  products: string[];
};

export type WorkspaceUsageSnapshotDTO = {
  workspaceId: string;
  periodStart: Date;
  periodEnd: Date;
  trafficGb: number | null;
  storageGb: number | null;
  transcodingMinutes: number | null;
  amountMinor: number | null;
  fetchedAt: Date;
  expiresAt: Date;
  source: "cache" | "live" | "stale" | "unavailable";
  reason: string | null;
  debug: KinescopeUsageDebugSummary | null;
  isLegacy: boolean;
  legacyMessage: string | null;
};

function asNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pickNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = asNumeric(source[key]);
    if (value !== null) {
      return value;
    }
  }
  return null;
}

function toMinorUnits(value: number, key: string): number {
  if (key.includes("minor")) {
    return Math.round(value);
  }
  if (Math.abs(value) > 10_000) {
    return Math.round(value);
  }
  return Math.round(value * 100);
}

function parseAmountMinor(source: Record<string, unknown>): number | null {
  const keys = ["amount_minor", "amountMinor", "cost_minor", "costMinor", "total_minor", "totalMinor", "amount", "cost", "total"];
  for (const key of keys) {
    const value = asNumeric(source[key]);
    if (value !== null) {
      return toMinorUnits(value, key.toLowerCase());
    }
  }
  return null;
}

function toGigabytes(bytes: number): number {
  return bytes / DECIMAL_BYTES_PER_GB;
}

function extractRows(payload: unknown): Array<Record<string, unknown>> {
  if (!payload) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
  }

  if (typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;
  const roots = [record.data, record.items, record.results];

  for (const candidate of roots) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
    }
  }

  const projects = record.projects;
  if (projects && typeof projects === "object") {
    const normalized: Array<Record<string, unknown>> = [];
    for (const [key, value] of Object.entries(projects as Record<string, unknown>)) {
      if (!value || typeof value !== "object") {
        continue;
      }
      normalized.push({ project_id: key, ...(value as Record<string, unknown>) });
    }
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return [];
}

function resolveProjectId(row: Record<string, unknown>): string | null {
  const candidates = [
    row.project_id,
    row.projectId,
    row.id,
    (row.project as Record<string, unknown> | undefined)?.id,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
}

function resolveUsageProduct(row: Record<string, unknown>): "traffic" | "storage" | "transcoding" | null {
  const candidates = [row.product, row.product_type, row.productType, row.metric, row.resource, row.type];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") {
      continue;
    }

    const normalized = candidate.trim().toLowerCase();
    if (!normalized) {
      continue;
    }

    if (normalized === "cdn" || normalized === "traffic" || normalized === "bandwidth") {
      return "traffic";
    }

    if (normalized === "storage") {
      return "storage";
    }

    if (normalized === "encoding" || normalized === "transcoding") {
      return "transcoding";
    }
  }

  return null;
}

function selectRelevantRows(
  rows: Array<Record<string, unknown>>,
  projectId: string,
  options?: { trustedProjectScope?: boolean },
): Array<Record<string, unknown>> {
  const directMatches = rows.filter((row) => resolveProjectId(row) === projectId);
  if (directMatches.length > 0) {
    if (options?.trustedProjectScope) {
      return [...directMatches, ...rows.filter((row) => resolveProjectId(row) === null)];
    }

    return directMatches;
  }

  const hasExplicitProjectIds = rows.some((row) => resolveProjectId(row) !== null);
  if (options?.trustedProjectScope && !hasExplicitProjectIds) {
    return rows;
  }

  return [];
}

function extractReason(rawJson: unknown): string | null {
  if (!rawJson || typeof rawJson !== "object" || Array.isArray(rawJson)) {
    return null;
  }

  const reason = (rawJson as Record<string, unknown>).reason;
  return typeof reason === "string" && reason.trim().length > 0 ? reason.trim() : null;
}

export function summarizeKinescopeUsageRawJson(rawJson: unknown): KinescopeUsageDebugSummary | null {
  const rows = extractRows(rawJson);
  if (rows.length === 0) {
    return {
      rowCount: 0,
      projectIds: [],
      products: [],
    };
  }

  const projectIds = Array.from(
    new Set(
      rows
        .map((row) => resolveProjectId(row))
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const products = Array.from(
    new Set(
      rows
        .map((row) => {
          const product = row.product ?? row.product_type ?? row.productType ?? row.metric ?? row.resource ?? row.type;
          return typeof product === "string" && product.trim().length > 0 ? product.trim() : null;
        })
        .filter((value): value is string => Boolean(value)),
    ),
  );

  return {
    rowCount: rows.length,
    projectIds,
    products,
  };
}

function buildDebugRawJson(input: {
  rows: Array<Record<string, unknown>>;
  requestedProjectId: string;
  filteredRowCount: number;
  fallbackWithoutProjectFilter: boolean;
  reason?: string | null;
}): Prisma.InputJsonValue {
  return {
    data: input.rows as unknown as Prisma.InputJsonValue,
    requestedProjectId: input.requestedProjectId,
    filteredRowCount: input.filteredRowCount,
    fallbackWithoutProjectFilter: input.fallbackWithoutProjectFilter,
    reason: input.reason ?? null,
  };
}

function resolveRowTimestamp(row: Record<string, unknown>): number | null {
  const candidates = [row.date, row.created_at, row.createdAt, row.timestamp];

  for (const candidate of candidates) {
    if (typeof candidate !== "string" || candidate.trim().length === 0) {
      continue;
    }

    const parsed = Date.parse(candidate);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
}

function mapSnapshot(snapshot: {
  workspaceId: string;
  periodStart: Date;
  periodEnd: Date;
  trafficGb: Prisma.Decimal | null;
  storageGb: Prisma.Decimal | null;
  transcodingMinutes: Prisma.Decimal | null;
  amountMinor: number | null;
  rawJson: Prisma.JsonValue;
  fetchedAt: Date;
  expiresAt: Date;
}, source: WorkspaceUsageSnapshotDTO["source"], isLegacy: boolean, legacyMessage: string | null): WorkspaceUsageSnapshotDTO {
  return {
    workspaceId: snapshot.workspaceId,
    periodStart: snapshot.periodStart,
    periodEnd: snapshot.periodEnd,
    trafficGb: snapshot.trafficGb ? Number(snapshot.trafficGb.toString()) : null,
    storageGb: snapshot.storageGb ? Number(snapshot.storageGb.toString()) : null,
    transcodingMinutes: snapshot.transcodingMinutes ? Number(snapshot.transcodingMinutes.toString()) : null,
    amountMinor: snapshot.amountMinor,
    fetchedAt: snapshot.fetchedAt,
    expiresAt: snapshot.expiresAt,
    source,
    reason: extractReason(snapshot.rawJson),
    debug: summarizeKinescopeUsageRawJson(snapshot.rawJson),
    isLegacy,
    legacyMessage,
  };
}

function getUtcMonthPeriod(reference = new Date()): UsagePeriod {
  const from = new Date(reference);
  from.setUTCDate(1);
  from.setUTCHours(0, 0, 0, 0);

  const to = new Date(from);
  to.setUTCMonth(to.getUTCMonth() + 1);

  return { from, to };
}

function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export class KinescopeBillingService {
  private readonly baseUrl: string;
  private readonly apiToken: string;

  constructor(private prismaClient: PrismaClient = prisma as PrismaClient) {
    this.baseUrl = (process.env.KINESCOPE_BASE_URL ?? "https://api.kinescope.io/v1").replace(/\/+$/, "");
    this.apiToken = (process.env.KINESCOPE_API_TOKEN ?? "").trim();
  }

  async getWorkspaceUsageSnapshot(input: {
    workspaceId: string;
    from?: Date;
    to?: Date;
    forceRefresh?: boolean;
  }): Promise<WorkspaceUsageSnapshotDTO> {
    const workspace = await this.prismaClient.workspace.findUnique({
      where: { id: input.workspaceId },
      select: {
        id: true,
        kinescopeProjectId: true,
        billingTrackingStartedAt: true,
      },
    });

    if (!workspace) {
      throw new APIError(404, "Workspace not found", "NOT_FOUND");
    }

    const defaults = getUtcMonthPeriod();
    const periodStart = input.from ?? defaults.from;
    const periodEnd = input.to ?? defaults.to;

    if (!(periodStart instanceof Date) || Number.isNaN(periodStart.getTime())) {
      throw new APIError(400, "Invalid period start", "BAD_REQUEST");
    }
    if (!(periodEnd instanceof Date) || Number.isNaN(periodEnd.getTime())) {
      throw new APIError(400, "Invalid period end", "BAD_REQUEST");
    }
    if (periodEnd <= periodStart) {
      throw new APIError(400, "Period end must be after start", "BAD_REQUEST");
    }

    const now = new Date();
    const cached = await this.prismaClient.kinescopeUsageSnapshot.findUnique({
      where: {
        workspaceId_periodStart_periodEnd: {
          workspaceId: workspace.id,
          periodStart,
          periodEnd,
        },
      },
    });

    const isLegacy = workspace.billingTrackingStartedAt === null;
    const legacyMessage = isLegacy ? "Per-workspace billing accuracy starts from tracking enablement date." : null;

    if (!input.forceRefresh && cached && cached.expiresAt > now) {
      return mapSnapshot(cached, "cache", isLegacy, legacyMessage);
    }

    if (!workspace.kinescopeProjectId || !this.apiToken) {
      if (cached) {
        return mapSnapshot(cached, "stale", isLegacy, legacyMessage);
      }

      const fallback = await this.prismaClient.kinescopeUsageSnapshot.create({
        data: {
          workspaceId: workspace.id,
          periodStart,
          periodEnd,
          trafficGb: new Prisma.Decimal(0),
          storageGb: new Prisma.Decimal(0),
          transcodingMinutes: new Prisma.Decimal(0),
          amountMinor: 0,
          rawJson: {
            reason: !this.apiToken ? "KINESCOPE_API_TOKEN is missing" : "Workspace Kinescope project is not configured",
          },
          expiresAt: new Date(now.getTime() + USAGE_CACHE_TTL_MS),
        },
      });
      return mapSnapshot(fallback, "unavailable", isLegacy, legacyMessage);
    }

    let metrics: UsageMetrics;
    try {
      metrics = await this.fetchUsageMetrics(workspace.kinescopeProjectId, {
        from: periodStart,
        to: periodEnd,
      });
    } catch (error) {
      if (cached) {
        return mapSnapshot(cached, "stale", isLegacy, legacyMessage);
      }
      throw error;
    }

    const rawJson = (metrics.rawJson ?? {}) as Prisma.InputJsonValue;
    const refreshed = await this.prismaClient.kinescopeUsageSnapshot.upsert({
      where: {
        workspaceId_periodStart_periodEnd: {
          workspaceId: workspace.id,
          periodStart,
          periodEnd,
        },
      },
      create: {
        workspaceId: workspace.id,
        periodStart,
        periodEnd,
        trafficGb: metrics.trafficGb,
        storageGb: metrics.storageGb,
        transcodingMinutes: metrics.transcodingMinutes,
        amountMinor: metrics.amountMinor,
        rawJson,
        expiresAt: new Date(now.getTime() + USAGE_CACHE_TTL_MS),
      },
      update: {
        trafficGb: metrics.trafficGb,
        storageGb: metrics.storageGb,
        transcodingMinutes: metrics.transcodingMinutes,
        amountMinor: metrics.amountMinor,
        rawJson,
        fetchedAt: now,
        expiresAt: new Date(now.getTime() + USAGE_CACHE_TTL_MS),
      },
    });

    return mapSnapshot(refreshed, "live", isLegacy, legacyMessage);
  }

  private async fetchUsageMetrics(projectId: string, period: UsagePeriod): Promise<UsageMetrics> {
    const requestUsage = async (projectIdFilter?: string): Promise<{ rows: Array<Record<string, unknown>>; payload: unknown }> => {
      const params = new URLSearchParams({
        from: toIsoDay(period.from),
        to: toIsoDay(period.to),
        group_by: "project_id",
      });

      if (projectIdFilter) {
        params.set("project_id", projectIdFilter);
      }

      const response = await fetch(`${this.baseUrl}/billing/usage?${params.toString()}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        const body = await response.text();
        throw new APIError(502, `Kinescope billing usage request failed (${response.status}): ${body || response.statusText}`, "UPSTREAM_ERROR");
      }

      const payload = (await response.json().catch(() => null)) as unknown;
      return {
        payload,
        rows: extractRows(payload),
      };
    };

    const filtered = await requestUsage(projectId);
    let rows = filtered.rows;
    let fallbackWithoutProjectFilter = false;

    if (rows.length === 0) {
      const unfiltered = await requestUsage();
      if (unfiltered.rows.length > 0) {
        rows = unfiltered.rows;
        fallbackWithoutProjectFilter = true;
      }
    }

    const matched = fallbackWithoutProjectFilter
      ? selectRelevantRows(rows, projectId, { trustedProjectScope: false })
      : selectRelevantRows(rows, projectId, { trustedProjectScope: true });
    const hasProductUsageRows = matched.some((row) => resolveUsageProduct(row) !== null && pickNumber(row, ["usage", "value", "count"]) !== null);

    if (matched.length === 0 && rows.length > 0) {
      return {
        trafficGb: 0,
        storageGb: 0,
        transcodingMinutes: 0,
        amountMinor: 0,
        rawJson: buildDebugRawJson({
          rows,
          requestedProjectId: projectId,
          filteredRowCount: filtered.rows.length,
          fallbackWithoutProjectFilter,
          reason: fallbackWithoutProjectFilter
            ? "Billing rows are only account-level and cannot be safely assigned to a workspace"
            : "Billing rows returned, but none matched workspace Kinescope project id",
        }),
      };
    }

    if (hasProductUsageRows) {
      const aggregated = matched.reduce<ProductUsageAccumulator>(
        (acc, row) => {
          const product = resolveUsageProduct(row);
          const usage = pickNumber(row, ["usage", "value", "count"]);
          const amountMinor = parseAmountMinor(row);
          const rowTimestamp = resolveRowTimestamp(row);

          if (product !== null && usage !== null) {
            if (product === "traffic") {
              acc.trafficBytes += usage;
            } else if (product === "storage") {
              if (acc.latestStorageAt === null || rowTimestamp === null || rowTimestamp >= acc.latestStorageAt) {
                acc.storageBytes = usage;
                acc.latestStorageAt = rowTimestamp;
              }
            } else {
              acc.transcodingMinutes += usage;
            }
          }

          acc.amountMinor += amountMinor ?? 0;
          return acc;
        },
        {
          trafficBytes: 0,
          storageBytes: 0,
          transcodingMinutes: 0,
          amountMinor: 0,
          latestStorageAt: null,
        },
      );

      return {
        trafficGb: toGigabytes(aggregated.trafficBytes),
        storageGb: toGigabytes(aggregated.storageBytes),
        transcodingMinutes: aggregated.transcodingMinutes,
        amountMinor: aggregated.amountMinor,
        rawJson: buildDebugRawJson({
          rows,
          requestedProjectId: projectId,
          filteredRowCount: filtered.rows.length,
          fallbackWithoutProjectFilter,
        }),
      };
    }

    const aggregate = matched.reduce<UsageMetrics>(
      (acc, row) => {
        const traffic = pickNumber(row, ["traffic_gb", "trafficGb", "traffic", "cdn_traffic_gb", "bandwidth_gb", "bandwidth"]);
        const storage = pickNumber(row, ["storage_gb", "storageGb", "storage"]);
        const transcoding = pickNumber(row, ["transcoding_minutes", "transcodingMinutes", "transcoding", "encoding_minutes"]);
        const amountMinor = parseAmountMinor(row);

        acc.trafficGb = (acc.trafficGb ?? 0) + (traffic ?? 0);
        acc.storageGb = (acc.storageGb ?? 0) + (storage ?? 0);
        acc.transcodingMinutes = (acc.transcodingMinutes ?? 0) + (transcoding ?? 0);
        acc.amountMinor = (acc.amountMinor ?? 0) + (amountMinor ?? 0);
        return acc;
      },
      {
        trafficGb: 0,
        storageGb: 0,
        transcodingMinutes: 0,
        amountMinor: 0,
        rawJson: buildDebugRawJson({
          rows,
          requestedProjectId: projectId,
          filteredRowCount: filtered.rows.length,
          fallbackWithoutProjectFilter,
        }),
      },
    );

    return aggregate;
  }
}

export const kinescopeBillingService = new KinescopeBillingService();
