"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NewProjectPage(): JSX.Element {
  const router = useRouter();

  useEffect(() => {
    router.replace("/projects?create=1");
  }, [router]);

  return (
    <section className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
      <p className="text-sm text-white/60">Открываем создание проекта...</p>
    </section>
  );
}
