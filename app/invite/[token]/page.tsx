"use client";

import useSWR from "swr";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { apiFetch, getAuthToken } from "@/lib/utils/client-api";

type InvitePreview = {
  token: string;
  workspace: {
    id: string;
    name: string;
  };
  expiresAt: string;
  isActive: boolean;
};

export default function InvitePage(): JSX.Element {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();

  const { data, error, isLoading } = useSWR(`/api/invite/${token}`, apiFetch<InvitePreview>);

  const handleJoin = async (): Promise<void> => {
    const authToken = getAuthToken();
    if (!authToken) {
      router.push(`/signup?inviteToken=${encodeURIComponent(token)}`);
      return;
    }

    try {
      await apiFetch(`/api/invite/${token}/accept`, {
        method: "POST",
      });
      toast.success("You joined the workspace");
      router.push("/projects");
    } catch (joinError) {
      toast.error(joinError instanceof Error ? joinError.message : "Failed to join workspace");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-100 p-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Workspace Invitation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && <p className="text-sm text-neutral-600">Checking invite link...</p>}
          {!isLoading && error && <p className="text-sm text-red-600">Invite link is invalid or expired.</p>}
          {!isLoading && !error && data && (
            <>
              <p className="text-sm text-neutral-700">
                You were invited to workspace <span className="font-semibold">{data.workspace.name}</span>.
              </p>
              <p className="text-xs text-neutral-500">Valid until {new Date(data.expiresAt).toLocaleString("ru-RU")}</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={() => void handleJoin()}>Join</Button>
                <Button asChild variant="outline">
                  <Link href={`/login?inviteToken=${encodeURIComponent(token)}`}>I already have an account</Link>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
