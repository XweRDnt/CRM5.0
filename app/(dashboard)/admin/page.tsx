"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { BillingPlanCode, WorkspaceSubscriptionEventType } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/utils/client-api";

type PlanDTO = {
  code: BillingPlanCode;
  name: string;
  currency: string;
  priceMinor: number;
  isActive: boolean;
  sortOrder: number;
  maxProjects: number | null;
  maxMembers: number | null;
  maxTrafficGb: number | null;
  maxStorageGb: number | null;
  maxTranscodingMinutes: number | null;
};

type WorkspaceRow = {
  workspaceId: string;
  tenantId: string;
  workspaceName: string;
  owner: {
    userId: string;
    email: string;
    fullName: string;
  };
  registeredAt: string;
  isBlocked: boolean;
  hasDedicatedKinescopeProject: boolean;
  isLegacy: boolean;
  billingTrackingStartedAt: string | null;
  subscription: {
    plan: {
      code: BillingPlanCode;
      name: string;
      currency: string;
      priceMinor: number;
      maxProjects: number | null;
      maxMembers: number | null;
      maxTrafficGb: number | null;
      maxStorageGb: number | null;
      maxTranscodingMinutes: number | null;
    };
    currentPeriodStart: string;
    currentPeriodEnd: string;
  };
  usage: {
    trafficGb: number;
    storageGb: number;
    transcodingMinutes: number;
    amountMinor: number;
    fetchedAt: string;
    expiresAt: string;
  } | null;
};

type WorkspaceDetail = {
  workspace: {
    workspaceId: string;
    tenantId: string;
    workspaceName: string;
    registeredAt: string;
    isBlocked: boolean;
    owner: {
      userId: string;
      email: string;
      fullName: string;
    };
    memberCount: number;
    projectCount: number;
    kinescopeProjectId: string | null;
    kinescopeProjectName: string | null;
    kinescopeProjectProvisionedAt: string | null;
    billingTrackingStartedAt: string | null;
    isLegacy: boolean;
  };
  subscription: {
    plan: {
      code: BillingPlanCode;
      name: string;
      currency: string;
      priceMinor: number;
      maxProjects: number | null;
      maxMembers: number | null;
      maxTrafficGb: number | null;
      maxStorageGb: number | null;
      maxTranscodingMinutes: number | null;
    };
    currentPeriodStart: string;
    currentPeriodEnd: string;
    lastPayment: {
      amountMinor: number | null;
      currency: string | null;
      at: string | null;
      comment: string | null;
    };
  };
  usage: {
    trafficGb: number;
    storageGb: number;
    transcodingMinutes: number;
    amountMinor: number;
    periodStart: string;
    periodEnd: string;
    fetchedAt: string;
    expiresAt: string;
    reason: string | null;
  } | null;
  events: Array<{
    id: string;
    type: WorkspaceSubscriptionEventType;
    oldPlanCode: BillingPlanCode | null;
    newPlanCode: BillingPlanCode | null;
    paymentAmountMinor: number | null;
    paymentCurrency: string | null;
    paymentAt: string | null;
    comment: string | null;
    actorUserId: string | null;
    createdAt: string;
  }>;
};

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("ru-RU");
}

function formatMoney(minor: number | null | undefined, currency = "RUB"): string {
  if (minor === null || minor === undefined || !Number.isFinite(minor)) {
    return "-";
  }

  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

function formatLimit(value: number | null, unit: string): string {
  return value === null ? "∞" : `${value.toLocaleString("ru-RU")} ${unit}`;
}

function usagePercent(value: number, limit: number | null): number | null {
  if (limit === null || limit <= 0) {
    return null;
  }
  return Math.min(999, (value / limit) * 100);
}

function usageTone(percent: number | null): string {
  if (percent === null) {
    return "text-neutral-600";
  }
  if (percent >= 100) {
    return "text-red-600";
  }
  if (percent >= 80) {
    return "text-amber-600";
  }
  return "text-emerald-600";
}

function formatEventType(type: WorkspaceSubscriptionEventType): string {
  switch (type) {
    case WorkspaceSubscriptionEventType.PLAN_ASSIGNED:
      return "Тариф назначен";
    case WorkspaceSubscriptionEventType.PAYMENT_RECORDED:
      return "Платеж зафиксирован";
    case WorkspaceSubscriptionEventType.WORKSPACE_BLOCKED:
      return "Рабочее пространство заблокировано";
    case WorkspaceSubscriptionEventType.WORKSPACE_UNBLOCKED:
      return "Рабочее пространство разблокировано";
    case WorkspaceSubscriptionEventType.LIMIT_BLOCKED:
      return "Действие заблокировано лимитом";
    default:
      return type;
  }
}

function formatUsageReason(reason: string | null | undefined): string | null {
  if (!reason) {
    return null;
  }

  switch (reason) {
    case "KINESCOPE_API_TOKEN is missing":
      return "Kinescope billing недоступен: не задан KINESCOPE_API_TOKEN.";
    case "Workspace Kinescope project is not configured":
      return "Kinescope billing недоступен: у рабочего пространства нет выделенного Kinescope project.";
    default:
      return reason;
  }
}

type UsageRefreshResponse = {
  usage: {
    source: "cache" | "live" | "stale" | "unavailable";
    reason: string | null;
  };
};

export default function AdminPage(): JSX.Element {
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<"ALL" | BillingPlanCode>("ALL");
  const [blockFilter, setBlockFilter] = useState<"ALL" | "true" | "false">("ALL");
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);

  const [paymentAmountRub, setPaymentAmountRub] = useState("");
  const [paymentCurrency, setPaymentCurrency] = useState("RUB");
  const [paymentAt, setPaymentAt] = useState("");
  const [paymentComment, setPaymentComment] = useState("");
  const [nextPlanCode, setNextPlanCode] = useState<BillingPlanCode | null>(null);
  const [assigningPlan, setAssigningPlan] = useState(false);
  const [updatingBlock, setUpdatingBlock] = useState(false);
  const [refreshingUsage, setRefreshingUsage] = useState(false);
  const [planDrafts, setPlanDrafts] = useState<Record<BillingPlanCode, PlanDTO> | null>(null);
  const [savingPlanCode, setSavingPlanCode] = useState<BillingPlanCode | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) {
      params.set("q", search.trim());
    }
    if (planFilter !== "ALL") {
      params.set("plan", planFilter);
    }
    if (blockFilter !== "ALL") {
      params.set("blocked", blockFilter);
    }
    const encoded = params.toString();
    return encoded ? `?${encoded}` : "";
  }, [search, planFilter, blockFilter]);

  const { data: plans = [] } = useSWR(`/api/admin/plans`, apiFetch<PlanDTO[]>);
  const {
    data: workspaces = [],
    error: listError,
    mutate: mutateWorkspaces,
    isLoading: workspacesLoading,
  } = useSWR(`/api/admin/workspaces${queryString}`, apiFetch<WorkspaceRow[]>);

  const selectedWorkspace = useMemo(() => {
    if (!selectedWorkspaceId) {
      return null;
    }
    return workspaces.find((workspace) => workspace.workspaceId === selectedWorkspaceId) ?? null;
  }, [selectedWorkspaceId, workspaces]);

  const {
    data: detail,
    error: detailError,
    mutate: mutateDetail,
    isLoading: detailLoading,
  } = useSWR(
    selectedWorkspaceId ? `/api/admin/workspaces/${selectedWorkspaceId}` : null,
    apiFetch<WorkspaceDetail>,
  );

  const activePlanCode = detail?.subscription.plan.code ?? selectedWorkspace?.subscription.plan.code ?? null;

  const planOptions = useMemo(() => plans.filter((plan) => plan.isActive), [plans]);

  const resolvedNextPlanCode = nextPlanCode ?? activePlanCode;

  useEffect(() => {
    if (plans.length === 0) {
      return;
    }

    const next = plans.reduce<Record<BillingPlanCode, PlanDTO>>((acc, plan) => {
      acc[plan.code] = plan;
      return acc;
    }, {} as Record<BillingPlanCode, PlanDTO>);
    setPlanDrafts(next);
  }, [plans]);

  const updatePlanDraft = <K extends keyof PlanDTO>(
    code: BillingPlanCode,
    field: K,
    value: PlanDTO[K],
  ): void => {
    setPlanDrafts((current) => {
      if (!current?.[code]) {
        return current;
      }
      return {
        ...current,
        [code]: {
          ...current[code],
          [field]: value,
        },
      };
    });
  };

  const handleSavePlan = async (code: BillingPlanCode): Promise<void> => {
    const draft = planDrafts?.[code];
    if (!draft) {
      return;
    }

    setSavingPlanCode(code);
    try {
      await apiFetch(`/api/admin/plans/${code}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: draft.name,
          currency: draft.currency,
          priceMinor: draft.priceMinor,
          isActive: draft.isActive,
          sortOrder: draft.sortOrder,
          maxProjects: draft.maxProjects,
          maxMembers: draft.maxMembers,
          maxTrafficGb: draft.maxTrafficGb,
          maxStorageGb: draft.maxStorageGb,
          maxTranscodingMinutes: draft.maxTranscodingMinutes,
        }),
      });
      await mutateWorkspaces();
      toast.success(`Тариф "${draft.name}" обновлен`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось обновить тариф");
    } finally {
      setSavingPlanCode(null);
    }
  };

  const handleToggleWorkspace = async (): Promise<void> => {
    if (!detail) {
      return;
    }

    setUpdatingBlock(true);
    try {
      await apiFetch(`/api/admin/workspaces/${detail.workspace.workspaceId}/block`, {
        method: "PATCH",
        body: JSON.stringify({
          isBlocked: !detail.workspace.isBlocked,
        }),
      });
      await Promise.all([mutateWorkspaces(), mutateDetail()]);
      toast.success(detail.workspace.isBlocked ? "Рабочее пространство разблокировано" : "Рабочее пространство заблокировано");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось изменить статус рабочего пространства");
    } finally {
      setUpdatingBlock(false);
    }
  };

  const handleRefreshUsage = async (): Promise<void> => {
    if (!detail) {
      return;
    }

    setRefreshingUsage(true);
    try {
      const response = await apiFetch<UsageRefreshResponse>(`/api/admin/workspaces/${detail.workspace.workspaceId}/usage?force=1`);
      await Promise.all([mutateWorkspaces(), mutateDetail()]);
      const usageMessage = formatUsageReason(response.usage.reason);

      if (response.usage.source === "unavailable") {
        toast.error(usageMessage ?? "Kinescope billing сейчас недоступен");
        return;
      }

      if (response.usage.source === "stale") {
        toast.error(usageMessage ?? "Использование не обновилось, показан устаревший снапшот");
        return;
      }

      toast.success(response.usage.source === "live" ? "Использование обновлено из Kinescope" : "Показан кэшированный usage snapshot");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось обновить использование");
    } finally {
      setRefreshingUsage(false);
    }
  };

  const handleAssignPlan = async (): Promise<void> => {
    if (!detail || !resolvedNextPlanCode) {
      return;
    }

    const amountRub = Number(paymentAmountRub);
    if (!Number.isFinite(amountRub) || amountRub < 0) {
      toast.error("Введите корректную сумму платежа");
      return;
    }

    if (!paymentAt) {
      toast.error("Выберите дату и время платежа");
      return;
    }

    if (!paymentComment.trim()) {
      toast.error("Комментарий к платежу обязателен");
      return;
    }

    setAssigningPlan(true);
    try {
      await apiFetch(`/api/admin/workspaces/${detail.workspace.workspaceId}/subscription`, {
        method: "PATCH",
        body: JSON.stringify({
          planCode: resolvedNextPlanCode,
          paymentAmountMinor: Math.round(amountRub * 100),
          paymentCurrency,
          paymentAt: new Date(paymentAt).toISOString(),
          paymentComment: paymentComment.trim(),
        }),
      });

      await Promise.all([mutateWorkspaces(), mutateDetail()]);
      toast.success("Тариф обновлен");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось обновить подписку");
    } finally {
      setAssigningPlan(false);
    }
  };

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Центр управления</h1>
        <p className="text-sm text-neutral-500">Ручные тарифы, использование Kinescope по рабочим пространствам и контроль запуска первых платных пользователей.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Фильтры</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск рабочего пространства" />
          <Select value={planFilter} onValueChange={(value) => setPlanFilter(value as typeof planFilter)}>
            <SelectTrigger>
              <SelectValue placeholder="Тариф" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Все тарифы</SelectItem>
              {plans.map((plan) => (
                <SelectItem key={plan.code} value={plan.code}>
                  {plan.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={blockFilter} onValueChange={(value) => setBlockFilter(value as typeof blockFilter)}>
            <SelectTrigger>
              <SelectValue placeholder="Статус рабочего пространства" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Все статусы</SelectItem>
              <SelectItem value="false">Активен</SelectItem>
              <SelectItem value="true">Заблокирован</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Тарифы</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!planDrafts ? (
              <p className="text-sm text-neutral-600">Загрузка тарифов...</p>
            ) : (
              plans.map((plan) => {
                const draft = planDrafts[plan.code];
                if (!draft) {
                  return null;
                }

                return (
                  <div key={plan.code} className="grid gap-2 rounded-lg border border-neutral-200 p-3 lg:grid-cols-7">
                    <div className="space-y-1">
                      <Label>Название</Label>
                      <Input value={draft.name} onChange={(event) => updatePlanDraft(plan.code, "name", event.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Цена (в копейках)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={draft.priceMinor}
                        onChange={(event) => updatePlanDraft(plan.code, "priceMinor", Number(event.target.value))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Проекты</Label>
                      <Input
                        value={draft.maxProjects ?? ""}
                        onChange={(event) =>
                          updatePlanDraft(
                            plan.code,
                            "maxProjects",
                            event.target.value === "" ? null : Math.max(0, Number(event.target.value)),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Участники</Label>
                      <Input
                        value={draft.maxMembers ?? ""}
                        onChange={(event) =>
                          updatePlanDraft(
                            plan.code,
                            "maxMembers",
                            event.target.value === "" ? null : Math.max(0, Number(event.target.value)),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Трафик, ГБ</Label>
                      <Input
                        value={draft.maxTrafficGb ?? ""}
                        onChange={(event) =>
                          updatePlanDraft(
                            plan.code,
                            "maxTrafficGb",
                            event.target.value === "" ? null : Math.max(0, Number(event.target.value)),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Хранилище, ГБ</Label>
                      <Input
                        value={draft.maxStorageGb ?? ""}
                        onChange={(event) =>
                          updatePlanDraft(
                            plan.code,
                            "maxStorageGb",
                            event.target.value === "" ? null : Math.max(0, Number(event.target.value)),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Транскодинг, мин</Label>
                      <Input
                        value={draft.maxTranscodingMinutes ?? ""}
                        onChange={(event) =>
                          updatePlanDraft(
                            plan.code,
                            "maxTranscodingMinutes",
                            event.target.value === "" ? null : Math.max(0, Number(event.target.value)),
                          )
                        }
                      />
                    </div>
                    <div className="col-span-full flex items-center justify-between gap-3 border-t border-neutral-200 pt-2">
                      <label className="flex items-center gap-2 text-sm text-neutral-700">
                        <input
                          type="checkbox"
                          checked={draft.isActive}
                          onChange={(event) => updatePlanDraft(plan.code, "isActive", event.target.checked)}
                        />
                        Активен
                      </label>
                      <Button size="sm" onClick={() => void handleSavePlan(plan.code)} disabled={savingPlanCode === plan.code}>
                        {savingPlanCode === plan.code ? "Сохранение..." : "Сохранить тариф"}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Рабочие пространства</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {workspacesLoading ? (
              <p className="text-sm text-neutral-600">Загрузка рабочих пространств...</p>
            ) : listError ? (
              <p className="text-sm text-red-600">{listError instanceof Error ? listError.message : "Не удалось загрузить список рабочих пространств"}</p>
            ) : workspaces.length === 0 ? (
              <p className="text-sm text-neutral-600">Рабочие пространства не найдены.</p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-50 text-left">
                  <tr>
                    <th className="px-3 py-2">Рабочее пространство</th>
                    <th className="px-3 py-2">Тариф</th>
                    <th className="px-3 py-2">Статус</th>
                    <th className="px-3 py-2">Трафик</th>
                    <th className="px-3 py-2">Обновлено</th>
                  </tr>
                </thead>
                <tbody>
                  {workspaces.map((workspace) => {
                    const active = selectedWorkspaceId === workspace.workspaceId;
                    return (
                      <tr
                        key={workspace.workspaceId}
                        className={`cursor-pointer border-t border-neutral-200 ${active ? "bg-blue-50" : "hover:bg-neutral-50"}`}
                        onClick={() => {
                          setSelectedWorkspaceId(workspace.workspaceId);
                          setNextPlanCode(workspace.subscription.plan.code);
                        }}
                      >
                        <td className="px-3 py-2">
                          <p className="font-medium">{workspace.workspaceName}</p>
                          <p className="text-xs text-neutral-500">{workspace.owner.email}</p>
                        </td>
                        <td className="px-3 py-2">{workspace.subscription.plan.name}</td>
                        <td className="px-3 py-2">{workspace.isBlocked ? "Заблокирован" : "Активен"}</td>
                        <td className="px-3 py-2">{workspace.usage ? `${workspace.usage.trafficGb.toFixed(2)} GB` : "-"}</td>
                        <td className="px-3 py-2">{workspace.usage ? formatDate(workspace.usage.fetchedAt) : "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Детали рабочего пространства</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedWorkspaceId ? (
              <p className="text-sm text-neutral-600">Выберите рабочее пространство в таблице.</p>
            ) : detailLoading ? (
              <p className="text-sm text-neutral-600">Загрузка деталей...</p>
            ) : detailError ? (
              <p className="text-sm text-red-600">{detailError instanceof Error ? detailError.message : "Не удалось загрузить детали"}</p>
            ) : !detail ? (
              <p className="text-sm text-neutral-600">Нет данных для отображения.</p>
            ) : (
              <>
                <div className="space-y-1 rounded-lg border border-neutral-200 p-3 text-sm">
                  <p className="font-medium">{detail.workspace.workspaceName}</p>
                  <p className="text-neutral-600">Владелец: {detail.workspace.owner.email}</p>
                  <p className="text-neutral-600">Проекты: {detail.workspace.projectCount}</p>
                  <p className="text-neutral-600">Участники: {detail.workspace.memberCount}</p>
                  <p className="text-neutral-600">Дата регистрации: {formatDate(detail.workspace.registeredAt)}</p>
                  <p className="text-neutral-600">Проект Kinescope: {detail.workspace.kinescopeProjectId ?? "не создан"}</p>
                  {detail.workspace.isLegacy ? (
                    <p className="text-amber-700">Legacy-режим: точный биллинг по workspace доступен с даты запуска трекинга.</p>
                  ) : null}
                </div>

                <div className="space-y-1 rounded-lg border border-neutral-200 p-3 text-sm">
                  <p className="font-medium">Текущий тариф: {detail.subscription.plan.name}</p>
                  <p className="text-neutral-600">Период: {formatDate(detail.subscription.currentPeriodStart)} - {formatDate(detail.subscription.currentPeriodEnd)}</p>
                  <p className="text-neutral-600">Цена: {formatMoney(detail.subscription.plan.priceMinor, detail.subscription.plan.currency)}</p>
                  <p className="text-neutral-600">Лимит проектов: {formatLimit(detail.subscription.plan.maxProjects, "шт.")}</p>
                  <p className="text-neutral-600">Лимит участников: {formatLimit(detail.subscription.plan.maxMembers, "шт.")}</p>
                  <p className="text-neutral-600">Лимит трафика: {formatLimit(detail.subscription.plan.maxTrafficGb, "ГБ")}</p>
                  <p className="text-neutral-600">Лимит хранилища: {formatLimit(detail.subscription.plan.maxStorageGb, "ГБ")}</p>
                  <p className="text-neutral-600">Лимит транскодинга: {formatLimit(detail.subscription.plan.maxTranscodingMinutes, "мин")}</p>
                  <p className="text-neutral-600">Последний платеж: {formatMoney(detail.subscription.lastPayment.amountMinor, detail.subscription.lastPayment.currency ?? "RUB")}</p>
                  <p className="text-neutral-600">Дата платежа: {formatDate(detail.subscription.lastPayment.at)}</p>
                </div>

                <div className="space-y-2 rounded-lg border border-neutral-200 p-3 text-sm">
                  <p className="font-medium">Использование (billing Kinescope)</p>
                  {detail.usage?.reason ? <p className="text-amber-700">{formatUsageReason(detail.usage.reason)}</p> : null}
                  <p className={usageTone(usagePercent(detail.usage?.trafficGb ?? 0, detail.subscription.plan.maxTrafficGb))}>
                    Трафик: {(detail.usage?.trafficGb ?? 0).toFixed(2)} GB
                    {detail.subscription.plan.maxTrafficGb !== null ? ` / ${detail.subscription.plan.maxTrafficGb.toFixed(2)} GB` : " / ∞"}
                  </p>
                  <p className={usageTone(usagePercent(detail.usage?.storageGb ?? 0, detail.subscription.plan.maxStorageGb))}>
                    Хранилище: {(detail.usage?.storageGb ?? 0).toFixed(2)} GB
                    {detail.subscription.plan.maxStorageGb !== null ? ` / ${detail.subscription.plan.maxStorageGb.toFixed(2)} GB` : " / ∞"}
                  </p>
                  <p className={usageTone(usagePercent(detail.usage?.transcodingMinutes ?? 0, detail.subscription.plan.maxTranscodingMinutes))}>
                    Транскодинг: {(detail.usage?.transcodingMinutes ?? 0).toFixed(2)} мин
                    {detail.subscription.plan.maxTranscodingMinutes !== null
                      ? ` / ${detail.subscription.plan.maxTranscodingMinutes.toFixed(2)} мин`
                      : " / ∞"}
                  </p>
                  <p>Оценочная сумма: {formatMoney(detail.usage?.amountMinor, "RUB")}</p>
                  <p className="text-neutral-600">Синхронизировано: {formatDate(detail.usage?.fetchedAt)}</p>
                  <Button variant="outline" size="sm" onClick={() => void handleRefreshUsage()} disabled={refreshingUsage}>
                    {refreshingUsage ? "Обновление..." : "Обновить использование"}
                  </Button>
                </div>

                <div className="space-y-3 rounded-lg border border-neutral-200 p-3 text-sm">
                  <p className="font-medium">Ручное назначение тарифа</p>
                  <div className="grid gap-3">
                    <div className="space-y-1">
                      <Label>Тариф</Label>
                      <Select value={resolvedNextPlanCode ?? ""} onValueChange={(value) => setNextPlanCode(value as BillingPlanCode)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите тариф" />
                        </SelectTrigger>
                        <SelectContent>
                          {planOptions.map((plan) => (
                            <SelectItem key={plan.code} value={plan.code}>
                              {plan.name} ({formatMoney(plan.priceMinor, plan.currency)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label>Сумма платежа (RUB)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={paymentAmountRub}
                        onChange={(event) => setPaymentAmountRub(event.target.value)}
                        placeholder="2900"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Валюта платежа</Label>
                      <Input value={paymentCurrency} onChange={(event) => setPaymentCurrency(event.target.value.toUpperCase())} placeholder="RUB" />
                    </div>

                    <div className="space-y-1">
                      <Label>Дата платежа</Label>
                      <Input type="datetime-local" value={paymentAt} onChange={(event) => setPaymentAt(event.target.value)} />
                    </div>

                    <div className="space-y-1">
                      <Label>Комментарий</Label>
                      <Textarea value={paymentComment} onChange={(event) => setPaymentComment(event.target.value)} rows={3} />
                    </div>
                  </div>
                  <Button onClick={() => void handleAssignPlan()} disabled={assigningPlan}>
                    {assigningPlan ? "Сохранение..." : "Применить тариф"}
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant={detail.workspace.isBlocked ? "outline" : "destructive"} onClick={() => void handleToggleWorkspace()} disabled={updatingBlock}>
                    {updatingBlock ? "Обновление..." : detail.workspace.isBlocked ? "Разблокировать рабочее пространство" : "Заблокировать рабочее пространство"}
                  </Button>
                </div>

                <div className="space-y-2 rounded-lg border border-neutral-200 p-3 text-sm">
                  <p className="font-medium">События подписки</p>
                  {detail.events.length === 0 ? (
                    <p className="text-neutral-600">Событий пока нет.</p>
                  ) : (
                    <div className="max-h-56 space-y-2 overflow-auto">
                      {detail.events.map((event) => (
                        <article key={event.id} className="rounded border border-neutral-200 p-2">
                          <p className="font-medium">{formatEventType(event.type)}</p>
                          <p className="text-xs text-neutral-500">{formatDate(event.createdAt)}</p>
                          <p className="text-xs text-neutral-600">
                            {event.oldPlanCode ?? "-"} {"->"} {event.newPlanCode ?? "-"}
                          </p>
                          <p className="text-xs text-neutral-600">
                            Платеж: {formatMoney(event.paymentAmountMinor, event.paymentCurrency ?? "RUB")}
                          </p>
                          {event.comment ? <p className="text-xs text-neutral-700">{event.comment}</p> : null}
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
