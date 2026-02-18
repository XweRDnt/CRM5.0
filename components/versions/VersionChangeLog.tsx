"use client";

import { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";

type VersionChangeLogProps = {
  changeLog: string | null;
  editable?: boolean;
  onChange?: (value: string) => void;
  placeholder?: string;
};

export function VersionChangeLog({
  changeLog,
  editable = false,
  onChange,
  placeholder = "Опишите, что изменилось в этой версии...",
}: VersionChangeLogProps): JSX.Element {
  const [value, setValue] = useState(changeLog ?? "");

  useEffect(() => {
    setValue(changeLog ?? "");
  }, [changeLog]);

  if (!editable) {
    return <p className="text-sm text-neutral-600">{changeLog?.trim() || "Пока нет описания изменений."}</p>;
  }

  return (
    <Textarea
      value={value}
      onChange={(event) => {
        const next = event.target.value;
        setValue(next);
        onChange?.(next);
      }}
      placeholder={placeholder}
      className="min-h-24"
    />
  );
}
