import { ImageError } from "../browser";
import { findBestEncoding, CompressionError } from "../compress";
import type { ImageSource, ImageFormat, ImageResult } from "../types";
import {
  calculateTransform,
  TransformError,
  type Transform,
  type TransformSettings,
  type CropState,
} from "./geometry";
export function renderToCanvas(
  canvas: HTMLCanvasElement,
  bitmap: ImageBitmap,
  t: Transform,
  format: ImageFormat,
  scale = 1,
) {
  canvas.width = Math.max(1, Math.round(t.canvasWidth * scale));
  canvas.height = Math.max(1, Math.round(t.canvasHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx)
    throw new ImageError("浏览器无法处理这张图片，请关闭其他页面后重试。");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (format === "image/jpeg" || t.background !== "transparent") {
    ctx.fillStyle = t.background === "transparent" ? "#ffffff" : t.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const s = t.sourceRect,
    d = t.destinationRect;
  // The proxy carries the same original coordinate system as export.
  ctx.drawImage(
    bitmap,
    (s.x * bitmap.width) / t.originalWidth,
    (s.y * bitmap.height) / t.originalHeight,
    (s.width * bitmap.width) / t.originalWidth,
    (s.height * bitmap.height) / t.originalHeight,
    (d.x * canvas.width) / t.canvasWidth,
    (d.y * canvas.height) / t.canvasHeight,
    (d.width * canvas.width) / t.canvasWidth,
    (d.height * canvas.height) / t.canvasHeight,
  );
}
export async function processTransform(
  source: ImageSource,
  settings: TransformSettings,
  crop?: CropState,
): Promise<ImageResult> {
  const canvas = document.createElement("canvas");
  try {
    const t = calculateTransform(source.width, source.height, settings, crop),
      format = settings.format === "original" ? source.format : settings.format;
    const maxBytes =
      settings.sizeUnit === "none"
        ? undefined
        : settings.sizeLimit * (settings.sizeUnit === "MB" ? 1048576 : 1024);
    const s = t.sourceRect;
    if (settings.fit !== "pad" || settings.mode !== "exact") {
      if (
        !s.x &&
        !s.y &&
        s.width === source.width &&
        s.height === source.height &&
        t.canvasWidth === source.width &&
        t.canvasHeight === source.height &&
        format === source.format &&
        (!maxBytes || source.file.size <= maxBytes)
      )
        return {
          blob: source.file,
          width: source.width,
          height: source.height,
          format,
          preservedOriginal: true,
        };
    }
    renderToCanvas(canvas, source.bitmap, t, format);
    const blob = await findBestEncoding(
      (q) =>
        new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (b) =>
              b && b.type === format
                ? resolve(b)
                : reject(
                    new ImageError("浏览器无法输出此格式，请尝试其他格式。"),
                  ),
            format,
            q,
          ),
        ),
      maxBytes,
      format === "image/png",
    );
    return { blob, width: t.canvasWidth, height: t.canvasHeight, format };
  } catch (e) {
    if (e instanceof TransformError || e instanceof CompressionError)
      throw new ImageError(e.message);
    throw e;
  } finally {
    canvas.width = canvas.height = 0;
  }
}
