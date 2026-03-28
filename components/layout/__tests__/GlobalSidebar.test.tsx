/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { GlobalSidebar } from "../GlobalSidebar";

const usePathnameMock = vi.fn();
const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
  useRouter: () => ({
    push: pushMock,
  }),
}));

describe("GlobalSidebar", () => {
  const user = {
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

  it("renders a fixed desktop sidebar and a bounded mobile drawer", () => {
    usePathnameMock.mockReturnValue("/projects");

    render(<GlobalSidebar user={user} open onClose={() => {}} />);

    const complementary = screen.getAllByRole("complementary");
    const mobileDrawer = complementary.find((node) => node.className.includes("max-w-[320px]"));
    const desktopSidebar = complementary.find((node) => node.className.includes("lg:w-[280px]"));

    expect(mobileDrawer).toBeTruthy();
    expect(mobileDrawer?.className).toContain("w-[min(86vw,320px)]");
    expect(desktopSidebar).toBeTruthy();
    expect(desktopSidebar?.className).toContain("lg:w-[280px]");
  });

  it("keeps the interface visible behind the mobile drawer and closes after navigation", () => {
    usePathnameMock.mockReturnValue("/projects/project-1/versions/version-1");
    const onClose = vi.fn();

    render(<GlobalSidebar user={user} open onClose={onClose} />);

    const backdrop = screen.getAllByLabelText("Закрыть меню").find((node) => node.className.includes("bg-slate-950/45"));
    expect(backdrop).toBeTruthy();
    expect(backdrop?.className).toContain("bg-slate-950/45");

    fireEvent.click(screen.getAllByRole("button", { name: /команда/i })[0]);

    expect(pushMock).toHaveBeenCalledWith("/team");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
