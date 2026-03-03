"use client";

import { useEffect, useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { VersionUploadFlow } from "@/components/versions/VersionUploadFlow";

type VersionUploadDialogProps = {
  projectId: string;
  triggerText: string;
  triggerClassName?: string;
  triggerVariant?: ButtonProps["variant"];
  triggerSize?: ButtonProps["size"];
};

export function VersionUploadDialog({
  projectId,
  triggerText,
  triggerClassName,
  triggerVariant = "default",
  triggerSize = "default",
}: VersionUploadDialogProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [appTheme, setAppTheme] = useState<"light" | "dark">("light");

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" className={triggerClassName} variant={triggerVariant} size={triggerSize}>
          {triggerText}
        </Button>
      </DialogTrigger>
      <DialogContent
        className={
          appTheme === "dark"
            ? "version-upload-dialog max-w-2xl !border-slate-700 !bg-slate-900/95 !text-neutral-100"
            : "version-upload-dialog max-w-2xl !border-neutral-200 !bg-white !text-neutral-900"
        }
      >
        <DialogHeader>
          <DialogTitle className={appTheme === "dark" ? "text-neutral-100" : "text-neutral-900"}>
            Загрузить новую версию
          </DialogTitle>
          <DialogDescription className={appTheme === "dark" ? "text-neutral-400" : "text-neutral-600"}>
            Добавьте видео, проверьте номер версии и загрузите файл.
          </DialogDescription>
        </DialogHeader>
        <VersionUploadFlow
          projectId={projectId}
          surface="dialog"
          onCancel={() => setOpen(false)}
          onCompleted={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
