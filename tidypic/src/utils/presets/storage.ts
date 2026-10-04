import { parseSettings, validateName, type ImagePreset } from "./model.ts";
export const PRESET_STORAGE_KEY = "tidypic.resize.presets.v1";
type Store = Pick<Storage, "getItem" | "setItem">;
function readRecords(storage: Store): ImagePreset[] {
  const raw = storage.getItem(PRESET_STORAGE_KEY);
  if (raw === null) return [];
  const data = JSON.parse(raw);
  if (data?.version !== 1 || !Array.isArray(data.presets))
    throw new Error("无法读取本机预设，原有数据未被覆盖。");
  const items: ImagePreset[] = [];
  for (const p of data.presets) {
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
      throw new Error("本机预设数据无效，原有数据未被覆盖。");
    items.push({
      id: p.id,
      name: validateName(p.name, items),
      type: "user",
      createdAt: p.createdAt,
      settings: parseSettings(p.settings),
    });
  }
  return items;
}
export function savePresets(storage: Store, presets: ImagePreset[]) {
  storage.setItem(
    PRESET_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      presets: presets.map((p) => ({
        id: p.id,
        name: p.name,
        type: "user",
        createdAt: p.createdAt,
        settings: parseSettings(p.settings),
      })),
    }),
  );
}

export function loadPresets(storage: Store): ImagePreset[] {
  try {
    return readRecords(storage);
  } catch {
    throw new Error("无法读取本机预设，原有数据未被覆盖。");
  }
}
