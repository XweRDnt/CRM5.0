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
      router.push(`/projects/${project.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось создать проект");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl border-white/10 bg-[linear-gradient(180deg,rgba(11,18,32,0.96),rgba(8,14,27,0.96))] text-neutral-100 shadow-[0_28px_90px_rgba(0,0,0,0.42)] backdrop-blur-[24px]">
        <DialogHeader className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300/80">First Project</p>
          <DialogTitle className="text-2xl text-white">Создайте проект за несколько секунд</DialogTitle>
          <DialogDescription className="text-sm text-slate-300">
            Только название проекта. Видео загрузим следующим шагом.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={form.handleSubmit(createProject)}>
          <div className="space-y-2">
            <label htmlFor="project-name" className="text-sm font-medium text-slate-200">
              Название проекта
            </label>
            <Input
              id="project-name"
              className="h-12 border-white/10 bg-slate-950/60 text-white placeholder:text-slate-500"
              placeholder="Например, Презентационный ролик"
              {...form.register("name")}
            />
            {form.formState.errors.name ? (
              <p className="text-xs text-red-400">{form.formState.errors.name.message}</p>
            ) : null}
          </div>

          <div className="flex justify-end">
            <Button type="submit" className="min-w-40" disabled={form.formState.isSubmitting}>
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
      </DialogContent>
    </Dialog>
  );
}
