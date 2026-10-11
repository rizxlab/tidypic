export interface PreviewImage {
  id: string;
  name: string;
  blob?: Blob;
  /** Borrowed URLs remain owned by the source/result collection. */
  url?: string;
}
export function createPreviewUrls(
  create = (blob: Blob) => URL.createObjectURL(blob),
  revoke = (url: string) => URL.revokeObjectURL(url),
) {
  const owned = new Map<Blob, string>();
  return {
    get(image: PreviewImage) {
      if (image.url) return image.url;
      if (!image.blob) throw Error("没有可预览的图片。");
      let url = owned.get(image.blob);
      if (!url) {
        url = create(image.blob);
        owned.set(image.blob, url);
      }
      return url;
    },
    clear() {
      owned.forEach(revoke);
      owned.clear();
    },
  };
}
