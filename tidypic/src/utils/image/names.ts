import type { ImageFormat } from "./types.ts";
export function outputFilename(
  filename: string,
  format: ImageFormat,
  originalFormat?: ImageFormat,
) {
  const safe = filename.replace(/[\\/\x00-\x1f]/g, "_");
  if (format === originalFormat && safe) return safe;
  const stem = safe.replace(/\.[^.]+$/, "") || "image";
  return `${stem}.${format === "image/jpeg" ? "jpg" : format.split("/")[1]}`;
}
/** Case-insensitive collisions are also avoided for Windows / macOS extraction. */
export function uniqueFilename(name: string, used: Set<string>) {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : "";
  let candidate = name,
    index = 2;
  while (used.has(candidate.toLocaleLowerCase()))
    candidate = `${stem} (${index++})${extension}`;
  used.add(candidate.toLocaleLowerCase());
  return candidate;
}
