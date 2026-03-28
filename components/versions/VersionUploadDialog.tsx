"use client";

import { useState, type ReactNode } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { VersionUploadFlow } from "@/components/versions/VersionUploadFlow";

type VersionUploadDialogProps = {
  projectId: string;
  triggerText?: string;
  triggerContent?: ReactNode;
  triggerClassName?: string;
  triggerVariant?: ButtonProps["variant"];
  triggerSize?: ButtonProps["size"];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function VersionUploadDialog({
  projectId,
  triggerText,
  triggerContent,
  triggerClassName,
  triggerVariant = "default",
  triggerSize = "default",
  open: controlledOpen,
  onOpenChange,
}: VersionUploadDialogProps): JSX.Element {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const hasTrigger = Boolean(triggerContent ?? triggerText);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {hasTrigger ? (
        <DialogTrigger asChild>
          <Button type="button" className={triggerClassName} variant={triggerVariant} size={triggerSize}>
            {triggerContent ?? triggerText}
          </Button>
        </DialogTrigger>
      ) : null}

      <DialogContent className="!w-[min(860px,92vw)] !max-w-[860px] !overflow-hidden !rounded-[28px] !border-white/10 !bg-[linear-gradient(180deg,rgba(16,18,29,0.98),rgba(8,10,18,0.98))] !p-0 !text-neutral-100 !shadow-[0_34px_120px_rgba(0,0,0,0.56)] !backdrop-blur-[32px]">
        <div className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(67,87,255,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.12),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_18%)]"
          />

          <div className="relative border-b border-white/10 px-5 pb-3 pt-4 sm:px-6">
            <DialogHeader>
              <DialogTitle className="text-[22px] font-semibold tracking-[-0.04em] text-neutral-100">
                Загрузить видео
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="relative min-h-0 p-4">
            <VersionUploadFlow
              projectId={projectId}
              surface="dialog"
              onCancel={() => setOpen(false)}
              onCompleted={() => setOpen(false)}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
