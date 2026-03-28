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
    const profileCard = screen.getByText("OWNER").closest("div");

    expect(aside?.className).toContain("sidebar-shell-macos");
    expect(aside?.className).toContain("w-72");
    expect(aside?.className).toContain("lg:w-64");
    expect(aside?.className).toContain("z-[60]");
    expect(nav.className).toContain("glass-item");
    expect(nav.className).toContain("sidebar-nav-frosted");
    expect(nav.className).toContain("sidebar-nav-macos");
    expect(profileCard?.className).toContain("glass-item");
  });

  it("navigates with router.push and closes the drawer when a nav item is pressed", () => {
    usePathnameMock.mockReturnValue("/projects/project-1/versions/version-1");
    const onClose = vi.fn();

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

    fireEvent.click(screen.getByRole("button", { name: "Команда" }));

    expect(pushMock).toHaveBeenCalledWith("/team");
    expect(onClose).toHaveBeenCalled();
  });
});
