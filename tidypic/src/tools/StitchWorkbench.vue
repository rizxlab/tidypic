<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import PreviewLightbox from "../components/PreviewLightbox.vue";
import SortableImageList from "../components/SortableImageList.vue";
import StitchParameterBar from "../components/stitch/StitchParameterBar.vue";
import StitchPreview from "../components/stitch/StitchPreview.vue";
import { useImageBatch } from "../composables/useImageBatch";
import {
  defaultStitchSettings,
  calculateStitchLayout,
  resolveStitchFormat,
  validateStitchOutput,
} from "../utils/image/stitch/geometry";
import { encodeStitchedImage } from "../utils/image/stitch/browser";
import { downloadBlob } from "../utils/image/download";
import { friendlyError, formatBytes, formatName } from "../utils/image/browser";
import type { ImageResult, ImageFormat } from "../utils/image/types";
const batch = useImageBatch();
const { images, locked, processing, error } = batch;
const settings = ref(defaultStitchSettings()),
  preview = ref<InstanceType<typeof StitchPreview>>();
const resultLightbox = ref<InstanceType<typeof PreviewLightbox>>();
let viewingResult = false;
const result = ref<ImageResult>(),
  resultUrl = ref("");
let disposed = false;
const formats = computed(() =>
  images.value.flatMap((i) => (i.format ? [i.format] : [])),
);
const format = computed(() =>
  resolveStitchFormat(formats.value, settings.value.format),
);
const mixed = computed(() => new Set(formats.value).size > 1);
const layoutState = computed(() => {
  try {
    return {
      layout: calculateStitchLayout(images.value, settings.value),
      error: "",
    };
  } catch (e) {
    return {
      layout: undefined,
      error: images.value.length ? (e as Error).message : "",
    };
  }
});
const outputError = computed(() => {
  if (!layoutState.value.layout) return "";
  try {
    validateStitchOutput(layoutState.value.layout);
    return "";
  } catch (e) {
    return (e as Error).message;
  }
});
const canRun = computed(
  () =>
    images.value.length >= 2 &&
    images.value.every((i) => i.format && i.processingStatus !== "failed") &&
    !!layoutState.value.layout &&
    !outputError.value &&
    !locked.value,
);
const filename = computed(
  () =>
    `tidypic-stitched.${result.value?.format === "image/jpeg" ? "jpg" : result.value?.format.split("/")[1] || "png"}`,
);
function clearResult() {
  resultLightbox.value?.close();
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value);
  resultUrl.value = "";
  result.value = undefined;
}
watch(
  () => [images.value.map((i) => [i.id, i.width, i.height]), settings.value],
  () => {
    clearResult();
    error.value = "";
  },
  { deep: true },
);
async function showResult() {
  if (!result.value || viewingResult) return;
  viewingResult = true;
  const blob = result.value.blob;
  let bitmap: ImageBitmap | undefined;
  const canvas = document.createElement("canvas");
  try {
    bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas
      .getContext("2d")!
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    if (!disposed && result.value?.blob === blob)
      resultLightbox.value?.open(canvas);
  } catch {
    if (!disposed) error.value = "无法打开结果预览，请下载查看。";
  } finally {
    bitmap?.close();
    canvas.width = canvas.height = 0;
    viewingResult = false;
  }
}
async function run() {
  if (!canRun.value) return;
  const layout = layoutState.value.layout!,
    options = { ...settings.value },
    files = images.value.map((i) => i.originalFile),
    outputFormat = format.value;
  processing.value = true;
  error.value = "";
  clearResult();
  await preview.value?.suspend();
  try {
    if (disposed) return;
    const output = await encodeStitchedImage(
      files,
      layout,
      options,
      outputFormat,
      () => disposed,
    );
    if (!disposed) {
      result.value = output;
      resultUrl.value = URL.createObjectURL(output.blob);
    }
  } catch (e) {
    if (!disposed) error.value = friendlyError(e);
  } finally {
    processing.value = false;
  }
}
onBeforeUnmount(() => {
  disposed = true;
  clearResult();
});
</script>
<template>
  <div class="workspace-heading"><h1>图片拼接</h1></div>
  <SortableImageList
    :batch="batch"
    @retry="
      (image) =>
        batch.runWithProcessor(
          async (source) => ({
            blob: source.file,
            width: source.width,
            height: source.height,
            format: source.format,
            preservedOriginal: true,
          }),
          image,
        )
    "
  />
  <section class="parameter-bar split-settings">
    <h2>拼接设置</h2>
    <StitchParameterBar
      v-model="settings"
      :disabled="locked"
      :resolved-format="format"
      :mixed="mixed"
    />
    <div class="watermark-action">
      <span class="privacy-line" role="status">{{
        layoutState.error ||
        outputError ||
        (images.length < 2
          ? "至少需要 2 张图片"
          : layoutState.layout
            ? `预计输出：${layoutState.layout.width} × ${layoutState.layout.height} px`
            : "")
      }}</span
      ><button class="primary" :disabled="!canRun" @click="run">
        {{ processing ? "正在拼接…" : "开始拼接" }}
      </button>
    </div>
    <p
      v-if="settings.background === 'transparent' && format === 'image/jpeg'"
      class="field-note stitch-note"
    >
      JPG 不支持透明背景，将使用白色背景。
    </p>
  </section>
  <p v-if="error" class="error-notice" role="alert">{{ error }}</p>
  <StitchPreview
    v-if="images.length"
    ref="preview"
    :images="images"
    :layout="layoutState.layout"
    :settings="settings"
    :format="format"
    :paused="locked"
  />
  <section v-if="result" class="results-panel stitch-result">
    <h2>拼接完成</h2>
    <button
      class="stitch-result-thumb"
      aria-label="放大拼接结果"
      @click="showResult"
    >
      <img :src="resultUrl" alt="拼接结果" /></button
    ><span
      >{{ result.width }} × {{ result.height }} px ·
      {{ formatBytes(result.blob.size) }} ·
      {{ formatName(result.format) }}</span
    ><button class="primary" @click="downloadBlob(result!.blob, filename)">
      下载图片
    </button>
  </section>
  <PreviewLightbox ref="resultLightbox" label="拼接结果" />
</template>
