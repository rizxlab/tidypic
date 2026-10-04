import { computed, onBeforeUnmount, onMounted, ref, type Ref } from "vue";
import type { TransformSettings } from "../utils/image/transform/geometry";
import { defaultSettings } from "../utils/image/transform/geometry";
import {
  applyPreset,
  cropNeedsReset,
  presetModified,
  settingsSnapshot,
  validateName,
  type ImagePreset,
} from "../utils/presets/model";
import {
  loadPresets,
  savePresets,
  PRESET_STORAGE_KEY,
} from "../utils/presets/storage";
export function useImagePresets(
  settings: Ref<TransformSettings>,
  resetCrop: () => void,
) {
  const users = ref<ImagePreset[]>([]),
    selected = ref<ImagePreset>(),
    error = ref(""),
    storageReady = ref(false);
  function currentUsers() {
    try {
      return loadPresets(localStorage);
    } catch {
      throw new Error("无法读取本机预设，原有数据未被覆盖。");
    }
  }
  function reload() {
    try {
      users.value = currentUsers();
      storageReady.value = true;
      error.value = "";
      if (selected.value?.type === "user")
        selected.value = users.value.find((p) => p.id === selected.value!.id);
    } catch {
      storageReady.value = false;
      error.value = "无法读取本机预设，原有数据未被覆盖。";
    }
  }
  function changed(e: StorageEvent) {
    if (e.key === PRESET_STORAGE_KEY || e.key === null) reload();
  }
  onMounted(() => {
    reload();
    window.addEventListener("storage", changed);
  });
  onBeforeUnmount(() => window.removeEventListener("storage", changed));
  function assign(next: TransformSettings) {
    if (cropNeedsReset(settings.value, next)) resetCrop();
    if (
      Object.entries(next).some(
        ([key, value]) =>
          settings.value[key as keyof TransformSettings] !== value,
      )
    )
      settings.value = next;
  }
  function apply(p: ImagePreset) {
    try {
      assign(applyPreset(settings.value, p));
      selected.value = p;
      error.value = "";
    } catch (e) {
      error.value = (e as Error).message;
    }
  }
  function reset() {
    assign(defaultSettings());
    selected.value = undefined;
  }
  function persist(next: ImagePreset[]) {
    if (!storageReady.value) throw new Error("本机预设存储不可用，未保存。");
    try {
      savePresets(localStorage, next);
    } catch {
      throw new Error("无法保存预设，请检查浏览器存储空间或权限。");
    }
    users.value = next;
    error.value = "";
  }
  function save(name: string) {
    const current = currentUsers();
    const p: ImagePreset = {
      id: crypto.randomUUID(),
      name: validateName(name, current),
      type: "user",
      settings: settingsSnapshot(settings.value),
      createdAt: new Date().toISOString(),
    };
    persist([...current, p]);
    selected.value = p;
  }
  function rename(id: string, name: string) {
    const current = currentUsers(),
      valid = validateName(name, current, id);
    if (!current.some((p) => p.id === id))
      throw new Error("这个预设已被删除。");
    persist(current.map((p) => (p.id === id ? { ...p, name: valid } : p)));
    if (selected.value?.id === id)
      selected.value = users.value.find((p) => p.id === id);
  }
  function remove(id: string) {
    persist(currentUsers().filter((p) => p.id !== id));
    if (selected.value?.id === id) selected.value = undefined;
  }
  const label = computed(() =>
    selected.value
      ? `${selected.value.platform ? (selected.value.platformName || selected.value.platform) + " · " : ""}${selected.value.name}${presetModified(settings.value, selected.value) ? " · 已修改" : ""}`
      : "选择预设",
  );
  return { users, selected, error, label, apply, reset, save, rename, remove };
}
export type ImagePresets = ReturnType<typeof useImagePresets>;
