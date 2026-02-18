"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getMessages } from "@/lib/i18n/messages";
import { formatTimecode } from "@/lib/utils/time";

type FeedbackFormProps = {
  versionId: string;
  capturedTimecodeSec?: number | null;
  onSubmitted?: () => void;
  darkTheme?: boolean;
  disabled?: boolean;
  disabledReason?: string;
};

export function FeedbackForm({
  versionId,
  capturedTimecodeSec,
  onSubmitted,
  darkTheme = false,
  disabled = false,
  disabledReason,
}: FeedbackFormProps): JSX.Element {
  const m = getMessages();
  const [authorName, setAuthorName] = useState("");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fieldClass = darkTheme
    ? "border-white/20 bg-white/10 text-slate-100 placeholder:text-slate-400 focus:ring-1 focus:ring-white/30 focus:border-white/40"
    : "";

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setSubmitting(true);

    try {
      await fetch("/api/public/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetVersionId: versionId,
          authorType: "CLIENT",
          authorName,
          text,
          timecodeSec: capturedTimecodeSec ?? undefined,
        }),
      }).then(async (response) => {
        if (!response.ok) {
          const json = (await response.json()) as { error?: string };
          throw new Error(json.error || "Failed to submit feedback");
        }
      });

      setText("");
      toast.success(m.feedback.submitSuccess);
      onSubmitted?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : m.feedback.submitError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {disabledReason && <p className="text-sm text-amber-600">{disabledReason}</p>}
      <Input
        className={fieldClass}
        placeholder={m.feedback.authorPlaceholder}
        value={authorName}
        onChange={(event) => setAuthorName(event.target.value)}
        required
        disabled={disabled}
      />
      <Input
        className={fieldClass}
        value={capturedTimecodeSec !== null && capturedTimecodeSec !== undefined ? formatTimecode(capturedTimecodeSec) : ""}
        placeholder={m.feedback.timecodePlaceholder}
        readOnly
        disabled={disabled}
      />
      <Textarea
        className={fieldClass}
        rows={6}
        placeholder={m.feedback.textPlaceholder}
        value={text}
        onChange={(event) => setText(event.target.value)}
        required
        disabled={disabled}
      />
      <Button type="submit" className="w-full" disabled={submitting || disabled}>
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {m.feedback.submitting}
          </>
        ) : (
          m.feedback.submit
        )}
      </Button>
    </form>
  );
}
