/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { VersionUploadFlow } from "@/components/versions/VersionUploadFlow";

type MockApiRequestErrorPayload = unknown;

const apiFetchMock = vi.fn();
const routerReplaceMock = vi.fn();
const routerRefreshMock = vi.fn();

let tusBehavior: "pending" | "success" = "success";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: routerReplaceMock,
    refresh: routerRefreshMock,
  }),
}));

vi.mock("tus-js-client", () => {
  class MockUpload {
    constructor(
      _file: File,
      private options: {
        onProgress?: (bytesUploaded: number, bytesTotal: number) => void;
        onSuccess?: () => void;
      },
    ) {}

    start(): void {
      if (tusBehavior === "success") {
        this.options.onProgress?.(1, 1);
        this.options.onSuccess?.();
      }
    }

    abort(): Promise<void> {
      return Promise.resolve();
    }
  }

  return {
    Upload: MockUpload,
  };
});

vi.mock("@/lib/utils/client-api", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  ApiRequestError: class MockApiRequestError extends Error {
    constructor(
      message: string,
      public status: number,
      public payload?: MockApiRequestErrorPayload,
    ) {
      super(message);
      this.name = "ApiRequestError";
    }
  },
}));

function renderFlow(): void {
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <VersionUploadFlow projectId="project-1" />
    </SWRConfig>,
  );
}

function getFileInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("File input not found");
  }
  return input;
}

describe("VersionUploadFlow", () => {
  beforeEach(() => {
    tusBehavior = "success";
    apiFetchMock.mockReset();
    routerReplaceMock.mockReset();
    routerRefreshMock.mockReset();
    apiFetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/versions/meta")) {
        return {
          usedVersionNumbers: [1, 2],
          nextVersionNumber: 3,
        };
      }
      if (url === "/api/upload") {
        return {
          uploadUrl: "https://upload.test",
          uploadMethod: "POST",
          uploadHeaders: {},
          kinescopeVideoId: "k-video-1",
          expiresAt: "2026-01-01T00:00:00.000Z",
          expiresIn: 3600,
        };
      }
      if (url === "/api/upload/confirm") {
        return {
          kinescopeVideoId: "k-video-1",
          processingStatus: "READY",
          streamUrl: "https://stream.test/video",
          durationSec: 120,
          processingError: null,
        };
      }
      if (url.endsWith("/versions") && init?.method === "POST") {
        return {
          id: "version-1",
          versionNumber: 3,
        };
      }
      throw new Error(`Unexpected request: ${url}`);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("auto-fills next version number from meta", async () => {
    renderFlow();

    await waitFor(() => {
      const input = screen.getByLabelText("Номер версии") as HTMLInputElement;
      expect(input.value).toBe("3");
    });
  });

  it("shows instant conflict warning and applies suggested number", async () => {
    renderFlow();

    const input = (await screen.findByLabelText("Номер версии")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2" } });

    expect(await screen.findByText("Этот номер уже используется.")).toBeTruthy();
    const applyButton = screen.getByRole("button", { name: "Применить v3" });
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(input.value).toBe("3");
    });
  });

  it("does not render duration and notes fields", async () => {
    renderFlow();

    await screen.findByLabelText("Номер версии");
    expect(screen.queryByText("Длительность (сек, опционально)")).toBeNull();
    expect(screen.queryByText("Заметки (опционально)")).toBeNull();
  });

  it("cancels upload and shows retry state", async () => {
    tusBehavior = "pending";
    const rendered = render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <VersionUploadFlow projectId="project-1" />
      </SWRConfig>,
    );

    await screen.findByLabelText("Номер версии");
    const fileInput = getFileInput(rendered.container);
    const file = new File(["video"], "video.mp4", { type: "video/mp4" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByRole("button", { name: "Загрузить версию" }));
    const cancelButton = await screen.findByRole("button", { name: "Отменить загрузку" });
    fireEvent.click(cancelButton);

    expect(await screen.findByText("Загрузка отменена. Нажмите «Повторить загрузку», чтобы попробовать снова.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Повторить загрузку" })).toBeTruthy();
  });

  it("continues in background during processing and creates version", async () => {
    apiFetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/versions/meta")) {
        return {
          usedVersionNumbers: [1],
          nextVersionNumber: 2,
        };
      }
      if (url === "/api/upload") {
        return {
          uploadUrl: "https://upload.test",
          uploadMethod: "POST",
          uploadHeaders: {},
          kinescopeVideoId: "k-video-2",
          expiresAt: "2026-01-01T00:00:00.000Z",
          expiresIn: 3600,
        };
      }
      if (url === "/api/upload/confirm") {
        return {
          kinescopeVideoId: "k-video-2",
          processingStatus: "PROCESSING",
          streamUrl: null,
          durationSec: null,
          processingError: null,
        };
      }
      if (url.endsWith("/versions") && init?.method === "POST") {
        return {
          id: "version-2",
          versionNumber: 2,
        };
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    const rendered = render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <VersionUploadFlow projectId="project-1" />
      </SWRConfig>,
    );
    await screen.findByLabelText("Номер версии");

    const fileInput = getFileInput(rendered.container);
    const file = new File(["video"], "video.mp4", { type: "video/mp4" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Загрузить версию" }));

    const continueButton = await screen.findByRole("button", { name: "Продолжить в фоне" });
    fireEvent.click(continueButton);

    await waitFor(() => {
      const postCall = apiFetchMock.mock.calls.find((call) => String(call[0]).endsWith("/versions") && call[1]?.method === "POST");
      expect(postCall).toBeTruthy();
      const payload = JSON.parse(postCall?.[1]?.body as string) as { processingStatus: string };
      expect(payload.processingStatus).toBe("PROCESSING");
    });

    expect(routerReplaceMock).toHaveBeenCalledWith("/projects/project-1/versions");
  });
});
