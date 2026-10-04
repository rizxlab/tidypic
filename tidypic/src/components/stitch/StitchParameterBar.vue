<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import AppIcon from "../AppIcon.vue";
import type { StitchSettings } from "../../utils/image/stitch/geometry";
import type { ImageFormat } from "../../utils/image/types";
const model = defineModel<StitchSettings>({ required: true });
const props = defineProps<{
  disabled: boolean;
  resolvedFormat: ImageFormat;
  mixed: boolean;
}>();
const opened = ref(""),
  root = ref<HTMLElement>();
let trigger: HTMLElement | undefined;
const vertical = computed(() => model.value.direction === "vertical");
const alignments = computed(
  () =>
    [
      ["start", vertical.value ? "左" : "顶部"],
      ["center", "居中"],
      ["end", vertical.value ? "右" : "底部"],
    ] as const,
);
const formats = [
  ["original", "原格式"],
  ["image/jpeg", "JPG"],
  ["image/png", "PNG"],
  ["image/webp", "WebP"],
] as const;
const panels = computed(() => [
  { id: "direction", title: "方向", value: vertical.value ? "纵向" : "横向" },
  {
    id: "size",
    title: "尺寸",
    value:
      model.value.size === "original"
        ? "保持原尺寸"
        : `统一${vertical.value ? "宽度" : "高度"}${model.value.target === null ? "" : ` ${model.value.target}px`}`,
  },
  {
    id: "alignment",
    title: "对齐",
    value: alignments.value.find((a) => a[0] === model.value.alignment)![1],
  },
  { id: "gap", title: "间距", value: `${model.value.gap}px` },
  {
    id: "background",
    title: "背景",
    value:
      (
        { "#ffffff": "白色", "#000000": "黑色", transparent: "透明" } as Record<
          string,
          string
        >
      )[model.value.background] || model.value.background,
  },
  {
    id: "format",
    title: "格式",
    value:
      model.value.format === "original"
        ? props.mixed
          ? "PNG"
          : "原格式"
        : formats.find((f) => f[0] === model.value.format)![1],
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
        <span class="wm-parameter-name">{{ p.title }}：</span>{{ p.value
        }}<AppIcon name="chevron" :size="14" />
      </button>
      <div
        v-if="opened === p.id"
        class="parameter-popover wm-popover"
        role="dialog"
        :aria-label="`${p.title}设置`"
      >
        <div class="popover-title">
          <strong>{{ p.title }}</strong
          ><button aria-label="关闭设置" @click="close(true)">
            <AppIcon name="close" :size="16" />
          </button>
        </div>
        <div v-if="p.id === 'direction'" class="split-options">
          <button
            @click="
              model.direction = 'vertical';
              close(true);
            "
          >
            纵向</button
          ><button
            @click="
              model.direction = 'horizontal';
              close(true);
            "
          >
            横向
          </button>
        </div>
        <template v-else-if="p.id === 'size'"
          ><div class="split-options">
            <button
              :aria-pressed="model.size === 'uniform'"
              @click="model.size = 'uniform'"
            >
              统一{{ vertical ? "宽度" : "高度" }}</button
            ><button
              :aria-pressed="model.size === 'original'"
              @click="model.size = 'original'"
            >
              保持原尺寸
            </button>
          </div>
          <template v-if="model.size === 'uniform'"
            ><label class="wm-field"
              >目标{{ vertical ? "宽度" : "高度"
              }}<select
                :value="model.target === null ? 'auto' : 'custom'"
                aria-label="目标尺寸方式"
                @change="
                  model.target =
                    ($event.target as HTMLSelectElement).value === 'auto'
                      ? null
                      : 800
                "
              >
                <option value="auto">自动（最小尺寸）</option>
                <option value="custom">自定义</option>
              </select></label
            ><label v-if="model.target !== null" class="wm-field"
              >自定义尺寸（px）<input
                v-model.number="model.target"
                aria-label="自定义目标尺寸"
                type="number"
                min="1"
                max="16384" /></label></template
        ></template>
        <div v-else-if="p.id === 'alignment'" class="split-options">
          <button
            v-for="a in alignments"
            :key="a[0]"
            :aria-pressed="model.alignment === a[0]"
            @click="
              model.alignment = a[0];
              close(true);
            "
          >
            {{ a[1] }}
          </button>
        </div>
        <template v-else-if="p.id === 'gap'"
          ><div class="split-presets">
            <button
              v-for="n in [0, 8, 16, 24, 32]"
              :key="n"
              class="secondary"
              @click="model.gap = n"
            >
              {{ n }}px
            </button>
          </div>
          <label class="wm-field"
            >自定义间距（px）<input
              v-model.number="model.gap"
              aria-label="自定义间距"
              type="number"
              min="0"
              max="4096" /></label
        ></template>
        <template v-else-if="p.id === 'background'"
          ><div class="split-options">
            <button
              v-for="c in [
                ['#ffffff', '白色'],
                ['#000000', '黑色'],
                ['transparent', '透明'],
              ]"
              :key="c[0]"
              @click="
                model.background = c[0]!;
                close(true);
              "
            >
              {{ c[1] }}
            </button>
          </div>
          <label class="wm-field"
            >自定义<input
              type="color"
              aria-label="自定义背景颜色"
              :value="
                model.background === 'transparent'
                  ? '#ffffff'
                  : model.background
              "
              @input="
                model.background = ($event.target as HTMLInputElement).value
              " /></label
        ></template>
        <div v-else class="split-options">
          <button
            v-for="f in formats"
            :key="f[0]"
            @click="
              model.format = f[0];
              close(true);
            "
          >
            {{ f[0] === "original" && mixed ? "自动（混合格式 → PNG）" : f[1] }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
