<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import PreviewLightbox from "../PreviewLightbox.vue";
import type { ImageJob } from "../../utils/image/types";
import {
  readPreview,
  friendlyError,
  formatName,
} from "../../utils/image/browser";
import {
  calculateTransform,
  centerCrop,
  type TransformSettings,
  type CropState,
} from "../../utils/image/transform/geometry";
import { renderToCanvas } from "../../utils/image/transform/browser";
const props = defineProps<{
  image: ImageJob;
  settings: TransformSettings;
  crop?: CropState;
  disabled: boolean;
}>();
const emit = defineEmits<{ adjust: [state: CropState] }>();
const canvas = ref<HTMLCanvasElement>(),
  editorCanvas = ref<HTMLCanvasElement>(),
  dialog = ref<HTMLDialogElement>(),
  lightbox = ref<InstanceType<typeof PreviewLightbox>>();
const error = ref(""),
  ready = ref(false),
  editing = ref(false),
  draft = ref(centerCrop());
let bitmap: ImageBitmap | undefined,
  version = 0,
  disposed = false,
  overflow: string | undefined;
const plan = computed(() => {
  try {
    return {
      transform: calculateTransform(
        props.image.width,
        props.image.height,
        props.settings,
        props.crop,
      ),
      error: "",
    };
  } catch (e) {
    return { transform: null, error: (e as Error).message };
  }
});
const transform = computed(() => plan.value.transform);
const cropTransform = computed(() => {
  try {
    return calculateTransform(
      props.image.width,
      props.image.height,
      props.settings,
      draft.value,
    );
  } catch {
    return null;
  }
});
const cropping = computed(
  () =>
    props.settings.mode === "ratio" ||
    (props.settings.mode === "exact" && props.settings.fit === "crop"),
);
const box = computed(() => {
  const r = cropTransform.value?.sourceRect;
  return r
    ? {
        left: `${(r.x / props.image.width) * 100}%`,
        top: `${(r.y / props.image.height) * 100}%`,
        width: `${(r.width / props.image.width) * 100}%`,
        height: `${(r.height / props.image.height) * 100}%`,
      }
    : {};
});
function draw() {
  ready.value = false;
  error.value = "";
  if (!bitmap || !canvas.value || !transform.value) return;
  try {
    const t = transform.value;
    renderToCanvas(
      canvas.value,
      bitmap,
      t,
      props.settings.format === "original"
        ? props.image.format!
        : props.settings.format,
      Math.min(1, 1200 / Math.max(t.canvasWidth, t.canvasHeight)),
    );
    ready.value = true;
  } catch (e) {
    error.value = friendlyError(e);
  }
}
let loading: Promise<void> = Promise.resolve();
function load() {
  const ticket = ++version;
  ready.value = false;
  bitmap?.close();
  bitmap = undefined;
  error.value = "";
  loading = loading.then(async () => {
    if (disposed || ticket !== version) return;
    try {
      const preview = await readPreview(props.image, 1200);
      if (disposed || ticket !== version) {
        preview.bitmap.close();
        return;
      }
      bitmap = preview.bitmap;
      draw();
    } catch (e) {
      if (ticket === version) error.value = friendlyError(e);
    }
  });
}
watch(() => props.image.id, load, { immediate: true });
watch(() => [props.settings, props.crop], draw, { deep: true, flush: "post" });
watch(canvas, draw);
async function open() {
  await loading;
  if (!ready.value || props.disabled || !bitmap) return;
  draft.value = { ...(props.crop || centerCrop()) };
  editing.value = true;
  await nextTick();
  if (!editorCanvas.value || !dialog.value) return;
  editorCanvas.value.width = bitmap.width;
  editorCanvas.value.height = bitmap.height;
  editorCanvas.value.getContext("2d")?.drawImage(bitmap, 0, 0);
  overflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  dialog.value.showModal();
}
function close() {
  dialog.value?.close();
  editing.value = false;
  if (overflow !== undefined) {
    document.body.style.overflow = overflow;
    overflow = undefined;
  }
  if (editorCanvas.value)
    editorCanvas.value.width = editorCanvas.value.height = 0;
}
function done() {
  emit("adjust", { ...draft.value });
  close();
}
let drag:
  { id: number; x: number; y: number; cx: number; cy: number } | undefined;
function start(e: PointerEvent) {
  const r = cropTransform.value?.sourceRect;
  if (!r) return;
  const el = e.currentTarget as HTMLElement;
  el.setPointerCapture(e.pointerId);
  drag = {
    id: e.pointerId,
    x: e.clientX,
    y: e.clientY,
    cx: (r.x + r.width / 2) / props.image.width,
    cy: (r.y + r.height / 2) / props.image.height,
  };
}
function move(e: PointerEvent) {
  if (!drag || drag.id !== e.pointerId) return;
  const bounds = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const r = cropTransform.value!.sourceRect;
  draft.value = {
    ...draft.value,
    x: Math.max(
      r.width / props.image.width / 2,
      Math.min(
        1 - r.width / props.image.width / 2,
        drag.cx + (e.clientX - drag.x) / bounds.width,
      ),
    ),
    y: Math.max(
      r.height / props.image.height / 2,
      Math.min(
        1 - r.height / props.image.height / 2,
        drag.cy + (e.clientY - drag.y) / bounds.height,
      ),
    ),
  };
}
async function suspend() {
  ++version;
  ready.value = false;
  await loading;
  bitmap?.close();
  bitmap = undefined;
  if (canvas.value) canvas.value.width = canvas.value.height = 0;
}
onBeforeUnmount(() => {
  disposed = true;
  ++version;
  bitmap?.close();
  close();
  if (canvas.value) canvas.value.width = canvas.value.height = 0;
});
defineExpose({ open, suspend, resume: load });
</script>
<template>
  <section class="transform-preview">
    <div class="list-header">
      <h2>处理预览</h2>
      <button
        v-if="cropping"
        class="secondary small"
        :disabled="disabled || !ready"
        @click="open"
      >
        调整裁剪
      </button>
    </div>
    <p class="field-note">
      {{ image.filename
      }}<template v-if="transform">
        · 预计输出：{{ transform.canvasWidth }} × {{ transform.canvasHeight }}px
        ·
        {{
          formatName(
            settings.format === "original" ? image.format! : settings.format,
          )
        }}</template
      >
    </p>
    <p v-if="transform?.upscaled" class="field-note">
      输出尺寸大于原图，清晰度可能下降。
    </p>
    <p v-if="error || plan.error" role="alert" class="row-error">
      {{ error || plan.error }}
    </p>
    <button
      class="transform-stage"
      aria-label="放大处理预览"
      :disabled="!ready"
      @click="canvas && lightbox?.open(canvas)"
    >
      <canvas
        ref="canvas"
        :style="{ visibility: ready ? 'visible' : 'hidden' }"
      />
    </button>
    <PreviewLightbox ref="lightbox" label="放大处理预览" />
    <Teleport to="body"
      ><dialog
        ref="dialog"
        class="crop-dialog"
        aria-label="调整裁剪"
        @cancel.prevent="close"
        @click.self="close"
      >
        <div class="crop-content" v-if="editing">
          <div class="list-header">
            <h2>调整裁剪</h2>
            <button class="icon-button" aria-label="关闭裁剪" @click="close">
              ×
            </button>
          </div>
          <p class="filename">{{ image.filename }}</p>
          <div
            class="crop-stage"
            @pointerdown.prevent="start"
            @pointermove.prevent="move"
            @pointerup="drag = undefined"
            @pointercancel="drag = undefined"
            @lostpointercapture="drag = undefined"
          >
            <canvas ref="editorCanvas" />
            <div class="crop-window" :style="box" />
          </div>
          <label class="crop-zoom"
            >缩放<input
              v-model.number="draft.zoom"
              type="range"
              min="1"
              max="4"
              step="0.01"
            />{{ draft.zoom.toFixed(2) }}×</label
          >
          <div class="list-header">
            <button class="secondary" @click="draft = centerCrop()">重置</button
            ><button class="primary" @click="done">完成</button>
          </div>
        </div>
      </dialog></Teleport
    >
  </section>
</template>
