<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import WatermarkParameterBar from "../components/watermark/WatermarkParameterBar.vue";
import AppIcon from "../components/AppIcon.vue";
import ImageUploadList from "../components/ImageUploadList.vue";
import BatchResults from "../components/BatchResults.vue";
import WatermarkPreview from "../components/WatermarkPreview.vue";
import { useImageBatch } from "../composables/useImageBatch";
import type { ImageJob } from "../utils/image/types";
import {
  readImage,
  createThumbnail,
  friendlyError,
  ImageError,
} from "../utils/image/browser";
import { applyWatermark } from "../utils/image/watermark/draw";
import { defaultWatermarkSettings } from "../utils/image/watermark/types";
import { validateWatermark } from "../utils/image/watermark/layout";
const batch = useImageBatch("tidypic-watermarked.zip");
const {
  images,
  loading,
  processing,
  locked,
  pending,
  completed,
  total,
  error,
} = batch;
const settings = ref(defaultWatermarkSettings());
const selectedId = ref(""),
  logo = shallowRef<ImageBitmap>(),
  logoUrl = ref(""),
  logoName = ref("");
const logoLoading = ref(false),
  preparing = ref(false),
  logoError = ref("");
const logoInput = ref<HTMLInputElement>(),
  preview = ref<InstanceType<typeof WatermarkPreview>>();
const controlsLocked = computed(
  () => locked.value || logoLoading.value || preparing.value,
);
const selected = computed(() =>
  images.value.find((image) => image.id === selectedId.value),
);
const valid = computed(() => {
  try {
    validateWatermark(settings.value, !!logo.value);
    return true;
  } catch {
    return false;
  }
});
const actionLabel = computed(() =>
  processing.value
    ? `正在处理 ${completed.value} / ${total.value}`
    : preparing.value
      ? "准备中…"
      : loading.value
        ? "读取中…"
        : images.value.length && !pending.value.length
          ? "已全部处理"
          : images.value.length > 1
            ? `添加水印到 ${pending.value.length} 张图片`
            : "添加水印",
);
watch(
  () => images.value.map((image) => [image.id, image.width]),
  () => {
    if (
      !images.value.some(
        (image) => image.id === selectedId.value && image.width,
      )
    )
      selectedId.value = images.value.find((image) => image.width)?.id || "";
  },
  { deep: true },
);
watch(settings, batch.invalidate, { deep: true, flush: "sync" });
let disposed = false;
let tiledInitialized = false;
function changeLayout(layout: 'single' | 'tiled') {
  if (layout === 'tiled' && !tiledInitialized) {
    settings.value.size = 'medium';
    tiledInitialized = true;
  }
  settings.value.layout = layout;
}
async function uploadLogo(files: FileList | null) {
  const file = files?.[0];
  if (!file || controlsLocked.value) return;
  logoLoading.value = true;
  logoError.value = "";
  let next: Awaited<ReturnType<typeof readImage>> | undefined;
  try {
    next = await readImage(file);
    const thumb = await createThumbnail(next);
    if (disposed) {
      next.bitmap.close();
      return;
    }
    logo.value?.close();
    if (logoUrl.value) URL.revokeObjectURL(logoUrl.value);
    logo.value = next.bitmap;
    logoUrl.value = URL.createObjectURL(thumb);
    logoName.value = file.name;
    batch.invalidate();
  } catch (e) {
    next?.bitmap.close();
    if (!disposed) logoError.value = friendlyError(e);
  } finally {
    logoLoading.value = false;
    if (logoInput.value) logoInput.value.value = "";
  }
}
async function run(only?: ImageJob) {
  if (controlsLocked.value) return;
  try {
    validateWatermark(settings.value, !!logo.value);
  } catch (e) {
    error.value = (e as Error).message;
    return;
  }
  const snapshot = { ...settings.value };
  const bitmap = logo.value;
  preparing.value = true;
  // Free the preview bitmap before allocating full-resolution batch canvases.
  await preview.value?.suspend();
  if (disposed) {
    preparing.value = false;
    return;
  }
  try {
    await batch.runWithProcessor(
      (source) => applyWatermark(source, snapshot, bitmap),
      only,
    );
  } catch (e) {
    if (!disposed)
      error.value = friendlyError(e instanceof ImageError ? e : undefined);
  } finally {
    preparing.value = false;
  }
}
onBeforeUnmount(() => {
  disposed = true;
  logo.value?.close();
  if (logoUrl.value) URL.revokeObjectURL(logoUrl.value);
});
</script>
<template>
  <div class="workspace-heading">
    <h1>添加水印</h1>
    <span v-if="images.length" class="heading-count"
      >{{ images.length }} 张图片</span
    >
  </div>
  <ImageUploadList
    :batch="batch"
    selectable
    :selected-id="selectedId"
    :disabled="logoLoading || preparing"
    @select="selectedId = $event.id"
    @retry="run"
  />
  <section class="watermark-workspace" aria-label="水印设置">
    <div class="watermark-controls">
      <h2>水印设置</h2>
      <fieldset :disabled="controlsLocked">
        <div class="segmented kind-tabs" aria-label="水印类型">
          <button
            :aria-pressed="settings.kind === 'text'"
            @click="settings.kind = 'text'"
          >
            文字水印</button
          ><button
            :aria-pressed="settings.kind === 'image'"
            @click="settings.kind = 'image'"
          >
            图片水印
          </button>
        </div>
        <label v-if="settings.kind === 'text'" class="wm-field"
          >水印文字<input
            v-model="settings.text"
            aria-label="水印文字"
            maxlength="100"
            placeholder="@自己的店铺"
        /></label>
        <div v-else class="logo-upload">
          <input
            ref="logoInput"
            class="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="选择水印图片"
            @change="uploadLogo(($event.target as HTMLInputElement).files)"
          />
          <div v-if="logoUrl" class="logo-thumb">
            <img :src="logoUrl" alt="水印图片" />
          </div>
          <div class="logo-info">
            <span v-if="logoName" class="filename" :title="logoName">{{
              logoName
            }}</span
            ><button class="secondary" @click="logoInput?.click()">
              {{
                logoLoading
                  ? "读取中…"
                  : logo
                    ? "更换"
                    : "＋ 选择水印图片"
              }}</button
            ><span v-if="!logoName" class="field-note">PNG / JPG / WebP</span>
          </div>
        </div>
        <p v-if="logoError" class="row-error" role="alert">{{ logoError }}</p>
        <WatermarkParameterBar v-model="settings" :disabled="controlsLocked" @layout="changeLayout" />
      </fieldset>
    <div class="watermark-action">
      <button
        class="primary"
        :disabled="controlsLocked || !pending.length || !valid"
        @click="run()"
      >
        {{ actionLabel }}<AppIcon name="arrow" :size="17" />
      </button>
    </div>
    </div>
    <WatermarkPreview
      ref="preview"
      :image="selected"
      :settings="settings"
      :logo="logo"
      :paused="processing || preparing"
    />

  </section>
  <div v-if="error" class="error-notice" role="alert">
    <span>{{ error }}</span
    ><button aria-label="关闭提示" @click="error = ''">
      <AppIcon name="close" :size="16" />
    </button>
  </div>
  <BatchResults
    :batch="batch"
    :disabled="logoLoading || preparing"
    @retry="run()"
  />
</template>
