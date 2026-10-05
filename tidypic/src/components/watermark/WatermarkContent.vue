<script setup lang="ts">
import type { WatermarkSettings } from "../../utils/image/watermark/types";
const model = defineModel<WatermarkSettings>({ required: true });
defineProps<{ disabled?: boolean }>();
const emit = defineEmits<{ logo: [file: File] }>();
</script>
<template>
  <fieldset :disabled="disabled">
    <div class="segmented kind-tabs" aria-label="水印类型">
      <button
        :aria-pressed="model.kind === 'text'"
        @click="model.kind = 'text'"
      >
        文字水印
      </button>
      <button
        :aria-pressed="model.kind === 'image'"
        @click="model.kind = 'image'"
      >
        图片水印
      </button>
    </div>
    <label v-if="model.kind === 'text'" class="wm-field"
      >水印文字<input
        v-model="model.text"
        aria-label="水印文字"
        maxlength="100"
        placeholder="@自己的店铺"
    /></label>
    <slot v-else name="image">
      <label class="wm-field"
        >水印图片<input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label="选择水印图片"
          @change="
            ($event.target as HTMLInputElement).files?.[0] &&
            emit('logo', ($event.target as HTMLInputElement).files![0]!)
          "
      /></label>
    </slot>
  </fieldset>
</template>
