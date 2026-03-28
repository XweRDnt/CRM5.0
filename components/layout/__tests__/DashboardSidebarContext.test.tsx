/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { DashboardSidebarProvider, useDashboardSidebar } from "../dashboard-sidebar-context";

function TestConsumer(): JSX.Element {
  const { sidebarOpen, openSidebar, closeSidebar } = useDashboardSidebar();

  return (
    <div>
      <span data-testid="sidebar-state">{sidebarOpen ? "open" : "closed"}</span>
      <button type="button" onClick={openSidebar}>
        open
      </button>
      <button type="button" onClick={closeSidebar}>
        close
      </button>
    </div>
  );
}

describe("DashboardSidebarProvider", () => {
  it("shares sidebar state across nested consumers", () => {
    render(
      <DashboardSidebarProvider>
        <TestConsumer />
      </DashboardSidebarProvider>,
    );

    expect(screen.getByTestId("sidebar-state").textContent).toBe("closed");

    fireEvent.click(screen.getByRole("button", { name: "open" }));
    expect(screen.getByTestId("sidebar-state").textContent).toBe("open");

    fireEvent.click(screen.getByRole("button", { name: "close" }));
    expect(screen.getByTestId("sidebar-state").textContent).toBe("closed");
  });
});
