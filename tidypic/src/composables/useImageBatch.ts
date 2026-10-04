import { computed, onBeforeUnmount, reactive, ref } from "vue";
import type {
  ImageJob,
  ImageSource,
  ImageResult,
  OutputSettings,
  ProcessOptions,
} from "../utils/image/types";
import {
  readImage,
  processImage,
  createThumbnail,
  friendlyError,
} from "../utils/image/browser";
import { validateResizeOptions } from "../utils/image/geometry";
import { runQueue } from "../utils/image/queue";
import { outputFilename } from "../utils/image/names";
import { createImageZip, downloadBlob } from "../utils/image/download";

export function useImageBatch(zipName = "tidypic-images.zip") {
  const images = ref<ImageJob[]>([]);
  const loading = ref(false),
    processing = ref(false),
    packing = ref(false),
    error = ref("");
  const completed = ref(0),
    total = ref(0);
  const locked = computed(
    () => loading.value || processing.value || packing.value,
  );
  const successes = computed(() =>
    images.value.filter((image) => image.processingStatus === "done"),
  );
  const pending = computed(() =>
    images.value.filter(
      (image) =>
        image.processingStatus === "waiting" ||
        image.processingStatus === "failed",
    ),
  );
  let disposed = false;
  let nextId = 0;

  function release(image: ImageJob) {
    if (image.previewUrl) URL.revokeObjectURL(image.previewUrl);
    image.previewUrl = "";
    image.resultBlob = undefined;
  }
  function resetResult(image: ImageJob) {
    image.resultBlob = undefined;
    image.resultWidth = undefined;
    image.resultHeight = undefined;
    image.resultSize = undefined;
    image.resultFormat = undefined;
    image.preservedOriginal = false;
  }
  function invalidate() {
    if (locked.value) return;
    error.value = "";
    completed.value = 0;
    total.value = 0;
    for (const image of images.value) {
      resetResult(image);
      if (image.format) {
        image.processingStatus = "waiting";
        image.error = "";
      }
    }
  }
  function remove(id: string) {
    if (locked.value) return;
    const image = images.value.find((image) => image.id === id);
    if (image) release(image);
    images.value = images.value.filter((image) => image.id !== id);
  }
  function clear() {
    if (locked.value) return;
    images.value.forEach(release);
    images.value = [];
    error.value = "";
    completed.value = 0;
    total.value = 0;
  }
  async function inspect(image: ImageJob): Promise<ImageSource> {
    const source = await readImage(image.originalFile);
    try {
      image.width = source.width;
      image.height = source.height;
      image.format = source.format;
      if (!image.previewUrl && !disposed) {
        const thumbnail = await createThumbnail(source);
        if (!disposed) image.previewUrl = URL.createObjectURL(thumbnail);
      }
      return source;
    } catch (e) {
      source.bitmap.close();
      throw e;
    }
  }
  async function add(files: FileList | File[]) {
    if (locked.value || disposed || !files.length) return;
    loading.value = true;
    error.value = "";
    const added = Array.from(files, (file) =>
      reactive<ImageJob>({
        id: `image-${++nextId}`,
        originalFile: file,
        filename: file.name,
        width: 0,
        height: 0,
        originalSize: file.size,
        previewUrl: "",
        processingStatus: "reading",
        error: "",
        preservedOriginal: false,
      }),
    );
    images.value.push(...added);
    try {
      // Decode metadata/thumbnail one at a time; never retain full-size bitmaps in the list.
      for (const image of added) {
        if (disposed) break;
        let source: ImageSource | undefined;
        try {
          source = await inspect(image);
          image.processingStatus = "waiting";
        } catch (e) {
          image.processingStatus = "failed";
          image.error = friendlyError(e);
        } finally {
          source?.bitmap.close();
        }
      }
    } finally {
      loading.value = false;
    }
  }
  async function run(settings: OutputSettings, only?: ImageJob) {
    if (locked.value || disposed) return;
    const targets = only ? [only] : [...pending.value];
    if (!targets.length) return;
    const maxBytes =
      settings.sizeUnit === "none"
        ? undefined
        : Math.floor(
            settings.sizeLimit * (settings.sizeUnit === "MB" ? 1048576 : 1024),
          );
    try {
      validateResizeOptions(settings);
      if (
        maxBytes !== undefined &&
        (!Number.isFinite(maxBytes) || maxBytes < 1024)
      )
        throw new Error("文件大小目标太低，请至少设置为 1 KB。");
    } catch (e) {
      error.value = (e as Error).message;
      return;
    }
    const options = { ...settings, maxBytes };
    await runWithProcessor(async (source) => {
      const requested: ProcessOptions = {
        ...options,
        format: options.format === "original" ? source.format : options.format,
      };
      return processImage(source, requested);
    }, only);
  }
  async function runWithProcessor(
    processor: (source: ImageSource, image: ImageJob) => Promise<ImageResult>,
    only?: ImageJob,
  ) {
    if (locked.value || disposed) return;
    const targets = only ? [only] : [...pending.value];
    if (!targets.length) return;
    processing.value = true;
    error.value = "";
    completed.value = 0;
    total.value = targets.length;
    targets.forEach((image) => {
      resetResult(image);
      image.processingStatus = "waiting";
      image.error = "";
    });
    try {
      await runQueue(
        targets,
        async (image) => {
          image.processingStatus = "processing";
          let source: ImageSource | undefined;
          try {
            source = await inspect(image);
            if (disposed) return;
            const result = await processor(source, image);
            if (disposed) return;
            image.resultBlob = result.blob;
            image.resultWidth = result.width;
            image.resultHeight = result.height;
            image.resultSize = result.blob.size;
            image.resultFormat = result.format;
            image.preservedOriginal = !!result.preservedOriginal;
            image.processingStatus = "done";
          } catch (e) {
            if (!disposed) {
              image.processingStatus = "failed";
              image.error = friendlyError(e);
            }
          } finally {
            source?.bitmap.close();
            completed.value++;
          }
        },
        2,
        () => disposed,
      );
    } finally {
      processing.value = false;
    }
  }
  function filename(image: ImageJob) {
    return outputFilename(image.filename, image.resultFormat!, image.format);
  }
  function download(image: ImageJob) {
    if (image.resultBlob) downloadBlob(image.resultBlob, filename(image));
  }
  async function downloadAll() {
    if (locked.value || !successes.value.length) return;
    const ready = [...successes.value];
    if (images.value.length === 1) {
      download(ready[0]!);
      return;
    }
    packing.value = true;
    error.value = "";
    try {
      const zip = await createImageZip(
        ready.map((image) => ({
          name: filename(image),
          blob: image.resultBlob!,
        })),
      );
      if (!disposed) downloadBlob(zip, zipName);
    } catch {
      if (!disposed)
        error.value = "打包失败，可能是内存不足。请减少图片数量，或逐张下载。";
    } finally {
      packing.value = false;
    }
  }
  onBeforeUnmount(() => {
    disposed = true;
    images.value.forEach(release);
    images.value = [];
  });
  return {
    images,
    loading,
    processing,
    packing,
    error,
    completed,
    total,
    locked,
    successes,
    pending,
    add,
    remove,
    clear,
    run,
    runWithProcessor,
    invalidate,
    download,
    downloadAll,
    filename,
  };
}

export type ImageBatch = ReturnType<typeof useImageBatch>;

export type ImageCollection = Pick<ImageBatch, "images" | "locked" | "add" | "remove" | "clear">;
