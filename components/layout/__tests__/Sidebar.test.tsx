/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "../Sidebar";

const usePathnameMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

describe("Sidebar", () => {
  it("renders the sidebar with the macos glass treatment", () => {
    usePathnameMock.mockReturnValue("/projects");

    render(
      <Sidebar
        user={{
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
        }}
        open
        onClose={() => {}}
      />,
    );

    const aside = screen.getByText("ProdStudio").closest("aside");
    const nav = screen.getByRole("navigation");

    expect(aside?.className).toContain("sidebar-shell-macos");
    expect(nav.className).toContain("sidebar-nav-frosted");
    expect(nav.className).toContain("sidebar-nav-macos");
  });
});
