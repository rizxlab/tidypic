import { ImageError, readImage } from "../browser";
import type { ImageFormat, ImageResult } from "../types";
import type { StitchLayout, StitchSettings } from "./geometry";
import { validateStitchOutput } from "./geometry";
export async function renderStitchedImage(
  canvas: HTMLCanvasElement,
  layout: StitchLayout,
  settings: StitchSettings,
  format: ImageFormat,
  load: (
    index: number,
  ) => Promise<{ image: CanvasImageSource; release: () => void }>,
  maxEdge?: number,
  cancelled = () => false,
) {
  const scale = maxEdge
    ? Math.min(1, maxEdge / Math.max(layout.width, layout.height))
    : 1;
  canvas.width = Math.max(1, Math.round(layout.width * scale));
  canvas.height = Math.max(1, Math.round(layout.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageError("无法创建拼接画布，请减少图片数量后重试。");
  const background =
    settings.background === "transparent" && format === "image/jpeg"
      ? "#ffffff"
      : settings.background;
  if (background !== "transparent") {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  for (let i = 0; i < layout.items.length; i++) {
    if (cancelled()) return;
    const source = await load(i);
    try {
      if (cancelled()) return;
      const item = layout.items[i]!;
      const x = Math.round(item.x * scale),
        y = Math.round(item.y * scale);
      ctx.drawImage(
        source.image,
        x,
        y,
        Math.round((item.x + item.width) * scale) - x,
        Math.round((item.y + item.height) * scale) - y,
      );
    } finally {
      source.release();
    }
  }
}
export async function encodeStitchedImage(
  files: File[],
  layout: StitchLayout,
  settings: StitchSettings,
  format: ImageFormat,
  cancelled = () => false,
): Promise<ImageResult> {
  validateStitchOutput(layout);
  const canvas = document.createElement("canvas");
  try {
    await renderStitchedImage(
      canvas,
      layout,
      settings,
      format,
      async (i) => {
        const source = await readImage(files[i]!);
        return { image: source.bitmap, release: () => source.bitmap.close() };
      },
      undefined,
      cancelled,
    );
    if (cancelled()) throw new ImageError("拼接已停止。");
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b && b.type === format
            ? resolve(b)
            : reject(
                new ImageError("图片导出失败，请缩小目标尺寸或更换格式。"),
              ),
        format,
        0.95,
      ),
    );
    return { blob, width: layout.width, height: layout.height, format };
  } finally {
    canvas.width = canvas.height = 0;
  }
}
