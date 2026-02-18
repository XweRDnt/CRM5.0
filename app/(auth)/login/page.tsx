"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { mutate } from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMessages } from "@/lib/i18n/messages";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
  tenantSlug: z.string().min(1, "Tenant slug is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

type LoginResponse = {
  token: string;
  tenant: { id: string };
};

function extractLoginPayload(json: unknown): LoginResponse {
  if (!json || typeof json !== "object") {
    throw new Error("Login response is invalid");
  }

  const wrapped = json as { data?: unknown };
  const raw = wrapped.data ?? json;
  if (!raw || typeof raw !== "object") {
    throw new Error("Login response is invalid");
  }

  const payload = raw as { token?: unknown; tenant?: { id?: unknown } };
  if (typeof payload.token !== "string" || typeof payload.tenant?.id !== "string") {
    throw new Error("Login response is missing token");
  }

  return {
    token: payload.token,
    tenant: { id: payload.tenant.id },
  };
}

export default function LoginPage(): JSX.Element {
  const m = getMessages();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/projects";
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      tenantSlug: "",
    },
  });

  const onSubmit = async (data: LoginFormValues): Promise<void> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error("Login failed");
      }

      const json = await res.json();
      const payload = extractLoginPayload(json);

      await mutate(() => true, undefined, { revalidate: false });
      localStorage.setItem("token", payload.token);
      localStorage.setItem("tenantId", payload.tenant.id);
      toast.success("Вход выполнен");
      router.push(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось выполнить вход");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-500">{m.appName}</p>
          <CardTitle>{m.auth.loginTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@company.com" {...register("email")} />
              {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="******" {...register("password")} />
              {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenantSlug">Tenant Slug</Label>
              <Input id="tenantSlug" placeholder="my-studio" {...register("tenantSlug")} />
              {errors.tenantSlug && <p className="text-xs text-red-500">{errors.tenantSlug.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : m.auth.loginButton}
            </Button>
            <p className="text-center text-sm text-neutral-500">
              {`${m.auth.noAccount} `}
              <Link href="/signup" className="text-blue-500 hover:underline">
                {m.auth.toSignup}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
