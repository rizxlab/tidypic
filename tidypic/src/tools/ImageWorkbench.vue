<script setup lang="ts">
import { computed, ref, watch } from "vue";
import AppIcon from "../components/AppIcon.vue";
import ParameterBar from "../components/ParameterBar.vue";
import { useImageBatch } from "../composables/useImageBatch";
import type { OutputSettings, ImageJob } from "../utils/image/types";
import ImageUploadList from "../components/ImageUploadList.vue";
import BatchResults from "../components/BatchResults.vue";
const props = defineProps<{ tool: "resize" | "convert" }>();
const batch = useImageBatch("tidypic-images.zip", props.tool);
const {
  images,
  loading,
  processing,
  locked,
  pending,
  completed,
  total,
  error,
} = batch;
const isResize = computed(() => props.tool === "resize");
const settings = ref<OutputSettings>({
  mode: isResize.value ? "width" : "original",
  width: 800,
  height: 800,
  fit: "contain",
  sizeUnit: isResize.value ? "KB" : "none",
  sizeLimit: 500,
  format: isResize.value ? "original" : "image/jpeg",
});
watch(settings, batch.invalidate, { deep: true, flush: "sync" });
const actionLabel = computed(() =>
  processing.value
    ? `正在处理 ${completed.value} / ${total.value}`
    : loading.value
      ? "读取中…"
      : !images.value.length
        ? isResize.value
          ? "开始处理"
          : "转换图片"
        : !pending.value.length
          ? "已全部处理"
          : images.value.length === 1
            ? isResize.value
              ? "开始处理"
              : "转换图片"
            : `处理 ${pending.value.length} 张图片`,
);
function run(image?: ImageJob) {
  batch.run({ ...settings.value }, image);
}
</script>
<template>
  <div class="workspace-heading">
    <h1>{{ isResize ? "尺寸调整 + 压缩" : "格式转换" }}</h1>
    <span v-if="images.length" class="heading-count"
      >{{ images.length }} 张图片</span
    >
  </div>
  <ImageUploadList :batch="batch" @retry="run" />
  <ParameterBar
    v-model="settings"
    :resize="isResize"
    :disabled="locked"
    :can-run="pending.length > 0"
    :action-label="actionLabel"
    @run="run()"
  />
  <div v-if="processing" class="under-bar">
    <span class="progress-text" role="status"
      >正在处理 {{ completed }} / {{ total }}</span
    >
  </div>
  <div v-if="error" class="error-notice" role="alert">
    <span>{{ error }}</span
    ><button aria-label="关闭提示" @click="error = ''">
      <AppIcon name="close" :size="16" />
    </button>
  </div>
  <BatchResults :batch="batch" @retry="run()" />
</template>
