import type { ImageFormat, ImageResult, ImageSource } from "../types";
import { ImageError } from "../browser";
import type { Slice } from "./geometry";
export async function encodeSlice(
  source: ImageSource,
  slice: Slice,
  format: ImageFormat,
): Promise<ImageResult> {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = slice.height;
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageError("无法创建切片画布，请减少图片数量后重试。");
    if (format === "image/jpeg") {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(
      source.bitmap,
      0,
      slice.y,
      source.width,
      slice.height,
      0,
      0,
      source.width,
      slice.height,
    );
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b && b.type === format
            ? resolve(b)
            : reject(
                new ImageError("切片导出失败，请换一种格式或减少每段高度。"),
              ),
        format,
        0.95,
      ),
    );
    return { blob, width: source.width, height: slice.height, format };
  } finally {
    canvas.width = canvas.height = 0;
  }
}
