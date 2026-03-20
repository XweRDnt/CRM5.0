/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppThemeShell } from "../AppThemeShell";

const usePathnameMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

describe("AppThemeShell", () => {
  it("does not wrap dashboard routes in the legacy ios shell", () => {
    usePathnameMock.mockReturnValue("/projects");

    render(
      <AppThemeShell>
        <div data-testid="content">dashboard</div>
      </AppThemeShell>,
    );

    expect(screen.getByTestId("content").closest("[data-app-shell='ios']")).toBeNull();
  });

  it("keeps the public auth shell unwrapped as plain content", () => {
    usePathnameMock.mockReturnValue("/login");

    render(
      <AppThemeShell>
        <div data-testid="content">login</div>
      </AppThemeShell>,
    );

    expect(screen.getByTestId("content").closest("[data-app-shell='ios']")).toBeNull();
  });
});
