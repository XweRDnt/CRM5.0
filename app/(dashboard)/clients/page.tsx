"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { ClientList } from "@/components/clients/client-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/utils/client-api";
import type { ClientResponse } from "@/types";

const fetcher = (url: string) => apiFetch<ClientResponse[]>(url);

export default function ClientsPage(): JSX.Element {
  const [deletingId, setDeletingId] = useState<string>();
  const { data: clients, error, isLoading, mutate } = useSWR("/api/clients", fetcher);

  const deleteClient = async (id: string): Promise<void> => {
    setDeletingId(id);
    try {
      await apiFetch(`/api/clients/${id}`, { method: "DELETE" });
      await mutate();
      toast.success("Client deleted");
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Failed to delete client");
    } finally {
      setDeletingId(undefined);
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-sm text-neutral-500">Manage client contacts for new projects.</p>
        </div>
        <Button asChild>
          <Link href="/clients/new">+ New Client</Link>
        </Button>
      </header>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Card key={`client-skeleton-${index}`} className="animate-pulse">
              <CardContent className="h-16 p-4" />
            </Card>
          ))}
        </div>
      )}

      {error && !isLoading && (
        <Card>
          <CardContent className="py-6 text-sm text-red-600">Failed to load clients.</CardContent>
        </Card>
      )}

      {!isLoading && !error && clients && <ClientList clients={clients} deletingId={deletingId} onDelete={deleteClient} />}
    </section>
  );
}
