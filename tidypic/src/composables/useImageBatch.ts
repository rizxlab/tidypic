import { toolDefinitions, inputCountError, type ToolId } from "../data/tools";
import { convertImage } from "../processors/images";
import { useImageWorkspace } from "./useImageWorkspace";
import { workspaceTaskFlag } from "../utils/image/pool";
import { computed, onBeforeUnmount, reactive, ref, watch } from "vue";
import type {
  ImageJob,
  ImageSource,
  ImageResult,
  OutputSettings,
  ProcessOptions,
} from "../utils/image/types";
import { readImage, processImage, friendlyError } from "../utils/image/browser";
import { validateResizeOptions } from "../utils/image/geometry";
import { runQueue } from "../utils/image/queue";
import { outputFilename } from "../utils/image/names";
import { createImageZip, downloadBlob } from "../utils/image/download";

export function useImageBatch(zipName = "tidypic-images.zip", tool?: ToolId) {
  const workspace = useImageWorkspace();
  const images = ref<ImageJob[]>([]);
  const definition = tool ? toolDefinitions[tool] : undefined;
  const inputImages = computed(() =>
    definition?.inputMode === "single"
      ? images.value.filter((i) => i.id === workspace.active.value?.id)
      : images.value,
  );
  const inputError = computed(() =>
    definition ? inputCountError(definition, inputImages.value.length) : "",
  );
  const loading = workspace.loading,
    processing = workspaceTaskFlag(workspace),
    packing = workspaceTaskFlag(workspace),
    error = ref("");
  const completed = ref(0),
    total = ref(0);
  const locked = computed(
    () => workspace.locked.value || processing.value || packing.value,
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
  watch(
    workspace.assets,
    (assets) => {
      const previous = new Map(images.value.map((i) => [i.id, i]));
      images.value = assets.map((asset) => {
        const existing = previous.get(asset.id);
        if (existing) {
          existing.width = asset.width;
          existing.height = asset.height;
          existing.format = asset.format;
          existing.previewUrl = asset.objectUrl;
          existing.sourcePreviewBlob = asset.previewBlob;
          existing.sourcePreviewUrl = asset.previewObjectUrl;
          if (existing.processingStatus === "reading") {
            existing.processingStatus = asset.status;
            existing.error = asset.error;
          }
          return existing;
        }
        return reactive<ImageJob>({
          id: asset.id,
          originalFile: asset.file,
          filename: asset.name,
          width: asset.width,
          height: asset.height,
          originalSize: asset.size,
          format: asset.format,
          previewUrl: asset.objectUrl,
          sourcePreviewBlob: asset.previewBlob,
          sourcePreviewUrl: asset.previewObjectUrl,
          processingStatus: asset.status,
          error: asset.error,
          preservedOriginal: false,
        });
      });
    },
    { immediate: true, flush: "sync" },
  );

  function release(image: ImageJob) {
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
    if (!locked.value) workspace.remove(id);
  }
  function clear() {
    if (locked.value) return;
    workspace.clear();
    error.value = "";
    completed.value = 0;
    total.value = 0;
  }
  function reorder(ids: string[]) {
    workspace.reorder(ids);
  }
  async function inspect(image: ImageJob): Promise<ImageSource> {
    const source = await readImage(image.originalFile);
    try {
      image.width = source.width;
      image.height = source.height;
      image.format = source.format;
      return source;
    } catch (e) {
      source.bitmap.close();
      throw e;
    }
  }
  async function add(files: FileList | File[]) {
    if (locked.value || disposed) return;
    if (
      definition?.inputMode === "multiple" &&
      definition.maxImages !== undefined &&
      images.value.length + files.length > definition.maxImages
    ) {
      error.value = `最多导入 ${definition.maxImages} 个文件，请减少本次选择数量。`;
      return;
    }
    error.value = "";
    await workspace.add(files);
  }
  async function run(settings: OutputSettings, only?: ImageJob) {
    if (locked.value || disposed) return;
    const targets = only
      ? [only]
      : inputImages.value.filter((i) => pending.value.includes(i));
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
      return settings.mode === "original"
        ? convertImage(source, settings)
        : processImage(source, requested);
    }, only);
  }
  async function runWithProcessor(
    processor: (source: ImageSource, image: ImageJob) => Promise<ImageResult>,
    only?: ImageJob,
  ) {
    if (locked.value || disposed) return;
    const targets = only
      ? [only]
      : inputImages.value.filter((i) => pending.value.includes(i));
    if (!targets.length) return;
    if (!only && inputError.value) {
      error.value = inputError.value;
      return;
    }
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
    workspace,
    inputImages,
    inputError,
    reorder,
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

export type ImageCollection = Pick<
  ImageBatch,
  "images" | "locked" | "add" | "remove" | "clear"
> & { reorder?: (ids: string[]) => void };
