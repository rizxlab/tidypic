<script setup lang="ts">
import { computed } from "vue";
import RenameParameterBar from "./RenameParameterBar.vue";
import type { RenameSettings } from "../../utils/files/rename";
const model = defineModel<RenameSettings>({ required: true });
defineProps<{ disabled: boolean }>();
const text = computed({
  get: () =>
    model.value.mode === "uniform"
      ? model.value.name
      : model.value.mode === "prefix"
        ? model.value.prefix
        : model.value.suffix,
  set: (value) => {
    if (model.value.mode === "uniform") model.value.name = value;
    else if (model.value.mode === "prefix") model.value.prefix = value;
    else model.value.suffix = value;
  },
});
const label = computed(() =>
  model.value.mode === "uniform"
    ? "名称"
    : model.value.mode === "prefix"
      ? "前缀"
      : "后缀",
);
</script>
<template>
  <RenameParameterBar v-model="model" :disabled="disabled" />
  <label class="wm-field rename-name"
    >{{ label
    }}<input
      v-model="text"
      :aria-label="label"
      :disabled="disabled"
      :placeholder="
        model.mode === 'uniform' ? '可留空，仅使用编号' : undefined
      "
  /></label>
</template>
