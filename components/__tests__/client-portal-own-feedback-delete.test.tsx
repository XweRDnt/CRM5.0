/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

import ClientPortalPage from "../../app/client-portal/[token]/page";

const mutateMock = vi.fn();
const fetchMock = vi.fn();

const portalData = {
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
  feedback: [
    {
      id: "feedback_1",
      text: "My feedback",
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
    {
      id: "feedback_2",
      text: "Other feedback",
      status: "NEW" as const,
      timecodeSec: 22,
      annotationData: null,
      createdAt: "2026-03-15T00:00:00.000Z",
      authorName: "Other",
      authorEmail: null,
      threadMessageCount: 0,
      threadUnreadCount: 0,
      lastThreadMessageAt: null,
      lastThreadMessagePreview: null,
    },
  ],
};

vi.mock("next/navigation", () => ({
  useParams: () => ({ token: "portal-token" }),
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("swr", () => ({
  default: () => ({
    data: portalData,
    isLoading: false,
    error: null,
    mutate: mutateMock,
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

describe("Client portal own feedback delete", () => {
  beforeEach(() => {
    mutateMock.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    window.localStorage.clear();
    window.localStorage.setItem("portal_owned_feedback_ids:portal-token", JSON.stringify(["feedback_1"]));
  });

  it("shows delete confirmation only for owned feedback and deletes it", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(<ClientPortalPage />);

    const myFeedback = screen.getByText("My feedback").closest("article");
    const otherFeedback = screen.getByText("Other feedback").closest("article");

    expect(myFeedback).toBeTruthy();
    expect(otherFeedback).toBeTruthy();

    fireEvent.contextMenu(otherFeedback as HTMLElement);
    expect(screen.queryByText("Удалить правку?")).toBeNull();

    fireEvent.contextMenu(myFeedback as HTMLElement);

    expect(await screen.findByText("Удалить правку?")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Удалить" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/public/feedback/feedback_1",
        expect.objectContaining({
          method: "DELETE",
          body: JSON.stringify({ token: "portal-token" }),
        }),
      );
    });

    expect(window.localStorage.getItem("portal_owned_feedback_ids:portal-token")).toBe(JSON.stringify([]));
  });
});
