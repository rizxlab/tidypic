<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import AppIcon from "../AppIcon.vue";
import type { RenameSettings } from "../../utils/files/rename";
const model = defineModel<RenameSettings>({ required: true });
defineProps<{ disabled: boolean }>();
const opened = ref(""),
  root = ref<HTMLElement>();
let trigger: HTMLElement | undefined;
const modes = [
  ["uniform", "统一名称"],
  ["prefix", "添加前缀"],
  ["suffix", "添加后缀"],
] as const;
const separators = [
  ["_", "_"],
  ["-", "-"],
  [" ", "空格"],
  ["", "无"],
] as const;
const panels = computed(() => [
  {
    id: "mode",
    title: "规则",
    value: modes.find((m) => m[0] === model.value.mode)![1],
  },
  ...(model.value.mode === "uniform"
    ? [
        {
          id: "number",
          title: "编号",
          value: "1".padStart(model.value.digits, "0"),
        },
      ]
    : []),
  {
    id: "separator",
    title: "分隔符",
    value: separators.find((s) => s[0] === model.value.separator)![1],
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
        <template v-else-if="p.id === 'number'"
          ><div class="segmented">
            <button
              v-for="n in [1, 2, 3] as const"
              :key="n"
              :aria-pressed="model.digits === n"
              @click="model.digits = n"
            >
              {{ "1".padStart(n, "0") }}
            </button>
          </div>
          <label class="wm-field"
            >起始编号<input
              v-model.number="model.start"
              aria-label="起始编号"
              type="number"
              min="0"
              step="1" /></label
        ></template>
        <div v-else class="split-options">
          <button
            v-for="s in separators"
            :key="s[0]"
            :aria-pressed="model.separator === s[0]"
            @click="
              model.separator = s[0];
              close(true);
            "
          >
            {{ s[1] }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
