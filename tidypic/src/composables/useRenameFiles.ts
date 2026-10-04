import { computed, onBeforeUnmount, ref } from "vue";
import type { ImageJob, ImageFormat } from "../utils/image/types";
class FileImportError extends Error {}
// Metadata only: no image decoder, canvas or encoder is used here.
export function useRenameFiles() {
  const images = ref<ImageJob[]>([]),
    loading = ref(false),
    packing = ref(false),
    error = ref("");
  const locked = computed(() => loading.value || packing.value);
  let disposed = false,
    nextId = 0;
  async function inspect(image: ImageJob) {
    try {
      if (image.originalFile.size > 40 * 1024 * 1024)
        throw new FileImportError("文件超过 40 MB，请选择较小的图片。");
      if (!/\.(jpe?g|png|webp)$/i.test(image.filename))
        throw new FileImportError("请选择 JPG、JPEG、PNG 或 WebP 文件。");
      const b = new Uint8Array(
        await image.originalFile.slice(0, 16).arrayBuffer(),
      );
      let format: ImageFormat;
      if (b[0] === 255 && b[1] === 216 && b[2] === 255) format = "image/jpeg";
      else if (b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71)
        format = "image/png";
      else if (
        String.fromCharCode(...b.slice(0, 4)) === "RIFF" &&
        String.fromCharCode(...b.slice(8, 12)) === "WEBP"
      )
        format = "image/webp";
      else
        throw new FileImportError(
          "文件类型不受支持，请选择 JPG、PNG 或 WebP。",
        );
      if (!disposed) {
        image.format = format;
        image.processingStatus = "waiting";
        image.error = "";
      }
    } catch (e) {
      if (!disposed) {
        image.processingStatus = "failed";
        image.error =
          e instanceof FileImportError
            ? e.message
            : "无法读取文件，请重新添加。";
      }
    }
  }
  async function add(files: FileList | File[]) {
    if (locked.value || disposed || !files.length) return;
    if (images.value.length + files.length > 200) {
      error.value = "最多导入 200 个文件，请减少本次选择数量。";
      return;
    }
    loading.value = true;
    error.value = "";
    try {
      for (const file of Array.from(files)) {
        if (disposed) break;
        const image: ImageJob = {
          id: `rename-${++nextId}`,
          originalFile: file,
          filename: file.name,
          width: 0,
          height: 0,
          originalSize: file.size,
          previewUrl: "",
          processingStatus: "reading",
          preservedOriginal: true,
          error: "",
        };
        images.value.push(image);
        await inspect(images.value[images.value.length - 1]!);
      }
    } finally {
      loading.value = false;
    }
  }
  function remove(id: string) {
    if (!locked.value) images.value = images.value.filter((i) => i.id !== id);
  }
  function clear() {
    if (!locked.value) {
      images.value = [];
      error.value = "";
    }
  }
  async function retry(image: ImageJob) {
    if (locked.value) return;
    loading.value = true;
    try {
      await inspect(image);
    } finally {
      loading.value = false;
    }
  }
  onBeforeUnmount(() => {
    disposed = true;
    images.value = [];
  });
  return { images, loading, packing, locked, error, add, remove, clear, retry };
}
