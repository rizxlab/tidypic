export type SplitMode = "height" | "count" | "guides";
export interface SplitSettings {
  mode: SplitMode;
  height: number;
  count: number;
}
export interface Slice {
  y: number;
  height: number;
}
export class SplitError extends Error {}
export function splitByHeight(height: number, step: number): Slice[] {
  if (!Number.isSafeInteger(step) || step <= 0)
    throw new SplitError("每段高度必须是大于 0 的整数。");
  const count = Math.ceil(height / step);
  if (count > 100)
    throw new SplitError("每张图片最多切成 100 张，请增加每段高度。");
  return Array.from({ length: count }, (_, i) => ({
    y: i * step,
    height: Math.min(step, height - i * step),
  }));
}
export function splitByCount(height: number, count: number): Slice[] {
  if (
    !Number.isSafeInteger(count) ||
    count < 1 ||
    count > 100 ||
    count > height
  )
    throw new SplitError("切分数量须为 1～100 的整数，且不能超过图片高度。");
  const base = Math.floor(height / count),
    remainder = height % count;
  return Array.from({ length: count }, (_, i) => ({
    y: i * base + Math.min(i, remainder),
    height: base + (i < remainder ? 1 : 0),
  }));
}
export function splitByGuides(height: number, guides: number[]): Slice[] {
  if (guides.length > 99) throw new SplitError("最多添加 99 条切线。");
  const sorted = [...guides].sort((a, b) => a - b);
  if (
    sorted.some(
      (y, i) =>
        !Number.isSafeInteger(y) ||
        y <= 0 ||
        y >= height ||
        (i > 0 && y - sorted[i - 1]! < 1),
    )
  )
    throw new SplitError("切线不能重复或超出图片，每段至少保留 1px。");
  const bounds = [0, ...sorted, height];
  return bounds
    .slice(1)
    .map((end, i) => ({ y: bounds[i]!, height: end - bounds[i]! }));
}
export function calculateSlices(
  height: number,
  settings: SplitSettings,
  guides: number[] = [],
): Slice[] {
  if (!Number.isSafeInteger(height) || height < 1)
    throw new SplitError("图片高度无效，请重新选择图片。");
  return settings.mode === "height"
    ? splitByHeight(height, settings.height)
    : settings.mode === "count"
      ? splitByCount(height, settings.count)
      : splitByGuides(height, guides);
}
export function sliceFilename(
  filename: string,
  extension: string,
  index: number,
  count: number,
) {
  const stem =
    filename.replace(/[\\/\x00-\x1f]/g, "_").replace(/\.[^.]*$/, "") || "图片";
  return `${stem}_${String(index + 1).padStart(Math.max(2, String(count).length), "0")}.${extension}`;
}
