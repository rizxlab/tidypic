import { computed, customRef, markRaw, ref, shallowRef } from "vue";
import type { ImageFormat } from "./types";

export interface ImageAsset {
  id: string;
  file: File;
  name: string;
  type: string;
  size: number;
  width: number;
  height: number;
  format?: ImageFormat;
  objectUrl: string;
  previewBlob?: Blob;
  previewObjectUrl?: string;
  status: "reading" | "waiting" | "failed";
  error: string;
}
export type AssetMetadata = Pick<
  ImageAsset,
  | "width"
  | "height"
  | "format"
  | "objectUrl"
  | "previewBlob"
  | "previewObjectUrl"
>;
/** Session sources only. Tool results and settings never belong to this pool. */
export function createImagePool(
  inspect: (file: File) => Promise<AssetMetadata>,
  revoke = (url: string) => URL.revokeObjectURL(url),
) {
  const assets = shallowRef<ImageAsset[]>([]),
    activeId = ref(""),
    loading = ref(false),
    tasks = ref(0);
  const locked = computed(() => loading.value || tasks.value > 0);
  const active = computed(
    () => assets.value.find((a) => a.id === activeId.value) || assets.value[0],
  );
  let disposed = false,
    nextId = 0;
  function release(asset: ImageAsset) {
    if (asset.objectUrl) revoke(asset.objectUrl);
    if (asset.previewObjectUrl) revoke(asset.previewObjectUrl);
  }
  async function add(files: FileList | File[]) {
    if (disposed || locked.value || !files.length) return;
    loading.value = true;
    const added: ImageAsset[] = Array.from(files, (file) => ({
      id: `asset-${++nextId}`,
      file: markRaw(file),
      name: file.name,
      type: file.type,
      size: file.size,
      width: 0,
      height: 0,
      objectUrl: "",
      status: "reading",
      error: "",
    }));
    assets.value = [...assets.value, ...added];
    if (!activeId.value) activeId.value = added[0]!.id;
    try {
      for (const asset of added) {
        if (disposed) break;
        try {
          const metadata = await inspect(asset.file);
          if (disposed) {
            if (metadata.objectUrl) revoke(metadata.objectUrl);
            if (metadata.previewObjectUrl) revoke(metadata.previewObjectUrl);
            break;
          }
          Object.assign(asset, metadata, { status: "waiting" });
        } catch (e) {
          asset.status = "failed";
          asset.error =
            e instanceof Error ? e.message : "无法读取图片，请重试。";
        }
        assets.value = [...assets.value];
      }
    } finally {
      loading.value = false;
    }
  }
  function remove(id: string) {
    if (locked.value) return;
    const asset = assets.value.find((a) => a.id === id);
    if (asset) release(asset);
    assets.value = assets.value.filter((a) => a.id !== id);
    if (activeId.value === id) activeId.value = assets.value[0]?.id || "";
  }
  function clear() {
    if (locked.value) return;
    assets.value.forEach(release);
    assets.value = [];
    activeId.value = "";
  }
  function reorder(ids: string[]) {
    if (
      locked.value ||
      ids.length !== assets.value.length ||
      new Set(ids).size !== ids.length
    )
      return;
    const byId = new Map(assets.value.map((a) => [a.id, a]));
    if (ids.every((id) => byId.has(id)))
      assets.value = ids.map((id) => byId.get(id)!);
  }
  function dispose() {
    disposed = true;
    assets.value.forEach(release);
    assets.value = [];
    activeId.value = "";
  }
  return {
    assets,
    activeId,
    active,
    loading,
    locked,
    tasks,
    add,
    remove,
    clear,
    reorder,
    dispose,
  };
}
export type ImageWorkspace = ReturnType<typeof createImagePool>;

/** A task keeps its lease until its finally block, even if its page unmounts. */
export function workspaceTaskFlag(workspace: Pick<ImageWorkspace, "tasks">) {
  return customRef<boolean>((track, trigger) => {
    let value = false;
    return {
      get() {
        track();
        return value;
      },
      set(next) {
        if (next === value) return;
        value = next;
        workspace.tasks.value += next ? 1 : -1;
        trigger();
      },
    };
  });
}
