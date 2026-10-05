import type {
  ImageJob,
  ImageFormat,
  ImageSource,
  ImageResult,
  ProcessOptions,
} from "./types";
import { dimensions, cropRect } from "./geometry";
import { findBestEncoding, CompressionError } from "./compress";
import { canKeepOriginal } from "./policy";
export class ImageError extends Error {}
export function friendlyError(error: unknown) {
  return error instanceof ImageError
    ? error.message
    : "图片处理失败，可能是内存不足或浏览器不支持。请尝试较小的图片。";
}
export async function readImage(
  file: File,
  options: { generated?: boolean } = {},
): Promise<ImageSource> {
  // Generated workflow files already passed import validation; their encoded
  // size can grow after stitching/format changes. Pixel/decode checks still apply.
  if (!options.generated && file.size > 40 * 1024 * 1024)
    throw new ImageError("图片超过 40 MB，请先选择一张较小的图片。");
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  let format: ImageFormat;
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    format = "image/jpeg";
  else if (
    bytes[0] === 137 &&
    bytes[1] === 80 &&
    bytes[2] === 78 &&
    bytes[3] === 71
  )
    format = "image/png";
  else if (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    format = "image/webp";
  else
    throw new ImageError("请选择 JPG、PNG 或 WebP 图片，暂不支持此文件格式。");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageError(
      "无法读取这张图片，请确认文件完整，或换一张图片重试。",
    );
  }
  if (
    bitmap.width * bitmap.height > 32_000_000 ||
    Math.max(bitmap.width, bitmap.height) > 16384
  ) {
    bitmap.close();
    throw new ImageError(
      "图片像素过大。请选择不超过 3200 万像素、单边不超过 16384 px 的图片。",
    );
  }
  return { file, bitmap, width: bitmap.width, height: bitmap.height, format };
}
export async function processImage(
  source: ImageSource,
  options: ProcessOptions,
): Promise<ImageResult> {
  let size;
  try {
    size = dimensions(source.width, source.height, options);
  } catch (e) {
    throw new ImageError((e as Error).message);
  }
  if (
    options.maxBytes !== undefined &&
    (!Number.isFinite(options.maxBytes) || options.maxBytes < 1024)
  ) {
    throw new ImageError("文件大小目标太低，请至少设置为 1 KB。");
  }
  if (canKeepOriginal({ ...source, size: source.file.size }, options)) {
    return {
      blob: source.file,
      ...size,
      format: source.format,
      preservedOriginal: true,
    };
  }
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx)
      throw new ImageError("浏览器无法创建图片画布，请关闭一些页面后重试。");
    if (options.format === "image/jpeg") {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const crop =
      options.mode === "exact" && options.fit === "cover"
        ? cropRect(source.width, source.height, size.width, size.height)
        : { x: 0, y: 0, width: source.width, height: source.height };
    ctx.drawImage(
      source.bitmap,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      size.width,
      size.height,
    );
    const encode = (quality: number) =>
      new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (blob) => {
            if (!blob) reject(new ImageError("图片导出失败，请尝试缩小尺寸。"));
            else if (blob.type !== options.format)
              reject(
                new ImageError("当前浏览器不支持此输出格式，请换一种格式。"),
              );
            else resolve(blob);
          },
          options.format,
          quality,
        ),
      );
    let blob: Blob;
    try {
      blob = await findBestEncoding(
        encode,
        options.maxBytes,
        options.format === "image/png",
      );
    } catch (e) {
      if (e instanceof CompressionError) throw new ImageError(e.message);
      throw e;
    }
    return { blob, ...size, format: options.format };
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
export function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(2)} MB`
    : `${(bytes / 1024).toFixed(1)} KB`;
}
export function formatName(format: string) {
  return format === "image/jpeg" ? "JPG" : format.split("/")[1]?.toUpperCase();
}
export async function createThumbnail(
  source: ImageSource,
  maxEdge = 96,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height));
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  try {
    const context = canvas.getContext("2d");
    if (!context) throw new ImageError("无法创建图片预览，请重试。");
    context.drawImage(source.bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new ImageError("无法创建图片预览，请重试。")),
        "image/png",
      ),
    );
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

/** Preview callers decode the shared reduced blob, never re-import the original File. */
export async function readPreview(image: ImageJob, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
  const options = {
    resizeWidth: Math.max(1, Math.round(image.width * scale)),
    resizeHeight: Math.max(1, Math.round(image.height * scale)),
    resizeQuality: "high" as const,
  };
  if (image.sourcePreviewBlob)
    return {
      bitmap: await createImageBitmap(image.sourcePreviewBlob, options),
      width: image.width,
      height: image.height,
    };
  // Compatibility for callers supplying a standalone ImageJob outside a workspace.
  const source = await readImage(image.originalFile);
  try {
    return {
      bitmap: await createImageBitmap(source.bitmap, options),
      width: source.width,
      height: source.height,
    };
  } finally {
    source.bitmap.close();
  }
}
