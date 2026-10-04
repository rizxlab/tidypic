<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import ImageUploadList from "./ImageUploadList.vue";
import type { ImageJob } from "../utils/image/types";
import type { ImageCollection } from "../composables/useImageBatch";
const props = defineProps<{ batch: ImageCollection }>();
const emit = defineEmits<{ retry: [image: ImageJob] }>();
const root = ref<HTMLElement>(),
  dragging = ref("");
let pointerY = 0,
  pointerX = 0,
  frame = 0;
function moveTo(id: string, index: number) {
  const items = props.batch.images.value;
  const from = items.findIndex((i) => i.id === id);
  if (
    from < 0 ||
    index < 0 ||
    index >= items.length ||
    from === index ||
    props.batch.locked.value
  )
    return;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(index, 0, item!);
  props.batch.images.value = next;
}
function update(e: PointerEvent) {
  pointerY = e.clientY;
  pointerX = e.clientX;
  reorderAtPointer();
}
function reorderAtPointer() {
  const row = document
    .elementFromPoint(pointerX, pointerY)
    ?.closest<HTMLElement>(".file-row");
  if (row && root.value?.contains(row))
    moveTo(
      dragging.value,
      props.batch.images.value.findIndex((i) => i.id === row.dataset.imageId),
    );
}
function scroll() {
  const list = root.value?.querySelector(".file-list");
  if (list) {
    const r = list.getBoundingClientRect();
    const before = list.scrollTop;
    if (pointerY < r.top + 32) list.scrollTop -= 10;
    else if (pointerY > r.bottom - 32) list.scrollTop += 10;
    if (list.scrollTop !== before) reorderAtPointer();
  }
  frame = requestAnimationFrame(scroll);
}
function stop() {
  dragging.value = "";
  cancelAnimationFrame(frame);
  window.removeEventListener("pointermove", update);
  window.removeEventListener("pointerup", stop);
  window.removeEventListener("pointercancel", stop);
}
function start(e: PointerEvent, id: string) {
  if (props.batch.locked.value) return;
  dragging.value = id;
  pointerY = e.clientY;
  pointerX = e.clientX;
  window.addEventListener("pointermove", update);
  window.addEventListener("pointerup", stop);
  window.addEventListener("pointercancel", stop);
  frame = requestAnimationFrame(scroll);
}
onBeforeUnmount(stop);
</script>
<template>
  <div ref="root" class="stitch-upload">
    <ImageUploadList :batch="batch" @retry="emit('retry', $event)"
      ><template v-if="$slots.thumbnail" #thumbnail="{ image }"
        ><slot name="thumbnail" :image="image" /></template
      ><template #row-start="{ image }"
        ><button
          class="stitch-drag"
          :class="{ active: dragging === image.id }"
          :disabled="batch.locked.value"
          :aria-label="`拖动排序 ${image.filename}`"
          @pointerdown.prevent="start($event, image.id)"
          @keydown.up.prevent="
            moveTo(image.id, batch.images.value.indexOf(image) - 1)
          "
          @keydown.down.prevent="
            moveTo(image.id, batch.images.value.indexOf(image) + 1)
          "
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path d="M4 5h12M4 10h12M4 15h12" />
          </svg></button></template
    ></ImageUploadList>
  </div>
</template>
