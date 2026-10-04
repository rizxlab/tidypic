<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import AppIcon from "./AppIcon.vue";
withDefaults(defineProps<{ label?: string }>(), { label: "放大水印预览" });
const dialog = ref<HTMLDialogElement>();
const enlarged = ref<HTMLCanvasElement>();
let previousOverflow: string | undefined;
function restore() {
  if (previousOverflow !== undefined) {
    document.body.style.overflow = previousOverflow;
    previousOverflow = undefined;
  }
  if (enlarged.value) enlarged.value.width = enlarged.value.height = 0;
}
function close() {
  dialog.value?.close();
  restore();
}
function open(source: HTMLCanvasElement) {
  if (!source.width || !source.height || !dialog.value || !enlarged.value)
    return;
  const target = enlarged.value;
  target.width = source.width;
  target.height = source.height;
  target.getContext("2d")?.drawImage(source, 0, 0);
  target.style.aspectRatio = `${source.width} / ${source.height}`;
  target.style.width = `min(calc(100vw - 32px), calc((100dvh - 112px) * ${source.width / source.height}))`;
  if (!dialog.value.open) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.value.showModal();
  }
}
onBeforeUnmount(() => {
  dialog.value?.close();
  restore();
});
defineExpose({ open, close });
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
    >
      <button
        class="lightbox-close"
        aria-label="关闭大图预览"
        autofocus
        @click="close"
      >
        <AppIcon name="close" :size="24" />
      </button>
      <canvas ref="enlarged" :aria-label="label"></canvas>
    </dialog>
  </Teleport>
</template>
