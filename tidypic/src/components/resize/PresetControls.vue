<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import type { ImagePresets } from "../../composables/useImagePresets";
import type { ImagePreset } from "../../utils/presets/model";
import { commonPresets } from "../../data/presets/common";
import {
  visiblePlatformPresets,
  platformGroups,
} from "../../data/presets/platform";
import AppIcon from "../AppIcon.vue";
const props = defineProps<{
  presets: ImagePresets;
  userOnly?: boolean;
  disabled: boolean;
  invalid: boolean;
}>();
const emit = defineEmits<{ opening: [] }>();
const { users, label, error } = props.presets;
const root = ref<HTMLElement>(),
  trigger = ref<HTMLButtonElement>(),
  dialog = ref<HTMLDialogElement>(),
  nameInput = ref<HTMLInputElement>();
const opened = ref(false),
  platform = ref(""),
  manage = ref(""),
  action = ref<"save" | "rename" | "delete">("save"),
  target = ref<ImagePreset>(),
  name = ref(""),
  dialogError = ref("");
const platforms = computed(() => platformGroups());
const platformLabel = computed(
  () =>
    platforms.value.find((p) => p.id === platform.value)?.name ||
    platform.value,
);
const scenes = computed(() =>
  visiblePlatformPresets().filter((p) => p.platform === platform.value),
);
let overflow: string | undefined;
function close(focus = false) {
  opened.value = false;
  manage.value = "";
  if (focus) trigger.value?.focus();
}
async function toggle() {
  if (opened.value) {
    close();
    return;
  }
  emit("opening");
  platform.value = "";
  opened.value = true;
  await nextTick();
  root.value?.querySelector<HTMLElement>(".preset-panel button")?.focus();
}
function outside(e: PointerEvent) {
  if (!root.value?.contains(e.target as Node)) close();
}
function escape(e: KeyboardEvent) {
  if (e.key === "Escape" && opened.value && !dialog.value?.open) {
    e.stopPropagation();
    close(true);
  }
}
function apply(p: ImagePreset) {
  props.presets.apply(p);
  close(true);
}
async function edit(kind: typeof action.value, p?: ImagePreset) {
  close();
  emit("opening");
  action.value = kind;
  target.value = p;
  name.value = kind === "rename" ? p!.name : "";
  dialogError.value = "";
  await nextTick();
  overflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  dialog.value?.showModal();
  if (kind !== "delete") nameInput.value?.focus();
}
function dismiss() {
  dialog.value?.close();
  if (overflow !== undefined) {
    document.body.style.overflow = overflow;
    overflow = undefined;
  }
}
function submit() {
  try {
    if (action.value === "save") props.presets.save(name.value);
    else if (action.value === "rename")
      props.presets.rename(target.value!.id, name.value);
    else props.presets.remove(target.value!.id);
    dismiss();
  } catch (e) {
    dialogError.value =
      e instanceof Error ? e.message : "无法保存预设，请稍后重试。";
  }
}
onMounted(() => {
  document.addEventListener("pointerdown", outside);
  document.addEventListener("keydown", escape);
});
onBeforeUnmount(() => {
  dismiss();
  document.removeEventListener("pointerdown", outside);
  document.removeEventListener("keydown", escape);
});
defineExpose({ close });
</script>
<template>
  <div ref="root" class="preset-controls">
    <button
      ref="trigger"
      class="parameter-button preset-trigger"
      :disabled="disabled"
      :aria-expanded="opened"
      :title="label"
      @click="toggle"
    >
      <span>{{ label }}</span
      ><AppIcon name="chevron" :size="14" />
    </button>
    <button
      class="text-button"
      :disabled="disabled || invalid"
      @click="edit('save')"
    >
      保存当前设置
    </button>
    <div
      v-if="opened"
      class="parameter-popover preset-panel"
      role="dialog"
      aria-label="选择预设"
    >
      <div class="popover-title">
        <button v-if="platform" class="text-button" @click="platform = ''">
          ‹ {{ platformLabel }}</button
        ><strong v-else>选择预设</strong
        ><button aria-label="关闭预设选择器" @click="close(true)">×</button>
      </div>
      <template v-if="!platform">
        <template v-if="!userOnly">
          <h3>常用预设</h3>
          <button
            v-for="p in commonPresets"
            :key="p.id"
            class="preset-option"
            @click="apply(p)"
          >
            <span>{{ p.name }}</span
            ><small>{{ p.summary }}</small>
          </button>
          <h3>电商平台</h3>
          <button
            v-for="p in platforms"
            :key="p.id"
            class="preset-option"
            @click="platform = p.id"
          >
            <span>{{ p.name }}</span
            ><span>›</span>
          </button>
          <p v-if="!platforms.length" class="field-note">
            暂无已核实的官方预设
          </p>
        </template>
        <h3>我的预设</h3>
        <p v-if="!users.length" class="field-note">尚未保存预设</p>
        <div v-for="p in users" :key="p.id" class="user-preset-row">
          <button class="preset-option" :title="p.name" @click="apply(p)">
            <span>{{ p.name }}</span></button
          ><button
            class="icon-button"
            :aria-label="`管理 ${p.name}`"
            :aria-expanded="manage === p.id"
            @click="manage = manage === p.id ? '' : p.id"
          >
            ⋯
          </button>
          <div v-if="manage === p.id" class="preset-manage">
            <button class="text-button" @click="edit('rename', p)">
              重命名</button
            ><button class="text-button" @click="edit('delete', p)">
              删除
            </button>
          </div>
        </div>
        <button
          class="text-button preset-footer"
          :disabled="invalid"
          @click="edit('save')"
        >
          ＋ 保存当前设置</button
        ><button
          class="text-button preset-footer"
          @click="
            presets.reset();
            close(true);
          "
        >
          恢复默认设置
        </button>
      </template>
      <template v-else
        ><h3>商品图片</h3>
        <div v-for="p in scenes" :key="p.id">
          <button class="preset-option" @click="apply(p)">
            <span>{{ p.name }}</span
            ><small>{{ p.summary }}</small>
          </button>
          <details class="preset-details">
            <summary>查看依据</summary>
            <template v-if="p.requirements">
              <p v-if="p.requirements.recommendedSize">
                建议尺寸：{{ p.requirements.recommendedSize.width }} ×
                {{ p.requirements.recommendedSize.height }}px
              </p>
              <p v-if="p.requirements.minimumSize">
                最低尺寸：{{ p.requirements.minimumSize.width }} ×
                {{ p.requirements.minimumSize.height }}px
              </p>
              <p v-if="p.requirements.ratio">
                比例：{{ p.requirements.ratio }}
              </p>
              <p v-if="p.requirements.note">{{ p.requirements.note }}</p>
            </template>
            <p v-for="rule in p.rules">
              {{
                {
                  required: "要求",
                  recommended: "建议",
                  minimum: "最低",
                  maximum: "最高",
                }[rule.kind]
              }}：{{ rule.text }}
            </p>
            <p v-if="p.source">
              来源：<a
                :href="p.source.url"
                target="_blank"
                rel="noopener noreferrer"
                >{{ p.source.label }}</a
              ><br />核实：{{ p.source.checkedAt }}
            </p>
          </details>
        </div></template
      >
    </div>
    <p v-if="error" class="row-error" role="alert">{{ error }}</p>
    <Teleport to="body"
      ><dialog
        ref="dialog"
        class="preset-dialog"
        :aria-label="
          action === 'save'
            ? '保存为预设'
            : action === 'rename'
              ? '重命名预设'
              : '删除预设'
        "
        @cancel.prevent="dismiss"
        @click.self="dismiss"
      >
        <form @submit.prevent="submit">
          <h2>
            {{
              action === "save"
                ? "保存为预设"
                : action === "rename"
                  ? "重命名预设"
                  : "删除预设"
            }}
          </h2>
          <p v-if="action === 'delete'" class="preset-delete-name">
            删除“{{ target?.name }}”？
          </p>
          <label v-else class="wm-field"
            >预设名称<input
              ref="nameInput"
              v-model="name"
              aria-label="预设名称"
              placeholder="最多 30 个字符"
          /></label>
          <p v-if="dialogError" class="row-error" role="alert">
            {{ dialogError }}
          </p>
          <div class="preset-dialog-actions">
            <button type="button" class="secondary" @click="dismiss">
              取消</button
            ><button type="submit" class="primary">
              {{ action === "delete" ? "删除" : "保存" }}
            </button>
          </div>
        </form>
      </dialog></Teleport
    >
  </div>
</template>
