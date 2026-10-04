<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import ImageUploadList from "../components/ImageUploadList.vue";
import PreviewLightbox from "../components/PreviewLightbox.vue";
import SplitParameterBar from "../components/split/SplitParameterBar.vue";
import GuideEditor from "../components/split/GuideEditor.vue";
import { useImageBatch } from "../composables/useImageBatch";
import {
  calculateSlices,
  sliceFilename,
  SplitError,
  type SplitSettings,
} from "../utils/image/split/geometry";
import { encodeSlice } from "../utils/image/split/browser";
import { ImageError, formatBytes, readImage } from "../utils/image/browser";
import { downloadBlob, createImageZip } from "../utils/image/download";
import type { ImageFormat, ImageResult, ImageJob } from "../utils/image/types";
const batch = useImageBatch();
const {
  images,
  locked,
  processing,
  packing,
  error,
  completed,
  total,
  pending,
} = batch;
const settings = ref<SplitSettings & { format: ImageFormat | "original" }>({
  mode: "height",
  height: 1200,
  count: 6,
  format: "original",
});
const selectedId = ref(""),
  guides = ref<Record<string, number[]>>({});
type Output = ImageResult & { name: string; url: string };
const results = ref<Record<string, Output[]>>({}),
  lightbox = ref<InstanceType<typeof PreviewLightbox>>();
const selected = computed(() =>
  images.value.find((i) => i.id === selectedId.value),
);
const allResults = computed(() =>
  images.value.flatMap((i) => results.value[i.id] || []),
);
let disposed = false;
let previewing = false;
function clearResults(id?: string) {
  for (const key of id ? [id] : Object.keys(results.value)) {
    results.value[key]?.forEach((r) => URL.revokeObjectURL(r.url));
    delete results.value[key];
  }
}
watch(
  settings,
  () => {
    if (!locked.value) {
      clearResults();
      batch.invalidate();
    }
  },
  { deep: true },
);
watch(
  () => images.value.map((i) => `${i.id}:${i.height}`),
  () => {
    for (const id of Object.keys(results.value))
      if (!images.value.some((i) => i.id === id)) clearResults(id);
    for (const id of Object.keys(guides.value))
      if (!images.value.some((i) => i.id === id)) delete guides.value[id];
    for (const i of images.value)
      if (i.height && !guides.value[i.id]) {
        const step = Math.max(
          1,
          Math.ceil(i.height / 100),
          Number.isSafeInteger(settings.value.height) &&
            settings.value.height > 0
            ? settings.value.height
            : 1200,
        );
        guides.value[i.id] = calculateSlices(i.height, {
          mode: "height",
          height: step,
          count: 1,
        })
          .slice(1)
          .map((s) => s.y);
      }
    if (!images.value.some((i) => i.id === selectedId.value && i.height))
      selectedId.value = images.value.find((i) => i.height)?.id || "";
  },
);
function updateGuides(value: number[]) {
  if (!selected.value || locked.value) return;
  guides.value[selected.value.id] = value;
  clearResults(selected.value.id);
  selected.value.processingStatus = "waiting";
  selected.value.resultBlob = undefined;
  selected.value.error = "";
}
const estimate = computed(() => {
  let count = 0;
  try {
    for (const i of images.value)
      if (i.height)
        count += calculateSlices(
          i.height,
          settings.value,
          guides.value[i.id],
        ).length;
    return { count, error: "" };
  } catch (e) {
    return { count: 0, error: (e as Error).message };
  }
});
async function run(only?: ImageJob) {
  if (locked.value) return;
  const snapshot = { ...settings.value };
  await batch.runWithProcessor(async (source, job) => {
    clearResults(job.id);
    const output: Output[] = [];
    try {
      const slices = calculateSlices(
        source.height,
        snapshot,
        guides.value[job.id],
      );
      const format =
        snapshot.format === "original" ? source.format : snapshot.format;
      for (let i = 0; i < slices.length; i++) {
        if (disposed) throw new ImageError("处理已停止。");
        const result = await encodeSlice(source, slices[i]!, format);
        output.push({
          ...result,
          name: sliceFilename(
            job.filename,
            format === "image/jpeg" ? "jpg" : format.split("/")[1]!,
            i,
            slices.length,
          ),
          url: URL.createObjectURL(result.blob),
        });
      }
      if (disposed) throw new ImageError("处理已停止。");
      results.value[job.id] = output;
      return output[0]!;
    } catch (e) {
      output.forEach((r) => URL.revokeObjectURL(r.url));
      if (e instanceof SplitError) throw new ImageError(e.message);
      throw e;
    }
  }, only);
}
async function downloadAll() {
  if (locked.value || !allResults.value.length) return;
  packing.value = true;
  try {
    const files = [...allResults.value];
    if (files.length === 1) downloadBlob(files[0]!.blob, files[0]!.name);
    else {
      const zip = await createImageZip(files);
      if (!disposed) downloadBlob(zip, "tidypic-split.zip");
    }
  } catch {
    error.value = "打包失败，请减少图片数量或逐张下载。";
  } finally {
    packing.value = false;
  }
}
async function preview(result: Output) {
  if (previewing || disposed) return;
  previewing = true;
  try {
    const source = await readImage(new File([result.blob], result.name));
    const canvas = document.createElement("canvas");
    try {
      const scale = Math.min(1, 1600 / Math.max(source.width, source.height));
      canvas.width = Math.max(1, Math.round(source.width * scale));
      canvas.height = Math.max(1, Math.round(source.height * scale));
      canvas
        .getContext("2d")!
        .drawImage(source.bitmap, 0, 0, canvas.width, canvas.height);
      if (!disposed) lightbox.value?.open(canvas);
    } finally {
      source.bitmap.close();
      canvas.width = canvas.height = 0;
    }
  } catch {
    if (!disposed) error.value = "无法打开切片预览，请尝试下载查看。";
  } finally {
    previewing = false;
  }
}
onBeforeUnmount(() => {
  disposed = true;
  clearResults();
});
</script>
<template>
  <div class="workspace-heading"><h1>长图切分</h1></div>
  <ImageUploadList
    :batch="batch"
    selectable
    :selected-id="selectedId"
    @select="selectedId = $event.id"
    @retry="run"
  />
  <section class="parameter-bar split-settings">
    <h2>切分设置</h2>
    <SplitParameterBar v-model="settings" :disabled="locked" />
    <div class="watermark-action">
      <span v-if="estimate.error || estimate.count" class="privacy-line">{{
        estimate.error ||
        (estimate.count
          ? `预计切成 ${estimate.count} 张`
          : "")
      }}</span
      ><button
        class="primary"
        :disabled="locked || !pending.length"
        @click="run()"
      >
        {{ processing ? `正在处理 ${completed} / ${total}` : "开始切分" }}
      </button>
    </div>
  </section>
  <GuideEditor
    v-if="settings.mode === 'guides' && selected?.height"
    :image="selected"
    :model-value="guides[selected.id] || []"
    :disabled="locked"
    @update:model-value="updateGuides"
  />
  <p v-if="error" class="error-notice" role="alert">{{ error }}</p>
  <section v-if="allResults.length" class="results-panel">
    <div class="list-header">
      <h2>切分完成 · {{ allResults.length }} 张</h2>
      <button class="primary" :disabled="locked" @click="downloadAll">
        {{ packing ? "打包中…" : "全部下载" }}
      </button>
    </div>
    <div class="split-result-groups">
      <template v-for="image in images" :key="image.id"
        ><div v-if="results[image.id]?.length" class="split-result-group">
          <h3>{{ image.filename }}</h3>
          <div v-for="r in results[image.id]" :key="r.name" class="result-row">
            <button
              class="split-thumb"
              :aria-label="`预览 ${r.name}`"
              @click="preview(r)"
            >
              <img :src="r.url" alt="切片" loading="lazy" />
            </button>
            <div class="result-info">
              <span class="filename">{{ r.name }}</span
              ><span class="result-meta"
                >{{ r.width }} × {{ r.height }} ·
                {{ formatBytes(r.blob.size) }}</span
              >
            </div>
            <button class="download-one" @click="downloadBlob(r.blob, r.name)">
              下载
            </button>
          </div>
        </div></template
      >
    </div>
  </section>
  <PreviewLightbox ref="lightbox" label="切片预览" />
</template>
