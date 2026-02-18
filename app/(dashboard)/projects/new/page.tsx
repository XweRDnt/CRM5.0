"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/utils/client-api";
import type { ClientResponse, ProjectResponse } from "@/types";

const projectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string().optional(),
  clientId: z.string().min(1, "Client is required"),
  revisionsLimit: z.coerce.number().min(1),
  brief: z.string().optional(),
});

const clientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  companyName: z.string().optional(),
  phone: z.string().optional(),
});

type ProjectFormValues = z.infer<typeof projectSchema>;
type ClientFormValues = z.infer<typeof clientSchema>;

const clientsFetcher = (url: string) => apiFetch<ClientResponse[]>(url);

export default function NewProjectPage(): JSX.Element {
  const router = useRouter();
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const { data: clients, mutate: mutateClients, isLoading: clientsLoading } = useSWR("/api/clients", clientsFetcher);

  const projectForm = useForm<z.input<typeof projectSchema>, undefined, ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: "",
      description: "",
      clientId: "",
      revisionsLimit: 3,
      brief: "",
    },
  });

  const clientForm = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: "",
      email: "",
      companyName: "",
      phone: "",
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

  const createClient = async (values: ClientFormValues): Promise<void> => {
    try {
      const client = await apiFetch<ClientResponse>("/api/clients", {
        method: "POST",
        body: JSON.stringify(values),
      });
      await mutateClients();
      projectForm.setValue("clientId", client.id);
      setIsClientDialogOpen(false);
      clientForm.reset();
      toast.success("Клиент создан");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось создать клиента");
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Новый проект</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={projectForm.handleSubmit(createProject)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Название проекта</Label>
              <Input id="name" {...projectForm.register("name")} />
              {projectForm.formState.errors.name && (
                <p className="text-xs text-red-500">{projectForm.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Описание</Label>
              <Textarea id="description" rows={3} {...projectForm.register("description")} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Клиент</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setIsClientDialogOpen(true)}>
                  Создать клиента
                </Button>
              </div>
              {clientsLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              ) : (
                <Controller
                  control={projectForm.control}
                  name="clientId"
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите клиента" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients?.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
              {projectForm.formState.errors.clientId && (
                <p className="text-xs text-red-500">{projectForm.formState.errors.clientId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="revisionsLimit">Лимит правок</Label>
              <Input id="revisionsLimit" type="number" min={1} {...projectForm.register("revisionsLimit")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="brief">Бриф / ТЗ</Label>
              <Textarea id="brief" rows={5} {...projectForm.register("brief")} />
            </div>

            <Button type="submit" disabled={projectForm.formState.isSubmitting || (clients?.length ?? 0) === 0}>
              {projectForm.formState.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Создание...
                </>
              ) : (
                "Создать проект"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Dialog open={isClientDialogOpen} onOpenChange={setIsClientDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создать клиента</DialogTitle>
            <DialogDescription>Добавьте клиента перед созданием проекта.</DialogDescription>
          </DialogHeader>
          <form onSubmit={clientForm.handleSubmit(createClient)} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="client-name">Имя</Label>
              <Input id="client-name" {...clientForm.register("name")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-email">Email</Label>
              <Input id="client-email" type="email" {...clientForm.register("email")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-company">Компания</Label>
              <Input id="client-company" {...clientForm.register("companyName")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-phone">Телефон</Label>
              <Input id="client-phone" {...clientForm.register("phone")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsClientDialogOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={clientForm.formState.isSubmitting}>
                {clientForm.formState.isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Создать клиента"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
