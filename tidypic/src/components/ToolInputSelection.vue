<script setup lang="ts">
import type { ImageBatch } from "../composables/useImageBatch";
import { toolDefinitions, type ToolId } from "../data/tools";
const props = defineProps<{ tool: ToolId; batch: ImageBatch }>();
const definition = toolDefinitions[props.tool];
</script>
<template>
  <label
    v-if="definition.inputMode === 'single' && batch.images.value.length"
    class="current-image wm-field"
  >
    当前图片
    <select
      v-model="batch.workspace.activeId.value"
      :disabled="batch.locked.value"
      aria-label="当前图片"
    >
      <option
        v-for="image in batch.images.value"
        :key="image.id"
        :value="image.id"
      >
        {{ image.filename }}
      </option>
    </select>
    <span class="field-note">仅处理当前图片，其他图片保留在图片池中。</span>
  </label>
</template>
<style scoped>
.current-image {
  margin: 14px 0;
  max-width: 100%;
}
select {
  max-width: 100%;
}
</style>
