"use client";

import Link from "next/link";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ClientResponse } from "@/types";

type ClientListProps = {
  clients: ClientResponse[];
  deletingId?: string;
  onDelete: (id: string) => void;
};

export function ClientList({ clients, deletingId, onDelete }: ClientListProps): JSX.Element {
  if (clients.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-neutral-500">
          No clients yet. Add the first client to create projects.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="hidden grid-cols-[2fr_2fr_1fr_auto] gap-4 border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 md:grid">
        <span>Name</span>
        <span>Email</span>
        <span>Company</span>
        <span className="text-right">Actions</span>
      </div>
      <div className="divide-y divide-neutral-200">
        {clients.map((client) => (
          <article key={client.id} className="grid gap-3 px-4 py-4 md:grid-cols-[2fr_2fr_1fr_auto] md:items-center">
            <div>
              <p className="font-medium text-neutral-900">{client.name}</p>
              <p className="text-xs text-neutral-500 md:hidden">{client.email}</p>
            </div>
            <p className="hidden text-sm text-neutral-600 md:block">{client.email}</p>
            <p className="text-sm text-neutral-600">{client.companyName || "—"}</p>
            <div className="flex justify-end gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/clients/${client.id}/edit`}>Edit</Link>
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={deletingId === client.id}
                onClick={() => onDelete(client.id)}
              >
                {deletingId === client.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
