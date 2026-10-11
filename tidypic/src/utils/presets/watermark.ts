import {
  defaultWatermarkSettings,
  type WatermarkSettings,
} from "../image/watermark/types.ts";
import { validateWatermark } from "../image/watermark/layout.ts";
import { validateName } from "./model.ts";
import { loadRecords, saveRecords, type PresetStore } from "./records.ts";
export const WATERMARK_PRESET_KEY = "tidypic.watermark.presets.v1";
export const MAX_PRESET_LOGO_BYTES = 1024 * 1024;
export interface PresetLogo {
  name: string;
  dataUrl: string;
}
export interface WatermarkPreset {
  id: string;
  name: string;
  type: "user";
  version: 1;
  createdAt: string;
  settings: WatermarkSettings;
  logo?: PresetLogo;
}
export function parseWatermarkSettings(value: unknown): WatermarkSettings {
  if (!value || typeof value !== "object") throw Error("水印预设参数无效。");
  const raw = value as Record<string, unknown>,
    defaults = defaultWatermarkSettings();
  for (const [key, d] of Object.entries(defaults))
    if (
      typeof raw[key] !== typeof d ||
      (typeof d === "number" && !Number.isFinite(raw[key]))
    )
      throw Error("水印预设参数无效。");
  const s = Object.fromEntries(
    Object.keys(defaults).map((k) => [k, raw[k]]),
  ) as unknown as WatermarkSettings;
  if (
    !["text", "image"].includes(s.kind) ||
    !["single", "tiled"].includes(s.layout) ||
    !["small", "medium", "large", "custom"].includes(s.size) ||
    !["grid", "staggered"].includes(s.arrangement) ||
    !["sparse", "medium", "dense", "custom"].includes(s.density)
  )
    throw Error("水印预设选项无效。");
  // Validate inactive parameters too, so later switching modes is safe.
  validateWatermark(
    {
      ...s,
      kind: "text",
      text: s.text || "验证",
      layout: "single",
      size: "custom",
    },
    true,
  );
  validateWatermark(
    { ...s, kind: "image", layout: "tiled", size: "custom", density: "custom" },
    true,
  );
  return s;
}
export function parseWatermarkPreset(
  value: unknown,
  items: WatermarkPreset[],
): WatermarkPreset {
  const p = value as WatermarkPreset;
  if (
    !p ||
    p.version !== 1 ||
    p.type !== "user" ||
    typeof p.id !== "string" ||
    !p.id ||
    items.some((i) => i.id === p.id) ||
    typeof p.name !== "string" ||
    typeof p.createdAt !== "string" ||
    !Number.isFinite(Date.parse(p.createdAt))
  )
    throw Error("水印预设数据无效，原有数据未被覆盖。");
  const settings = parseWatermarkSettings(p.settings);
  let logo: PresetLogo | undefined;
  if (settings.kind === "image") {
    if (
      !p.logo ||
      typeof p.logo.name !== "string" ||
      typeof p.logo.dataUrl !== "string" ||
      p.logo.dataUrl.length > Math.ceil(MAX_PRESET_LOGO_BYTES / 3) * 4 + 64 ||
      !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(
        p.logo.dataUrl,
      )
    )
      throw Error("图片水印预设缺少有效素材。");
    logo = { name: p.logo.name, dataUrl: p.logo.dataUrl };
    const file = presetLogoFile(logo);
    if (file.size > MAX_PRESET_LOGO_BYTES)
      throw Error("图片水印预设素材最大 1MB。");
  }
  validateWatermark(settings, !!logo);
  return {
    id: p.id,
    name: validateName(p.name, items),
    type: "user",
    version: 1,
    createdAt: p.createdAt,
    settings,
    ...(logo ? { logo } : {}),
  };
}
export function loadWatermarkPresets(storage: PresetStore) {
  return loadRecords(storage, WATERMARK_PRESET_KEY, parseWatermarkPreset);
}
export function saveWatermarkPresets(
  storage: PresetStore,
  presets: WatermarkPreset[],
) {
  saveRecords(
    storage,
    WATERMARK_PRESET_KEY,
    presets,
    parseWatermarkPreset,
    4 * 1024 * 1024,
  );
}
export async function presetLogo(file: File): Promise<PresetLogo> {
  if (file.size > MAX_PRESET_LOGO_BYTES)
    throw Error(
      "图片水印预设素材最大 1MB，请换用较小的图片；当前水印仍可正常处理。",
    );
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const format =
    bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      ? "image/jpeg"
      : bytes[0] === 137 &&
          bytes[1] === 80 &&
          bytes[2] === 78 &&
          bytes[3] === 71
        ? "image/png"
        : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
            String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
          ? "image/webp"
          : "";
  if (!format) throw Error("请选择 JPG、PNG 或 WebP 水印图片。");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(Error("无法保存水印素材。"));
    reader.readAsDataURL(new Blob([file], { type: format }));
  });
  return { name: file.name, dataUrl };
}
export function presetLogoFile(logo: PresetLogo): File {
  const [header, data] = logo.dataUrl.split(",");
  const binary = atob(data!),
    bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new File([bytes], logo.name || "watermark.png", {
    type: header!.slice(5).split(";")[0],
  });
}
export function applyWatermarkPreset(preset: WatermarkPreset) {
  const checked = parseWatermarkPreset(preset, []);
  return {
    settings: { ...checked.settings },
    logo: checked.logo ? presetLogoFile(checked.logo) : undefined,
  };
}
