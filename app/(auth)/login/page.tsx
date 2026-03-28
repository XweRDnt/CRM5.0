"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { mutate } from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMessages } from "@/lib/i18n/messages";
import { persistAuthSession } from "@/lib/utils/client-api";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

type LoginResponse = {
  token: string;
  tenant: { id: string; name: string; slug: string };
  user: { id: string; firstName: string; lastName: string; email: string; role: string };
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

  const payload = raw as {
    token?: unknown;
    tenant?: { id?: unknown; name?: unknown; slug?: unknown };
    user?: { id?: unknown; firstName?: unknown; lastName?: unknown; email?: unknown; role?: unknown };
  };
  if (
    typeof payload.token !== "string" ||
    typeof payload.tenant?.id !== "string" ||
    typeof payload.tenant?.name !== "string" ||
    typeof payload.tenant?.slug !== "string" ||
    typeof payload.user?.id !== "string" ||
    typeof payload.user?.firstName !== "string" ||
    typeof payload.user?.lastName !== "string" ||
    typeof payload.user?.email !== "string" ||
    typeof payload.user?.role !== "string"
  ) {
    throw new Error("Login response is missing token");
  }

  return {
    token: payload.token,
    tenant: { id: payload.tenant.id, name: payload.tenant.name, slug: payload.tenant.slug },
    user: {
      id: payload.user.id,
      firstName: payload.user.firstName,
      lastName: payload.user.lastName,
      email: payload.user.email,
      role: payload.user.role,
    },
  };
}

export default function LoginPage(): JSX.Element {
  const m = getMessages();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const inviteToken = searchParams.get("inviteToken");
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
      persistAuthSession(payload);

      if (inviteToken) {
        await fetch(`/api/invite/${encodeURIComponent(inviteToken)}/accept`, {
          method: "POST",
        });
      }

      toast.success("Вход выполнен");
      router.push(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось выполнить вход");
    }
  };

  useEffect(() => {
    let cancelled = false;

    const checkSession = async (): Promise<void> => {
      const token = localStorage.getItem("token");
      if (!token) {
        if (!cancelled) {
          setIsCheckingSession(false);
        }
        return;
      }

      try {
        const response = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          router.replace("/projects");
          return;
        }
      } catch {
        // ignore and show login form
      }

      if (!cancelled) {
        setIsCheckingSession(false);
      }
    };

    void checkSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const fieldClassName =
    "h-12 rounded-2xl border-white/10 bg-slate-950/60 text-white placeholder:text-slate-500 focus-visible:ring-blue-400";

  if (isCheckingSession) {
    return (
      <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#060b16] px-4">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.22),transparent_36%),radial-gradient(circle_at_bottom,rgba(14,165,233,0.14),transparent_42%)]"
        />
        <Loader2 className="relative h-6 w-6 animate-spin text-blue-400" />
      </main>
    );
  }

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#060b16] px-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.22),transparent_36%),radial-gradient(circle_at_bottom,rgba(14,165,233,0.14),transparent_42%)]"
      />

      <section className="relative w-full max-w-[460px] rounded-[30px] border border-white/12 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(5,10,25,0.3)] backdrop-blur-[24px] sm:p-8">
        <div className="space-y-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300/80">{m.appName}</p>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white">{m.auth.loginTitle}</h1>
          <p className="text-sm leading-relaxed text-slate-300">Войдите в рабочее пространство и продолжайте работу с проектами.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-slate-200">
              Email
            </label>
            <Input id="email" type="email" placeholder="you@company.com" className={fieldClassName} {...register("email")} />
            {errors.email ? <p className="text-xs text-red-400">{errors.email.message}</p> : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-slate-200">
              Password
            </label>
            <Input id="password" type="password" placeholder="******" className={fieldClassName} {...register("password")} />
            {errors.password ? <p className="text-xs text-red-400">{errors.password.message}</p> : null}
          </div>

          <Button type="submit" className="h-11 w-full rounded-2xl" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : m.auth.loginButton}
          </Button>

          <p className="text-center text-sm text-slate-400">
            {`${m.auth.noAccount} `}
            <Link
              href={inviteToken ? `/signup?inviteToken=${encodeURIComponent(inviteToken)}` : "/signup"}
              className="font-medium text-blue-300 hover:text-blue-200"
            >
              {m.auth.toSignup}
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}
