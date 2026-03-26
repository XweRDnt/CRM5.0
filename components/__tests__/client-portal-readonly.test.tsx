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
  useDemoProjectOverlay: () => ({
    overlay: { feedback: [], threadMessages: [] },
    setOverlay: vi.fn(),
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

describe("Client portal readonly mode", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      }),
    );
  });

  it("treats demo portal token as local demo mode even without readonly query", async () => {
    render(<ClientPortalPage />);

    expect(screen.queryByText("Утвердить")).toBeNull();
    expect(screen.getByText("Демо-режим: локальные правки")).not.toBeNull();

    fireEvent.click(screen.getByText("Please tighten the intro pacing"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Ответить команде...")).not.toBeNull();
    });
  });
});
