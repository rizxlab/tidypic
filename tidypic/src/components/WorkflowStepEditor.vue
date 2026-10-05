<script setup lang="ts">
import { computed, ref } from "vue";
import ResizeParameters from "./resize/ResizeParameters.vue";
import ParameterBar from "./ParameterBar.vue";
import WatermarkContent from "./watermark/WatermarkContent.vue";
import WatermarkParameterBar from "./watermark/WatermarkParameterBar.vue";
import StitchParameterBar from "./stitch/StitchParameterBar.vue";
import SplitParameterBar from "./split/SplitParameterBar.vue";
import RenameSettingsEditor from "./rename/RenameSettingsEditor.vue";
import { useImagePresets } from "../composables/useImagePresets";
import {
  defaultSettings,
  validateSettings,
} from "../utils/image/transform/geometry";
import { readImage, friendlyError } from "../utils/image/browser";
import type { WorkflowStep } from "../utils/workflow/model";
const model = defineModel<WorkflowStep>({ required: true });
defineProps<{ disabled: boolean }>();
const resizeSettings = computed({
  get: () =>
    model.value.type === "resize" ? model.value.settings : defaultSettings(),
  set: (value) => {
    if (model.value.type === "resize") model.value.settings = value;
  },
});
const resizeInvalid = computed(() => {
  try {
    validateSettings(resizeSettings.value);
    return false;
  } catch {
    return true;
  }
});
const presets = useImagePresets(resizeSettings, () => {});
const logoError = ref(""),
  logoLoading = ref(false);
const emit = defineEmits<{ busy: [value: boolean] }>();
async function uploadLogo(file: File) {
  logoLoading.value = true;
  emit("busy", true);
  logoError.value = "";
  let source: Awaited<ReturnType<typeof readImage>> | undefined;
  try {
    source = await readImage(file);
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(new Blob([file], { type: source!.format }));
    });
    if (model.value.type === "watermark")
      model.value.settings.logoDataUrl = url;
  } catch (e) {
    logoError.value = friendlyError(e);
  } finally {
    source?.bitmap.close();
    logoLoading.value = false;
    emit("busy", false);
  }
}
const guideText = computed({
  get: () =>
    model.value.type === "split"
      ? (model.value.settings.guides || []).join(", ")
      : "",
  set: (value) => {
    if (model.value.type === "split")
      model.value.settings.guides = value.trim()
        ? value.split(/[,，\s]+/).map(Number)
        : [];
  },
});
</script>
<template>
  <div class="workflow-editor">
    <ResizeParameters
      v-if="model.type === 'resize'"
      v-model="resizeSettings"
      :presets="presets"
      user-only
      embedded
      :invalid="resizeInvalid"
      :disabled="disabled"
      :can-run="false"
      action-label=""
    />
    <ParameterBar
      v-else-if="model.type === 'convert'"
      v-model="model.settings"
      :resize="false"
      embedded
      :disabled="disabled"
      :can-run="false"
      action-label=""
    />
    <template v-else-if="model.type === 'watermark'">
      <WatermarkContent
        v-model="model.settings"
        :disabled="disabled || logoLoading"
        @logo="uploadLogo"
      />
      <p
        v-if="model.settings.kind === 'image' && model.settings.logoDataUrl"
        class="field-note"
      >
        水印图片已载入，随工具流保存在本机。
      </p>
      <p v-if="logoError" class="row-error" role="alert">{{ logoError }}</p>
      <WatermarkParameterBar
        v-model="model.settings"
        :disabled="disabled || logoLoading"
        @layout="model.settings.layout = $event"
      />
    </template>
    <StitchParameterBar
      v-else-if="model.type === 'join'"
      v-model="model.settings"
      :disabled="disabled"
      :mixed="false"
      :resolved-format="
        model.settings.format === 'original'
          ? 'image/png'
          : model.settings.format
      "
    />
    <template v-else-if="model.type === 'split'">
      <SplitParameterBar v-model="model.settings" :disabled="disabled" />
      <label v-if="model.settings.mode === 'guides'" class="wm-field"
        >切线位置（px，以逗号分隔）<input
          v-model="guideText"
          :disabled="disabled"
          aria-label="切线位置"
          placeholder="例如 1200, 2400"
      /></label>
    </template>
    <RenameSettingsEditor
      v-else-if="model.type === 'rename'"
      v-model="model.settings"
      :disabled="disabled"
    />
  </div>
</template>
