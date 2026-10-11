import { loadRecords, saveRecords } from "./records.ts";
import { parseSettings, validateName, type ImagePreset } from "./model.ts";
export const PRESET_STORAGE_KEY = "tidypic.resize.presets.v1";
type Store = Pick<Storage, "getItem" | "setItem">;
function parseRecord(value: unknown, items: ImagePreset[]): ImagePreset {
  const p = value as ImagePreset;
  if (
    !p ||
    p.type !== "user" ||
    typeof p.id !== "string" ||
    !p.id ||
    typeof p.name !== "string" ||
    typeof p.createdAt !== "string" ||
    !Number.isFinite(Date.parse(p.createdAt)) ||
    items.some((i) => i.id === p.id)
  )
    throw Error("本机预设数据无效，原有数据未被覆盖。");
  return {
    id: p.id,
    name: validateName(p.name, items),
    type: "user",
    createdAt: p.createdAt,
    settings: parseSettings(p.settings),
  };
}
export function savePresets(storage: Store, presets: ImagePreset[]) {
  saveRecords(storage, PRESET_STORAGE_KEY, presets, parseRecord);
}
export function loadPresets(storage: Store): ImagePreset[] {
  try {
    return loadRecords(storage, PRESET_STORAGE_KEY, parseRecord);
  } catch {
    throw Error("无法读取本机预设，原有数据未被覆盖。");
  }
}
