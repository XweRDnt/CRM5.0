/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MobileMenuButton } from "../MobileMenuButton";

describe("MobileMenuButton", () => {
  it("renders the shared ghost menu button contract for mobile headers", () => {
    const handleOpen = vi.fn();

    render(<MobileMenuButton onClick={handleOpen} />);

    const button = screen.getByRole("button", { name: "Открыть меню" });
    expect(button.getAttribute("data-variant")).toBe("ghost");
    expect(button.className).toContain("ui-btn");
    expect(button.className).toContain("lg:hidden");
    expect(button.className).toContain("h-9");

    fireEvent.click(button);
    expect(handleOpen).toHaveBeenCalledTimes(1);
  });
});
