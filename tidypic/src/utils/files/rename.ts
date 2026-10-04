export type RenameMode = "uniform" | "prefix" | "suffix";
export interface RenameSettings {
  mode: RenameMode;
  name: string;
  prefix: string;
  suffix: string;
  digits: 1 | 2 | 3;
  start: number;
  separator: "_" | "-" | " " | "";
}
export interface RenameSource {
  id: string;
  filename: string;
}
export interface RenameEntry {
  id: string;
  originalName: string;
  name: string;
  changed: boolean;
}
export const defaultRenameSettings = (): RenameSettings => ({
  mode: "uniform",
  name: "",
  prefix: "",
  suffix: "",
  digits: 2,
  start: 1,
  separator: "_",
});
export function splitFilename(filename: string) {
  const dot = filename.lastIndexOf(".");
  return dot >= 0
    ? { basename: filename.slice(0, dot), extension: filename.slice(dot) }
    : { basename: filename, extension: "" };
}
export function sanitizeFilename(value: string) {
  let safe = value
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, "_")
    .trim()
    .replace(/[. ]+$/g, "");
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(safe))
    safe = "_" + safe;
  return safe;
}
export function formatNumber(
  index: number,
  count: number,
  digits: 1 | 2 | 3,
  start: number,
) {
  const value = start + index;
  const width =
    digits === 1
      ? 1
      : Math.max(digits, String(start + Math.max(0, count - 1)).length);
  return String(value).padStart(width, "0");
}
export function detectDuplicateNames(names: string[]) {
  const seen = new Set<string>(),
    duplicates = new Set<string>();
  for (const name of names) {
    const key = name.normalize("NFC").toLowerCase();
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  }
  return duplicates;
}
export function generateRenamedFiles(
  files: RenameSource[],
  settings: RenameSettings,
) {
  const value =
    settings.mode === "uniform"
      ? settings.name
      : settings.mode === "prefix"
        ? settings.prefix
        : settings.suffix;
  const clean = sanitizeFilename(value);
  const entries: RenameEntry[] = [];
  if (!clean && settings.mode !== "uniform")
    return { entries, error: "请输入名称。", sanitized: clean !== value };
  if (
    settings.mode === "uniform" &&
    (!Number.isSafeInteger(settings.start) ||
      settings.start < 0 ||
      !Number.isSafeInteger(settings.start + files.length))
  )
    return {
      entries,
      error: "起始编号须为非负整数，且不能超过安全整数范围。",
      sanitized: false,
    };
  let sanitized = clean !== value;
  for (let i = 0; i < files.length; i++) {
    const file = files[i]!,
      { basename, extension } = splitFilename(file.filename);
    const stem =
      settings.mode === "uniform"
        ? [clean, formatNumber(i, files.length, settings.digits, settings.start)]
            .filter(Boolean)
            .join(settings.separator)
        : settings.mode === "prefix"
          ? `${clean}${settings.separator}${basename}`
          : `${basename}${settings.separator}${clean}`;
    const safe = sanitizeFilename(stem);
    sanitized ||= safe !== stem;
    const name = safe + extension;
    entries.push({
      id: file.id,
      originalName: file.filename,
      name,
      changed: name !== file.filename,
    });
  }
  const duplicates = detectDuplicateNames(entries.map((e) => e.name));
  const error = duplicates.size
    ? "存在重复文件名，请调整命名规则。"
    : entries.some((e) => new TextEncoder().encode(e.name).length > 255)
      ? "文件名过长，请缩短名称。"
      : "";
  return { entries, error, sanitized };
}
