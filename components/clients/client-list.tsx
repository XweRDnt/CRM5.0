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
      <Card className="glass-card">
        <CardContent className="py-10 text-center text-sm glass-muted">
          No clients yet. Add the first client to create projects.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="glass-table overflow-hidden">
      <div className="hidden grid-cols-[2fr_2fr_1fr_auto] gap-4 glass-table-head px-4 py-3 text-xs font-semibold uppercase tracking-wide glass-muted md:grid">
        <span>Name</span>
        <span>Email</span>
        <span>Company</span>
        <span className="text-right">Actions</span>
      </div>
      <div>
        {clients.map((client) => (
          <article key={client.id} className="glass-table-row grid gap-3 px-4 py-4 md:grid-cols-[2fr_2fr_1fr_auto] md:items-center">
            <div>
              <p className="font-medium">{client.name}</p>
              <p className="text-xs glass-muted md:hidden">{client.email}</p>
            </div>
            <p className="hidden text-sm glass-muted md:block">{client.email}</p>
            <p className="text-sm glass-muted">{client.companyName || "вЂ”"}</p>
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

