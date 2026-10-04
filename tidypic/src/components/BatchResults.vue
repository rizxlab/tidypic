<script setup lang="ts">
import { computed } from "vue";
import AppIcon from "./AppIcon.vue";
import type { ImageBatch } from "../composables/useImageBatch";
import { formatBytes, formatName } from "../utils/image/browser";
const props = defineProps<{ batch: ImageBatch; disabled?: boolean }>();
const emit = defineEmits<{ retry: [] }>();
const { images, successes, processing, completed, packing, locked } =
  props.batch;
const failed = computed(() =>
  images.value.filter((image) => image.processingStatus === "failed"),
);
</script>
<template>
  <section
    v-if="successes.length || (completed > 0 && images.length)"
    class="results-panel"
    aria-label="处理结果"
  >
    <div class="list-header">
      <h2 aria-live="polite">
        {{
          processing ||
          images.some((image) => image.processingStatus === "waiting")
            ? "已完成"
            : "处理完成"
        }}
        <span class="result-count"
          >{{ successes.length }} / {{ images.length }}</span
        >
      </h2>
      <span v-if="failed.length" class="failure-count"
        >{{ failed.length }} 张失败</span
      >
    </div>
    <div class="result-list" tabindex="0" aria-label="处理结果列表">
      <div v-for="image in successes" :key="image.id" class="result-row">
        <AppIcon name="check" :size="17" />
        <div class="result-info">
          <span class="filename" :title="batch.filename(image)">{{
            batch.filename(image)
          }}</span
          ><span class="result-meta"
            >{{ image.resultWidth }} × {{ image.resultHeight }}
            <span class="meta-separator">·</span>
            {{ formatBytes(image.resultSize!)
            }} · {{ image.resultFormat ? formatName(image.resultFormat) : "" }}<span v-if="image.preservedOriginal" class="preserved"
              >保留原图</span
            ></span
          >
        </div>
        <button
          class="download-one"
          :aria-label="`下载 ${batch.filename(image)}`"
          @click="batch.download(image)"
        >
          <AppIcon name="download" :size="16" />下载
        </button>
      </div>
    </div>
    <p v-if="!successes.length && !processing" class="empty-results">
      没有可下载的图片，请调整参数后重试。
    </p>
    <div class="result-footer">
      <button
        v-if="failed.length"
        class="text-button"
        :disabled="locked || disabled"
        @click="emit('retry')"
      >
        重试未完成图片</button
      ><span v-if="failed.length" class="partial-note">下载仅包含成功图片</span
      ><button
        class="primary download-all"
        :disabled="locked || disabled || !successes.length"
        @click="batch.downloadAll"
      >
        <AppIcon name="download" :size="17" />{{
          packing ? "正在打包…" : images.length === 1 ? "下载图片" : "全部下载"
        }}
      </button>
    </div>
  </section>
</template>
