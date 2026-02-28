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
      toast.success("Вы вступили в команду");
      router.push("/projects");
    } catch (joinError) {
      toast.error(joinError instanceof Error ? joinError.message : "Не удалось вступить в команду");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-100 p-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Приглашение в команду</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && <p className="text-sm text-neutral-600">Проверяем ссылку...</p>}
          {!isLoading && error && <p className="text-sm text-red-600">Ссылка недействительна или истекла.</p>}
          {!isLoading && !error && data && (
            <>
              <p className="text-sm text-neutral-700">
                Вас пригласили в workspace <span className="font-semibold">{data.workspace.name}</span>.
              </p>
              <p className="text-xs text-neutral-500">Ссылка действительна до {new Date(data.expiresAt).toLocaleString("ru-RU")}</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={() => void handleJoin()}>Вступить</Button>
                <Button asChild variant="outline">
                  <Link href={`/login?inviteToken=${encodeURIComponent(token)}`}>У меня уже есть аккаунт</Link>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
