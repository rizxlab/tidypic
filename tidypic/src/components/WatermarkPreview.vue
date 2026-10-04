<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import PreviewLightbox from "./PreviewLightbox.vue";
import type { ImageJob } from "../utils/image/types";
import type { WatermarkSettings } from "../utils/image/watermark/types";
import { renderWatermark } from "../utils/image/watermark/draw";
import { readImage, friendlyError } from "../utils/image/browser";
const props = defineProps<{
  image?: ImageJob;
  settings: WatermarkSettings;
  logo?: ImageBitmap;
  paused: boolean;
}>();
const canvas = ref<HTMLCanvasElement>(),
  message = ref(""),
  busy = ref(false);
const lightbox = ref<InstanceType<typeof PreviewLightbox>>();
const canEnlarge = computed(() => !!props.image?.width && !props.paused && !busy.value && !message.value);
function enlarge() {
  if (canEnlarge.value && canvas.value) lightbox.value?.open(canvas.value);
}
let cached:
  | { file: File; bitmap: ImageBitmap; width: number; height: number }
  | undefined;
let disposed = false,
  revision = 0,
  timer: ReturnType<typeof setTimeout> | undefined,
  running: Promise<void> | undefined;
function release() {
  cached?.bitmap.close();
  cached = undefined;
}
function clearCanvas() {
  lightbox.value?.close();
  if (canvas.value) {
    canvas.value.width = 0;
    canvas.value.height = 0;
  }
}
async function update(token: number) {
  if (disposed || token !== revision) return;
  if (props.paused || !props.image?.width) {
    busy.value = false;
    release();
    clearCanvas();
    message.value = props.paused ? "处理中，预览已暂停" : "上传图片后预览水印";
    return;
  }
  const file = props.image.originalFile;
  busy.value = true;
  message.value = "";
  try {
    if (cached?.file !== file) {
      release();
      clearCanvas();
      const source = await readImage(file);
      try {
        const ratio = Math.min(1, 1000 / Math.max(source.width, source.height));
        const bitmap = await createImageBitmap(source.bitmap, {
          resizeWidth: Math.max(1, Math.round(source.width * ratio)),
          resizeHeight: Math.max(1, Math.round(source.height * ratio)),
          resizeQuality: "high",
        });
        if (disposed || token !== revision) {
          bitmap.close();
          return;
        }
        cached = { file, bitmap, width: source.width, height: source.height };
      } finally {
        source.bitmap.close();
      }
    }
    if (cached && canvas.value && !disposed && token === revision)
      renderWatermark(
        canvas.value,
        cached.bitmap,
        cached.width,
        cached.height,
        props.settings,
        props.logo,
        1000,
      );
  } catch (e) {
    if (!disposed && token === revision) {
      clearCanvas();
      if (cached && canvas.value) {
        canvas.value.width = cached.bitmap.width;
        canvas.value.height = cached.bitmap.height;
        canvas.value.getContext("2d")?.drawImage(cached.bitmap, 0, 0);
      }
      message.value = friendlyError(e);
    }
  } finally {
    if (token === revision) busy.value = false;
  }
}
function schedule() {
  const token = ++revision;
  if (timer) clearTimeout(timer);
  // Blank stale previews immediately; decoding and drawing are serialized below.
  clearCanvas();
  timer = setTimeout(() => {
    const previous = running ?? Promise.resolve();
    const next = previous.then(() => update(token));
    running = next;
    void next.finally(() => {
      if (running === next) running = undefined;
    });
  }, 80);
}
async function suspend() {
  revision++;
  if (timer) clearTimeout(timer);
  await running;
  release();
  clearCanvas();
  busy.value = false;
}
watch(
  () => [
    props.image?.id,
    props.image?.width,
    props.settings,
    props.logo,
    props.paused,
  ],
  schedule,
  { deep: true, immediate: true },
);
onBeforeUnmount(() => {
  disposed = true;
  revision++;
  if (timer) clearTimeout(timer);
  release();
  clearCanvas();
});
defineExpose({ suspend });
</script>
<template>
  <section class="watermark-preview" aria-label="水印实时预览">
    <div class="preview-heading">
      <h2>实时预览</h2>
      <span v-if="image" :title="image.filename">{{ image.filename }}</span>
    </div>
    <div class="watermark-stage" :aria-busy="busy">
      <canvas ref="canvas" aria-label="放大水印预览" :role="canEnlarge ? 'button' : undefined" :tabindex="canEnlarge ? 0 : -1" :class="{ 'can-enlarge': canEnlarge }" @click="enlarge" @keydown.enter.prevent="enlarge" @keydown.space.prevent="enlarge"></canvas
      ><span v-if="message || busy" class="preview-message" role="status">{{
        busy ? "正在更新预览…" : message
      }}</span>
    </div>
    <p v-if="image" class="preview-dimensions">
      {{ image.width }} × {{ image.height }} px
    </p>
    <PreviewLightbox ref="lightbox" />
  </section>
</template>
