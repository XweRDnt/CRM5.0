"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/utils/client-api";

type AdminWorkspace = {
  workspaceId: string;
  workspaceName: string;
  ownerEmail: string;
  registeredAt: string;
  isBlocked: boolean;
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("ru-RU");
}

export default function AdminPage(): JSX.Element {
  const [updatingWorkspaceId, setUpdatingWorkspaceId] = useState<string | null>(null);
  const {
    data: workspaces,
    error,
    isLoading,
    mutate,
  } = useSWR("/api/admin/workspaces", apiFetch<AdminWorkspace[]>);

  const handleToggle = async (workspaceId: string): Promise<void> => {
    setUpdatingWorkspaceId(workspaceId);
    try {
      await apiFetch<{ workspaceId: string; isBlocked: boolean }>("/api/admin/workspaces", {
        method: "PATCH",
        body: JSON.stringify({ workspaceId }),
      });
      await mutate();
      toast.success("Статус воркспейса обновлен");
    } catch (toggleError) {
      toast.error(toggleError instanceof Error ? toggleError.message : "Не удалось изменить статус");
    } finally {
      setUpdatingWorkspaceId(null);
    }
  };

  const errorMessage = error instanceof Error && error.message.toLowerCase().includes("forbidden")
    ? "Доступ запрещен"
    : "Не удалось загрузить данные";

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="text-sm text-neutral-500">Управление блокировкой воркспейсов.</p>
      </header>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-4 text-sm text-neutral-600">Загрузка...</p>
          ) : error ? (
            <p className="p-4 text-sm text-red-600">{errorMessage}</p>
          ) : !workspaces || workspaces.length === 0 ? (
            <p className="p-4 text-sm text-neutral-600">Нет воркспейсов.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-50 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium text-neutral-700">Название воркспейса</th>
                    <th className="px-4 py-3 font-medium text-neutral-700">Email владельца</th>
                    <th className="px-4 py-3 font-medium text-neutral-700">Дата регистрации</th>
                    <th className="px-4 py-3 font-medium text-neutral-700">Статус</th>
                    <th className="px-4 py-3 font-medium text-neutral-700">Действие</th>
                  </tr>
                </thead>
                <tbody>
                  {workspaces.map((workspace) => (
                    <tr key={workspace.workspaceId} className="border-t border-neutral-200">
                      <td className="px-4 py-3">{workspace.workspaceName}</td>
                      <td className="px-4 py-3">{workspace.ownerEmail}</td>
                      <td className="px-4 py-3">{formatDate(workspace.registeredAt)}</td>
                      <td className="px-4 py-3">{workspace.isBlocked ? "Заблокирован" : "Активен"}</td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant={workspace.isBlocked ? "outline" : "destructive"}
                          disabled={updatingWorkspaceId === workspace.workspaceId}
                          onClick={() => void handleToggle(workspace.workspaceId)}
                        >
                          {workspace.isBlocked ? "Разблокировать" : "Заблокировать"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
