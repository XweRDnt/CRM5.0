"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const clientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  companyName: z.string().optional(),
  phone: z.string().optional(),
});

export type ClientFormValues = z.infer<typeof clientSchema>;

type ClientFormProps = {
  defaultValues?: Partial<ClientFormValues>;
  submitLabel: string;
  loadingLabel: string;
  onSubmit: (values: ClientFormValues) => Promise<void>;
};

export function ClientForm({ defaultValues, submitLabel, loadingLabel, onSubmit }: ClientFormProps): JSX.Element {
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      email: defaultValues?.email ?? "",
      companyName: defaultValues?.companyName ?? "",
      phone: defaultValues?.phone ?? "",
    },
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Contact Name</Label>
        <Input id="name" placeholder="Jane Doe" {...form.register("name")} />
        {form.formState.errors.name && <p className="text-xs text-red-500">{form.formState.errors.name.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="jane@company.com" {...form.register("email")} />
        {form.formState.errors.email && <p className="text-xs text-red-500">{form.formState.errors.email.message}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="companyName">Company</Label>
          <Input id="companyName" placeholder="Acme Inc." {...form.register("companyName")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" placeholder="+1 555 555 55 55" {...form.register("phone")} />
        </div>
      </div>
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {loadingLabel}
          </>
        ) : (
          submitLabel
        )}
      </Button>
    </form>
  );
}
