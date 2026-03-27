"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/utils/client-api";
import type { ProjectResponse } from "@/types";

const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Введите название проекта"),
});

type CreateProjectDialogProps = {
  trigger: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCreated?: (project: ProjectResponse) => void;
};

type CreateProjectFormValues = z.infer<typeof createProjectSchema>;

export function CreateProjectDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
  onCreated,
}: CreateProjectDialogProps): JSX.Element {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const form = useForm<CreateProjectFormValues>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: "",
    },
  });

  const createProject = async (values: CreateProjectFormValues): Promise<void> => {
    try {
      const project = await apiFetch<ProjectResponse>("/api/projects", {
        method: "POST",
        body: JSON.stringify(values),
      });
      toast.success("Проект создан");
      form.reset();
      setOpen(false);
      onCreated?.(project);
      router.push(`/projects/${project.id}?upload=1`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось создать проект");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="!max-w-xl !overflow-hidden !rounded-[30px] !border-white/10 !bg-[linear-gradient(180deg,rgba(16,18,29,0.96),rgba(10,12,20,0.96))] !p-0 !text-white !shadow-[0_34px_120px_rgba(0,0,0,0.5)] !backdrop-blur-2xl">
        <div className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(67,87,255,0.24),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.16),transparent_32%)]"
          />

          <div className="relative p-6 sm:p-7">
            <DialogHeader className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300/80">First Project</p>
              <DialogTitle className="text-[28px] font-semibold tracking-[-0.04em] text-white">
                Создайте проект за несколько секунд
              </DialogTitle>
              <DialogDescription className="max-w-md text-sm leading-6 text-white/62">
                Только название проекта. Сразу после этого вы сможете загрузить первую версию видео в том же потоке.
              </DialogDescription>
            </DialogHeader>

            <form className="mt-6 space-y-5" onSubmit={form.handleSubmit(createProject)}>
              <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl">
                <div className="space-y-2">
                  <label htmlFor="project-name" className="text-sm font-medium text-white/88">
                    Название проекта
                  </label>
                  <Input
                    id="project-name"
                    className="h-12 rounded-2xl border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                    placeholder="Например, Рекламный ролик весна 2026"
                    autoFocus
                    {...form.register("name")}
                  />
                  {form.formState.errors.name ? (
                    <p className="text-xs text-red-400">{form.formState.errors.name.message}</p>
                  ) : (
                    <p className="text-xs text-white/45">
                      Без клиента, брифа и лишних шагов. Их можно добавить позже, если вообще понадобится.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white/82 hover:bg-white/[0.08] hover:text-white sm:w-auto"
                  onClick={() => setOpen(false)}
                  disabled={form.formState.isSubmitting}
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  className="w-full rounded-2xl border border-blue-400/20 bg-[linear-gradient(135deg,rgba(67,87,255,0.78),rgba(56,189,248,0.48))] px-5 py-3 text-white shadow-[0_16px_40px_rgba(37,99,235,0.3)] hover:opacity-95 sm:w-auto"
                  disabled={form.formState.isSubmitting}
                >
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
