/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

import ClientPortalPage from "../../app/client-portal/[token]/page";

const mockPortalData = {
  project: {
    id: "project_1",
    name: "Project",
    clientName: "Client",
    companyName: "Company",
  },
  isDemo: true,
  activeVersionId: "version_1",
  versions: [
    {
      id: "version_1",
      versionNumber: 1,
      fileUrl: "",
      fileName: "file.mp4",
      videoProvider: "KINESCOPE" as const,
      kinescopeVideoId: null,
      streamUrl: null,
      processingStatus: "READY" as const,
      durationSec: 120,
      status: "IN_REVIEW",
      createdAt: "2026-03-15T00:00:00.000Z",
    },
  ],
  feedback: [
    {
      id: "feedback_1",
      text: "Please tighten the intro pacing",
      status: "NEW" as const,
      timecodeSec: 12,
      annotationData: null,
      createdAt: "2026-03-15T00:00:00.000Z",
      authorName: "Client",
      authorEmail: null,
      threadMessageCount: 0,
      threadUnreadCount: 0,
      lastThreadMessageAt: null,
      lastThreadMessagePreview: null,
    },
  ],
};

vi.mock("next/navigation", () => ({
  useParams: () => ({ token: "demo-token" }),
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

vi.mock("swr", () => ({
  default: () => ({
    data: mockPortalData,
    isLoading: false,
    error: null,
    mutate: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/use-demo-project-overlay", () => ({
  useDemoProjectOverlay: () => {
    const [overlay, setOverlay] = React.useState({ feedback: [], threadMessages: [] });
    return { overlay, setOverlay };
  },
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

describe("Client portal demo mode", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      }),
    );
  });

  it("keeps replies local for demo threads without readonly query", async () => {
    render(<ClientPortalPage />);

    expect(screen.queryByText("Утвердить")).toBeNull();
    expect(screen.getAllByPlaceholderText("Добавить правку...").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Рисовать").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText("Please tighten the intro pacing"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Ответить...")).not.toBeNull();
    });
  });

  it("creates local demo feedback without calling the public feedback API and keeps drawing available", async () => {
    const { container } = render(<ClientPortalPage />);

    fireEvent.change(screen.getAllByPlaceholderText("Имя")[0], { target: { value: "Pasha" } });
    fireEvent.click(screen.getAllByLabelText("Рисовать")[0]);

    const overlay = container.querySelector(".absolute.inset-x-0.top-0.bottom-12");
    if (!(overlay instanceof HTMLElement)) {
      throw new Error("Annotation overlay not found");
    }

    await waitFor(() => {
      expect(overlay.className).toContain("pointer-events-auto");
    });

    fireEvent.change(screen.getAllByPlaceholderText("Добавить правку...")[0], {
      target: { value: "Проверка локальной правки" },
    });
    fireEvent.submit(
      screen.getAllByPlaceholderText("Добавить правку...")[0].closest("form") as HTMLFormElement,
    );

    await waitFor(() => {
      expect(screen.getByText("Pasha")).not.toBeNull();
      expect(screen.getByText("Проверка локальной правки")).not.toBeNull();
    });

    expect(fetch).not.toHaveBeenCalledWith(
      "/api/public/feedback",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });
});
