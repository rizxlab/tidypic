<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import PreviewLightbox from "./PreviewLightbox.vue";
import AppIcon from "./AppIcon.vue";
import type { ImageCollection } from "../composables/useImageBatch";
import type { ImageJob, ProcessingStatus } from "../utils/image/types";
import { formatBytes, formatName } from "../utils/image/browser";
import { registerImagePaste } from "../utils/image/clipboard";
const props = defineProps<{
  batch: ImageCollection;
  selectedId?: string;
  selectable?: boolean;
  disabled?: boolean;
}>();
const emit = defineEmits<{
  retry: [image: ImageJob];
  select: [image: ImageJob];
}>();
const { images, locked } = props.batch;
const input = ref<HTMLInputElement>(),
  dragging = ref(false);
const surface = ref<HTMLElement>();
const lightbox = ref<InstanceType<typeof PreviewLightbox>>();
const sourceImages = computed(() =>
  images.value
    .filter((image) => image.width && image.height)
    .map((image) => ({
      id: image.id,
      name: image.filename,
      blob: image.originalFile,
    })),
);
function preview(image: ImageJob, event: Event) {
  const at = sourceImages.value.findIndex((item) => item.id === image.id);
  if (at >= 0) {
    if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus();
    lightbox.value?.openImages(sourceImages.value, at);
  }
}
let unregisterPaste: (() => void) | undefined;
onMounted(() => {
  unregisterPaste = registerImagePaste(surface.value!.ownerDocument, {
    element: () => surface.value,
    enabled: () => !locked.value && !props.disabled,
    add: (files) => {
      void upload(files);
    },
  });
});
onBeforeUnmount(() => unregisterPaste?.());
const labels: Record<ProcessingStatus, string> = {
  reading: "读取中",
  waiting: "等待",
  processing: "处理中",
  done: "完成",
  failed: "失败",
};
async function upload(files: FileList | File[] | null) {
  if (files && !locked.value && !props.disabled) await props.batch.add(files);
  if (input.value) input.value.value = "";
}
let dragDepth = 0;
function enterDrag() {
  if (locked.value || props.disabled) return;
  dragDepth++;
  dragging.value = true;
}
function leaveDrag() {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) dragging.value = false;
}
function drop(event: DragEvent) {
  dragDepth = 0;
  dragging.value = false;
  upload(event.dataTransfer?.files || null);
}
function select(image: ImageJob) {
  if (props.selectable && !locked.value && !props.disabled && image.width)
    emit("select", image);
}
</script>
<template>
  <input
    ref="input"
    class="sr-only"
    type="file"
    multiple
    accept="image/jpeg,image/png,image/webp"
    aria-label="选择图片文件"
    :disabled="locked || disabled"
    @change="upload(($event.target as HTMLInputElement).files)"
  />
  <section
    ref="surface"
    class="upload-surface"
    :class="{ dragging, 'has-images': images.length }"
    @dragenter.prevent="enterDrag"
    @dragover.prevent
    @dragleave.prevent="leaveDrag"
    @drop.prevent="drop"
  >
    <div v-if="!images.length" class="upload-zone">
      <p class="upload-prompt">拖入图片到这里</p>
      <button
        class="primary choose-button"
        :disabled="locked || disabled"
        @click="input?.click()"
      >
        <span aria-hidden="true">＋</span>选择图片
      </button>
      <p class="upload-help">
        <span class="paste-hint">也可直接 Ctrl/⌘ + V 粘贴图片</span
        ><span class="paste-hint-mobile">支持直接粘贴图片</span><br />JPG / PNG
        / WebP · 单张最大 40MB
      </p>
    </div>
    <template v-else>
      <div class="list-header">
        <h2>已选择 {{ images.length }} 张</h2>
        <div class="list-actions">
          <button
            class="secondary small"
            :disabled="locked || disabled"
            @click="input?.click()"
          >
            <span aria-hidden="true">＋</span>添加图片</button
          ><button
            class="text-button"
            :disabled="locked || disabled"
            @click="batch.clear"
          >
            清空
          </button>
        </div>
      </div>
      <div class="file-list" tabindex="0" aria-label="已选择的图片列表">
        <div
          v-for="image in images"
          :key="image.id"
          class="file-row"
          :data-status="image.processingStatus"
          :data-image-id="image.id"
          :class="{
            'preview-selected': selectable && selectedId === image.id,
          }"
        >
          <slot name="row-start" :image="image" />
          <button
            v-if="selectable"
            class="icon-button source-select"
            :aria-label="`选择 ${image.filename} 作为当前图片`"
            :aria-pressed="selectedId === image.id"
            :disabled="locked || disabled || !image.width"
            @click.stop="select(image)"
          >
            <AppIcon
              v-if="selectedId === image.id"
              name="check"
              :size="16"
            /><span
              v-else
              class="source-select-circle"
              aria-hidden="true"
            ></span>
          </button>
          <div
            class="file-preview"
            role="button"
            :tabindex="image.width ? 0 : -1"
            :aria-label="`预览原图 ${image.filename}`"
            :aria-disabled="!image.width"
            @click.stop="preview(image, $event)"
            @keydown.enter.stop.prevent="preview(image, $event)"
            @keydown.space.stop.prevent="preview(image, $event)"
          >
            <slot name="thumbnail" :image="image">
              <div class="thumbnail">
                <img
                  v-if="image.previewUrl"
                  :src="image.previewUrl"
                  alt=""
                /><AppIcon v-else :size="19" />
              </div>
            </slot>
            <div class="file-info">
              <span class="filename" :title="image.filename">{{
                image.filename
              }}</span>
              <span class="file-meta"
                ><template v-if="image.width"
                  >{{ image.width }} × {{ image.height }}
                  <span class="meta-separator">·</span> </template
                >{{ formatBytes(image.originalSize)
                }}<template v-if="image.format">
                  <span class="meta-separator">·</span>
                  {{ formatName(image.format) }}</template
                ></span
              >
              <slot name="row-notice" :image="image" />
              <p v-if="image.error" class="row-error">{{ image.error }}</p>
            </div>
          </div>
          <slot name="row-actions" :image="image" />
          <span class="file-status" :class="image.processingStatus"
            ><AppIcon
              v-if="image.processingStatus === 'done'"
              name="check"
              :size="14"
            /><span
              v-if="
                image.processingStatus === 'processing' ||
                image.processingStatus === 'reading'
              "
              class="spinner"
            ></span
            >{{ labels[image.processingStatus] }}</span
          >
          <button
            v-if="image.processingStatus === 'failed'"
            class="row-retry"
            :disabled="locked || disabled"
            :aria-label="`重试 ${image.filename}`"
            @click.stop="emit('retry', image)"
          >
            重试
          </button>
          <button
            class="icon-button remove-button"
            :disabled="locked || disabled"
            :aria-label="`删除 ${image.filename}`"
            @click.stop="batch.remove(image.id)"
          >
            <AppIcon name="close" :size="16" />
          </button>
        </div>
      </div>
    </template>
  </section>
  <PreviewLightbox ref="lightbox" label="原图预览" />
</template>
