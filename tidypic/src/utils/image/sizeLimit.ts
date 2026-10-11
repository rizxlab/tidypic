import type { TransformSettings } from "./transform/geometry.ts";
type Limit = Pick<TransformSettings, "sizeUnit" | "sizeLimit">;
export const sizeShortcuts = [
  { label: "不限制", unit: "none", value: 0 },
  { label: "100KB", unit: "KB", value: 100 },
  { label: "200KB", unit: "KB", value: 200 },
  { label: "500KB", unit: "KB", value: 500 },
  { label: "1MB", unit: "MB", value: 1 },
] as const;
export function selectSizeShortcut(
  settings: Limit,
  shortcut: (typeof sizeShortcuts)[number],
) {
  settings.sizeUnit = shortcut.unit;
  if (shortcut.unit !== "none") settings.sizeLimit = shortcut.value;
}
export function isSizeShortcut(
  settings: Limit,
  shortcut: (typeof sizeShortcuts)[number],
) {
  return (
    settings.sizeUnit === shortcut.unit &&
    (shortcut.unit === "none" || settings.sizeLimit === shortcut.value)
  );
}
export function changeSizeUnit(settings: Limit, unit: "KB" | "MB") {
  if (settings.sizeUnit === "none" || settings.sizeUnit === unit) return;
  settings.sizeLimit =
    unit === "MB" ? settings.sizeLimit / 1024 : settings.sizeLimit * 1024;
  settings.sizeUnit = unit;
}
