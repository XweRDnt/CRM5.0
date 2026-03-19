"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ConfirmDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Удалить",
  loading = false,
  onConfirm,
}: ConfirmDeleteDialogProps): JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-md !rounded-[28px] !border-white/10 !bg-[linear-gradient(180deg,rgba(18,20,31,0.96),rgba(10,12,20,0.96))] !p-6 !text-white !shadow-[0_30px_80px_rgba(0,0,0,0.45)] !backdrop-blur-2xl">
        <DialogHeader className="mb-0 space-y-3">
          <DialogTitle className="text-[22px] font-semibold tracking-[-0.03em] text-white">{title}</DialogTitle>
          <DialogDescription className="text-sm leading-6 text-white/62">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-6 flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white/82 hover:bg-white/[0.08] hover:text-white sm:w-auto"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Отмена
          </Button>
          <Button
            type="button"
            className="w-full rounded-2xl border border-red-400/20 bg-[linear-gradient(135deg,rgba(185,28,28,0.72),rgba(239,68,68,0.54))] px-4 py-3 text-white shadow-[0_12px_30px_rgba(127,29,29,0.28)] hover:opacity-95 sm:w-auto"
            onClick={() => void onConfirm()}
            disabled={loading}
          >
            {loading ? "Удаление..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
