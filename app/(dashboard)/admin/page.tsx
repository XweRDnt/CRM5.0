"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { BillingPlanCode } from "@prisma/client";
import { AlertTriangle, MoreHorizontal } from "lucide-react";
import { AdminTopNav } from "@/components/admin/AdminTopNav";
import {
  formatByteSize,
  formatDate,
  formatEventType,
  formatLimit,
  formatMoney,
  formatUsageReason,
  getAdminSection,
  planBadgeVariant,
  sectionTitle,
  usageBarClasses,
  usageToneClasses,
  workspaceUsagePercent,
} from "@/components/admin/admin-utils";
import type { PlanDTO, UsageRefreshResponse, WorkspaceDetail, WorkspaceRow } from "@/components/admin/types";
import { matchesWorkspaceFilter, resolveWorkspaceFilter, type WorkspaceFilter } from "@/components/admin/workspace-filters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/utils/client-api";

const workspaceFilterOptions: Array<{ value: WorkspaceFilter; label: string }> = [
  { value: "all", label: "Все" },
  { value: "paid", label: "Платящие" },
  { value: "free", label: "FREE" },
  { value: "high", label: "Usage > 80%" },
  { value: "inactive", label: "Неактивные" },
];

function OverviewStatCard({
  label,
  value,
  tone = "text-white",
}: {
  label: string;
  value: number;
  tone?: string;
}): JSX.Element {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">{label}</p>
        <p className={`mt-3 text-3xl font-semibold ${tone}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

export default function AdminPage(): JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const detailRef = useRef<HTMLDivElement | null>(null);

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [paymentAmountRub, setPaymentAmountRub] = useState("");
  const [paymentCurrency, setPaymentCurrency] = useState("RUB");
  const [paymentAt, setPaymentAt] = useState("");
  const [paymentComment, setPaymentComment] = useState("");
  const [nextPlanCode, setNextPlanCode] = useState<BillingPlanCode | null>(null);
  const [assigningPlan, setAssigningPlan] = useState(false);
  const [updatingWorkspaceId, setUpdatingWorkspaceId] = useState<string | null>(null);
  const [refreshingUsage, setRefreshingUsage] = useState(false);
  const [planDrafts, setPlanDrafts] = useState<Record<BillingPlanCode, PlanDTO> | null>(null);
  const [savingPlanCode, setSavingPlanCode] = useState<BillingPlanCode | null>(null);

  const section = getAdminSection(pathname);
  const currentFilter = resolveWorkspaceFilter(searchParams.get("filter"));

  const { data: plans = [] } = useSWR("/api/admin/plans", apiFetch<PlanDTO[]>);
  const {
    data: workspaces = [],
    error: listError,
    mutate: mutateWorkspaces,
    isLoading: workspacesLoading,
  } = useSWR("/api/admin/workspaces", apiFetch<WorkspaceRow[]>);

  const filteredWorkspaces = useMemo(
    () => workspaces.filter((workspace) => matchesWorkspaceFilter(workspace, currentFilter)),
    [currentFilter, workspaces],
  );

  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.workspaceId === selectedWorkspaceId) ?? null,
    [selectedWorkspaceId, workspaces],
  );

  const {
    data: detail,
    error: detailError,
    mutate: mutateDetail,
    isLoading: detailLoading,
  } = useSWR(selectedWorkspaceId ? `/api/admin/workspaces/${selectedWorkspaceId}` : null, apiFetch<WorkspaceDetail>);

  const activePlanCode = detail?.subscription.plan.code ?? selectedWorkspace?.subscription.plan.code ?? null;
  const resolvedNextPlanCode = nextPlanCode ?? activePlanCode;
  const planOptions = useMemo(() => plans.filter((plan) => plan.isActive), [plans]);

  useEffect(() => {
    if (plans.length === 0) return;
    setPlanDrafts(Object.fromEntries(plans.map((plan) => [plan.code, plan])) as Record<BillingPlanCode, PlanDTO>);
  }, [plans]);

  useEffect(() => {
    if (section !== "workspaces") return;
    if (filteredWorkspaces.length === 0) {
      setSelectedWorkspaceId(null);
      return;
    }
    if (!selectedWorkspaceId || !filteredWorkspaces.some((workspace) => workspace.workspaceId === selectedWorkspaceId)) {
      setSelectedWorkspaceId(filteredWorkspaces[0].workspaceId);
      setNextPlanCode(filteredWorkspaces[0].subscription.plan.code);
    }
  }, [filteredWorkspaces, section, selectedWorkspaceId]);

  const stats = useMemo(() => {
    const total = workspaces.length;
    const paid = workspaces.filter((workspace) => workspace.subscription.plan.code !== BillingPlanCode.FREE).length;
    const free = workspaces.filter((workspace) => workspace.subscription.plan.code === BillingPlanCode.FREE).length;
    const high = workspaces.filter((workspace) => matchesWorkspaceFilter(workspace, "high")).length;
    const inactive = workspaces.filter((workspace) => matchesWorkspaceFilter(workspace, "inactive")).length;
    const blocked = workspaces.filter((workspace) => workspace.isBlocked).length;
    const billing = workspaces.filter((workspace) => workspace.isLegacy || !workspace.hasDedicatedKinescopeProject).length;
    return { total, paid, free, high, inactive, blocked, billing };
  }, [workspaces]);

  const alerts = [
    {
      key: "high",
      count: stats.high,
      title: "workspace с usage выше 80%",
      description: "Могут упереться в лимит текущего тарифа.",
      href: "/admin/workspaces?filter=high",
      action: "Посмотреть",
    },
    {
      key: "inactive",
      count: stats.inactive,
      title: "workspace неактивны",
      description: "Есть регистрации без заметного использования продукта.",
      href: "/admin/workspaces?filter=inactive",
      action: "Открыть",
    },
    {
      key: "blocked",
      count: stats.blocked,
      title: "workspace заблокированы",
      description: "Нужно проверить блокировки и причину ограничения.",
      href: "/admin/workspaces",
      action: "Проверить",
    },
    {
      key: "billing",
      count: stats.billing,
      title: "workspace с billing / setup вопросами",
      description: "Есть пространства без полного billing- или Kinescope-конфига.",
      href: "/admin/workspaces",
      action: "Разобрать",
    },
  ].filter((alert) => alert.count > 0);

  const changeWorkspaceFilter = (filter: WorkspaceFilter): void => {
    router.push(filter === "all" ? "/admin/workspaces" : `/admin/workspaces?filter=${filter}`);
  };

  const focusWorkspace = (workspace: WorkspaceRow): void => {
    setSelectedWorkspaceId(workspace.workspaceId);
    setNextPlanCode(workspace.subscription.plan.code);
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const handleToggleWorkspaceById = async (workspaceId: string, isBlocked: boolean): Promise<void> => {
    setUpdatingWorkspaceId(workspaceId);
    try {
      await apiFetch(`/api/admin/workspaces/${workspaceId}/block`, {
        method: "PATCH",
        body: JSON.stringify({ isBlocked: !isBlocked }),
      });
      await mutateWorkspaces();
      if (selectedWorkspaceId === workspaceId) await mutateDetail();
      toast.success(isBlocked ? "Workspace разблокирован" : "Workspace заблокирован");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось изменить статус workspace");
    } finally {
      setUpdatingWorkspaceId(null);
    }
  };

  const handleRefreshUsage = async (): Promise<void> => {
    if (!detail) return;
    setRefreshingUsage(true);
    try {
      const response = await apiFetch<UsageRefreshResponse>(`/api/admin/workspaces/${detail.workspace.workspaceId}/usage?force=1`);
      await Promise.all([mutateWorkspaces(), mutateDetail()]);
      const usageMessage = formatUsageReason(response.usage.reason);
      if (response.usage.source === "unavailable" || response.usage.source === "stale") {
        toast.error(usageMessage ?? "Использование сейчас недоступно");
      } else if (response.usage.source === "local") {
        const estimate = response.usage.localEstimate;
        toast.success(
          estimate
            ? `${usageMessage ?? "Показана локальная оценка usage"} Учтено ${estimate.uniqueVideoCount} видео и ${formatByteSize(estimate.storageBytes)}.`
            : usageMessage ?? "Показана локальная оценка usage",
        );
      } else {
        toast.success(response.usage.source === "live" ? "Использование обновлено из Kinescope" : "Показан кэшированный usage snapshot");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось обновить использование");
    } finally {
      setRefreshingUsage(false);
    }
  };

  const handleAssignPlan = async (): Promise<void> => {
    if (!detail || !resolvedNextPlanCode) return;
    const amountRub = Number(paymentAmountRub);
    if (!Number.isFinite(amountRub) || amountRub < 0) return toast.error("Введите корректную сумму платежа");
    if (!paymentAt) return toast.error("Выберите дату и время платежа");
    if (!paymentComment.trim()) return toast.error("Комментарий к платежу обязателен");
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
      toast.success("Тариф обновлён");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось обновить подписку");
    } finally {
      setAssigningPlan(false);
    }
  };

  const updatePlanDraft = <K extends keyof PlanDTO>(code: BillingPlanCode, field: K, value: PlanDTO[K]): void => {
    setPlanDrafts((current) => (current?.[code] ? { ...current, [code]: { ...current[code], [field]: value } } : current));
  };

  const handleSavePlan = async (code: BillingPlanCode): Promise<void> => {
    const draft = planDrafts?.[code];
    if (!draft) return;
    setSavingPlanCode(code);
    try {
      await apiFetch(`/api/admin/plans/${code}`, { method: "PATCH", body: JSON.stringify(draft) });
      toast.success(`Тариф "${draft.name}" обновлён`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось обновить тариф");
    } finally {
      setSavingPlanCode(null);
    }
  };

  const header = sectionTitle(section);

  return (
    <section className="space-y-5">
      <header className="space-y-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-white">{header.title}</h1>
          <p className="max-w-2xl text-sm text-slate-400">{header.description}</p>
        </div>
        <AdminTopNav />
      </header>

      {section === "overview" && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <OverviewStatCard label="Всего workspace" value={stats.total} />
            <OverviewStatCard label="Платящие" value={stats.paid} tone="text-emerald-300" />
            <OverviewStatCard label="На FREE" value={stats.free} tone="text-slate-100" />
            <OverviewStatCard label="Usage > 80%" value={stats.high} tone="text-amber-300" />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-400">Требует внимания</h2>
            </div>

            {alerts.length === 0 ? (
              <Card>
                <CardContent className="p-4 text-sm text-slate-300">Сейчас критичных owner-сигналов нет.</CardContent>
              </Card>
            ) : (
              alerts.map((alert) => (
                <Card key={alert.key} className="overflow-hidden">
                  <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <p className="font-medium text-white">
                        {alert.count} {alert.title}
                      </p>
                      <p className="text-sm text-slate-400">{alert.description}</p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href={alert.href}>{alert.action}</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {section === "workspaces" && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {workspaceFilterOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={currentFilter === option.value ? "default" : "outline"}
                size="sm"
                onClick={() => changeWorkspaceFilter(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          {workspacesLoading ? (
            <Card>
              <CardContent className="p-4 text-sm text-slate-300">Загрузка workspace...</CardContent>
            </Card>
          ) : listError ? (
            <Card>
              <CardContent className="p-4 text-sm text-rose-300">
                {listError instanceof Error ? listError.message : "Не удалось загрузить список workspace"}
              </CardContent>
            </Card>
          ) : filteredWorkspaces.length === 0 ? (
            <Card>
              <CardContent className="p-4 text-sm text-slate-300">Под выбранный фильтр workspace не найдены.</CardContent>
            </Card>
          ) : (
            <>
              <Card className="hidden md:block">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="admin-table-head text-left text-xs uppercase tracking-[0.14em] text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Workspace</th>
                          <th className="px-4 py-3">Тариф</th>
                          <th className="px-4 py-3">Usage</th>
                          <th className="px-4 py-3">Регистрация</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredWorkspaces.map((workspace) => {
                          const percent = workspaceUsagePercent(workspace);
                          const busy = updatingWorkspaceId === workspace.workspaceId;

                          return (
                            <tr key={workspace.workspaceId} className="admin-table-row transition-colors">
                              <td className="px-4 py-3">
                                <button type="button" className="text-left" onClick={() => focusWorkspace(workspace)}>
                                  <p className="font-medium text-white">{workspace.workspaceName}</p>
                                  <p className="text-xs text-slate-400">{workspace.owner.email}</p>
                                </button>
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant={planBadgeVariant(workspace.subscription.plan.code)}>{workspace.subscription.plan.code}</Badge>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <span className={`w-12 text-xs font-medium ${usageToneClasses(percent)}`}>{Math.round(percent)}%</span>
                                  <div className="h-2 w-24 overflow-hidden rounded-full bg-white/10">
                                    <div
                                      className={`h-full rounded-full ${usageBarClasses(percent)}`}
                                      style={{ width: `${Math.min(100, Math.max(6, percent))}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-slate-400">{formatDate(workspace.registeredAt)}</td>
                              <td className="px-4 py-3 text-right">
                                <details className="relative inline-block text-left">
                                  <summary className="inline-flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </summary>
                                  <div className="admin-menu absolute right-0 z-10 mt-2 w-48 overflow-hidden rounded-xl">
                                    <button
                                      type="button"
                                      className="block w-full px-4 py-2.5 text-left text-sm text-slate-100 hover:bg-white/[0.05]"
                                      onClick={() => focusWorkspace(workspace)}
                                    >
                                      Сменить тариф
                                    </button>
                                    <button
                                      type="button"
                                      className="block w-full px-4 py-2.5 text-left text-sm text-slate-100 hover:bg-white/[0.05]"
                                      onClick={() => focusWorkspace(workspace)}
                                    >
                                      Открыть workspace
                                    </button>
                                    <button
                                      type="button"
                                      className="block w-full px-4 py-2.5 text-left text-sm text-rose-300 hover:bg-rose-500/10 disabled:opacity-60"
                                      onClick={() => void handleToggleWorkspaceById(workspace.workspaceId, workspace.isBlocked)}
                                      disabled={busy}
                                    >
                                      {busy ? "Обновление..." : workspace.isBlocked ? "Разблокировать" : "Заблокировать"}
                                    </button>
                                  </div>
                                </details>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-3 md:hidden">
                {filteredWorkspaces.map((workspace) => {
                  const percent = workspaceUsagePercent(workspace);
                  const busy = updatingWorkspaceId === workspace.workspaceId;

                  return (
                    <Card key={workspace.workspaceId}>
                      <CardContent className="space-y-4 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-white">{workspace.workspaceName}</p>
                            <p className="text-xs text-slate-400">{workspace.owner.email}</p>
                          </div>
                          <Badge variant={planBadgeVariant(workspace.subscription.plan.code)}>{workspace.subscription.plan.code}</Badge>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">Usage</span>
                            <span className={usageToneClasses(percent)}>{Math.round(percent)}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-white/10">
                            <div
                              className={`h-full rounded-full ${usageBarClasses(percent)}`}
                              style={{ width: `${Math.min(100, Math.max(6, percent))}%` }}
                            />
                          </div>
                          <p className="text-xs text-slate-400">Регистрация: {formatDate(workspace.registeredAt)}</p>
                        </div>

                        <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => focusWorkspace(workspace)}>
                            Детали
                          </Button>
                          <Button type="button" size="sm" onClick={() => focusWorkspace(workspace)}>
                            Сменить тариф
                          </Button>
                          <details className="relative">
                            <summary className="inline-flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]">
                              <MoreHorizontal className="h-4 w-4" />
                            </summary>
                            <div className="admin-menu absolute right-0 z-10 mt-2 w-44 overflow-hidden rounded-xl">
                              <button
                                type="button"
                                className="block w-full px-4 py-2.5 text-left text-sm text-rose-300 hover:bg-rose-500/10 disabled:opacity-60"
                                onClick={() => void handleToggleWorkspaceById(workspace.workspaceId, workspace.isBlocked)}
                                disabled={busy}
                              >
                                {busy ? "Обновление..." : workspace.isBlocked ? "Разблокировать" : "Заблокировать"}
                              </button>
                            </div>
                          </details>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div ref={detailRef}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base text-white">Детали workspace</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!selectedWorkspaceId ? (
                      <p className="text-sm text-slate-300">Выберите workspace из списка.</p>
                    ) : detailLoading ? (
                      <p className="text-sm text-slate-300">Загрузка деталей...</p>
                    ) : detailError ? (
                      <p className="text-sm text-rose-300">{detailError instanceof Error ? detailError.message : "Не удалось загрузить детали"}</p>
                    ) : !detail ? (
                      <p className="text-sm text-slate-300">Нет данных для отображения.</p>
                    ) : (
                      <>
                        <div className="grid gap-4 lg:grid-cols-3">
                          <Card className="shadow-none">
                            <CardContent className="space-y-2 p-4 text-sm">
                              <p className="font-medium text-white">{detail.workspace.workspaceName}</p>
                              <p className="text-slate-400">Владелец: {detail.workspace.owner.email}</p>
                              <p className="text-slate-400">Проекты: {detail.workspace.projectCount}</p>
                              <p className="text-slate-400">Участники: {detail.workspace.memberCount}</p>
                              <p className="text-slate-400">Регистрация: {formatDate(detail.workspace.registeredAt)}</p>
                              <p className="text-slate-400">Kinescope project: {detail.workspace.kinescopeProjectId ?? "не создан"}</p>
                              <Badge variant={detail.workspace.isBlocked ? "error" : "success"}>
                                {detail.workspace.isBlocked ? "Заблокирован" : "Активен"}
                              </Badge>
                            </CardContent>
                          </Card>

                          <Card className="shadow-none">
                            <CardContent className="space-y-2 p-4 text-sm">
                              <p className="font-medium text-white">Использование</p>
                              {detail.usage?.reason ? <p className="text-amber-300">{formatUsageReason(detail.usage.reason)}</p> : null}
                              <p className="text-slate-400">
                                Трафик: {(detail.usage?.trafficGb ?? 0).toFixed(2)} GB
                                {detail.subscription.plan.maxTrafficGb !== null ? ` / ${detail.subscription.plan.maxTrafficGb.toFixed(2)} GB` : " / ∞"}
                              </p>
                              <p className="text-slate-400">
                                Хранилище: {(detail.usage?.storageGb ?? 0).toFixed(2)} GB
                                {detail.subscription.plan.maxStorageGb !== null ? ` / ${detail.subscription.plan.maxStorageGb.toFixed(2)} GB` : " / ∞"}
                              </p>
                              <p className="text-slate-400">
                                Минуты: {(detail.usage?.transcodingMinutes ?? 0).toFixed(2)} мин
                                {detail.subscription.plan.maxTranscodingMinutes !== null
                                  ? ` / ${detail.subscription.plan.maxTranscodingMinutes.toFixed(2)} мин`
                                  : " / ∞"}
                              </p>
                              <p className="text-slate-400">Оценочная сумма: {formatMoney(detail.usage?.amountMinor, "RUB")}</p>
                              <p className="text-slate-500">Синхронизировано: {formatDate(detail.usage?.fetchedAt)}</p>
                              {detail.usage?.localEstimate ? (
                                <p className="text-xs text-slate-500">
                                  Локально учтено {detail.usage.localEstimate.uniqueVideoCount} видео и {formatByteSize(detail.usage.localEstimate.storageBytes)}.
                                </p>
                              ) : null}
                              <Button variant="outline" size="sm" onClick={() => void handleRefreshUsage()} disabled={refreshingUsage}>
                                {refreshingUsage ? "Обновление..." : "Обновить использование"}
                              </Button>
                            </CardContent>
                          </Card>

                          <Card className="shadow-none">
                            <CardContent className="space-y-2 p-4 text-sm">
                              <p className="font-medium text-white">Тариф и оплата</p>
                              <p className="text-slate-400">Текущий тариф: {detail.subscription.plan.name}</p>
                              <p className="text-slate-400">
                                Период: {formatDate(detail.subscription.currentPeriodStart)} - {formatDate(detail.subscription.currentPeriodEnd)}
                              </p>
                              <p className="text-slate-400">Цена: {formatMoney(detail.subscription.plan.priceMinor, detail.subscription.plan.currency)}</p>
                              <p className="text-slate-400">
                                Последний платёж: {formatMoney(detail.subscription.lastPayment.amountMinor, detail.subscription.lastPayment.currency ?? "RUB")}
                              </p>
                              <p className="text-slate-500">Дата платежа: {formatDate(detail.subscription.lastPayment.at)}</p>
                              <Button
                                variant={detail.workspace.isBlocked ? "outline" : "destructive"}
                                size="sm"
                                onClick={() => void handleToggleWorkspaceById(detail.workspace.workspaceId, detail.workspace.isBlocked)}
                                disabled={updatingWorkspaceId === detail.workspace.workspaceId}
                              >
                                {updatingWorkspaceId === detail.workspace.workspaceId
                                  ? "Обновление..."
                                  : detail.workspace.isBlocked
                                    ? "Разблокировать"
                                    : "Заблокировать"}
                              </Button>
                            </CardContent>
                          </Card>
                        </div>

                        <Card className="shadow-none">
                          <CardContent className="space-y-4 p-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-2">
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

                              <div className="space-y-2">
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

                              <div className="space-y-2">
                                <Label>Валюта</Label>
                                <Input value={paymentCurrency} onChange={(event) => setPaymentCurrency(event.target.value.toUpperCase())} placeholder="RUB" />
                              </div>

                              <div className="space-y-2">
                                <Label>Дата платежа</Label>
                                <Input type="datetime-local" value={paymentAt} onChange={(event) => setPaymentAt(event.target.value)} />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label>Комментарий</Label>
                              <Textarea value={paymentComment} onChange={(event) => setPaymentComment(event.target.value)} rows={3} />
                            </div>

                            <Button onClick={() => void handleAssignPlan()} disabled={assigningPlan}>
                              {assigningPlan ? "Сохранение..." : "Применить тариф"}
                            </Button>
                          </CardContent>
                        </Card>

                        <Card className="shadow-none">
                          <CardContent className="space-y-3 p-4">
                            <p className="font-medium text-white">События подписки</p>
                            {detail.events.length === 0 ? (
                              <p className="text-sm text-slate-300">Событий пока нет.</p>
                            ) : (
                              detail.events.slice(0, 6).map((event) => (
                                <article key={event.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
                                  <div className="flex items-start justify-between gap-3">
                                    <p className="font-medium text-white">{formatEventType(event.type)}</p>
                                    <p className="text-xs text-slate-500">{formatDate(event.createdAt)}</p>
                                  </div>
                                  <p className="mt-1 text-xs text-slate-400">
                                    {event.oldPlanCode ?? "-"} {"->"} {event.newPlanCode ?? "-"}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-400">Платёж: {formatMoney(event.paymentAmountMinor, event.paymentCurrency ?? "RUB")}</p>
                                  {event.comment ? <p className="mt-1 text-xs text-slate-300">{event.comment}</p> : null}
                                </article>
                              ))
                            )}
                          </CardContent>
                        </Card>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      )}

      {section === "plans" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-white">Управление тарифами</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!planDrafts ? (
              <p className="text-sm text-slate-300">Загрузка тарифов...</p>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {plans.map((plan) => {
                  const draft = planDrafts[plan.code];
                  if (!draft) return null;

                  return (
                    <Card key={plan.code} className="shadow-none">
                      <CardContent className="space-y-4 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-white">{plan.name}</p>
                            <p className="text-sm text-slate-400">{plan.code}</p>
                          </div>
                          <Badge variant={planBadgeVariant(plan.code)}>{plan.isActive ? "Активен" : "Скрыт"}</Badge>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label>Название</Label>
                            <Input value={draft.name} onChange={(event) => updatePlanDraft(plan.code, "name", event.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label>Валюта</Label>
                            <Input value={draft.currency} onChange={(event) => updatePlanDraft(plan.code, "currency", event.target.value.toUpperCase())} />
                          </div>
                          <div className="space-y-1">
                            <Label>Цена (minor)</Label>
                            <Input type="number" value={draft.priceMinor} onChange={(event) => updatePlanDraft(plan.code, "priceMinor", Number(event.target.value))} />
                          </div>
                          <div className="space-y-1">
                            <Label>Sort order</Label>
                            <Input type="number" value={draft.sortOrder} onChange={(event) => updatePlanDraft(plan.code, "sortOrder", Number(event.target.value))} />
                          </div>
                          <div className="space-y-1">
                            <Label>Проекты</Label>
                            <Input
                              type="number"
                              value={draft.maxProjects ?? ""}
                              onChange={(event) => updatePlanDraft(plan.code, "maxProjects", event.target.value ? Number(event.target.value) : null)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Участники</Label>
                            <Input
                              type="number"
                              value={draft.maxMembers ?? ""}
                              onChange={(event) => updatePlanDraft(plan.code, "maxMembers", event.target.value ? Number(event.target.value) : null)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Traffic GB</Label>
                            <Input
                              type="number"
                              value={draft.maxTrafficGb ?? ""}
                              onChange={(event) => updatePlanDraft(plan.code, "maxTrafficGb", event.target.value ? Number(event.target.value) : null)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Storage GB</Label>
                            <Input
                              type="number"
                              value={draft.maxStorageGb ?? ""}
                              onChange={(event) => updatePlanDraft(plan.code, "maxStorageGb", event.target.value ? Number(event.target.value) : null)}
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-2">
                            <Label>Transcoding minutes</Label>
                            <Input
                              type="number"
                              value={draft.maxTranscodingMinutes ?? ""}
                              onChange={(event) =>
                                updatePlanDraft(plan.code, "maxTranscodingMinutes", event.target.value ? Number(event.target.value) : null)
                              }
                            />
                          </div>
                        </div>

                        <label className="flex items-center gap-2 text-sm text-slate-300">
                          <input type="checkbox" checked={draft.isActive} onChange={(event) => updatePlanDraft(plan.code, "isActive", event.target.checked)} />
                          Тариф активен
                        </label>

                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                          <div className="text-xs text-slate-400">
                            {formatLimit(draft.maxProjects, "проектов")} · {formatLimit(draft.maxMembers, "участников")} · {formatLimit(draft.maxStorageGb, "ГБ")}
                          </div>
                          <Button size="sm" onClick={() => void handleSavePlan(plan.code)} disabled={savingPlanCode === plan.code}>
                            {savingPlanCode === plan.code ? "Сохранение..." : "Сохранить тариф"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
