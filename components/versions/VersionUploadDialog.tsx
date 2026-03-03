"use client";

import { useState } from "react";
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" className={triggerClassName} variant={triggerVariant} size={triggerSize}>
          {triggerText}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Загрузить новую версию</DialogTitle>
          <DialogDescription>
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
