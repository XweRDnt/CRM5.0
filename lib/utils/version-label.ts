type VersionLabelInput = {
  title?: string | null;
  versionNumber: number;
};

export function getVersionLabel({ title, versionNumber }: VersionLabelInput): string {
  const trimmedTitle = title?.trim();
  return trimmedTitle && trimmedTitle.length > 0 ? trimmedTitle : `Версия ${versionNumber}`;
}
