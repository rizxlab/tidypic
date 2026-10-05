<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import ImageUploadList from "../components/ImageUploadList.vue";
import WorkflowStepEditor from "../components/WorkflowStepEditor.vue";
import AppIcon from "../components/AppIcon.vue";
import { useImageBatch } from "../composables/useImageBatch";
import { usePointerSort } from "../composables/usePointerSort";
import { toolDefinitions, type ToolId } from "../data/tools";
import {
  defaultStep,
  moveStep,
  planWorkflow,
  stepSummary,
  type Workflow,
  type WorkflowStep,
} from "../utils/workflow/model";
import {
  loadWorkflows,
  saveWorkflows,
  WORKFLOW_STORAGE_KEY,
} from "../utils/workflow/storage";
import {
  runWorkflow,
  type RuntimeImage,
  type StepState,
} from "../utils/workflow/runtime";
import { processWorkflowStep } from "../processors/workflow";
import {
  createThumbnail,
  readImage,
  formatBytes,
  formatName,
} from "../utils/image/browser";
import { createImageZip, downloadBlob } from "../utils/image/download";
import { validateName } from "../utils/presets/model";
const batch = useImageBatch(),
  { images, locked, processing, packing, error } = batch;
const steps = ref<WorkflowStep[]>([]),
  opened = ref(""),
  adding = ref(false),
  editorBusy = ref(false);
const saved = ref<Workflow[]>([]),
  chosen = ref(""),
  saveName = ref(""),
  saving = ref(false),
  storageError = ref("");
const list = ref<HTMLElement>();
const states = ref<StepState[]>([]),
  outputs = ref<(RuntimeImage & { url: string })[]>([]);
let disposed = false;
const busy = computed(() => locked.value || editorBusy.value);
const input = computed<RuntimeImage[]>(() =>
  images.value.flatMap((i) =>
    i.format && i.width
      ? [
          {
            file: i.originalFile,
            name: i.filename,
            width: i.width,
            height: i.height,
            format: i.format,
          },
        ]
      : [],
  ),
);
const plan = computed(() => planWorkflow(input.value, steps.value));
const canRun = computed(
  () =>
    !busy.value &&
    input.value.length === images.value.length &&
    plan.value.valid,
);
function clearOutputs() {
  outputs.value.forEach((i) => URL.revokeObjectURL(i.url));
  outputs.value = [];
}
function reset() {
  if (processing.value) return;
  clearOutputs();
  states.value = [];
  error.value = "";
}
watch(
  () => [steps.value, images.value.map((i) => [i.id, i.width, i.height])],
  reset,
  { deep: true },
);
function add(type: ToolId) {
  if (busy.value) return;
  if (steps.value.length >= 50) {
    error.value = "最多添加 50 个步骤。";
    return;
  }
  const step = defaultStep(type);
  steps.value.push(step);
  opened.value = step.id;
  adding.value = false;
}
function move(id: string, index: number) {
  if (!busy.value) steps.value = moveStep(steps.value, id, index);
}
const { dragging, start } = usePointerSort(
  list,
  ".workflow-row",
  (id, row) =>
    move(
      id,
      steps.value.findIndex((s) => s.id === row.dataset.stepId),
    ),
  () => busy.value,
);
function remove(id: string) {
  if (!busy.value) steps.value = steps.value.filter((s) => s.id !== id);
}
function reloadSaved() {
  try {
    saved.value = loadWorkflows(localStorage);
    storageError.value = "";
  } catch (e) {
    storageError.value =
      e instanceof Error ? e.message : "无法读取我的工具流。";
  }
}
function load() {
  if (busy.value) return;
  const workflow = saved.value.find((w) => w.id === chosen.value);
  if (!workflow) return;
  steps.value = JSON.parse(JSON.stringify(workflow.steps));
  saveName.value = workflow.name;
  opened.value = "";
}
function save() {
  try {
    const current = loadWorkflows(localStorage);
    const name = validateName(
      saveName.value,
      current,
      chosen.value || undefined,
    );
    const old = current.find((w) => w.id === chosen.value),
      now = new Date().toISOString();
    const workflow: Workflow = {
      id: old?.id || crypto.randomUUID(),
      name,
      version: 1,
      createdAt: old?.createdAt || now,
      updatedAt: now,
      steps: JSON.parse(JSON.stringify(steps.value)),
    };
    const next = [...current.filter((w) => w.id !== workflow.id), workflow];
    saveWorkflows(localStorage, next);
    saved.value = next;
    chosen.value = workflow.id;
    saving.value = false;
    storageError.value = "";
  } catch (e) {
    storageError.value =
      e instanceof DOMException
        ? "无法保存，请检查浏览器存储空间或权限。"
        : e instanceof Error
          ? e.message.replace(/预设/g, "工具流")
          : "无法保存工具流。";
  }
}
function storageChanged(event: StorageEvent) {
  if (event.key === WORKFLOW_STORAGE_KEY || event.key === null) reloadSaved();
}
onMounted(() => {
  reloadSaved();
  window.addEventListener("storage", storageChanged);
});
async function run() {
  if (!canRun.value) return;
  clearOutputs();
  error.value = "";
  processing.value = true;
  const snapshot = JSON.parse(JSON.stringify(steps.value)) as WorkflowStep[];
  const ready: (RuntimeImage & { url: string })[] = [];
  try {
    const outcome = await runWorkflow(
      input.value,
      snapshot,
      processWorkflowStep,
      (next) => {
        if (!disposed) states.value = next;
      },
      () => disposed,
    );
    for (const image of outcome.images) {
      if (disposed) return;
      const source = await readImage(image.file, { generated: image.generated });
      try {
        const thumbnail = await createThumbnail(source);
        if (disposed) return;
        ready.push({ ...image, url: URL.createObjectURL(thumbnail) });
      } finally {
        source.bitmap.close();
      }
    }
    if (!disposed) {
      outputs.value = ready;
    }
  } catch (e) {
    ready.forEach((i) => URL.revokeObjectURL(i.url));
    ready.length = 0;
    if (!disposed)
      error.value = e instanceof Error ? e.message : "工具流处理失败。";
  } finally {
    if (disposed) ready.forEach((i) => URL.revokeObjectURL(i.url));
    processing.value = false;
  }
}
async function downloadAll() {
  if (busy.value || !outputs.value.length) return;
  const files = [...outputs.value];
  if (files.length === 1) {
    downloadBlob(files[0]!.file, files[0]!.name);
    return;
  }
  packing.value = true;
  try {
    const zip = await createImageZip(
      files.map((i) => ({ name: i.name, blob: i.file })),
    );
    if (!disposed) downloadBlob(zip, "tidypic-workflow.zip");
  } catch {
    error.value = "打包失败，请逐张下载或减少图片数量。";
  } finally {
    packing.value = false;
  }
}
onBeforeUnmount(() => {
  disposed = true;
  clearOutputs();
  window.removeEventListener("storage", storageChanged);
});
const groups = [
  { id: "image", name: "图片处理" },
  { id: "structure", name: "结构处理" },
  { id: "file", name: "文件处理" },
];
function status(id: string) {
  return states.value.find((s) => s.id === id);
}
</script>
<template>
  <div class="workspace-heading">
    <h1>自定义工具流</h1>
    <span v-if="images.length" class="heading-count"
      >输入 {{ images.length }} 张图片</span
    >
  </div>
  <ImageUploadList :batch="batch" :disabled="editorBusy" />
  <section class="workflow-section" aria-label="工具流步骤">
    <div class="workflow-toolbar">
      <select
        v-model="chosen"
        :disabled="busy"
        aria-label="我的工具流"
        @change="load"
      >
        <option value="">我的工具流</option>
        <option v-for="w in saved" :key="w.id" :value="w.id">
          {{ w.name }}
        </option>
      </select>
      <button
        class="text-button"
        :disabled="busy || !steps.length"
        @click="saving = !saving"
      >
        保存当前工具流
      </button>
      <button
        v-if="chosen"
        class="text-button"
        :disabled="busy"
        @click="
          chosen = '';
          saveName = '';
        "
      >
        另存为
      </button>
    </div>
    <form v-if="saving" class="workflow-save" @submit.prevent="save">
      <label class="wm-field"
        >工具流名称<input
          v-model="saveName"
          maxlength="30"
          aria-label="工具流名称"
          :disabled="busy"
      /></label>
      <button class="secondary small" :disabled="busy">保存</button
      ><button type="button" class="text-button" @click="saving = false">
        取消
      </button>
    </form>
    <p v-if="storageError" class="row-error" role="alert">{{ storageError }}</p>
    <div ref="list" class="workflow-list">
      <div
        v-for="(step, index) in steps"
        :key="step.id"
        class="workflow-row"
        :class="{ 'is-dragging': dragging === step.id }"
        :data-step-id="step.id"
      >
        <div class="workflow-step-heading">
          <span
            class="workflow-number"
            :data-status="status(step.id)?.status"
            >{{
              status(step.id)?.status === "success"
                ? "✓"
                : status(step.id)?.status === "error"
                  ? "×"
                  : status(step.id)?.status === "processing"
                    ? "●"
                    : index + 1
            }}</span
          >
          <button
            class="workflow-step-title"
            :disabled="busy"
            :aria-expanded="opened === step.id"
            @click="opened = opened === step.id ? '' : step.id"
          >
            <strong>{{ toolDefinitions[step.type].name }}</strong
            ><small>{{ stepSummary(step) }}</small>
          </button>
          <button
            class="icon-button workflow-drag"
            :disabled="busy"
            :aria-label="`拖动排序步骤 ${index + 1}`"
            @pointerdown.prevent="start($event, step.id)"
            @keydown.up.prevent="move(step.id, index - 1)"
            @keydown.down.prevent="move(step.id, index + 1)"
          >
            ≡
          </button>
          <button
            class="icon-button"
            :disabled="busy"
            :aria-label="`删除步骤 ${index + 1}`"
            @click="remove(step.id)"
          >
            <AppIcon name="close" :size="16" />
          </button>
        </div>
        <p
          v-if="status(step.id)?.error || plan.states[index]?.error"
          class="row-error"
          role="alert"
        >
          {{ status(step.id)?.error || plan.states[index]?.error }}
        </p>
        <p
          v-else-if="status(step.id)?.status === 'success'"
          class="field-note workflow-count"
        >
          {{ status(step.id)?.inputCount }} →
          {{ status(step.id)?.outputCount }} 张 ·
          {{ Math.round(status(step.id)!.elapsedMs) }} ms
        </p>
        <p
          v-else-if="plan.states[index]?.inputCount"
          class="field-note workflow-count"
        >
          {{ plan.states[index]?.inputCount }} →
          {{ plan.states[index]?.outputCount }} 张
        </p>
        <WorkflowStepEditor
          v-if="opened === step.id"
          v-model="steps[index]!"
          :disabled="locked"
          @busy="editorBusy = $event"
        />
      </div>
    </div>
    <p v-if="!steps.length" class="field-note workflow-empty">
      添加步骤，按顺序处理当前图片。
    </p>
    <button
      class="text-button add-step"
      :disabled="busy"
      :aria-expanded="adding"
      @click="adding = !adding"
    >
      ＋ 添加步骤
    </button>
    <div
      v-if="adding"
      class="workflow-add-panel"
      role="dialog"
      aria-label="添加步骤"
      @keydown.esc="adding = false"
    >
      <div v-for="group in groups" :key="group.id">
        <h3>{{ group.name }}</h3>
        <button
          v-for="tool in Object.values(toolDefinitions).filter(
            (t) => t.group === group.id,
          )"
          :key="tool.id"
          class="text-button"
          @click="add(tool.id as ToolId)"
        >
          <AppIcon :name="tool.icon" :size="17" />{{ tool.name }}
        </button>
      </div>
      <button class="text-button" @click="adding = false">关闭</button>
    </div>
    <div class="workflow-action">
      <button class="primary" :disabled="!canRun" @click="run">
        {{ processing ? "正在处理…" : "开始处理"
        }}<AppIcon name="arrow" :size="17" />
      </button>
    </div>
  </section>
  <p v-if="error" class="error-notice" role="alert">{{ error }}</p>
  <section v-if="outputs.length" class="results-panel" aria-label="工具流结果">
    <div class="list-header">
      <h2>完成 · {{ outputs.length }} 张</h2>
      <button class="primary small" :disabled="busy" @click="downloadAll">
        {{
          packing
            ? "打包中…"
            : outputs.length === 1
              ? "下载图片"
              : "下载全部 ZIP"
        }}
      </button>
    </div>
    <div v-for="output in outputs" :key="output.url" class="result-row">
      <div class="thumbnail"><img :src="output.url" alt="" /></div>
      <div class="result-info">
        <span class="filename">{{ output.name }}</span
        ><span class="result-meta"
          >{{ output.width }} × {{ output.height }} ·
          {{ formatName(output.format) }} ·
          {{ formatBytes(output.file.size) }}</span
        >
      </div>
      <button
        class="download-one"
        :disabled="busy"
        @click="downloadBlob(output.file, output.name)"
      >
        下载
      </button>
    </div>
  </section>
</template>
