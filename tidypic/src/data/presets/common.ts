import type { ImagePreset } from "../../utils/presets/model";
export const commonPresets: ImagePreset[] = [
  ["square", "正方形商品图", 1, 1],
  ["product-portrait", "商品竖图", 3, 4],
  ["phone", "手机竖图", 9, 16],
  ["landscape", "横版图片", 16, 9],
].map(([id, name, w, h]) => ({
  id: `common-${id}`,
  name: String(name),
  type: "common",
  summary: `${w}:${h}`,
  settings: { mode: "ratio", ratioWidth: Number(w), ratioHeight: Number(h) },
}));
