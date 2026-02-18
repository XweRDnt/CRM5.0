"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClientForm, type ClientFormValues } from "@/components/clients/client-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/utils/client-api";

export default function NewClientPage(): JSX.Element {
  const router = useRouter();

  const createClient = async (values: ClientFormValues): Promise<void> => {
    try {
      await apiFetch("/api/clients", {
        method: "POST",
        body: JSON.stringify(values),
      });
      toast.success("Client created");
      router.push("/clients");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create client");
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>New Client</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientForm submitLabel="Create Client" loadingLabel="Creating..." onSubmit={createClient} />
        </CardContent>
      </Card>
    </div>
  );
}
