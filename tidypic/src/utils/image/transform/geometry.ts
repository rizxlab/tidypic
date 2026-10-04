import type { ImageFormat } from "../types";
export interface TransformSettings {
  mode: "limit" | "exact" | "ratio";
  axis: "width" | "height" | "longest" | "original";
  limit: number;
  width: number;
  height: number;
  ratioWidth: number;
  ratioHeight: number;
  fit: "crop" | "pad";
  background: string;
  sizeUnit: "none" | "KB" | "MB";
  sizeLimit: number;
  format: ImageFormat | "original";
  presetId?: string;
  presetName?: string;
}
export interface CropState {
  x: number;
  y: number;
  zoom: number;
}
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export const centerCrop = (): CropState => ({ x: 0.5, y: 0.5, zoom: 1 });
export const defaultSettings = (): TransformSettings => ({
  mode: "limit",
  axis: "width",
  limit: 800,
  width: 800,
  height: 800,
  ratioWidth: 1,
  ratioHeight: 1,
  fit: "crop",
  background: "#ffffff",
  sizeUnit: "KB",
  sizeLimit: 500,
  format: "original",
});
export class TransformError extends Error {}
export function checkCanvas(width: number, height: number) {
  if (
    ![width, height].every((v) => Number.isInteger(v) && v > 0 && v <= 16384) ||
    width * height > 32_000_000
  )
    throw new TransformError(
      "图片尺寸过大或无效，请设置正整数尺寸并降低输出尺寸后重试。",
    );
}
export function validateSettings(s: TransformSettings) {
  if (s.mode === "exact") checkCanvas(s.width, s.height);
  if (
    s.mode === "limit" &&
    s.axis !== "original" &&
    (!Number.isInteger(s.limit) || s.limit < 1 || s.limit > 16384)
  )
    throw new TransformError("尺寸请输入 1–16384 之间的整数。");
  if (
    s.mode === "ratio" &&
    ![s.ratioWidth, s.ratioHeight].every((v) => Number.isFinite(v) && v > 0)
  )
    throw new TransformError("比例两侧都需要填写大于 0 的数字。");
  if (
    s.sizeUnit !== "none" &&
    (!Number.isFinite(s.sizeLimit) ||
      s.sizeLimit * (s.sizeUnit === "MB" ? 1048576 : 1024) < 1024)
  )
    throw new TransformError("文件大小目标至少为 1 KB。");
  if (s.background !== "transparent" && !/^#[0-9a-f]{6}$/i.test(s.background))
    throw new TransformError("请选择有效的背景颜色。");
}
export function calculateCropRect(
  w: number,
  h: number,
  ratio: number,
  state: CropState = centerCrop(),
): Rect {
  if (!Number.isFinite(ratio) || ratio <= 0)
    throw new TransformError("请填写有效的图片比例。");
  const zoom = Math.max(
    1,
    Math.min(4, Number.isFinite(state.zoom) ? state.zoom : 1),
  );
  const width = Math.round(Math.min(w, h * ratio) / zoom),
    height = Math.round(Math.min(h, w / ratio) / zoom);
  if (width < 1 || height < 1)
    throw new TransformError("这个比例过于狭长，请调整比例后重试。");
  const x = Math.max(
    0,
    Math.min(w - width, Math.round(state.x * w - width / 2)),
  );
  const y = Math.max(
    0,
    Math.min(h - height, Math.round(state.y * h - height / 2)),
  );
  return { x, y, width, height };
}
export function calculateContainRect(
  w: number,
  h: number,
  tw: number,
  th: number,
): Rect {
  const scale = Math.min(tw / w, th / h),
    width = Math.max(1, Math.round(w * scale)),
    height = Math.max(1, Math.round(h * scale));
  return {
    x: Math.floor((tw - width) / 2),
    y: Math.floor((th - height) / 2),
    width,
    height,
  };
}
export function calculateTransform(
  w: number,
  h: number,
  s: TransformSettings,
  state?: CropState,
) {
  validateSettings(s);
  checkCanvas(w, h);
  let sourceRect: Rect = { x: 0, y: 0, width: w, height: h },
    canvasWidth = w,
    canvasHeight = h;
  if (s.mode === "limit" && s.axis !== "original") {
    const scale = Math.min(
      1,
      s.limit /
        (s.axis === "width" ? w : s.axis === "height" ? h : Math.max(w, h)),
    );
    canvasWidth = Math.max(1, Math.round(w * scale));
    canvasHeight = Math.max(1, Math.round(h * scale));
  } else if (s.mode === "ratio" || (s.mode === "exact" && s.fit === "crop")) {
    sourceRect = calculateCropRect(
      w,
      h,
      s.mode === "ratio" ? s.ratioWidth / s.ratioHeight : s.width / s.height,
      state,
    );
    canvasWidth = s.mode === "exact" ? s.width : sourceRect.width;
    canvasHeight = s.mode === "exact" ? s.height : sourceRect.height;
  } else if (s.mode === "exact") {
    canvasWidth = s.width;
    canvasHeight = s.height;
  }
  checkCanvas(canvasWidth, canvasHeight);
  const destinationRect =
    s.mode === "exact" && s.fit === "pad"
      ? calculateContainRect(w, h, canvasWidth, canvasHeight)
      : { x: 0, y: 0, width: canvasWidth, height: canvasHeight };
  return {
    originalWidth: w,
    originalHeight: h,
    sourceRect,
    destinationRect,
    canvasWidth,
    canvasHeight,
    background:
      s.mode === "exact" && s.fit === "pad" ? s.background : "transparent",
    upscaled:
      destinationRect.width > sourceRect.width ||
      destinationRect.height > sourceRect.height,
  };
}
export type Transform = ReturnType<typeof calculateTransform>;
