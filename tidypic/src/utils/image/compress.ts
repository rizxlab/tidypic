export class CompressionError extends Error {}
/** Encoding is injected so the size/quality policy can be reused with other platforms. */
export async function findBestEncoding(
  encode: (quality: number) => Promise<Blob>,
  maxBytes?: number,
  lossless = false,
): Promise<Blob> {
  if (maxBytes !== undefined && (!Number.isFinite(maxBytes) || maxBytes < 1024))
    throw new CompressionError("文件大小目标太低，请至少设置为 1 KB。");
  const best = await encode(1);
  if (!maxBytes || best.size <= maxBytes) return best;
  if (lossless)
    throw new CompressionError(
      "PNG 无损格式无法在当前尺寸下达到目标。请减小尺寸，或改用 JPG / WebP。",
    );
  let low = 0.1,
    high = 1;
  let result = await encode(low);
  if (result.size > maxBytes)
    throw new CompressionError(
      "当前尺寸下无法达到这个文件大小。请减小尺寸，或适当提高文件大小上限。",
    );
  for (let i = 0; i < 9; i++) {
    const quality = (low + high) / 2;
    const blob = await encode(quality);
    if (blob.size <= maxBytes) {
      low = quality;
      result = blob;
    } else high = quality;
  }
  return result;
}
