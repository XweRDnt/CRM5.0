/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminTopNav } from "../AdminTopNav";

const usePathnameMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

describe("AdminTopNav", () => {
  it("highlights the overview tab on /admin", () => {
    usePathnameMock.mockReturnValue("/admin");

    render(<AdminTopNav />);

    expect(screen.getByRole("link", { name: "Обзор" }).getAttribute("data-active")).toBe("true");
    expect(screen.getByRole("link", { name: "Workspace" }).getAttribute("data-active")).toBe("false");
  });

  it("highlights nested admin routes by prefix", () => {
    usePathnameMock.mockReturnValue("/admin/workspaces");

    render(<AdminTopNav />);

    expect(screen.getByRole("link", { name: "Workspace" }).getAttribute("data-active")).toBe("true");
    expect(screen.getByRole("link", { name: "Тарифы" }).getAttribute("data-active")).toBe("false");
  });
});
