import { BillingPlanCode, WorkspaceSubscriptionEventType } from "@prisma/client";
import type { WorkspaceRow } from "./types";

export type AdminSection = "overview" | "workspaces" | "plans";

export function getAdminSection(pathname: string): AdminSection {
  if (pathname === "/admin/plans" || pathname.startsWith("/admin/plans/")) {
    return "plans";
  }
  if (pathname === "/admin/workspaces" || pathname.startsWith("/admin/workspaces/")) {
    return "workspaces";
  }
  return "overview";
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ru-RU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatMoney(minor: number | null | undefined, currency = "RUB"): string {
  if (minor === null || minor === undefined || !Number.isFinite(minor)) return "-";
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100);
}

export function formatLimit(value: number | null, unit: string): string {
  return value === null ? "∞" : `${value.toLocaleString("ru-RU")} ${unit}`;
}

export function formatByteSize(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let current = value;
  let unitIndex = 0;
  while (current >= 1000 && unitIndex < units.length - 1) {
    current /= 1000;
    unitIndex += 1;
  }
  const digits = unitIndex === 0 ? 0 : current >= 100 ? 0 : current >= 10 ? 1 : 2;
  return `${current.toLocaleString("ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${units[unitIndex]}`;
}

export function metricPercent(value: number, limit: number | null): number {
  if (!Number.isFinite(value) || limit === null || !Number.isFinite(limit) || limit <= 0) return 0;
  return (value / limit) * 100;
}

export function workspaceUsagePercent(workspace: WorkspaceRow): number {
  if (!workspace.usage) return 0;
  const plan = workspace.subscription.plan;
  return Math.max(
    metricPercent(workspace.usage.trafficGb, plan.maxTrafficGb),
    metricPercent(workspace.usage.storageGb, plan.maxStorageGb),
    metricPercent(workspace.usage.transcodingMinutes, plan.maxTranscodingMinutes),
  );
}

export function usageToneClasses(percent: number): string {
  if (percent >= 100) return "text-red-600";
  if (percent >= 80) return "text-amber-600";
  return "text-neutral-700";
}

export function usageBarClasses(percent: number): string {
  if (percent >= 100) return "bg-red-500";
  if (percent >= 80) return "bg-amber-500";
  return "bg-emerald-500";
}

export function planBadgeVariant(code: BillingPlanCode): "secondary" | "default" | "success" {
  switch (code) {
    case BillingPlanCode.FREE:
      return "secondary";
    case BillingPlanCode.START:
      return "default";
    default:
      return "success";
  }
}

export function formatEventType(type: WorkspaceSubscriptionEventType): string {
  switch (type) {
    case WorkspaceSubscriptionEventType.PLAN_ASSIGNED:
      return "Тариф назначен";
    case WorkspaceSubscriptionEventType.PAYMENT_RECORDED:
      return "Платеж зафиксирован";
    case WorkspaceSubscriptionEventType.WORKSPACE_BLOCKED:
      return "Workspace заблокирован";
    case WorkspaceSubscriptionEventType.WORKSPACE_UNBLOCKED:
      return "Workspace разблокирован";
    case WorkspaceSubscriptionEventType.LIMIT_BLOCKED:
      return "Действие заблокировано лимитом";
    default:
      return type;
  }
}

export function formatUsageReason(reason: string | null | undefined): string | null {
  if (!reason) return null;
  switch (reason) {
    case "KINESCOPE_API_TOKEN is missing":
      return "Kinescope billing недоступен: не задан KINESCOPE_API_TOKEN.";
    case "Workspace Kinescope project is not configured":
      return "У workspace нет выделенного Kinescope project.";
    case "Billing rows returned, but none matched workspace Kinescope project id":
      return "Kinescope usage пришёл на другой project_id и не совпал с этим workspace.";
    case "Billing rows are only account-level and cannot be safely assigned to a workspace":
      return "Kinescope billing сейчас отдаёт только общие цифры аккаунта.";
    case "Using local workspace estimate because Kinescope billing API returned only account-level rows":
    case "Using local workspace estimate because Kinescope billing rows did not match workspace project id":
      return "Показана локальная оценка usage по загрузкам этого workspace.";
    default:
      return reason;
  }
}

export function sectionTitle(section: AdminSection): { title: string; description: string } {
  switch (section) {
    case "workspaces":
      return { title: "Workspace", description: "Список клиентов, фильтры по usage и быстрые owner-действия." };
    case "plans":
      return { title: "Тарифы", description: "Те же рабочие тарифы, но в более чистой и мобильной оболочке." };
    default:
      return { title: "Admin", description: "Короткий owner-обзор: состояние бизнеса, риски и точки внимания." };
  }
}
