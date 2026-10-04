import type { MarkSize, Point, WatermarkSettings } from "./types.ts";
export class WatermarkError extends Error {}
export function validateWatermark(
  settings: WatermarkSettings,
  hasLogo: boolean,
) {
  const finite = (n: number, min: number, max: number) =>
    Number.isFinite(n) && n >= min && n <= max;
  if (settings.kind === "text") {
    if (!settings.text.trim()) throw new WatermarkError("请输入水印文字。");
    if (settings.text.length > 100)
      throw new WatermarkError("水印文字请控制在 100 个字符以内。");
    if (!/^#[0-9a-f]{6}$/i.test(settings.color))
      throw new WatermarkError("请选择有效的文字颜色。");
    if (settings.size === "custom" && !finite(settings.fontSize, 8, 400))
      throw new WatermarkError("自定义字号请输入 8 到 400。");
  } else {
    if (!hasLogo) throw new WatermarkError("请先上传一张水印图片。");
    if (
      settings.size === "custom" &&
      !finite(settings.imageWidthPercent, 1, 100)
    )
      throw new WatermarkError("水印宽度请输入 1% 到 100%。");
  }
  if (settings.layout === "single") {
    if (
      !Number.isInteger(settings.position) ||
      !finite(settings.position, 0, 8)
    )
      throw new WatermarkError("请选择水印位置。");
    if (!finite(settings.margin, 0, 320))
      throw new WatermarkError("边距请输入 0 到 320。");
    if (!finite(settings.singleOpacity, 0, 100))
      throw new WatermarkError("透明度请输入 0% 到 100%。");
  } else {
    if (!finite(settings.tileOpacity, 0, 100))
      throw new WatermarkError("透明度请输入 0% 到 100%。");
    if (!finite(settings.angle, -180, 180))
      throw new WatermarkError("角度请输入 -180° 到 180°。");
    if (settings.density === "custom" && !finite(settings.gap, 0, 800))
      throw new WatermarkError("间距请输入 0 到 800。");
  }
}
/** Pixel controls use an 800px short-edge reference, preserving proportions in a batch. */
export function relativePixels(value: number, width: number, height: number) {
  return (value * Math.min(width, height)) / 800;
}
export function calculateWatermarkSize(
  width: number,
  height: number,
  settings: WatermarkSettings,
  content: {
    aspect: number;
    textWidthPerEm?: number;
    textHeightPerEm?: number;
  },
): MarkSize {
  const edge = Math.min(width, height);
  const fontSize =
    settings.size === "custom"
      ? relativePixels(settings.fontSize, width, height)
      : edge * { small: 0.025, medium: 0.04, large: 0.065 }[settings.size];
  let markWidth =
    settings.kind === "text"
      ? fontSize * (content.textWidthPerEm || 1)
      : settings.size === "custom"
        ? (width * settings.imageWidthPercent) / 100
        : edge * { small: 0.12, medium: 0.18, large: 0.28 }[settings.size];
  let markHeight =
    settings.kind === "text"
      ? fontSize * (content.textHeightPerEm || 1)
      : markWidth / content.aspect;
  const margin =
    settings.layout === "single"
      ? relativePixels(settings.margin, width, height)
      : 0;
  const maxWidth =
    settings.layout === "single" ? width - 2 * margin : edge * 0.75;
  const maxHeight =
    settings.layout === "single" ? height - 2 * margin : edge * 0.5;
  const fit = Math.min(
    1,
    Math.max(0.1, maxWidth) / markWidth,
    Math.max(0.1, maxHeight) / markHeight,
  );
  markWidth *= fit;
  markHeight *= fit;
  return { width: markWidth, height: markHeight, fontSize: fontSize * fit };
}
export function singlePosition(
  width: number,
  height: number,
  mark: MarkSize,
  position: number,
  margin: number,
): Point {
  const col = position % 3,
    row = Math.floor(position / 3);
  return {
    x:
      col === 0
        ? margin + mark.width / 2
        : col === 1
          ? width / 2
          : width - margin - mark.width / 2,
    y:
      row === 0
        ? margin + mark.height / 2
        : row === 1
          ? height / 2
          : height - margin - mark.height / 2,
  };
}
/** Use the rotated stamp's bounding box for spacing and add a bleed row/column at each edge. */
export function calculateTileLayout(
  width: number,
  height: number,
  mark: MarkSize,
  settings: WatermarkSettings,
) {
  const angle = (settings.angle * Math.PI) / 180;
  const boundWidth =
    Math.abs(mark.width * Math.cos(angle)) +
    Math.abs(mark.height * Math.sin(angle));
  const boundHeight =
    Math.abs(mark.width * Math.sin(angle)) +
    Math.abs(mark.height * Math.cos(angle));
  const gap =
    settings.density === "custom"
      ? relativePixels(settings.gap, width, height)
      : Math.min(width, height) *
        { sparse: 0.2, medium: 0.1, dense: 0.045 }[settings.density];
  const stepX = Math.max(0.5, boundWidth + gap),
    stepY = Math.max(0.5, boundHeight + gap);
  const columns = Math.ceil(width / stepX / 2) + 2,
    rows = Math.ceil(height / stepY / 2) + 2;
  if ((columns * 2 + 1) * (rows * 2 + 1) > 5000)
    throw new WatermarkError("水印过于密集，请增大水印或间距后重试。");
  const positions: Point[] = [];
  for (let row = -rows; row <= rows; row++) {
    const offset =
      settings.arrangement === "staggered" && Math.abs(row) % 2 ? stepX / 2 : 0;
    const y = height / 2 + row * stepY;
    for (let col = -columns; col <= columns; col++) {
      const x = width / 2 + col * stepX + offset;
      if (
        x + boundWidth / 2 >= 0 &&
        x - boundWidth / 2 <= width &&
        y + boundHeight / 2 >= 0 &&
        y - boundHeight / 2 <= height
      )
        positions.push({ x, y });
    }
  }
  return { positions, angle, stepX, stepY, boundWidth, boundHeight };
}
