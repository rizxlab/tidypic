import type { ImageFormat } from "../types.ts";
export interface StitchSettings {
  direction: "vertical" | "horizontal";
  size: "uniform" | "original";
  target: number | null;
  alignment: "start" | "center" | "end";
  gap: number;
  background: string;
  format: ImageFormat | "original";
}
export interface Dimensions {
  width: number;
  height: number;
}
export interface Placement extends Dimensions {
  x: number;
  y: number;
}
export interface StitchLayout extends Dimensions {
  items: Placement[];
}
export class StitchError extends Error {}
export const defaultStitchSettings = (): StitchSettings => ({
  direction: "vertical",
  size: "uniform",
  target: null,
  alignment: "center",
  gap: 0,
  background: "#ffffff",
  format: "original",
});
export function calculateScaledSize(
  image: Dimensions,
  direction: StitchSettings["direction"],
  target: number,
): Dimensions {
  return direction === "vertical"
    ? {
        width: target,
        height: Math.max(1, Math.round((image.height * target) / image.width)),
      }
    : {
        height: target,
        width: Math.max(1, Math.round((image.width * target) / image.height)),
      };
}
export function calculateAlignment(
  space: number,
  alignment: StitchSettings["alignment"],
) {
  return alignment === "start"
    ? 0
    : alignment === "end"
      ? space
      : Math.floor(space / 2);
}
export function calculateStitchLayout(
  images: Dimensions[],
  s: StitchSettings,
): StitchLayout {
  if (!images.length) throw new StitchError("请先选择图片。");
  if (
    images.some(
      (i) =>
        !Number.isSafeInteger(i.width) ||
        !Number.isSafeInteger(i.height) ||
        i.width < 1 ||
        i.height < 1,
    )
  )
    throw new StitchError("请删除或重新添加无法读取的图片。");
  if (!Number.isSafeInteger(s.gap) || s.gap < 0 || s.gap > 4096)
    throw new StitchError("图片间距须为 0～4096px 的整数。");
  if (
    s.size === "uniform" &&
    s.target !== null &&
    (!Number.isSafeInteger(s.target) || s.target < 1 || s.target > 16384)
  )
    throw new StitchError("目标尺寸须为 1～16384px 的整数。");
  if (s.background !== "transparent" && !/^#[0-9a-f]{6}$/i.test(s.background))
    throw new StitchError("请选择有效的背景颜色。");
  const vertical = s.direction === "vertical";
  const target =
    s.target ?? Math.min(...images.map((i) => (vertical ? i.width : i.height)));
  const sizes = images.map((i) =>
    s.size === "original"
      ? { ...i }
      : calculateScaledSize(i, s.direction, target),
  );
  const cross = Math.max(...sizes.map((i) => (vertical ? i.width : i.height)));
  let offset = 0;
  const items = sizes.map((i) => {
    const alignment = calculateAlignment(
      cross - (vertical ? i.width : i.height),
      s.alignment,
    );
    const item = {
      ...i,
      x: vertical ? alignment : offset,
      y: vertical ? offset : alignment,
    };
    offset += (vertical ? i.height : i.width) + s.gap;
    return item;
  });
  const main = offset - s.gap;
  return {
    width: vertical ? cross : main,
    height: vertical ? main : cross,
    items,
  };
}
export function validateStitchOutput(size: Dimensions) {
  if (
    size.width > 16384 ||
    size.height > 16384 ||
    size.width * size.height > 32_000_000
  )
    throw new StitchError(
      "拼接后的图片尺寸过大，请减少图片数量或降低目标尺寸。",
    );
}
export function resolveStitchFormat(
  formats: ImageFormat[],
  requested: StitchSettings["format"],
): ImageFormat {
  return requested !== "original"
    ? requested
    : formats.length && formats.every((f) => f === formats[0])
      ? formats[0]!
      : "image/png";
}
