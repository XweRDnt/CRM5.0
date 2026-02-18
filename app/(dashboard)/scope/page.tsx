"use client";

import useSWR from "swr";
import { ScopeDecisionCard } from "@/components/scope/scope-decision-card";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/utils/client-api";
import type { ScopeDecisionResponse } from "@/types";

const fetcher = (url: string) => apiFetch<ScopeDecisionResponse[]>(url);

export default function ScopeDecisionsPage(): JSX.Element {
  const { data, error, isLoading, mutate } = useSWR("/api/scope/decisions", fetcher);

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Scope Guard</h1>
        <p className="text-sm text-neutral-500">Approve or reject out-of-scope feedback requests.</p>
      </header>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={`scope-skeleton-${index}`} className="animate-pulse">
              <CardContent className="h-48 p-6" />
            </Card>
          ))}
        </div>
      )}

      {error && !isLoading && (
        <Card>
          <CardContent className="py-6 text-sm text-red-600">Failed to load scope decisions.</CardContent>
        </Card>
      )}

      {!isLoading && !error && (data?.length ?? 0) === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-neutral-500">No scope decisions found.</CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {data?.map((decision) => (
          <ScopeDecisionCard key={decision.id} decision={decision} onUpdated={() => void mutate()} />
        ))}
      </div>
    </section>
  );
}
