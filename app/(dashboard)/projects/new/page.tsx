"use client";

import { useRouter } from "next/navigation";
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog";

export default function NewProjectPage(): JSX.Element {
  const router = useRouter();

  return (
    <section className="relative flex min-h-[calc(100vh-8rem)] items-center justify-center overflow-hidden px-4">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(67,87,255,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.1),transparent_24%)]"
      />
      <CreateProjectDialog
        trigger={<span className="hidden" aria-hidden="true" />}
        open
        onOpenChange={(open) => {
          if (!open) {
            router.replace("/projects");
          }
        }}
      />
    </section>
  );
}
