<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch,
} from "vue";
import { createPreviewUrls, type PreviewImage } from "../utils/image/preview";
import AppIcon from "./AppIcon.vue";
withDefaults(defineProps<{ label?: string }>(), { label: "放大水印预览" });
const dialog = ref<HTMLDialogElement>();
const enlarged = ref<HTMLCanvasElement>();
const images = shallowRef<PreviewImage[]>([]),
  index = ref(0),
  imageUrl = ref(""),
  loading = ref(false),
  error = ref("");
const current = computed(() => images.value[index.value]);
const urls = createPreviewUrls();
let previousFocus: HTMLElement | undefined;
let previousOverflow: string | undefined;
let updating = false;
function updateCurrent() {
  const image = current.value;
  loading.value = !!image;
  error.value = "";
  try {
    imageUrl.value = image ? urls.get(image) : "";
  } catch (e) {
    error.value = (e as Error).message;
    loading.value = false;
  }
}
watch(
  current,
  () => {
    if (!updating) updateCurrent();
  },
  { flush: "sync" },
);
function show() {
  if (!dialog.value || dialog.value.open) return;
  previousFocus =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : undefined;
  previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  dialog.value.showModal();
}
function openImages(collection: PreviewImage[], at = 0) {
  if (!collection.length || !collection[at] || !dialog.value) return;
  updating = true;
  urls.clear();
  images.value = [...collection];
  index.value = at;
  updating = false;
  updateCurrent();
  show();
}
function navigate(delta: number) {
  const next = index.value + delta;
  if (next >= 0 && next < images.value.length) index.value = next;
}
function restore() {
  if (previousOverflow !== undefined) {
    document.body.style.overflow = previousOverflow;
    previousOverflow = undefined;
  }
  images.value = [];
  index.value = 0;
  urls.clear();
  if (enlarged.value) enlarged.value.width = enlarged.value.height = 0;
  const focus = previousFocus;
  previousFocus = undefined;
  if (focus?.isConnected) void nextTick(() => focus.focus());
}
function close() {
  dialog.value?.close();
  restore();
}
function open(source: HTMLCanvasElement) {
  if (!source.width || !source.height || !dialog.value || !enlarged.value)
    return;
  images.value = [];
  urls.clear();
  const target = enlarged.value;
  target.width = source.width;
  target.height = source.height;
  target.getContext("2d")?.drawImage(source, 0, 0);
  target.style.aspectRatio = `${source.width} / ${source.height}`;
  target.style.width = `min(calc(100vw - 32px), calc((100dvh - 112px) * ${source.width / source.height}))`;
  show();
}
onBeforeUnmount(() => {
  dialog.value?.close();
  restore();
});
defineExpose({ open, openImages, close });
</script>
<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="preview-lightbox"
      :aria-label="label"
      @click.self="close"
      @cancel.prevent="close"
      @close="restore"
      @keydown.left.prevent="navigate(-1)"
      @keydown.right.prevent="navigate(1)"
    >
      <button
        class="lightbox-close"
        aria-label="关闭大图预览"
        autofocus
        @click="close"
      >
        <AppIcon name="close" :size="24" />
      </button>
      <canvas v-show="!current" ref="enlarged" :aria-label="label"></canvas>
      <template v-if="current">
        <img
          v-if="imageUrl"
          :key="imageUrl"
          class="lightbox-image"
          :src="imageUrl"
          :alt="current.name"
          @load="loading = false"
          @error="
            loading = false;
            error = '无法打开这张图片，请尝试下载查看。';
          "
        />
        <p v-if="loading || error" class="lightbox-message" role="status">
          {{ error || "读取中…" }}
        </p>
        <div class="lightbox-gallery">
          <button
            v-if="images.length > 1"
            class="lightbox-navigation"
            aria-label="上一张"
            :disabled="index === 0"
            @click="navigate(-1)"
          >
            ←
          </button>
          <div class="lightbox-caption">
            <span v-if="images.length > 1" aria-live="polite"
              >{{ index + 1 }} / {{ images.length }}</span
            ><span class="filename" :title="current.name">{{
              current.name
            }}</span>
          </div>
          <button
            v-if="images.length > 1"
            class="lightbox-navigation"
            aria-label="下一张"
            :disabled="index === images.length - 1"
            @click="navigate(1)"
          >
            →
          </button>
        </div>
      </template>
    </dialog>
  </Teleport>
</template>
