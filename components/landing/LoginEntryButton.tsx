"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LoginEntryButton(): JSX.Element {
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  const onClick = async (): Promise<void> => {
    if (checking) {
      return;
    }

    setChecking(true);

    try {
      const token = localStorage.getItem("token");

      if (token) {
        const response = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          router.push("/projects");
          return;
        }
      }

      router.push("/login");
    } catch {
      router.push("/login");
    } finally {
      setChecking(false);
    }
  };

  return (
    <Button type="button" size="sm" variant="outline" onClick={() => void onClick()} disabled={checking}>
      {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Вход"}
    </Button>
  );
}
