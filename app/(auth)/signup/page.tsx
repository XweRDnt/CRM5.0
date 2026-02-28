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

const signupSchema = z.object({
  workspaceName: z.string().optional(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
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
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      workspaceName: "",
      firstName: "",
      lastName: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: SignupFormValues): Promise<void> => {
    if (!inviteToken && (!data.workspaceName || data.workspaceName.trim().length === 0)) {
      toast.error("Workspace name is required");
      return;
    }

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          workspaceName: data.workspaceName?.trim() || undefined,
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
      router.push("/projects");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось зарегистрироваться");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-100 p-4">
      <Card className="w-full max-w-xl">
        <CardHeader className="space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-500">Создание агентства</p>
          <CardTitle>{m.auth.signupTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {!inviteToken && (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="workspaceName">Workspace Name</Label>
                  <Input id="workspaceName" placeholder="North Studio" {...register("workspaceName")} />
                  {errors.workspaceName && <p className="text-xs text-red-500">{errors.workspaceName.message}</p>}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" {...register("firstName")} />
                {errors.firstName && <p className="text-xs text-red-500">{errors.firstName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" {...register("lastName")} />
                {errors.lastName && <p className="text-xs text-red-500">{errors.lastName.message}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@company.com" {...register("email")} />
              {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="At least 8 characters" {...register("password")} />
              {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : m.auth.signupButton}
            </Button>
            <p className="text-center text-sm text-neutral-500">
              {`${m.auth.haveAccount} `}
              <Link href="/login" className="text-blue-500 hover:underline">
                {m.auth.toLogin}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
