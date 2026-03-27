/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

import ClientPortalPage from "../../app/client-portal/[token]/page";

vi.mock("next/navigation", () => ({
  useParams: () => ({ token: "token_1" }),
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("swr", () => ({
  default: () => ({
    data: {
      project: {
        id: "project_1",
        name: "Project",
        clientName: "Client",
        companyName: "Company",
      },
      activeVersionId: "version_1",
      versions: [
        {
          id: "version_1",
          versionNumber: 1,
          fileUrl: "",
          fileName: "file.mp4",
          videoProvider: "KINESCOPE",
          kinescopeVideoId: null,
          streamUrl: null,
          processingStatus: "READY",
          durationSec: 120,
          status: "IN_REVIEW",
          createdAt: "2026-03-15T00:00:00.000Z",
        },
      ],
      feedback: [],
    },
    isLoading: false,
    error: null,
    mutate: vi.fn(),
  }),
}));

vi.mock("@/lib/i18n/messages", () => ({
  getMessages: () => ({
    portal: {
      title: "Portal",
      playerNotReady: "Player not ready",
      approveFailed: "Approve failed",
      approvedSuccess: "Approved",
      approveDialogTitle: "Approve",
      approveDialogDescription: "Approve desc",
      cancel: "Cancel",
      approveConfirm: "Approve",
      approved: "Approved",
      approvalLocked: "Locked",
    },
    feedback: {
      submitSuccess: "Sent",
      submitError: "Error",
      submitting: "Submitting",
    },
  }),
}));

vi.mock("@/components/video/KinescopePlayer", () => ({
  KinescopePlayer: React.forwardRef(function MockedPlayer(
    props: {
      onReady?: () => void;
      onTimeUpdate?: (seconds: number) => void;
      onPlay?: () => void;
      onPause?: () => void;
    },
    ref: React.Ref<{
      play: () => void;
      pause: () => void;
      seekTo: (time: number) => void;
      getCurrentTime: () => number;
      getCurrentTimeAsync?: () => Promise<number>;
    }>,
  ) {
    React.useEffect(() => {
      props.onReady?.();
      props.onTimeUpdate?.(0);
    }, [props]);

    React.useImperativeHandle(ref, () => ({
      play: () => props.onPlay?.(),
      pause: () => props.onPause?.(),
      seekTo: () => undefined,
      getCurrentTime: () => 0,
      getCurrentTimeAsync: async () => 0,
    }));

    return <div data-testid="kinescope-player" />;
  }),
}));

const setMobileEnvironment = (): void => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: query.includes("max-width") ? true : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
  Object.defineProperty(window.navigator, "maxTouchPoints", {
    value: 1,
    configurable: true,
  });
};

describe("Client portal mobile annotations", () => {
  beforeEach(() => {
    setMobileEnvironment();
    window.localStorage.clear();
    document.body.style.overflow = "";
  });

  it("enables drawing mode on mobile", async () => {
    const { container } = render(<ClientPortalPage />);

    const pencil = (await screen.findAllByLabelText("Рисовать"))[1];
    fireEvent.click(pencil);

    await waitFor(() => {
      const overlay = container.querySelector(".absolute.inset-x-0.top-0.bottom-12");
      expect(overlay).toBeTruthy();
      expect((overlay as HTMLElement).className).toContain("pointer-events-auto");
    });
  });

  it("turns drawing mode off on second tap", async () => {
    const { container } = render(<ClientPortalPage />);

    const pencil = (await screen.findAllByLabelText("Рисовать"))[1];
    fireEvent.click(pencil);

    await waitFor(() => {
      const overlay = container.querySelector(".absolute.inset-x-0.top-0.bottom-12");
      expect((overlay as HTMLElement).className).toContain("pointer-events-auto");
    });

    fireEvent.click((await screen.findAllByLabelText("Закрыть рисование"))[0]);

    await waitFor(() => {
      const overlay = container.querySelector(".absolute.inset-x-0.top-0.bottom-12");
      expect((overlay as HTMLElement).className).toContain("pointer-events-none");
    });
  });

  it("keeps the mobile feedback form available while drawing", async () => {
    render(<ClientPortalPage />);

    const pencil = (await screen.findAllByLabelText("Рисовать"))[1];
    fireEvent.click(pencil);

    await waitFor(() => {
      expect(screen.getAllByPlaceholderText("Добавить правку...").length).toBeGreaterThan(0);
      expect(screen.getAllByLabelText("Закрыть рисование").length).toBeGreaterThan(0);
    });
  });
});
