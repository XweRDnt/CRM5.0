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
            ? "version-upload-dialog !w-[min(1100px,96vw)] !max-w-[1100px] !overflow-hidden !rounded-[32px] !border-white/10 !bg-[linear-gradient(180deg,rgba(16,18,29,0.97),rgba(9,11,19,0.97))] !p-0 !text-neutral-100 !shadow-[0_34px_120px_rgba(0,0,0,0.52)] !backdrop-blur-[30px]"
            : "version-upload-dialog !w-[min(1100px,96vw)] !max-w-[1100px] !overflow-hidden !rounded-[32px] !border-neutral-200/70 !bg-white/96 !p-0 !text-neutral-900 !shadow-[0_34px_120px_rgba(15,23,42,0.18)] !backdrop-blur-[30px]"
        }
      >
        <div className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className={
              appTheme === "dark"
                ? "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(67,87,255,0.24),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.16),transparent_32%)]"
                : "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.16),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.12),transparent_32%)]"
            }
          />

          <div className="relative p-6 sm:p-7">
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
                    ? "text-[30px] font-semibold tracking-[-0.04em] text-neutral-100"
                    : "text-[30px] font-semibold tracking-[-0.04em] text-neutral-900"
                }
              >
                Загрузить новую версию
              </DialogTitle>
              <DialogDescription
                className={appTheme === "dark" ? "max-w-xl text-sm leading-6 text-white/62" : "max-w-xl text-sm leading-6 text-neutral-600"}
              >
                Добавьте видео, проверьте название версии и загрузите файл в одном окне.
              </DialogDescription>
            </DialogHeader>

            <div
              className={
                appTheme === "dark"
                  ? "mt-6 rounded-[28px] border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl sm:p-5"
                  : "mt-6 rounded-[28px] border border-neutral-200/80 bg-white/75 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-xl sm:p-5"
              }
            >
              <VersionUploadFlow
                projectId={projectId}
                surface="dialog"
                onCancel={() => setOpen(false)}
                onCompleted={() => setOpen(false)}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
