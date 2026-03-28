"use client";

import useSWR from "swr";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/utils/client-api";

export type TeamMember = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "EDITOR" | "OWNER";
};

export type InviteLink = {
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

export function TeamPageClient({
  initialMembers,
  initialInvites,
}: {
  initialMembers: TeamMember[];
  initialInvites: InviteLink[];
}): JSX.Element {
  const { data: members = [], mutate: mutateMembers, isLoading: membersLoading } = useSWR("/api/team/members", apiFetch<TeamMember[]>, {
    fallbackData: initialMembers,
    revalidateOnMount: false,
  });
  const { data: invites = [], mutate: mutateInvites, isLoading: invitesLoading } = useSWR("/api/team/invites", apiFetch<InviteLink[]>, {
    fallbackData: initialInvites,
    revalidateOnMount: false,
  });

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
          <h1 className="text-2xl font-semibold">Team</h1>
          <p className="text-sm glass-muted">Manage editors and invite links.</p>
        </div>
        <Button onClick={() => void handleCreateInvite()}>Invite</Button>
      </header>

      <Card className="glass-card">
        <CardContent className="space-y-3 p-4 sm:p-5">
          <h2 className="text-lg font-semibold">Editors</h2>
          {membersLoading ? (
            <p className="text-sm glass-muted">Loading...</p>
          ) : members.length === 0 ? (
            <p className="text-sm glass-muted">No editors yet.</p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.userId} className="glass-item px-3 py-2 text-sm">
                  <p className="font-medium">
                    {member.firstName} {member.lastName}
                  </p>
                  <p className="glass-muted">{member.email}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardContent className="space-y-3 p-4 sm:p-5">
          <h2 className="text-lg font-semibold">Active invite links</h2>
          {invitesLoading ? (
            <p className="text-sm glass-muted">Loading...</p>
          ) : sortedInvites.length === 0 ? (
            <p className="text-sm glass-muted">No active invites.</p>
          ) : (
            <div className="space-y-2">
              {sortedInvites.map((invite) => (
                <div key={invite.id} className="glass-item flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs glass-muted">Expires at {new Date(invite.expiresAt).toLocaleString("ru-RU")}</p>
                    <p className="text-sm glass-muted">{absoluteInviteUrl(invite.url)}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void handleCopyInvite(invite.url)}>
                    Copy
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
