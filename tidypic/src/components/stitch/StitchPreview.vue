<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import type { ImageJob, ImageFormat } from "../../utils/image/types";
import type {
  StitchLayout,
  StitchSettings,
} from "../../utils/image/stitch/geometry";
import { renderStitchedImage } from "../../utils/image/stitch/browser";
import { readImage, friendlyError } from "../../utils/image/browser";
import PreviewLightbox from "../PreviewLightbox.vue";
const props = defineProps<{
  images: ImageJob[];
  layout?: StitchLayout;
  settings: StitchSettings;
  format: ImageFormat;
  paused: boolean;
}>();
const canvas = ref<HTMLCanvasElement>(),
  lightbox = ref<InstanceType<typeof PreviewLightbox>>(),
  busy = ref(false),
  error = ref("");
const cache = new Map<File, ImageBitmap>();
let revision = 0,
  disposed = false,
  timer: ReturnType<typeof setTimeout> | undefined,
  running = Promise.resolve();
function release() {
  cache.forEach((b) => b.close());
  cache.clear();
}
function clear() {
  if (canvas.value) canvas.value.width = canvas.value.height = 0;
  lightbox.value?.close();
}
async function update(token: number) {
  if (disposed || token !== revision) return;
  if (props.paused || !props.layout) {
    release();
    clear();
    busy.value = false;
    return;
  }
  busy.value = true;
  error.value = "";
  const files = props.images.map((i) => i.originalFile),
    layout = props.layout,
    settings = { ...props.settings },
    format = props.format;
  for (const [f, b] of cache)
    if (!files.includes(f)) {
      b.close();
      cache.delete(f);
    }
  try {
    await renderStitchedImage(
      canvas.value!,
      layout,
      settings,
      format,
      async (index) => {
        const file = files[index]!;
        let bitmap = cache.get(file);
        if (!bitmap) {
          const source = await readImage(file);
          try {
            const edge = Math.min(
              512,
              Math.floor(Math.sqrt(8_000_000 / files.length)),
            );
            const scale = Math.min(
              1,
              edge / Math.max(source.width, source.height),
            );
            bitmap = await createImageBitmap(source.bitmap, {
              resizeWidth: Math.max(1, Math.round(source.width * scale)),
              resizeHeight: Math.max(1, Math.round(source.height * scale)),
              resizeQuality: "high",
            });
          } finally {
            source.bitmap.close();
          }
          if (disposed || token !== revision) {
            bitmap.close();
            throw new Error("cancelled");
          }
          cache.set(file, bitmap);
        }
        return { image: bitmap, release: () => {} };
      },
      1600,
      () => disposed || token !== revision,
    );
  } catch (e) {
    if (!disposed && token === revision) {
      error.value = friendlyError(e);
      clear();
    }
  } finally {
    if (token === revision) busy.value = false;
  }
}
function schedule() {
  const token = ++revision;
  if (timer) clearTimeout(timer);
  clear();
  busy.value = true;
  timer = setTimeout(() => {
    running = running.then(() => update(token));
  }, 100);
}
async function suspend() {
  revision++;
  if (timer) clearTimeout(timer);
  await running;
  release();
  clear();
  busy.value = false;
}
function enlarge() {
  if (canvas.value && !busy.value && !error.value)
    lightbox.value?.open(canvas.value);
}
watch(
  () => [
    props.images.map((i) => [i.id, i.width, i.height]),
    props.layout,
    props.settings,
    props.format,
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
  clear();
});
defineExpose({ suspend, enlarge });
</script>
<template>
  <section class="stitch-preview">
    <div class="preview-heading">
      <h2>实时预览</h2>
      <span v-if="layout"
        >预计输出：{{ layout.width }} × {{ layout.height }} px</span
      >
    </div>
    <div class="stitch-stage" :class="settings.direction">
      <canvas
        ref="canvas"
        role="button"
        aria-label="放大拼接预览"
        :tabindex="busy || !layout ? -1 : 0"
        @click="enlarge"
        @keydown.enter.prevent="enlarge"
        @keydown.space.prevent="enlarge"
      ></canvas
      ><span v-if="busy || error" class="preview-message">{{
        error || "正在更新预览…"
      }}</span>
    </div>
    <PreviewLightbox ref="lightbox" label="拼接预览" />
  </section>
</template>
