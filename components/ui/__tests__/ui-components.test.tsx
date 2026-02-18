/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LoadingSpinner } from "../loading-spinner";
import { Skeleton } from "../skeleton";
import { EmptyState } from "../empty-state";
import { ErrorBoundary } from "../error-boundary";
import { MobileSidebar } from "../../layout/mobile-sidebar";
import { PageHeader } from "../../layout/page-header";

describe("UI Components", () => {
  describe("LoadingSpinner", () => {
    it("should render spinner", () => {
      render(<LoadingSpinner />);
      expect(screen.getByTestId("loading-spinner-icon")).not.toBeNull();
    });

    it("should render with text", () => {
      render(<LoadingSpinner text="Loading..." />);
      expect(screen.getByText("Loading...")).not.toBeNull();
    });

    it("should apply size classes", () => {
      render(<LoadingSpinner size="lg" />);
      const className = screen.getByTestId("loading-spinner-icon").getAttribute("class") ?? "";
      expect(className).toContain("h-8");
      expect(className).toContain("w-8");
    });
  });

  describe("Skeleton", () => {
    it("should render text skeleton", () => {
      render(<Skeleton type="text" />);
      expect(screen.getByTestId("skeleton-text")).not.toBeNull();
    });

    it("should render multiple skeletons", () => {
      const { container } = render(<Skeleton type="text" count={3} />);
      const skeletons = container.querySelectorAll('[data-testid="skeleton-text"]');
      expect(skeletons).toHaveLength(3);
    });

    it("should render card skeleton", () => {
      render(<Skeleton type="card" />);
      expect(screen.getByTestId("skeleton-card")).not.toBeNull();
    });

    it("should render avatar skeleton", () => {
      render(<Skeleton type="avatar" />);
      expect(screen.getByTestId("skeleton-avatar")).not.toBeNull();
    });
  });

  describe("EmptyState", () => {
    it("should render title", () => {
      render(<EmptyState title="No data" />);
      expect(screen.getByText("No data")).not.toBeNull();
    });

    it("should render description", () => {
      render(<EmptyState title="No data" description="Add your first item" />);
      expect(screen.getByText("Add your first item")).not.toBeNull();
    });

    it("should render action button", () => {
      const onClick = vi.fn();
      render(<EmptyState title="No data" action={{ label: "Create", onClick }} />);

      const button = screen.getByText("Create");
      fireEvent.click(button);
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("should render with icon", () => {
      render(<EmptyState icon={<div data-testid="custom-icon">Icon</div>} title="No data" />);
      expect(screen.getByTestId("custom-icon")).not.toBeNull();
    });
  });

  describe("ErrorBoundary", () => {
    it("should render children when no error", () => {
      render(
        <ErrorBoundary>
          <div>Child content</div>
        </ErrorBoundary>,
      );
      expect(screen.getByText("Child content")).not.toBeNull();
    });

    it("should catch errors and show fallback", () => {
      const ThrowError = (): never => {
        throw new Error("Test error");
      };

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>,
      );

      expect(screen.getByText(/something went wrong/i)).not.toBeNull();
    });

    it("should call onError callback", () => {
      const onError = vi.fn();
      const ThrowError = (): never => {
        throw new Error("Test error");
      };

      render(
        <ErrorBoundary onError={onError}>
          <ThrowError />
        </ErrorBoundary>,
      );

      expect(onError).toHaveBeenCalled();
    });
  });

  describe("MobileSidebar", () => {
    it("should render when open", () => {
      render(
        <MobileSidebar isOpen={true} onClose={vi.fn()}>
          <div>Sidebar content</div>
        </MobileSidebar>,
      );
      expect(screen.getByText("Sidebar content")).not.toBeNull();
    });

    it("should not be visible when closed", () => {
      const { container } = render(
        <MobileSidebar isOpen={false} onClose={vi.fn()}>
          <div>Sidebar content</div>
        </MobileSidebar>,
      );
      const sidebar = container.querySelector("aside");
      expect(sidebar?.className).toContain("-translate-x-full");
    });

    it("should call onClose when overlay clicked", () => {
      const onClose = vi.fn();
      const { container } = render(
        <MobileSidebar isOpen={true} onClose={onClose}>
          <div>Content</div>
        </MobileSidebar>,
      );

      const overlay = container.querySelector('[data-testid="overlay"]');
      fireEvent.click(overlay as HTMLElement);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should close on ESC key", () => {
      const onClose = vi.fn();
      render(
        <MobileSidebar isOpen={true} onClose={onClose}>
          <div>Content</div>
        </MobileSidebar>,
      );

      fireEvent.keyDown(window, { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("PageHeader", () => {
    it("should render title", () => {
      render(<PageHeader title="Projects" />);
      expect(screen.getByText("Projects")).not.toBeNull();
    });

    it("should render description", () => {
      render(<PageHeader title="Projects" description="Manage your projects" />);
      expect(screen.getByText("Manage your projects")).not.toBeNull();
    });

    it("should render breadcrumbs", () => {
      render(
        <PageHeader
          title="Projects"
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Projects" },
          ]}
        />,
      );
      expect(screen.getByText("Dashboard")).not.toBeNull();
      expect(screen.getAllByText("Projects")).toHaveLength(2);
    });

    it("should render actions", () => {
      render(<PageHeader title="Projects" actions={<button type="button">Create</button>} />);
      expect(screen.getByText("Create")).not.toBeNull();
    });
  });
});
