/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { VersionDetailMobileSidebar } from "../VersionDetailMobileSidebar";

const sidebarSpy = vi.fn();

vi.mock("@/components/layout/Sidebar", () => ({
  Sidebar: (props: unknown) => {
    sidebarSpy(props);
    return <div data-testid="shared-sidebar" />;
  },
}));

describe("VersionDetailMobileSidebar", () => {
  it("reuses the shared dashboard sidebar instead of a local mobile drawer", () => {
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
    const onClose = vi.fn();

    render(<VersionDetailMobileSidebar user={user} open onClose={onClose} />);

    expect(screen.getByTestId("shared-sidebar")).toBeTruthy();
    expect(sidebarSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        user,
        open: true,
        onClose,
      }),
    );
  });
});
