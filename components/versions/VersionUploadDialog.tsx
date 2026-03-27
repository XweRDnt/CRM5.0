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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {hasTrigger ? (
        <DialogTrigger asChild>
          <Button type="button" className={triggerClassName} variant={triggerVariant} size={triggerSize}>
            {triggerContent ?? triggerText}
          </Button>
        </DialogTrigger>
      ) : null}

      <DialogContent
        className={
          appTheme === "dark"
            ? "!h-[min(92vh,920px)] !w-[min(1320px,97vw)] !max-w-[1320px] !overflow-hidden !rounded-[36px] !border-white/10 !bg-[linear-gradient(180deg,rgba(10,12,20,0.98),rgba(6,9,16,0.98))] !p-0 !text-neutral-100 !shadow-[0_40px_140px_rgba(0,0,0,0.58)] !backdrop-blur-[34px]"
            : "!h-[min(92vh,920px)] !w-[min(1320px,97vw)] !max-w-[1320px] !overflow-hidden !rounded-[36px] !border-neutral-200/70 !bg-white/96 !p-0 !text-neutral-900 !shadow-[0_34px_120px_rgba(15,23,42,0.18)] !backdrop-blur-[30px]"
        }
      >
        <div className="relative flex h-full flex-col overflow-hidden">
          <div
            aria-hidden="true"
            className={
              appTheme === "dark"
                ? "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(67,87,255,0.2),transparent_28%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.14),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_18%)]"
                : "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_28%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.1),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.7),transparent_18%)]"
            }
          />

          <div className="relative border-b border-white/10 px-6 pb-5 pt-6 sm:px-8">
            <DialogHeader className="space-y-3">
              <p
                className={
                  appTheme === "dark"
                    ? "text-xs font-semibold uppercase tracking-[0.24em] text-blue-300/80"
                    : "text-xs font-semibold uppercase tracking-[0.24em] text-blue-600/80"
                }
              >
                Upload Flow
              </p>
              <DialogTitle
                className={
                  appTheme === "dark"
                    ? "text-[32px] font-semibold tracking-[-0.05em] text-neutral-100"
                    : "text-[32px] font-semibold tracking-[-0.05em] text-neutral-900"
                }
              >
                Загрузить новую версию
              </DialogTitle>
              <DialogDescription
                className={
                  appTheme === "dark"
                    ? "max-w-2xl text-sm leading-6 text-white/62"
                    : "max-w-2xl text-sm leading-6 text-neutral-600"
                }
              >
                Большая зона перетаскивания, автоназвание версии и быстрый путь до готового review-flow без лишних шагов.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="relative min-h-0 flex-1 p-4 sm:p-6">
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
