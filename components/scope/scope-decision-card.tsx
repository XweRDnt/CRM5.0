"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/utils/client-api";
import type { ScopeDecisionResponse } from "@/types";

const aiLabelVariant: Record<ScopeDecisionResponse["aiLabel"], "success" | "error" | "warning"> = {
  IN_SCOPE: "success",
  OUT_OF_SCOPE: "error",
  UNCLEAR: "warning",
};

type ScopeDecisionCardProps = {
  decision: ScopeDecisionResponse;
  onUpdated: () => void;
};

export function ScopeDecisionCard({ decision, onUpdated }: ScopeDecisionCardProps): JSX.Element {
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState(decision.pmReason ?? "");
  const [amount, setAmount] = useState(decision.changeRequestAmount?.toString() ?? "");

  const submitDecision = async (pmDecision: "APPROVED" | "REJECTED" | "NEEDS_INFO"): Promise<void> => {
    setLoading(true);
    try {
      await apiFetch(`/api/scope/decisions/${decision.id}/decide`, {
        method: "POST",
        body: JSON.stringify({
          decision: pmDecision,
          reason: reason || undefined,
          changeRequestAmount: amount ? Number(amount) : undefined,
        }),
      });
      toast.success("Scope decision updated");
      onUpdated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update scope decision");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">Scope Decision</CardTitle>
          <Badge variant={aiLabelVariant[decision.aiLabel]}>{decision.aiLabel}</Badge>
          {decision.pmDecision && <Badge variant="secondary">PM: {decision.pmDecision}</Badge>}
        </div>
        <p className="text-sm text-neutral-600">AI confidence: {Math.round(decision.aiConfidence * 100)}%</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {decision.aiReasoning && <p className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">{decision.aiReasoning}</p>}
        <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="PM reason (optional)" />
        <Input
          type="number"
          min={0}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="Change request amount (optional)"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={loading} onClick={() => void submitDecision("APPROVED")}>
            Approve
          </Button>
          <Button type="button" variant="destructive" disabled={loading} onClick={() => void submitDecision("REJECTED")}>
            Reject
          </Button>
          <Button type="button" variant="outline" disabled={loading} onClick={() => void submitDecision("NEEDS_INFO")}>
            Needs Info
          </Button>
        </div>
        {loading && (
          <p className="flex items-center gap-2 text-xs text-neutral-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Saving decision...
          </p>
        )}
      </CardContent>
    </Card>
  );
}
