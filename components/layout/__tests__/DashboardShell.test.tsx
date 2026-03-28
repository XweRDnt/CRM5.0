/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DashboardUserProvider } from "@/components/auth/dashboard-user-context";
import { DashboardSidebarProvider } from "../dashboard-sidebar-context";
import type { AuthUser } from "@/lib/hooks/use-auth-guard";
import { DashboardShell } from "../DashboardShell";

const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

vi.mock("../Header", () => ({
  Header: ({ onOpenSidebar }: { onOpenSidebar: () => void }) => (
    <button type="button" onClick={onOpenSidebar}>
      global-header
    </button>
  ),
}));

vi.mock("../Sidebar", () => ({
  Sidebar: ({ open, onClose }: { open: boolean; onClose: () => void }) => (
    <div>
      <span data-testid="sidebar-state">{open ? "open" : "closed"}</span>
      <button type="button" onClick={onClose}>
        close-sidebar
      </button>
    </div>
  ),
}));

const user: AuthUser = {
  id: "user-1",
  firstName: "Pasha",
  lastName: "Durov",
  email: "pasha@example.com",
  role: "OWNER",
  isAdmin: false,
  tenant: {
    id: "tenant-1",
    name: "ProdStudio",
    slug: "prodstudio",
  },
};

function renderShell(pathname: string): void {
  render(
    <DashboardUserProvider user={user}>
      <DashboardSidebarProvider>
        <DashboardShell pathname={pathname}>
          <div>page-body</div>
        </DashboardShell>
      </DashboardSidebarProvider>
    </DashboardUserProvider>,
  );
}

describe("DashboardShell", () => {
  it("keeps the global header available on project version routes", () => {
    renderShell("/projects/project-1/versions/version-1");

    expect(screen.getByRole("button", { name: "global-header" })).toBeTruthy();
    expect(screen.getByText("page-body")).toBeTruthy();
  });

  it("opens the shared sidebar from the global header", () => {
    renderShell("/projects");

    expect(screen.getByTestId("sidebar-state").textContent).toBe("closed");
    fireEvent.click(screen.getByRole("button", { name: "global-header" }));
    expect(screen.getByTestId("sidebar-state").textContent).toBe("open");
  });
});
