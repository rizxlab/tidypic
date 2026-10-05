<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import SortableImageList from "../components/SortableImageList.vue";
import RenameSettingsEditor from "../components/rename/RenameSettingsEditor.vue";
import { renameEntries } from "../processors/images";
import { useRenameFiles } from "../composables/useRenameFiles";
import {
  defaultRenameSettings,
  generateRenamedFiles,
  detectDuplicateNames,
} from "../utils/files/rename";
import { createImageZip, downloadBlob } from "../utils/image/download";
const batch = useRenameFiles(),
  { images, locked, packing, error, inputError } = batch;
const settings = ref(defaultRenameSettings());
const preview = computed(() =>
  generateRenamedFiles(images.value, settings.value),
);
const results = ref<{ id: string; name: string; file: File }[]>([]);
let disposed = false;
const canRun = computed(
  () =>
    !locked.value &&
    images.value.length > 0 &&
    images.value.every((i) => i.format && i.processingStatus !== "failed") &&
    !preview.value.error &&
    !inputError.value &&
    preview.value.entries.some((e) => e.changed),
);
watch(
  () => [images.value.map((i) => [i.id, i.filename, i.format]), settings.value],
  () => {
    results.value = [];
    for (const i of images.value)
      if (i.processingStatus === "done") i.processingStatus = "waiting";
  },
  { deep: true, flush: "sync" },
);
function run() {
  if (!canRun.value) return;
  const entries = renameEntries(images.value, settings.value);
  results.value = entries.map((e) => ({
    id: e.id,
    name: e.name,
    file: images.value.find((i) => i.id === e.id)!.originalFile,
  }));
  images.value.forEach((i) => (i.processingStatus = "done"));
  error.value = "";
  if (results.value.length === 1)
    downloadBlob(results.value[0]!.file, results.value[0]!.name);
}
async function downloadAll() {
  if (locked.value || !results.value.length) return;
  const files = [...results.value];
  if (detectDuplicateNames(files.map((f) => f.name)).size) {
    error.value = "存在重复文件名，请调整命名规则。";
    return;
  }
  packing.value = true;
  error.value = "";
  try {
    if (files.length === 1) downloadBlob(files[0]!.file, files[0]!.name);
    else {
      const zip = await createImageZip(
        files.map((f) => ({ name: f.name, blob: f.file })),
      );
      if (!disposed) downloadBlob(zip, "tidypic-renamed.zip");
    }
  } catch {
    if (!disposed)
      error.value = "打包失败，可能是内存不足。请减少文件数量后重试。";
  } finally {
    packing.value = false;
  }
}
onBeforeUnmount(() => {
  disposed = true;
  results.value = [];
});
</script>
<template>
  <div class="workspace-heading"><h1>批量改名</h1></div>
  <SortableImageList :batch="batch" @retry="batch.retry" />
  <section class="parameter-bar split-settings">
    <h2>改名设置</h2>
    <RenameSettingsEditor v-model="settings" :disabled="locked" />
    <div class="watermark-action">
      <span class="privacy-line" role="status">{{
        preview.error && images.length
          ? preview.error
          : preview.sanitized
            ? "不适用的文件名字符已替换或移除。"
            : ""
      }}</span
      ><button class="primary" :disabled="!canRun" @click="run">
        开始改名
      </button>
    </div>
  </section>
  <p v-if="inputError && images.length" class="error-notice" role="alert">
    {{ inputError }}
  </p>
  <p v-if="error" class="error-notice" role="alert">{{ error }}</p>
  <section v-if="images.length" class="results-panel">
    <div class="list-header">
      <h2>名称预览 · {{ images.length }} 个文件</h2>
    </div>
    <div class="rename-preview-list">
      <div
        v-for="(image, index) in images"
        :key="image.id"
        class="rename-preview-row"
      >
        <span class="rename-old" :title="image.filename">{{
          image.filename
        }}</span
        ><span class="rename-arrow" aria-hidden="true">→</span
        ><span class="rename-new" :title="preview.entries[index]?.name">{{
          preview.entries[index]?.name || "—"
        }}</span>
      </div>
    </div>
  </section>
  <section v-if="results.length" class="results-panel">
    <div class="list-header">
      <h2>改名完成 · {{ results.length }} 个文件</h2>
      <button class="primary" :disabled="locked" @click="downloadAll">
        {{
          packing ? "打包中…" : results.length === 1 ? "下载文件" : "全部下载"
        }}
      </button>
    </div>
    <div class="rename-result-list">
      <div v-for="item in results" :key="item.id" class="result-row">
        <span class="filename" :title="item.name">{{ item.name }}</span>
      </div>
    </div>
  </section>
</template>
