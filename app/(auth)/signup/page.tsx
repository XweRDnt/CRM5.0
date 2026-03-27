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
import { Input } from "@/components/ui/input";
import { getMessages } from "@/lib/i18n/messages";

const signupSchema = z.object({
  workspaceName: z.string().trim().min(1, "Workspace name is required"),
  email: z.string().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type SignupFormValues = z.infer<typeof signupSchema>;

type SignupResponse = {
  token: string;
  tenant: { id: string };
};

function extractSignupPayload(json: unknown): SignupResponse {
  if (!json || typeof json !== "object") {
    throw new Error("Signup response is invalid");
  }

  const payload = json as { token?: unknown; tenant?: { id?: unknown } };
  if (typeof payload.token !== "string" || typeof payload.tenant?.id !== "string") {
    throw new Error("Signup response is missing token");
  }

  return {
    token: payload.token,
    tenant: { id: payload.tenant.id },
  };
}

export default function SignupPage(): JSX.Element {
  const m = getMessages();
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("inviteToken") ?? "";
  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      workspaceName: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: SignupFormValues): Promise<void> => {
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceName: data.workspaceName.trim(),
          email: data.email,
          password: data.password,
          inviteToken: inviteToken || undefined,
        }),
      });

      if (!response.ok) {
        const failure = (await response.json()) as { error?: string };
        throw new Error(failure.error || "Signup failed");
      }

      const payload = extractSignupPayload(await response.json());
      await mutate(() => true, undefined, { revalidate: false });
      localStorage.setItem("token", payload.token);
      localStorage.setItem("tenantId", payload.tenant.id);

      toast.success("Аккаунт создан");
      router.push("/projects/new");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось зарегистрироваться");
    }
  };

  const fieldClassName =
    "border-white/10 bg-slate-950/50 text-white placeholder:text-slate-500 focus-visible:ring-blue-400";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#060b16] px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.22),transparent_36%),radial-gradient(circle_at_bottom,rgba(14,165,233,0.14),transparent_42%)]"
      />

      <section className="relative w-full max-w-xl rounded-[30px] border border-white/12 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(5,10,25,0.3)] backdrop-blur-[24px] sm:p-8">
        <div className="space-y-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300/80">Workspace Setup</p>
          <h1 className="text-3xl font-semibold text-white">{m.auth.signupTitle}</h1>
          <p className="text-sm leading-relaxed text-slate-300">
            Создайте рабочее пространство и сразу перейдите к первому проекту.
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-8 space-y-4">
          <div className="space-y-2">
            <label htmlFor="workspaceName" className="text-sm font-medium text-slate-200">
              Workspace name
            </label>
            <Input id="workspaceName" placeholder="North Studio" className={fieldClassName} {...form.register("workspaceName")} />
            {form.formState.errors.workspaceName ? (
              <p className="text-xs text-red-400">{form.formState.errors.workspaceName.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-slate-200">
              Email
            </label>
            <Input id="email" type="email" placeholder="you@company.com" className={fieldClassName} {...form.register("email")} />
            {form.formState.errors.email ? <p className="text-xs text-red-400">{form.formState.errors.email.message}</p> : null}
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-slate-200">
              Password
            </label>
            <Input
              id="password"
              type="password"
              placeholder="At least 8 characters"
              className={fieldClassName}
              {...form.register("password")}
            />
            {form.formState.errors.password ? (
              <p className="text-xs text-red-400">{form.formState.errors.password.message}</p>
            ) : null}
          </div>

          <Button type="submit" className="h-11 w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : m.auth.signupButton}
          </Button>

          <p className="text-center text-sm text-slate-400">
            {`${m.auth.haveAccount} `}
            <Link href="/login" className="font-medium text-blue-300 hover:text-blue-200">
              {m.auth.toLogin}
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}
