<script setup lang="ts">
import { ref } from "vue";
import { usePointerSort } from "../composables/usePointerSort";
import ImageUploadList from "./ImageUploadList.vue";
import type { ImageJob } from "../utils/image/types";
import type { ImageCollection } from "../composables/useImageBatch";
const props = defineProps<{ batch: ImageCollection }>();
const emit = defineEmits<{ retry: [image: ImageJob] }>();
const root = ref<HTMLElement>();
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
  if (props.batch.reorder) props.batch.reorder(next.map((i) => i.id));
  else props.batch.images.value = next;
}
const { dragging, start } = usePointerSort(
  root,
  ".file-row",
  (id, row) =>
    moveTo(
      id,
      props.batch.images.value.findIndex((i) => i.id === row.dataset.imageId),
    ),
  () => props.batch.locked.value,
);
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
