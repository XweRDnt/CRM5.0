"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/utils/client-api";
import type { ProjectResponse } from "@/types";

const projectSchema = z.object({
  name: z.string().trim().min(1, "Введите название проекта"),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

export default function NewProjectPage(): JSX.Element {
  const router = useRouter();
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: "",
    },
  });

  const createProject = async (values: ProjectFormValues): Promise<void> => {
    try {
      const project = await apiFetch<ProjectResponse>("/api/projects", {
        method: "POST",
        body: JSON.stringify(values),
      });
      toast.success("Проект создан");
      router.push(`/projects/${project.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось создать проект");
    }
  };

  return (
    <section className="relative mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl items-center justify-center px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_40%),radial-gradient(circle_at_bottom,rgba(14,165,233,0.12),transparent_42%)]"
      />
      <div className="relative w-full max-w-xl rounded-[28px] border border-white/12 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(5,10,25,0.28)] backdrop-blur-[24px]">
        <div className="mb-6 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-300/80">First Project</p>
          <h1 className="text-2xl font-semibold text-white">Создайте проект за несколько секунд</h1>
          <p className="text-sm text-slate-300">Только название. Всё остальное добавим уже внутри проекта.</p>
        </div>

        <form className="space-y-4" onSubmit={form.handleSubmit(createProject)}>
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium text-slate-200">
              Название проекта
            </label>
            <Input
              id="name"
              className="border-white/10 bg-slate-950/50 text-white placeholder:text-slate-500"
              placeholder="Например, Рекламный ролик для бренда"
              {...form.register("name")}
            />
            {form.formState.errors.name ? (
              <p className="text-xs text-red-400">{form.formState.errors.name.message}</p>
            ) : null}
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Создание...
                </>
              ) : (
                "Создать проект"
              )}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
