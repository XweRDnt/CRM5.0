/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SidebarToggleButton } from "../SidebarToggleButton";

describe("SidebarToggleButton", () => {
  it("renders a compact mobile-only dashboard menu trigger", () => {
    const handleOpen = vi.fn();

    render(<SidebarToggleButton onClick={handleOpen} />);

    const button = screen.getByRole("button", { name: "Открыть меню" });
    expect(button.className).toContain("lg:hidden");
    expect(button.className).toContain("h-10");
    expect(button.className).toContain("w-10");

    fireEvent.click(button);
    expect(handleOpen).toHaveBeenCalledTimes(1);
  });
});
