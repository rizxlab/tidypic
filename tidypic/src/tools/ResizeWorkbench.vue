<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import ImageUploadList from "../components/ImageUploadList.vue";
import BatchResults from "../components/BatchResults.vue";
import ResizeParameters from "../components/resize/ResizeParameters.vue";
import TransformPreview from "../components/resize/TransformPreview.vue";
import { useImagePresets } from "../composables/useImagePresets";
import { useImageBatch } from "../composables/useImageBatch";
import {
  calculateTransform,
  defaultSettings,
  validateSettings,
  type CropState,
} from "../utils/image/transform/geometry";
import { resizeImage } from "../processors/images";
import { validateRequirements } from "../utils/presets/requirements";
import type { ImageJob } from "../utils/image/types";
const batch = useImageBatch("tidypic-images.zip", "resize"),
  { images, locked, pending, processing, completed, total, error } = batch;
const settings = ref(defaultSettings()),
  cropStateByImage = ref<Record<string, CropState>>({}),
  selectedId = batch.workspace.activeId,
  preparing = ref(false),
  preview = ref<InstanceType<typeof TransformPreview>>();
const presets = useImagePresets(settings, () => {
  cropStateByImage.value = {};
});
const busy = computed(() => locked.value || preparing.value);
const warnings = computed(() => {
  const result: Record<string, string[]> = {};
  const requirements = presets.selected.value?.requirements;
  if (!requirements) return result;
  for (const image of images.value) {
    if (!image.width) continue;
    try {
      const t = calculateTransform(
        image.width,
        image.height,
        settings.value,
        cropStateByImage.value[image.id],
      );
      result[image.id] = validateRequirements(
        { width: t.canvasWidth, height: t.canvasHeight },
        requirements,
      );
    } catch {
      /* Invalid processing parameters use the existing form error. */
    }
  }
  return result;
});
function resultWarnings(image: ImageJob) {
  return validateRequirements(
    { width: image.resultWidth!, height: image.resultHeight! },
    presets.selected.value?.requirements,
  );
}

const selected = computed(
  () =>
    images.value.find((i) => i.id === selectedId.value && i.width) ||
    images.value.find((i) => i.width),
);
const cropping = computed(
  () =>
    settings.value.mode === "ratio" ||
    (settings.value.mode === "exact" && settings.value.fit === "crop"),
);
const validation = computed(() => {
  try {
    validateSettings(settings.value);
    return "";
  } catch (e) {
    return (e as Error).message;
  }
});
const jpgNotice = computed(
  () =>
    settings.value.mode === "exact" &&
    settings.value.fit === "pad" &&
    settings.value.background === "transparent" &&
    (settings.value.format === "image/jpeg" ||
      (settings.value.format === "original" &&
        images.value.some((i) => i.format === "image/jpeg"))),
);
watch(settings, () => batch.invalidate(), { deep: true, flush: "sync" });
watch(
  () => images.value.map((i) => i.id),
  (ids) => {
    for (const id of Object.keys(cropStateByImage.value))
      if (!ids.includes(id)) delete cropStateByImage.value[id];
  },
);
function adjust(state: CropState) {
  if (!selected.value) return;
  if (state.x === 0.5 && state.y === 0.5 && state.zoom === 1)
    delete cropStateByImage.value[selected.value.id];
  else cropStateByImage.value[selected.value.id] = state;
  batch.invalidate();
}
async function edit(image: ImageJob) {
  selectedId.value = image.id;
  await nextTick();
  preview.value?.open();
}
async function run(only?: ImageJob) {
  if (busy.value || validation.value) return;
  preparing.value = true;
  const s = { ...settings.value },
    states = Object.fromEntries(
      Object.entries(cropStateByImage.value).map(([id, state]) => [
        id,
        { ...state },
      ]),
    );
  try {
    await preview.value?.suspend();
    await batch.runWithProcessor(
      (source, image) => resizeImage(source, s, states[image.id]),
      only,
    );
  } finally {
    preparing.value = false;
    preview.value?.resume();
  }
}
const label = computed(() =>
  processing.value
    ? `正在处理 ${completed.value} / ${total.value}`
    : busy.value
      ? "准备中…"
      : pending.value.length > 1
        ? `处理 ${pending.value.length} 张图片`
        : "开始处理",
);
</script>
<template>
  <div class="workspace-heading">
    <h1>尺寸调整 + 压缩</h1>
    <span v-if="images.length" class="heading-count"
      >{{ images.length }} 张图片</span
    >
  </div>
  <ImageUploadList
    :batch="batch"
    :disabled="preparing"
    :selectable="settings.mode !== 'limit'"
    :selected-id="selected?.id"
    @select="selectedId = $event.id"
    @retry="run"
  >
    <template #row-notice="{ image }">
      <p
        v-for="warning in warnings[image.id]"
        :key="warning"
        class="preset-warning"
      >
        {{ warning }}
      </p>
    </template>
    <template #row-actions="{ image }"
      ><button
        v-if="cropping && image.width"
        class="text-button crop-row-action"
        :disabled="busy"
        @click.stop="edit(image)"
      >
        {{ cropStateByImage[image.id] ? "已调整" : "中心裁剪" }} · 调整
      </button></template
    >
  </ImageUploadList>
  <ResizeParameters
    v-model="settings"
    :presets="presets"
    :invalid="!!validation"
    :disabled="busy"
    :can-run="pending.length > 0 && !validation"
    :action-label="label"
    @run="run()"
  />
  <p v-if="validation" class="error-notice" role="alert">{{ validation }}</p>
  <p v-if="jpgNotice" class="field-note">JPG 不支持透明背景，已使用白色。</p>
  <p v-if="error" class="error-notice" role="alert">{{ error }}</p>
  <TransformPreview
    v-if="selected && settings.mode !== 'limit' && !validation"
    ref="preview"
    :image="selected"
    :settings="settings"
    :crop="cropStateByImage[selected.id]"
    :disabled="busy"
    @adjust="adjust"
  />
  <BatchResults :batch="batch" :disabled="preparing" @retry="run()">
    <template #row-notice="{ image }">
      <p
        v-for="warning in resultWarnings(image)"
        :key="warning"
        class="preset-warning"
      >
        {{ warning }}
      </p>
    </template>
  </BatchResults>
</template>

<style scoped>
.preset-warning {
  margin: 4px 0 0;
  color: #886018;
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
</style>
