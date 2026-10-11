import type { WatermarkSettings } from "../utils/image/watermark/types.ts";
export type WatermarkStyle = Pick<
  WatermarkSettings,
  | "layout"
  | "position"
  | "size"
  | "margin"
  | "singleOpacity"
  | "tileOpacity"
  | "angle"
  | "arrangement"
  | "density"
  | "gap"
>;
export interface WatermarkStylePreset {
  id: string;
  name: string;
  type: "system";
  settings: Readonly<Partial<WatermarkStyle>>;
}
export const watermarkStylePresets: readonly WatermarkStylePreset[] = [
  {
    id: "watermark-light",
    name: "轻水印",
    type: "system",
    settings: {
      layout: "single",
      position: 8,
      size: "small",
      singleOpacity: 45,
      margin: 24,
      angle: 0,
    },
  },
  {
    id: "watermark-prominent",
    name: "明显水印",
    type: "system",
    settings: {
      layout: "single",
      position: 8,
      size: "medium",
      singleOpacity: 75,
      margin: 24,
      angle: 0,
    },
  },
  {
    id: "watermark-center",
    name: "居中水印",
    type: "system",
    settings: {
      layout: "single",
      position: 4,
      size: "large",
      singleOpacity: 50,
      margin: 24,
      angle: 0,
    },
  },
  {
    id: "watermark-tiled",
    name: "满屏平铺",
    type: "system",
    settings: {
      layout: "tiled",
      size: "small",
      tileOpacity: 22,
      angle: 0,
      arrangement: "grid",
      density: "custom",
      gap: 80,
    },
  },
  {
    id: "watermark-diagonal",
    name: "对角平铺",
    type: "system",
    settings: {
      layout: "tiled",
      size: "small",
      tileOpacity: 22,
      angle: -30,
      arrangement: "staggered",
      density: "custom",
      gap: 80,
    },
  },
];
export function applyWatermarkStyle(
  settings: WatermarkSettings,
  preset: WatermarkStylePreset,
): WatermarkSettings {
  return { ...settings, ...preset.settings };
}
