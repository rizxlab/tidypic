import {
  defaultSettings,
  validateSettings,
  type TransformSettings,
} from "../image/transform/geometry.ts";
export interface ImagePreset {
  id: string;
  name: string;
  type: "common" | "platform" | "user";
  settings: Partial<TransformSettings>;
  platform?: string;
  platformName?: string;
  category?: string;
  visible?: boolean;
  requirements?: {
    ratio?: string;
    recommendedSize?: { width: number; height: number };
    minimumSize?: { width: number; height: number };
    maxFileSize?: number;
    formats?: string[];
    note?: string;
  };
  summary?: string;
  createdAt?: string;
  rules?: {
    kind: "required" | "recommended" | "minimum" | "maximum";
    text: string;
  }[];
  source?: { label: string; url: string; checkedAt: string };
}
export function settingsSnapshot(
  settings: TransformSettings,
): TransformSettings {
  const result = { ...settings };
  delete result.presetId;
  delete result.presetName;
  return result;
}
export function applyPreset(
  current: TransformSettings,
  preset: ImagePreset,
): TransformSettings {
  const next = { ...settingsSnapshot(current), ...preset.settings };
  validateSettings(next);
  return next;
}
export function presetModified(
  current: TransformSettings,
  preset: ImagePreset,
) {
  return Object.entries(preset.settings).some(
    ([key, value]) => current[key as keyof TransformSettings] !== value,
  );
}
function cropSignature(s: TransformSettings) {
  return s.mode === "exact"
    ? ["exact", s.width, s.height, s.fit]
    : s.mode === "ratio"
      ? ["ratio", s.ratioWidth / s.ratioHeight]
      : ["limit", s.axis, s.axis === "original" ? null : s.limit];
}
export function cropNeedsReset(
  before: TransformSettings,
  after: TransformSettings,
) {
  return (
    JSON.stringify(cropSignature(before)) !==
    JSON.stringify(cropSignature(after))
  );
}
export function validateName(
  value: string,
  presets: ImagePreset[],
  exceptId?: string,
) {
  const name = value.trim();
  if (!name) throw new Error("请填写预设名称。");
  if (Array.from(name).length > 30) throw new Error("预设名称最多 30 个字符。");
  if (
    presets.some(
      (p) =>
        p.id !== exceptId &&
        p.name.normalize("NFC").toLocaleLowerCase() ===
          name.normalize("NFC").toLocaleLowerCase(),
    )
  )
    throw new Error("已有同名预设，请修改名称。");
  return name;
}
/** Only known processing fields may cross the persistence boundary. */
export function parseSettings(value: unknown): TransformSettings {
  if (!value || typeof value !== "object") throw new Error("预设参数无效。");
  const raw = value as Record<string, unknown>,
    defaults = defaultSettings();
  for (const [key, v] of Object.entries(defaults)) {
    if (
      typeof raw[key] !== typeof v ||
      (typeof v === "number" && !Number.isFinite(raw[key]))
    )
      throw new Error("预设参数无效。");
  }
  const enums = {
    mode: ["limit", "exact", "ratio"],
    axis: ["width", "height", "longest", "original"],
    fit: ["crop", "pad"],
    sizeUnit: ["none", "KB", "MB"],
    format: ["original", "image/jpeg", "image/png", "image/webp"],
  };
  for (const [key, values] of Object.entries(enums))
    if (!values.includes(raw[key] as string)) throw new Error("预设参数无效。");
  const settings = Object.fromEntries(
    Object.keys(defaults).map((k) => [k, raw[k]]),
  ) as unknown as TransformSettings;
  validateSettings(settings);
  return settings;
}
