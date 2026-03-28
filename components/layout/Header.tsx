"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { mutate } from "swr";
import { Button } from "@/components/ui/button";
import { getMessages } from "@/lib/i18n/messages";
import { clearWorkspaceDemoToken } from "@/lib/utils/client-api";
import type { AuthUser } from "@/lib/hooks/use-auth-guard";
import { MobileMenuButton } from "./MobileMenuButton";

type HeaderProps = {
  user: AuthUser;
  onOpenSidebar: () => void;
};

export function Header({ user, onOpenSidebar }: HeaderProps): JSX.Element {
  const router = useRouter();
  const m = getMessages();

  const logout = async (): Promise<void> => {
    await mutate(() => true, undefined, { revalidate: false });
    clearWorkspaceDemoToken();
    localStorage.removeItem("token");
    localStorage.removeItem("tenantId");
    router.replace("/login");
  };

  return (
    <header className="glass-topbar flex h-16 items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <MobileMenuButton onClick={onOpenSidebar} />
        <div>
          <p className="text-sm font-semibold">{m.header.welcome}</p>
          <p className="text-xs glass-muted">
            {user.firstName} {user.lastName}
          </p>
          {user.isDemo ? <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-amber-300">Demo Read Only</p> : null}
        </div>
      </div>
      <Button variant="outline" onClick={() => void logout()} className="shrink-0">
        <LogOut className="h-4 w-4 sm:mr-2" />
        <span className="hidden sm:inline">{m.header.logout}</span>
      </Button>
    </header>
  );
}
