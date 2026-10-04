import { uniqueFilename } from "./names";
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export async function createImageZip(files: { name: string; blob: Blob }[]) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const used = new Set<string>();
  for (const file of files)
    zip.file(uniqueFilename(file.name, used), file.blob);
  // Images are already compressed. STORE avoids another expensive compression pass.
  return zip.generateAsync({
    type: "blob",
    compression: "STORE",
    streamFiles: true,
  });
}
