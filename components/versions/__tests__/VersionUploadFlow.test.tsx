/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { VersionUploadFlow } from "@/components/versions/VersionUploadFlow";

type MockApiRequestErrorPayload = unknown;

const apiFetchMock = vi.fn();
const routerReplaceMock = vi.fn();
const routerRefreshMock = vi.fn();

let tusBehavior: "pending" | "success" = "success";
let videoMetadataMode: "success" | "error" = "success";
let videoDurationSec = 120;

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

function renderFlow() {
  return render(
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

function getVersionTitleInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('input[id^="versionTitle-"]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("Version title input not found");
  }
  return input;
}

function getSubmitButton(container: HTMLElement): HTMLButtonElement {
  const button = container.querySelector('button[type="submit"]');
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error("Submit button not found");
  }
  return button;
}

async function selectVideoFile(container: HTMLElement, file: File): Promise<void> {
  fireEvent.change(getFileInput(container), { target: { files: [file] } });
  await waitFor(() => {
    expect(screen.getByText(/Длительность:/)).toBeTruthy();
  });
}

describe("VersionUploadFlow", () => {
  beforeEach(() => {
    tusBehavior = "success";
    videoMetadataMode = "success";
    videoDurationSec = 120;
    apiFetchMock.mockReset();
    routerReplaceMock.mockReset();
    routerRefreshMock.mockReset();

    Object.defineProperty(globalThis.URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:video"),
    });
    Object.defineProperty(globalThis.URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
      if (tagName.toLowerCase() !== "video") {
        return originalCreateElement(tagName);
      }

      const video = originalCreateElement("video") as HTMLVideoElement;
      Object.defineProperty(video, "duration", {
        configurable: true,
        get: () => videoDurationSec,
      });
      video.load = vi.fn();
      Object.defineProperty(video, "src", {
        configurable: true,
        get: () => "blob:video",
        set: () => {
          setTimeout(() => {
            if (videoMetadataMode === "success") {
              video.onloadedmetadata?.(new Event("loadedmetadata"));
              return;
            }

            video.onerror?.(new Event("error"));
          }, 0);
        },
      });

      return video;
    }) as typeof document.createElement);

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
          title: "Версия 3",
        };
      }
      throw new Error(`Unexpected request: ${url}`);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("auto-fills next version title from meta", async () => {
    const rendered = renderFlow();

    await waitFor(() => {
      expect(getVersionTitleInput(rendered.container).value).toBe("Версия 3");
    });
  });

  it("lets the user override the auto-filled version title", async () => {
    const rendered = renderFlow();
    const input = getVersionTitleInput(rendered.container);

    await waitFor(() => {
      expect(input.value).toBe("Версия 3");
    });

    fireEvent.change(input, { target: { value: "Монтаж для клиента" } });

    expect(input.value).toBe("Монтаж для клиента");
  });

  it("does not render version number, duration and notes fields", async () => {
    const rendered = renderFlow();

    await screen.findByText("По умолчанию подставляется следующая версия, но вы можете назвать её по-своему.");
    expect(rendered.container.querySelector('input[type="number"]')).toBeNull();
    expect(screen.queryByText("Длительность (сек, опционально)")).toBeNull();
    expect(screen.queryByText("Заметки (опционально)")).toBeNull();
  });

  it("cancels upload and shows retry state", async () => {
    tusBehavior = "pending";
    const rendered = renderFlow();

    await waitFor(() => {
      expect(getVersionTitleInput(rendered.container).value).toBe("Версия 3");
    });

    await selectVideoFile(rendered.container, new File(["video"], "video.mp4", { type: "video/mp4" }));
    fireEvent.click(getSubmitButton(rendered.container));

    const cancelButton = await screen.findByRole("button", { name: "Отменить загрузку" });
    fireEvent.click(cancelButton);

    expect(await screen.findByText("Загрузка отменена. Нажмите «Повторить загрузку», чтобы попробовать снова.")).toBeTruthy();
    expect(getSubmitButton(rendered.container).textContent).toBe("Повторить загрузку");
  });

  it("continues in background during processing and creates version with the detected duration", async () => {
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
          title: "Версия 2",
        };
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    const rendered = renderFlow();
    await waitFor(() => {
      expect(getVersionTitleInput(rendered.container).value).toBe("Версия 2");
    });

    await selectVideoFile(rendered.container, new File(["video"], "video.mp4", { type: "video/mp4" }));
    fireEvent.click(getSubmitButton(rendered.container));

    const continueButton = await screen.findByRole("button", { name: "Продолжить в фоне" });
    fireEvent.click(continueButton);

    await waitFor(() => {
      const postCall = apiFetchMock.mock.calls.find((call) => String(call[0]).endsWith("/versions") && call[1]?.method === "POST");
      expect(postCall).toBeTruthy();
      const payload = JSON.parse(postCall?.[1]?.body as string) as { processingStatus: string; durationSec: number; title: string };
      expect(payload.processingStatus).toBe("PROCESSING");
      expect(payload.durationSec).toBe(120);
      expect(payload.title).toBe("Версия 2");
    });

    expect(routerReplaceMock).toHaveBeenCalledWith("/projects/project-1/versions");
  });

  it("sends detected durationSec to /api/upload", async () => {
    const rendered = renderFlow();
    await waitFor(() => {
      expect(getVersionTitleInput(rendered.container).value).toBe("Версия 3");
    });

    await selectVideoFile(rendered.container, new File(["video"], "video.mp4", { type: "video/mp4" }));
    fireEvent.click(getSubmitButton(rendered.container));

    await waitFor(() => {
      const uploadCall = apiFetchMock.mock.calls.find((call) => call[0] === "/api/upload");
      expect(uploadCall).toBeTruthy();
      const payload = JSON.parse(uploadCall?.[1]?.body as string) as { durationSec: number };
      expect(payload.durationSec).toBe(120);
    });
  });

  it("shows an error and does not start upload when video metadata cannot be read", async () => {
    videoMetadataMode = "error";
    const rendered = renderFlow();
    await waitFor(() => {
      expect(getVersionTitleInput(rendered.container).value).toBe("Версия 3");
    });

    fireEvent.change(getFileInput(rendered.container), { target: { files: [new File(["video"], "broken.mp4", { type: "video/mp4" })] } });

    expect(await screen.findByText("Не удалось прочитать метаданные видео. Выберите другой файл.")).toBeTruthy();
    expect(getSubmitButton(rendered.container).disabled).toBe(true);
    expect(apiFetchMock.mock.calls.some((call) => call[0] === "/api/upload")).toBe(false);
  });

  it("renders without crashing when MutationObserver is unavailable", async () => {
    const originalMutationObserver = globalThis.MutationObserver;
    // Some embedded browsers/opened shells don't expose MutationObserver.
    Object.defineProperty(globalThis, "MutationObserver", {
      configurable: true,
      value: undefined,
    });

    try {
      const rendered = renderFlow();
      expect(getVersionTitleInput(rendered.container).value).toBe("Версия 1");
      expect(rendered.container.querySelector("form")).toBeTruthy();
      await act(async () => {
        await Promise.resolve();
      });
    } finally {
      Object.defineProperty(globalThis, "MutationObserver", {
        configurable: true,
        value: originalMutationObserver,
      });
    }
  });
});
