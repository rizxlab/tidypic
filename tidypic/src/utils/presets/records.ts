/** Shared versioned local record storage; each preset family owns its settings schema. */
export type PresetStore = Pick<Storage, "getItem" | "setItem">;
export function loadRecords<P>(
  storage: PresetStore,
  key: string,
  parse: (value: unknown, previous: P[]) => P,
): P[] {
  const raw = storage.getItem(key);
  if (raw === null) return [];
  const data = JSON.parse(raw);
  if (data?.version !== 1 || !Array.isArray(data.presets))
    throw Error("无法读取本机预设，原有数据未被覆盖。");
  const records: P[] = [];
  for (const record of data.presets) records.push(parse(record, records));
  return records;
}
export function saveRecords<P>(
  storage: PresetStore,
  key: string,
  presets: P[],
  parse: (value: unknown, previous: P[]) => P,
  maxBytes = Infinity,
) {
  const checked: P[] = [];
  for (const p of presets) checked.push(parse(p, checked));
  const json = JSON.stringify({ version: 1, presets: checked });
  if (new Blob([json]).size > maxBytes)
    throw Error("水印预设存储已达 4MB 上限，请删除不需要的图片预设后重试。");
  storage.setItem(key, json);
}
