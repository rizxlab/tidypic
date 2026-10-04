<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from "vue";
import PresetControls from "./PresetControls.vue";
import type { ImagePresets } from "../../composables/useImagePresets";
import AppIcon from "../AppIcon.vue";
import type { TransformSettings } from "../../utils/image/transform/geometry";
const model = defineModel<TransformSettings>({ required: true });
defineProps<{
  presets: ImagePresets;
  invalid: boolean;
  disabled: boolean;
  canRun: boolean;
  actionLabel: string;
}>();
const emit = defineEmits<{ run: [] }>();
const presetControls = ref<InstanceType<typeof PresetControls>>();
const open = ref(""),
  root = ref<HTMLElement>();
let trigger: HTMLElement | undefined;
function toggle(key: string, e: MouseEvent) {
  presetControls.value?.close();
  trigger = e.currentTarget as HTMLElement;
  open.value = open.value === key ? "" : key;
}
function close(focus = false) {
  open.value = "";
  if (focus) trigger?.focus();
}
function outside(e: PointerEvent) {
  if (!root.value?.contains(e.target as Node)) close();
}
function escape(e: KeyboardEvent) {
  if (e.key === "Escape" && open.value) {
    e.stopPropagation();
    close(true);
  }
}
onMounted(() => {
  document.addEventListener("pointerdown", outside);
  document.addEventListener("keydown", escape);
});
onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", outside);
  document.removeEventListener("keydown", escape);
});
const dimensions = computed(() => {
  const s = model.value;
  return s.mode === "exact"
    ? `${s.width}×${s.height}px`
    : s.mode === "ratio"
      ? `比例 ${s.ratioWidth}:${s.ratioHeight}`
      : s.axis === "original"
        ? "原尺寸"
        : s.axis === "boundingBox"
          ? `宽≤${s.maxWidth} · 高≤${s.maxHeight}`
          : `${{ width: "宽", height: "高", longest: "长边" }[s.axis]}≤${s.limit}px`;
});
const controls = computed(() => [
  { key: "dimensions", label: "尺寸", value: dimensions.value },
  ...(model.value.mode === "exact"
    ? [
        {
          key: "fit",
          label: "适配",
          value: model.value.fit === "crop" ? "裁剪填满" : "扩展画布",
        },
      ]
    : []),
  ...(model.value.mode === "exact" && model.value.fit === "pad"
    ? [
        {
          key: "background",
          label: "背景",
          value:
            (
              {
                "#ffffff": "白色",
                "#000000": "黑色",
                transparent: "透明",
              } as Record<string, string>
            )[model.value.background] || "自定义",
        },
      ]
    : []),
  {
    key: "size",
    label: "大小",
    value:
      model.value.sizeUnit === "none"
        ? "不限"
        : `≤${model.value.sizeLimit}${model.value.sizeUnit}`,
  },
  {
    key: "format",
    label: "格式",
    value: {
      original: "原格式",
      "image/jpeg": "JPG",
      "image/png": "PNG",
      "image/webp": "WebP",
    }[model.value.format],
  },
]);
</script>
<template>
  <section
    ref="root"
    class="parameter-bar resize-parameters"
    aria-label="输出要求"
  >
    <h2>输出要求</h2>
    <PresetControls
      ref="presetControls"
      :presets="presets"
      :disabled="disabled"
      :invalid="invalid"
      @opening="close()"
    />
    <fieldset :disabled="disabled" class="parameter-controls">
      <div
        v-for="control in controls"
        :key="control.key"
        class="parameter-anchor"
      >
        <button
          class="parameter-button"
          :class="{ active: open === control.key }"
          :aria-expanded="open === control.key"
          @click="toggle(control.key, $event)"
        >
          <span>{{ control.label }}：{{ control.value }}</span
          ><AppIcon name="chevron" :size="14" />
        </button>
        <div
          v-if="open === control.key"
          class="parameter-popover resize-popover"
          role="dialog"
          :aria-label="control.label + '设置'"
        >
          <div class="popover-title">
            <strong>{{ control.label }}设置</strong
            ><button aria-label="关闭参数设置" @click="close(true)">×</button>
          </div>
          <template v-if="control.key === 'dimensions'">
            <div class="segmented">
              <button
                v-for="item in [
                  ['limit', '限制尺寸'],
                  ['exact', '指定尺寸'],
                  ['ratio', '固定比例'],
                ] as const"
                :class="{ selected: model.mode === item[0] }"
                @click="model.mode = item[0]"
              >
                {{ item[1] }}
              </button>
            </div>
            <template v-if="model.mode === 'limit'"
              ><label class="wm-field"
                >限制方式<select v-model="model.axis">
                  <option value="width">宽度</option>
                  <option value="height">高度</option>
                  <option value="longest">最长边</option>
                  <option value="boundingBox">宽高限制</option>
                  <option value="original">保持原尺寸</option>
                </select></label
              >
              <div v-if="model.axis === 'boundingBox'" class="dimension-fields">
                <label
                  >最大宽度（px）<input
                    v-model.number="model.maxWidth"
                    type="number"
                    min="1"
                    max="16384"
                    step="1"
                    aria-label="最大宽度"
                /></label>
                <label
                  >最大高度（px）<input
                    v-model.number="model.maxHeight"
                    type="number"
                    min="1"
                    max="16384"
                    step="1"
                    aria-label="最大高度"
                /></label>
              </div>
              <label v-else-if="model.axis !== 'original'" class="wm-field"
                >数值（px）<input
                  v-model.number="model.limit"
                  type="number"
                  min="1"
                  max="16384"
                  aria-label="限制尺寸数值" /></label
            ></template>
            <div v-else-if="model.mode === 'exact'" class="dimension-fields">
              <label
                >宽度（px）<input
                  v-model.number="model.width"
                  type="number"
                  min="1"
                  max="16384"
                  aria-label="输出宽度" /></label
              ><label
                >高度（px）<input
                  v-model.number="model.height"
                  type="number"
                  min="1"
                  max="16384"
                  aria-label="输出高度"
              /></label>
            </div>
            <template v-else
              ><div class="split-presets">
                <button
                  v-for="ratio in [
                    [1, 1],
                    [3, 4],
                    [4, 3],
                    [16, 9],
                    [9, 16],
                  ]"
                  :class="{
                    selected:
                      model.ratioWidth === ratio[0] &&
                      model.ratioHeight === ratio[1],
                  }"
                  @click="
                    model.ratioWidth = ratio[0]!;
                    model.ratioHeight = ratio[1]!;
                  "
                >
                  {{ ratio[0] }}:{{ ratio[1] }}
                </button>
              </div>
              <div class="dimension-fields">
                <label
                  >自定义比例<input
                    v-model.number="model.ratioWidth"
                    type="number"
                    min="0.001"
                    step="any"
                    aria-label="比例宽" /></label
                ><label
                  >：<input
                    v-model.number="model.ratioHeight"
                    type="number"
                    min="0.001"
                    step="any"
                    aria-label="比例高"
                /></label></div
            ></template>
          </template>
          <div v-else-if="control.key === 'fit'" class="radio-list">
            <label
              ><input
                v-model="model.fit"
                type="radio"
                value="crop"
              />裁剪填满</label
            ><label
              ><input
                v-model="model.fit"
                type="radio"
                value="pad"
              />扩展画布</label
            >
          </div>
          <template v-else-if="control.key === 'background'"
            ><div class="split-presets">
              <button
                v-for="color in [
                  ['#ffffff', '白色'],
                  ['#000000', '黑色'],
                  ['transparent', '透明'],
                ]"
                @click="model.background = color[0]!"
              >
                {{ color[1] }}
              </button>
            </div>
            <label class="wm-field"
              >自定义颜色<input
                type="color"
                :value="
                  model.background === 'transparent'
                    ? '#ffffff'
                    : model.background
                "
                @input="
                  model.background = ($event.target as HTMLInputElement).value
                " /></label
          ></template>
          <template v-else-if="control.key === 'size'"
            ><label class="wm-field"
              >文件大小<select v-model="model.sizeUnit">
                <option value="none">不限制</option>
                <option value="KB">KB</option>
                <option value="MB">MB</option>
              </select></label
            ><label v-if="model.sizeUnit !== 'none'" class="wm-field"
              >不超过<input
                v-model.number="model.sizeLimit"
                type="number"
                min="0.001"
                step="any"
                aria-label="文件大小上限"
            /></label>
            <div class="split-presets">
              <button
                v-for="n in [100, 200, 500]"
                @click="
                  model.sizeUnit = 'KB';
                  model.sizeLimit = n;
                "
              >
                {{ n }}KB</button
              ><button
                @click="
                  model.sizeUnit = 'MB';
                  model.sizeLimit = 1;
                "
              >
                1MB
              </button>
            </div></template
          >
          <div v-else class="radio-list">
            <label
              v-for="f in [
                ['original', '原格式'],
                ['image/jpeg', 'JPG'],
                ['image/png', 'PNG'],
                ['image/webp', 'WebP'],
              ] as const"
              ><input
                v-model="model.format"
                type="radio"
                :value="f[0]"
                @change="close(true)"
              />{{ f[1] }}</label
            >
          </div>
          <button class="popover-done" @click="close(true)">完成</button>
        </div>
      </div>
    </fieldset>
    <button
      class="primary process-button"
      :disabled="disabled || !canRun"
      @click="
        close();
        emit('run');
      "
    >
      {{ actionLabel }}<AppIcon name="arrow" :size="17" />
    </button>
  </section>
</template>
