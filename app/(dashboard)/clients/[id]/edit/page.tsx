"use client";

import useSWR from "swr";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClientForm, type ClientFormValues } from "@/components/clients/client-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/utils/client-api";
import type { ClientResponse } from "@/types";

const fetcher = (url: string) => apiFetch<ClientResponse>(url);

export default function EditClientPage(): JSX.Element {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data: client, isLoading, error } = useSWR(`/api/clients/${id}`, fetcher);

  const updateClient = async (values: ClientFormValues): Promise<void> => {
    try {
      await apiFetch(`/api/clients/${id}`, {
        method: "PATCH",
        body: JSON.stringify(values),
      });
      toast.success("Client updated");
      router.push("/clients");
    } catch (updateError) {
      toast.error(updateError instanceof Error ? updateError.message : "Failed to update client");
    }
  };

  if (isLoading) {
    return (
      <Card className="mx-auto max-w-2xl animate-pulse">
        <CardContent className="h-52 p-6" />
      </Card>
    );
  }

  if (error || !client) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardContent className="py-6 text-sm text-red-600">Failed to load client details.</CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Edit Client</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientForm
            defaultValues={{
              name: client.name,
              email: client.email,
              companyName: client.companyName ?? "",
              phone: client.phone ?? "",
            }}
            submitLabel="Save Changes"
            loadingLabel="Saving..."
            onSubmit={updateClient}
          />
        </CardContent>
      </Card>
    </div>
  );
}
