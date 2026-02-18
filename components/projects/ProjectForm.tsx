"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type ProjectFormValues = {
  name: string;
  description?: string;
  brief?: string;
  revisionsLimit: number;
};

type ProjectFormProps = {
  defaultValues?: Partial<ProjectFormValues>;
  submitLabel?: string;
  loadingLabel?: string;
  disabled?: boolean;
  onSubmit: (values: ProjectFormValues) => Promise<void> | void;
};

export function ProjectForm({
  defaultValues,
  submitLabel = "Save Project",
  loadingLabel = "Saving...",
  disabled = false,
  onSubmit,
}: ProjectFormProps): JSX.Element {
  const [values, setValues] = useState<ProjectFormValues>({
    name: defaultValues?.name ?? "",
    description: defaultValues?.description ?? "",
    brief: defaultValues?.brief ?? "",
    revisionsLimit: defaultValues?.revisionsLimit ?? 3,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        ...values,
        description: values.description?.trim() || undefined,
        brief: values.brief?.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="project-name">Project Name</Label>
        <Input
          id="project-name"
          required
          value={values.name}
          onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="project-description">Description</Label>
        <Textarea
          id="project-description"
          rows={3}
          value={values.description}
          onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="project-brief">Brief / SOW</Label>
        <Textarea
          id="project-brief"
          rows={5}
          value={values.brief}
          onChange={(event) => setValues((current) => ({ ...current, brief: event.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="project-revisions">Revisions Limit</Label>
        <Input
          id="project-revisions"
          min={1}
          type="number"
          value={values.revisionsLimit}
          onChange={(event) =>
            setValues((current) => ({ ...current, revisionsLimit: Math.max(1, Number(event.target.value) || 1) }))
          }
        />
      </div>

      <Button disabled={disabled || saving} type="submit">
        {saving ? loadingLabel : submitLabel}
      </Button>
    </form>
  );
}
