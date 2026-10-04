import type { ImageResult, ImageSource } from "../types";
import { ImageError } from "../browser";
import type { MarkSize, WatermarkSettings } from "./types";
import {
  calculateWatermarkSize,
  calculateTileLayout,
  singlePosition,
  relativePixels,
  validateWatermark,
  WatermarkError,
} from "./layout";
const FONT = "sans-serif";
type Painter = () => void;
export function drawTextWatermark(
  ctx: CanvasRenderingContext2D,
  settings: WatermarkSettings,
  mark: MarkSize,
) {
  ctx.font = `${mark.fontSize}px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = settings.color;
  const metrics = ctx.measureText(settings.text.trim());
  const left = metrics.actualBoundingBoxLeft || 0;
  const ascent = metrics.actualBoundingBoxAscent || mark.fontSize * 0.8;
  ctx.fillText(
    settings.text.trim(),
    -mark.width / 2 + left,
    -mark.height / 2 + ascent,
  );
}
export function drawImageWatermark(
  ctx: CanvasRenderingContext2D,
  logo: ImageBitmap,
  mark: MarkSize,
) {
  ctx.drawImage(
    logo,
    -mark.width / 2,
    -mark.height / 2,
    mark.width,
    mark.height,
  );
}
export function drawSingleWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  mark: MarkSize,
  settings: WatermarkSettings,
  paint: Painter,
) {
  const point = singlePosition(
    width,
    height,
    mark,
    settings.position,
    relativePixels(settings.margin, width, height),
  );
  ctx.save();
  ctx.globalAlpha = settings.singleOpacity / 100;
  ctx.translate(point.x, point.y);
  paint();
  ctx.restore();
}
export function drawTiledWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  mark: MarkSize,
  settings: WatermarkSettings,
  paint: Painter,
) {
  const layout = calculateTileLayout(width, height, mark, settings);
  ctx.save();
  ctx.globalAlpha = settings.tileOpacity / 100;
  for (const point of layout.positions) {
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(layout.angle);
    paint();
    ctx.restore();
  }
  ctx.restore();
}
/** Same logical coordinate system for the reduced preview and full-resolution export. */
export function renderWatermark(
  canvas: HTMLCanvasElement,
  bitmap: ImageBitmap,
  width: number,
  height: number,
  settings: WatermarkSettings,
  logo?: ImageBitmap,
  maxEdge?: number,
) {
  try {
    validateWatermark(settings, !!logo);
  } catch (e) {
    throw new ImageError((e as Error).message);
  }
  const scale = maxEdge ? Math.min(1, maxEdge / Math.max(width, height)) : 1;
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageError("无法创建水印画布，请关闭一些页面后重试。");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.scale(canvas.width / width, canvas.height / height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  ctx.font = `100px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const text = ctx.measureText(settings.text.trim());
  const mark = calculateWatermarkSize(width, height, settings, {
    aspect: logo ? logo.width / logo.height : 1,
    textWidthPerEm:
      Math.max(
        text.width,
        text.actualBoundingBoxLeft + text.actualBoundingBoxRight,
      ) / 100,
    textHeightPerEm:
      ((text.actualBoundingBoxAscent || 80) +
        (text.actualBoundingBoxDescent || 0)) /
      100,
  });
  if (settings.kind === "text") {
    // Font hinting is not perfectly linear. Position by the final glyph bounds,
    // rather than the advance width (which includes invisible side bearings).
    ctx.font = `${mark.fontSize}px ${FONT}`;
    const actual = ctx.measureText(settings.text.trim());
    const actualWidth = actual.actualBoundingBoxLeft + actual.actualBoundingBoxRight;
    const actualHeight = actual.actualBoundingBoxAscent + actual.actualBoundingBoxDescent;
    const margin = settings.layout === "single" ? relativePixels(settings.margin, width, height) : 0;
    const maxWidth = settings.layout === "single" ? width - 2 * margin : Math.min(width, height) * .75;
    const maxHeight = settings.layout === "single" ? height - 2 * margin : Math.min(width, height) * .5;
    const fit = Math.min(1, maxWidth / Math.max(1, actualWidth), maxHeight / Math.max(1, actualHeight));
    mark.fontSize *= fit;
    ctx.font = `${mark.fontSize}px ${FONT}`;
    const final = ctx.measureText(settings.text.trim());
    mark.width = final.actualBoundingBoxLeft + final.actualBoundingBoxRight || final.width;
    mark.height = final.actualBoundingBoxAscent + final.actualBoundingBoxDescent || mark.fontSize;
  }
  const paint = () =>
    settings.kind === "text"
      ? drawTextWatermark(ctx, settings, mark)
      : drawImageWatermark(ctx, logo!, mark);
  try {
    if (settings.layout === "single")
      drawSingleWatermark(ctx, width, height, mark, settings, paint);
    else drawTiledWatermark(ctx, width, height, mark, settings, paint);
  } catch (e) {
    if (e instanceof WatermarkError) throw new ImageError(e.message);
    throw e;
  }
}
export async function applyWatermark(
  source: ImageSource,
  settings: WatermarkSettings,
  logo?: ImageBitmap,
): Promise<ImageResult> {
  const canvas = document.createElement("canvas");
  try {
    renderWatermark(
      canvas,
      source.bitmap,
      source.width,
      source.height,
      settings,
      logo,
    );
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => {
          if (!blob)
            reject(new ImageError("水印图片导出失败，请尝试较小的图片。"));
          else if (blob.type !== source.format)
            reject(
              new ImageError("浏览器不支持保存此图片格式，请先转换格式。"),
            );
          else resolve(blob);
        },
        source.format,
        0.95,
      ),
    );
    return {
      blob,
      width: source.width,
      height: source.height,
      format: source.format,
    };
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
