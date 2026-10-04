export type WatermarkKind = "text" | "image";
export type WatermarkLayout = "single" | "tiled";
export type WatermarkSize = "small" | "medium" | "large" | "custom";
export interface WatermarkSettings {
  kind: WatermarkKind;
  text: string;
  color: string;
  layout: WatermarkLayout;
  position: number;
  size: WatermarkSize;
  fontSize: number;
  imageWidthPercent: number;
  margin: number;
  singleOpacity: number;
  tileOpacity: number;
  arrangement: "grid" | "staggered";
  density: "sparse" | "medium" | "dense" | "custom";
  gap: number;
  angle: number;
}
export function defaultWatermarkSettings(): WatermarkSettings {
  return {
    kind: "text",
    text: "",
    color: "#ffffff",
    layout: "single",
    position: 8,
    size: "medium",
    fontSize: 32,
    imageWidthPercent: 18,
    margin: 24,
    singleOpacity: 50,
    tileOpacity: 25,
    arrangement: "staggered",
    density: "medium",
    gap: 80,
    angle: -30,
  };
}
export interface MarkSize {
  width: number;
  height: number;
  fontSize: number;
}
export interface Point {
  x: number;
  y: number;
}
