"use client";

import { useRouter } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { mutate } from "swr";
import { Button } from "@/components/ui/button";
import { getMessages } from "@/lib/i18n/messages";
import type { AuthUser } from "@/lib/hooks/use-auth-guard";

type HeaderProps = {
  user: AuthUser;
  onOpenSidebar: () => void;
};

export function Header({ user, onOpenSidebar }: HeaderProps): JSX.Element {
  const router = useRouter();
  const m = getMessages();

  const logout = async (): Promise<void> => {
    await mutate(() => true, undefined, { revalidate: false });
    localStorage.removeItem("token");
    localStorage.removeItem("tenantId");
    router.replace("/login");
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-neutral-200 bg-white/90 px-4 backdrop-blur lg:px-6">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={onOpenSidebar} className="lg:hidden">
          <Menu className="h-4 w-4" />
        </Button>
        <div>
          <p className="text-sm font-semibold text-neutral-900">{m.header.welcome}</p>
          <p className="text-xs text-neutral-500">
            {user.firstName} {user.lastName}
          </p>
        </div>
      </div>
      <Button variant="outline" onClick={() => void logout()} className="shrink-0">
        <LogOut className="h-4 w-4 sm:mr-2" />
        <span className="hidden sm:inline">{m.header.logout}</span>
      </Button>
    </header>
  );
}
