/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { VersionChangeLog } from "@/components/versions/VersionChangeLog";
import { VersionStatusBadge } from "@/components/versions/VersionStatusBadge";
import { VersionsList } from "@/components/versions/VersionsList";
import type { AssetVersionResponse } from "@/types";

const versions: AssetVersionResponse[] = [
  {
    id: "v2",
    projectId: "p1",
    versionNumber: 2,
    fileUrl: "https://example.com/v2.mp4",
    fileName: "v2.mp4",
    fileSize: 200,
    durationSec: 120,
    videoProvider: "EXTERNAL_URL",
    kinescopeVideoId: null,
    kinescopeAssetId: null,
    kinescopeProjectId: null,
    streamUrl: null,
    processingStatus: "READY",
    processingError: null,
    uploadedBy: { id: "u1", name: "Jane Doe" },
    notes: "note",
    changeLog: "Fixed intro",
    status: "IN_REVIEW",
    approvedBy: null,
    approvedAt: null,
    createdAt: new Date("2026-01-01"),
  },
  {
    id: "v1",
    projectId: "p1",
    versionNumber: 1,
    fileUrl: "https://example.com/v1.mp4",
    fileName: "v1.mp4",
    fileSize: 180,
    durationSec: 100,
    videoProvider: "EXTERNAL_URL",
    kinescopeVideoId: null,
    kinescopeAssetId: null,
    kinescopeProjectId: null,
    streamUrl: null,
    processingStatus: "READY",
    processingError: null,
    uploadedBy: { id: "u1", name: "Jane Doe" },
    notes: null,
    changeLog: null,
    status: "DRAFT",
    approvedBy: null,
    approvedAt: null,
    createdAt: new Date("2025-12-31"),
  },
];

describe("VersionStatusBadge", () => {
  it("renders readable status", () => {
    render(<VersionStatusBadge status="APPROVED" />);
    expect(screen.getByText("Утверждено")).not.toBeNull();
  });

  it("renders draft status", () => {
    render(<VersionStatusBadge status="DRAFT" />);
    expect(screen.getByText("Черновик")).not.toBeNull();
  });
});

describe("VersionChangeLog", () => {
  it("renders readonly changelog", () => {
    render(<VersionChangeLog changeLog="Updated CTA animation" />);
    expect(screen.getByText("Updated CTA animation")).not.toBeNull();
  });

  it("renders fallback text for empty changelog", () => {
    render(<VersionChangeLog changeLog={null} />);
    expect(screen.getByText("Пока нет описания изменений.")).not.toBeNull();
  });

  it("supports editable mode", () => {
    const onChange = vi.fn();
    render(<VersionChangeLog changeLog="Initial" editable onChange={onChange} />);

    const input = screen.getByPlaceholderText("Опишите, что изменилось в этой версии...");
    fireEvent.change(input, { target: { value: "Updated copy" } });

    expect(onChange).toHaveBeenCalledWith("Updated copy");
  });
});

describe("VersionsList", () => {
  it("renders versions list", () => {
    render(<VersionsList versions={versions} />);
    expect(screen.getByText("Версия 2")).not.toBeNull();
    expect(screen.getByText("Версия 1")).not.toBeNull();
  });

  it("renders empty state", () => {
    render(<VersionsList versions={[]} />);
    expect(screen.getByText("Пока нет загруженных версий.")).not.toBeNull();
  });

  it("calls onChangeStatus", async () => {
    const onChangeStatus = vi.fn().mockResolvedValue(undefined);
    render(<VersionsList versions={versions} onChangeStatus={onChangeStatus} />);

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "APPROVED" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Сменить статус" })[0]);

    await waitFor(() => {
      expect(onChangeStatus).toHaveBeenCalledWith("v2", "APPROVED");
    });
  });

  it("calls onApprove", async () => {
    const onApprove = vi.fn().mockResolvedValue(undefined);
    render(<VersionsList versions={versions} onApprove={onApprove} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Утвердить" })[0]);
    await waitFor(() => {
      expect(onApprove).toHaveBeenCalledWith("v2");
    });
  });
});
