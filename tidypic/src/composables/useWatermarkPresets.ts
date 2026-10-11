import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  type Ref,
} from "vue";
import {
  defaultWatermarkSettings,
  type WatermarkSettings,
} from "../utils/image/watermark/types";
import { validateWatermark } from "../utils/image/watermark/layout";
import { validateName } from "../utils/presets/model";
import {
  applyWatermarkPreset,
  loadWatermarkPresets,
  saveWatermarkPresets,
  presetLogo,
  WATERMARK_PRESET_KEY,
  type WatermarkPreset,
} from "../utils/presets/watermark";
import {
  applyWatermarkStyle,
  type WatermarkStylePreset,
} from "../data/watermarkPresets";
/** Settings-level adapter, reusable by a tool or a workflow step. */
export function useWatermarkPresets(
  settings: Ref<WatermarkSettings>,
  logoFile: Ref<File | undefined>,
) {
  const users = ref<WatermarkPreset[]>([]),
    selected = shallowRef<WatermarkPreset | WatermarkStylePreset>(),
    error = ref("");
  function current() {
    return loadWatermarkPresets(localStorage);
  }
  function reload() {
    try {
      users.value = current();
      error.value = "";
      if (selected.value?.type === "user")
        selected.value = users.value.find((p) => p.id === selected.value!.id);
    } catch {
      error.value = "无法读取本机水印预设，原有数据未被覆盖。";
    }
  }
  function changed(e: StorageEvent) {
    if (e.key === WATERMARK_PRESET_KEY || e.key === null) reload();
  }
  onMounted(() => {
    reload();
    window.addEventListener("storage", changed);
  });
  onBeforeUnmount(() => window.removeEventListener("storage", changed));
  function persist(next: WatermarkPreset[]) {
    try {
      saveWatermarkPresets(localStorage, next);
    } catch (e) {
      throw Error(
        e instanceof Error && e.message.includes("上限")
          ? e.message
          : "无法保存水印预设，请检查浏览器存储空间或权限。",
      );
    }
    users.value = next;
    error.value = "";
  }
  function apply(p: WatermarkPreset) {
    const next = applyWatermarkPreset(p);
    settings.value = next.settings;
    logoFile.value = next.logo;
    selected.value = p;
    error.value = "";
  }
  function applySystem(p: WatermarkStylePreset) {
    settings.value = applyWatermarkStyle(settings.value, p);
    selected.value = p;
    error.value = "";
  }
  function reset() {
    settings.value = defaultWatermarkSettings();
    logoFile.value = undefined;
    selected.value = undefined;
  }
  async function save(name: string) {
    const currentUsers = current(),
      validName = validateName(name, currentUsers);
    const snapshot = { ...settings.value },
      file = logoFile.value;
    validateWatermark(snapshot, !!file);
    const logo =
      snapshot.kind === "image" ? await presetLogo(file!) : undefined;
    const p: WatermarkPreset = {
      id: crypto.randomUUID(),
      name: validName,
      version: 1,
      type: "user",
      createdAt: new Date().toISOString(),
      settings: snapshot,
      ...(logo ? { logo } : {}),
    };
    // Re-read after asynchronous serialization to avoid overwriting another tab's edits.
    const latest = current();
    validateName(validName, latest);
    persist([...latest, p]);
    selected.value = p;
    appliedLogo.value = file;
  }
  function rename(id: string, name: string) {
    const latest = current(),
      valid = validateName(name, latest, id);
    if (!latest.some((p) => p.id === id)) throw Error("这个预设已被删除。");
    persist(latest.map((p) => (p.id === id ? { ...p, name: valid } : p)));
    if (selected.value?.id === id)
      selected.value = users.value.find((p) => p.id === id);
  }
  function remove(id: string) {
    persist(current().filter((p) => p.id !== id));
    if (selected.value?.id === id) selected.value = undefined;
  }
  const label = computed(() => {
    const p = selected.value;
    if (!p) return "选择预设";
    const modified =
      Object.entries(p.settings).some(
        ([key, value]) =>
          settings.value[key as keyof WatermarkSettings] !== value,
      ) ||
      (p.type === "user" &&
        p.settings.kind === "image" &&
        logoFile.value !== appliedLogo.value);
    return p.name + (modified ? " · 已修改" : "");
  });
  const appliedLogo = shallowRef<File>();
  function applyWithLogo(p: WatermarkPreset) {
    apply(p);
    appliedLogo.value = logoFile.value;
  }
  return {
    users,
    selected,
    error,
    label,
    apply: applyWithLogo,
    applySystem,
    reset,
    save,
    rename,
    remove,
  };
}
