<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import type { ImageJob } from "../../utils/image/types";
const props = defineProps<{ image: ImageJob; disabled: boolean }>();
const guides = defineModel<number[]>({ required: true });
const url = ref(""),
  area = ref<HTMLElement>(),
  error = ref("");
watch(
  () => props.image.originalFile,
  (file) => {
    if (url.value) URL.revokeObjectURL(url.value);
    url.value = URL.createObjectURL(file);
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  URL.revokeObjectURL(url.value);
});
const sorted = computed(() =>
  guides.value.map((y, index) => ({ y, index })).sort((a, b) => a.y - b.y),
);
function set(index: number, y: number) {
  y = Math.max(1, Math.min(props.image.height - 1, Math.round(y)));
  if (guides.value.some((v, i) => i !== index && v === y)) {
    error.value = "切线不能重叠，请稍微移动位置。";
    return;
  }
  error.value = "";
  const next = [...guides.value];
  if (index < 0) next.push(y);
  else next[index] = y;
  guides.value = next;
}
function add(y?: number) {
  if (props.disabled) return;
  if (guides.value.length >= 99 || props.image.height < 2) {
    error.value = "最多 99 条切线，每段至少 1px。";
    return;
  }
  if (y === undefined) {
    const points = [
      0,
      ...guides.value.toSorted((a, b) => a - b),
      props.image.height,
    ];
    let gap = 0;
    for (let i = 1; i < points.length; i++)
      if (points[i]! - points[i - 1]! > gap) {
        gap = points[i]! - points[i - 1]!;
        y = Math.floor((points[i]! + points[i - 1]!) / 2);
      }
    if (gap < 2) {
      error.value = "没有可添加切线的空间。";
      return;
    }
  }
  set(-1, y!);
}
function coordinate(e: PointerEvent | MouseEvent) {
  const r = area.value!.getBoundingClientRect();
  return ((e.clientY - r.top) / r.height) * props.image.height;
}
let dragging: number | undefined;
function start(e: PointerEvent, index: number) {
  if (props.disabled) return;
  dragging = index;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}
function move(e: PointerEvent) {
  if (dragging !== undefined) set(dragging, coordinate(e));
}
</script>
<template>
  <section class="split-editor">
    <div class="list-header">
      <h2>{{ image.filename }}</h2>
      <button class="secondary" :disabled="disabled" @click="add()">
        ＋ 添加切线
      </button>
    </div>
    <p v-if="error" class="row-error" role="alert">{{ error }}</p>
    <div class="split-scroll">
      <div
        ref="area"
        class="split-guide-image"
        :style="{ aspectRatio: `${image.width}/${image.height}` }"
        @click.self="add(coordinate($event))"
      >
        <img
          :src="url"
          alt="长图切线预览"
          draggable="false"
          @click="add(coordinate($event))"
        />
        <div
          v-for="g in sorted"
          :key="g.index"
          class="split-guide"
          :style="{ top: `${(g.y / image.height) * 100}%` }"
        >
          <button
            class="guide-handle"
            :disabled="disabled"
            :aria-label="`拖动切线 ${g.y}px`"
            @pointerdown.prevent="start($event, g.index)"
            @pointermove="move"
            @pointerup="dragging = undefined"
            @pointercancel="dragging = undefined"
            @click.stop
            @keydown.up.prevent="set(g.index, g.y - 1)"
            @keydown.down.prevent="set(g.index, g.y + 1)"
          >
            {{ g.y }}px</button
          ><button
            class="guide-delete"
            :disabled="disabled"
            :aria-label="`删除切线 ${g.y}px`"
            @click.stop="guides = guides.filter((_, i) => i !== g.index)"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
