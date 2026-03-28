/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Sidebar } from "../Sidebar";

const usePathnameMock = vi.fn();
const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
  useRouter: () => ({
    push: pushMock,
  }),
}));

describe("Sidebar", () => {
  it("renders the mobile drawer outside the dashboard tree to avoid project layout stacking issues", () => {
    usePathnameMock.mockReturnValue("/projects");

    const { container } = render(
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

    const desktopAside = container.querySelector("aside");
    const mobileAside = Array.from(document.body.querySelectorAll("aside")).find((aside) => !container.contains(aside));
    const nav = screen.getAllByRole("navigation")[0];
    const profileCard = screen.getAllByText("OWNER")[0]?.closest("div");

    expect(mobileAside).toBeTruthy();
    expect(desktopAside).toBeTruthy();
    expect(mobileAside?.className).toContain("sidebar-shell-macos");
    expect(mobileAside?.className).toContain("w-72");
    expect(container.contains(mobileAside ?? null)).toBe(false);
    expect(document.body.contains(mobileAside ?? null)).toBe(true);
    expect(desktopAside?.className).toContain("sidebar-shell-macos");
    expect(desktopAside?.className).toContain("w-64");
    expect(desktopAside?.className).toContain("lg:flex");
    expect(nav.className).toContain("glass-item");
    expect(nav.className).toContain("sidebar-nav-frosted");
    expect(nav.className).toContain("sidebar-nav-macos");
    expect(profileCard?.className).toContain("glass-item");
  });

  it("starts navigation before closing the drawer when a nav item is pressed", () => {
    usePathnameMock.mockReturnValue("/projects/project-1/versions/version-1");
    const callOrder: string[] = [];
    const onClose = vi.fn(() => {
      callOrder.push("close");
    });
    pushMock.mockImplementation(() => {
      callOrder.push("push");
    });

    render(
      <Sidebar
        user={{
          id: "user-1",
          firstName: "Pasha",
          lastName: "Durov",
          email: "pasha@example.com",
          role: "OWNER",
          isAdmin: true,
          tenant: {
            id: "tenant-1",
            name: "ProdStudio",
            slug: "prodstudio",
          },
        }}
        open
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: /команда/i })[0]);

    expect(pushMock).toHaveBeenCalledWith("/team");
    expect(onClose).toHaveBeenCalled();
    expect(callOrder).toEqual(["push", "close"]);
  });
});
