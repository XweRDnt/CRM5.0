"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  const [appTheme, setAppTheme] = useState<"light" | "dark">("light");
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const root = document.documentElement;
    const readTheme = (): void => {
      setAppTheme(root.getAttribute("data-app-theme") === "dark" ? "dark" : "light");
    };

    readTheme();
    const observer = new MutationObserver(readTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["data-app-theme"] });
    return () => observer.disconnect();
  }, []);

  const hasTrigger = Boolean(triggerContent ?? triggerText);
  const titleClassName = appTheme === "dark" ? "text-neutral-100" : "text-neutral-100";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {hasTrigger ? (
        <DialogTrigger asChild>
          <Button type="button" className={triggerClassName} variant={triggerVariant} size={triggerSize}>
            {triggerContent ?? triggerText}
          </Button>
        </DialogTrigger>
      ) : null}

      <DialogContent className="!w-[min(960px,94vw)] !max-w-[960px] !overflow-hidden !rounded-[30px] !border-white/10 !bg-[linear-gradient(180deg,rgba(16,18,29,0.98),rgba(9,11,19,0.98))] !p-0 !text-neutral-100 !shadow-[0_34px_120px_rgba(0,0,0,0.52)] !backdrop-blur-[30px]">
        <div className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(67,87,255,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.12),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_18%)]"
          />

          <div className="relative border-b border-white/10 px-5 pb-4 pt-5 sm:px-6">
            <DialogHeader className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300/80">Upload Flow</p>
              <DialogTitle className={`text-[28px] font-semibold tracking-[-0.04em] ${titleClassName}`}>
                Загрузить новую версию
              </DialogTitle>
              <DialogDescription className="max-w-xl text-sm leading-6 text-white/62">
                Тёмная компактная модалка с быстрым названием версии и удобной drag-and-drop зоной без лишнего шума.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="relative min-h-0 p-4 sm:p-5">
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
