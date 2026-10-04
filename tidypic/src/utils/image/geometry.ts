import type { ResizeOptions } from "./types.ts";
export function validateResizeOptions(options: ResizeOptions) {
  const { mode, width, height } = options;
  const valid = (n: number) => Number.isInteger(n) && n >= 1 && n <= 8192;
  if (
    mode !== "original" &&
    (!valid(mode === "height" ? height : width) ||
      (mode === "exact" && !valid(height)))
  )
    throw new Error("请输入 1 到 8192 之间的整数尺寸。");
}
export function dimensions(w: number, h: number, options: ResizeOptions) {
  validateResizeOptions(options);
  const { mode, width, height, fit } = options;
  let scale = 1;
  if (mode === "width") scale = Math.min(1, width / w);
  if (mode === "height") scale = Math.min(1, height / h);
  if (mode === "longest") scale = Math.min(1, width / Math.max(w, h));
  if (mode === "exact") scale = Math.min(width / w, height / h);
  const output =
    mode === "exact" && fit === "cover"
      ? { width, height }
      : {
          width: Math.max(1, Math.round(w * scale)),
          height: Math.max(1, Math.round(h * scale)),
        };
  if (output.width * output.height > 32_000_000)
    throw new Error("输出图片过大，请将尺寸调小后重试。");
  return output;
}
export function cropRect(
  w: number,
  h: number,
  targetW: number,
  targetH: number,
) {
  const scale = Math.max(targetW / w, targetH / h);
  const width = targetW / scale,
    height = targetH / scale;
  return { x: (w - width) / 2, y: (h - height) / 2, width, height };
}
