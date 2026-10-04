<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import AppIcon from "../AppIcon.vue";
import type { SplitSettings } from "../../utils/image/split/geometry";
import type { ImageFormat } from "../../utils/image/types";
const model = defineModel<SplitSettings & { format: ImageFormat | "original" }>(
  { required: true },
);
defineProps<{ disabled: boolean }>();
const opened = ref(""),
  root = ref<HTMLElement>();
let trigger: HTMLElement | undefined;
const modes = [
  ["height", "按高度"],
  ["count", "按数量"],
  ["guides", "自定义切线"],
] as const;
const formats = [
  ["original", "原格式"],
  ["image/jpeg", "JPG"],
  ["image/png", "PNG"],
  ["image/webp", "WebP"],
] as const;
const panels = computed(() => [
  {
    id: "mode",
    label: `方式：${modes.find((m) => m[0] === model.value.mode)![1]}`,
  },
  ...(model.value.mode === "guides"
    ? []
    : [
        {
          id: "value",
          label:
            model.value.mode === "height"
              ? `每段：${model.value.height}px`
              : `数量：${model.value.count}张`,
        },
      ]),
  {
    id: "format",
    label: `格式：${formats.find((f) => f[0] === model.value.format)![1]}`,
  },
]);
function close(focus = false) {
  opened.value = "";
  if (focus) trigger?.focus();
}
function outside(e: PointerEvent) {
  if (!root.value?.contains(e.target as Node)) close();
}
onMounted(() => document.addEventListener("pointerdown", outside));
onBeforeUnmount(() => document.removeEventListener("pointerdown", outside));
</script>
<template>
  <div ref="root" class="wm-parameter-bar" @keydown.esc.stop="close(true)">
    <div v-for="p in panels" :key="p.id" class="wm-parameter-anchor">
      <button
        class="parameter-button"
        :disabled="disabled"
        :aria-expanded="opened === p.id"
        @click="
          trigger = $event.currentTarget as HTMLElement;
          opened = opened === p.id ? '' : p.id;
        "
      >
        {{ p.label }}<AppIcon name="chevron" :size="14" />
      </button>
      <div
        v-if="opened === p.id"
        class="parameter-popover wm-popover"
        role="dialog"
        :aria-label="p.label"
      >
        <div class="popover-title">
          <strong>{{
            p.id === "mode"
              ? "切分方式"
              : p.id === "format"
                ? "输出格式"
                : model.mode === "height"
                  ? "每段高度"
                  : "切分数量"
          }}</strong
          ><button aria-label="关闭设置" @click="close(true)">
            <AppIcon name="close" :size="16" />
          </button>
        </div>
        <div v-if="p.id === 'mode'" class="split-options">
          <button
            v-for="m in modes"
            :key="m[0]"
            :aria-pressed="model.mode === m[0]"
            @click="
              model.mode = m[0];
              close(true);
            "
          >
            {{ m[1] }}
          </button>
        </div>
        <div v-else-if="p.id === 'format'" class="split-options">
          <button
            v-for="f in formats"
            :key="f[0]"
            @click="
              model.format = f[0];
              close(true);
            "
          >
            {{ f[1] }}
          </button>
        </div>
        <template v-else
          ><div class="split-presets">
            <button
              v-for="n in model.mode === 'height'
                ? [800, 1000, 1200, 1500, 2000]
                : [2, 3, 4, 6, 8, 10]"
              :key="n"
              class="secondary"
              @click="
                model.mode === 'height' ? (model.height = n) : (model.count = n)
              "
            >
              {{ n }}
            </button>
          </div>
          <label class="wm-field"
            >自定义<input
              v-if="model.mode === 'height'"
              v-model.number="model.height"
              aria-label="每段高度"
              type="number"
              min="1" /><input
              v-else
              v-model.number="model.count"
              aria-label="切分数量"
              type="number"
              min="1"
              max="100" /></label
        ></template>
      </div>
    </div>
  </div>
</template>
