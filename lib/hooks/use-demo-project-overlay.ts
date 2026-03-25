"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  EMPTY_DEMO_PROJECT_OVERLAY,
  readDemoProjectOverlay,
  type DemoProjectOverlay,
  writeDemoProjectOverlay,
} from "@/lib/utils/demo-project-overlay";

const EVENT_NAME = "demo-project-overlay-updated";

export function useDemoProjectOverlay(projectId: string | null | undefined): {
  overlay: DemoProjectOverlay;
  setOverlay: (updater: DemoProjectOverlay | ((current: DemoProjectOverlay) => DemoProjectOverlay)) => void;
} {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (typeof window === "undefined") {
        return () => undefined;
      }

      const handleChange = (): void => onStoreChange();
      window.addEventListener("storage", handleChange);
      window.addEventListener(EVENT_NAME, handleChange);

      return () => {
        window.removeEventListener("storage", handleChange);
        window.removeEventListener(EVENT_NAME, handleChange);
      };
    },
    [],
  );

  const getSnapshot = useCallback(() => {
    if (!projectId) {
      return EMPTY_DEMO_PROJECT_OVERLAY;
    }

    return readDemoProjectOverlay(projectId);
  }, [projectId]);

  const overlay = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_DEMO_PROJECT_OVERLAY);

  const setOverlay = useCallback(
    (updater: DemoProjectOverlay | ((current: DemoProjectOverlay) => DemoProjectOverlay)) => {
      if (!projectId || typeof window === "undefined") {
        return;
      }

      const current = readDemoProjectOverlay(projectId);
      const next = typeof updater === "function" ? (updater as (current: DemoProjectOverlay) => DemoProjectOverlay)(current) : updater;
      writeDemoProjectOverlay(projectId, next);
      window.dispatchEvent(new Event(EVENT_NAME));
    },
    [projectId],
  );

  return { overlay, setOverlay };
}
