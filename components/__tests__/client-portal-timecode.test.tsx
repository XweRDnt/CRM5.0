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
  feedback: [],
};

vi.mock("next/navigation", () => ({
  useParams: () => ({ token: "portal-token" }),
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("swr", () => ({
  default: () => ({
    data: mockPortalData,
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
      props.onTimeUpdate?.(12);
    }, [props]);

    React.useImperativeHandle(ref, () => ({
      play: () => props.onPlay?.(),
      pause: () => props.onPause?.(),
      seekTo: () => undefined,
      getCurrentTime: () => 12,
      getCurrentTimeAsync: async () => 12,
    }));

    return <div data-testid="kinescope-player" />;
  }),
}));

describe("Client portal feedback submission", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      }),
    );
  });

  it("submits the current player timecode for a plain text feedback comment", async () => {
    render(<ClientPortalPage />);

    const nameInputs = screen.getAllByPlaceholderText("Имя");
    const commentInputs = screen.getAllByPlaceholderText("Добавить правку...");

    fireEvent.change(nameInputs[0], { target: { value: "Pasha" } });
    fireEvent.change(commentInputs[0], { target: { value: "Нужно поправить начало" } });
    fireEvent.submit(commentInputs[0].closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/public/feedback",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("\"timecodeSec\":12"),
        }),
      );
    });
  });
});
