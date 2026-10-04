<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import type { OutputSettings, ResizeMode } from "../utils/image/types";
import AppIcon from "./AppIcon.vue";
const model = defineModel<OutputSettings>({ required: true });
const props = defineProps<{
  resize: boolean;
  disabled: boolean;
  canRun: boolean;
  actionLabel: string;
}>();
const emit = defineEmits<{ run: [] }>();
const opened = ref<"dimensions" | "size" | "format" | null>(null);
const root = ref<HTMLElement>();
let trigger: HTMLButtonElement | undefined;
const modes: { value: ResizeMode; text: string }[] = [
  { value: "original", text: "保持原尺寸" },
  { value: "width", text: "限制宽度" },
  { value: "height", text: "限制高度" },
  { value: "longest", text: "限制最长边" },
  { value: "exact", text: "指定尺寸" },
];
const sizeLabel = computed(() => {
  const value = model.value;
  const width = value.width || "—",
    height = value.height || "—";
  return value.mode === "original"
    ? "原尺寸"
    : value.mode === "width"
      ? `宽 ≤ ${width}px`
      : value.mode === "height"
        ? `高 ≤ ${height}px`
        : value.mode === "longest"
          ? `最长边 ≤ ${width}px`
          : `${width} × ${height}px`;
});
const formatLabel = computed(() =>
  model.value.format === "original"
    ? "原格式"
    : model.value.format === "image/jpeg"
      ? "JPG"
      : model.value.format === "image/png"
        ? "PNG"
        : "WebP",
);
async function toggle(name: typeof opened.value, event: MouseEvent) {
  trigger = event.currentTarget as HTMLButtonElement;
  opened.value = opened.value === name ? null : name;
  await nextTick();
  root.value
    ?.querySelector<HTMLElement>(
      ".parameter-popover input, .parameter-popover button",
    )
    ?.focus();
}
function close(focus = false) {
  opened.value = null;
  if (focus) trigger?.focus();
}
function outside(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node)) close();
}
function preset(sizeLimit: number, sizeUnit: "KB" | "MB") {
  model.value.sizeLimit = sizeLimit;
  model.value.sizeUnit = sizeUnit;
  close(true);
}
onMounted(() => document.addEventListener("pointerdown", outside));
onBeforeUnmount(() => document.removeEventListener("pointerdown", outside));
</script>
<template>
  <section
    ref="root"
    class="parameter-bar"
    aria-label="输出要求"
    @keydown.esc.stop="close(true)"
  >
    <h2>输出要求</h2>
    <fieldset :disabled="disabled" class="parameter-controls">
      <div v-if="resize" class="parameter-anchor">
        <button
          class="parameter-button"
          :class="{ active: opened === 'dimensions' }"
          :aria-expanded="opened === 'dimensions'"
          aria-controls="dimensions-popover"
          @click="toggle('dimensions', $event)"
        >
          <AppIcon name="resize" :size="16" /><span>{{ sizeLabel }}</span
          ><AppIcon name="chevron" :size="14" />
        </button>
        <div
          v-if="opened === 'dimensions'"
          id="dimensions-popover"
          class="parameter-popover"
          role="dialog"
          aria-label="图片尺寸设置"
        >
          <div class="popover-title">
            <strong>图片尺寸</strong
            ><button aria-label="关闭尺寸设置" @click="close(true)">
              <AppIcon name="close" :size="16" />
            </button>
          </div>
          <div class="radio-list">
            <label v-for="mode in modes" :key="mode.value"
              ><input
                v-model="model.mode"
                type="radio"
                name="resize-mode"
                :value="mode.value"
              />{{ mode.text }}</label
            >
          </div>
          <div v-if="model.mode !== 'original'" class="dimension-fields">
            <label v-if="model.mode !== 'height'"
              >{{ model.mode === "longest" ? "最长边" : "宽度"
              }}<span class="input-unit"
                ><input
                  v-model.number="model.width"
                  aria-label="输出宽度或最长边"
                  type="number"
                  min="1"
                  max="8192"
                  step="1"
                /><span>px</span></span
              ></label
            >
            <label v-if="model.mode === 'height' || model.mode === 'exact'"
              >高度<span class="input-unit"
                ><input
                  v-model.number="model.height"
                  aria-label="输出高度"
                  type="number"
                  min="1"
                  max="8192"
                  step="1"
                /><span>px</span></span
              ></label
            >
          </div>
          <div v-if="model.mode === 'exact'" class="fit-options">
            <label
              ><input
                v-model="model.fit"
                type="radio"
                value="contain"
                name="fit"
              />保持比例</label
            ><label
              ><input
                v-model="model.fit"
                type="radio"
                value="cover"
                name="fit"
              />居中裁剪</label
            >
          </div>
          <p v-if="model.mode === 'exact'" class="field-note">
            {{
              model.fit === "contain"
                ? "等比适配到指定范围内。"
                : "裁剪超出区域，输出精确尺寸。"
            }}
          </p>
          <button class="popover-done" @click="close(true)">完成</button>
        </div>
      </div>
      <div v-if="resize" class="parameter-anchor">
        <button
          class="parameter-button"
          :class="{ active: opened === 'size' }"
          :aria-expanded="opened === 'size'"
          aria-controls="size-popover"
          @click="toggle('size', $event)"
        >
          <span>{{
            model.sizeUnit === "none"
              ? "大小不限"
              : `≤ ${model.sizeLimit || "—"}${model.sizeUnit}`
          }}</span
          ><AppIcon name="chevron" :size="14" />
        </button>
        <div
          v-if="opened === 'size'"
          id="size-popover"
          class="parameter-popover size-popover"
          role="dialog"
          aria-label="文件大小设置"
        >
          <div class="popover-title">
            <strong>文件大小</strong
            ><button aria-label="关闭大小设置" @click="close(true)">
              <AppIcon name="close" :size="16" />
            </button>
          </div>
          <div class="radio-list">
            <label
              ><input
                type="radio"
                name="limit"
                :checked="model.sizeUnit === 'none'"
                @change="model.sizeUnit = 'none'"
              />不限制</label
            ><label
              ><input
                type="radio"
                name="limit"
                :checked="model.sizeUnit !== 'none'"
                @change="model.sizeUnit = 'KB'"
              />不超过</label
            >
          </div>
          <div v-if="model.sizeUnit !== 'none'" class="limit-fields">
            <input
              v-model.number="model.sizeLimit"
              aria-label="文件大小上限"
              type="number"
              min="0.001"
              step="any"
            /><select v-model="model.sizeUnit" aria-label="文件大小单位">
              <option value="KB">KB</option>
              <option value="MB">MB</option>
            </select>
          </div>
          <p class="preset-label">常用</p>
          <div class="presets">
            <button @click="preset(200, 'KB')">200KB</button
            ><button @click="preset(500, 'KB')">500KB</button
            ><button @click="preset(1, 'MB')">1MB</button
            ><button @click="preset(2, 'MB')">2MB</button>
          </div>
          <button class="popover-done" @click="close(true)">完成</button>
        </div>
      </div>
      <div class="parameter-anchor format-anchor">
        <button
          class="parameter-button"
          :class="{ active: opened === 'format' }"
          :aria-expanded="opened === 'format'"
          aria-controls="format-popover"
          @click="toggle('format', $event)"
        >
          <span>{{ formatLabel }}</span
          ><AppIcon name="chevron" :size="14" />
        </button>
        <div
          v-if="opened === 'format'"
          id="format-popover"
          class="parameter-popover format-popover"
          role="dialog"
          aria-label="输出格式设置"
        >
          <button
            v-if="resize"
            :class="{ selected: model.format === 'original' }"
            @click="
              model.format = 'original';
              close(true);
            "
          >
            保持原格式<AppIcon
              v-if="model.format === 'original'"
              name="check"
              :size="16"
            />
          </button>
          <button
            v-for="item in [
              ['image/jpeg', 'JPG'],
              ['image/png', 'PNG'],
              ['image/webp', 'WebP'],
            ] as const"
            :key="item[0]"
            :class="{ selected: model.format === item[0] }"
            @click="
              model.format = item[0];
              close(true);
            "
          >
            {{ item[1]
            }}<AppIcon
              v-if="model.format === item[0]"
              name="check"
              :size="16"
            />
          </button>
          <p v-if="model.format === 'image/jpeg'" class="field-note">
            透明区域填充为白色。
          </p>
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
