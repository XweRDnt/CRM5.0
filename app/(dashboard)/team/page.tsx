"use client";

import useSWR from "swr";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/utils/client-api";

type TeamMember = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "EDITOR" | "OWNER";
};

type InviteLink = {
  id: string;
  token: string;
  url: string;
  expiresAt: string;
  isActive: boolean;
};

function absoluteInviteUrl(path: string): string {
  if (typeof window === "undefined") {
    return path;
  }

  return `${window.location.origin}${path}`;
}

export default function TeamPage(): JSX.Element {
  const { data: members = [], mutate: mutateMembers, isLoading: membersLoading } = useSWR(
    "/api/team/members",
    apiFetch<TeamMember[]>,
  );
  const { data: invites = [], mutate: mutateInvites, isLoading: invitesLoading } = useSWR(
    "/api/team/invites",
    apiFetch<InviteLink[]>,
  );

  const sortedInvites = useMemo(
    () => [...invites].sort((a, b) => new Date(b.expiresAt).getTime() - new Date(a.expiresAt).getTime()),
    [invites],
  );

  const handleCreateInvite = async (): Promise<void> => {
    try {
      const created = await apiFetch<InviteLink>("/api/team/invites", {
        method: "POST",
      });
      await navigator.clipboard.writeText(absoluteInviteUrl(created.url));
      await Promise.all([mutateInvites(), mutateMembers()]);
      toast.success("Invite link copied");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create invite link");
    }
  };

  const handleCopyInvite = async (path: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(absoluteInviteUrl(path));
      toast.success("Invite link copied");
    } catch {
      toast.error("Failed to copy invite link");
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Команда</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Управление редакторами и инвайт-ссылками.</p>
        </div>
        <Button onClick={() => void handleCreateInvite()}>Пригласить</Button>
      </header>

      <Card className="border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900/50">
        <CardContent className="space-y-3 p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Редакторы</h2>
          {membersLoading ? (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Загрузка...</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">В команде пока нет редакторов.</p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.userId} className="rounded-lg border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-700">
                  <p className="font-medium text-neutral-900 dark:text-neutral-100">
                    {member.firstName} {member.lastName}
                  </p>
                  <p className="text-neutral-600 dark:text-neutral-400">{member.email}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900/50">
        <CardContent className="space-y-3 p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Активные инвайт-ссылки</h2>
          {invitesLoading ? (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Загрузка...</p>
          ) : sortedInvites.length === 0 ? (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Нет активных инвайтов.</p>
          ) : (
            <div className="space-y-2">
              {sortedInvites.map((invite) => (
                <div key={invite.id} className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Действует до {new Date(invite.expiresAt).toLocaleString("ru-RU")}</p>
                    <p className="text-sm text-neutral-700 dark:text-neutral-200">{absoluteInviteUrl(invite.url)}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void handleCopyInvite(invite.url)}>
                    Копировать
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
