import { inject, onBeforeUnmount, provide, type InjectionKey } from "vue";
import { createImagePool, type ImageWorkspace } from "../utils/image/pool";
import {
  createThumbnail,
  friendlyError,
  readImage,
} from "../utils/image/browser";
const workspaceKey: InjectionKey<ImageWorkspace> = Symbol("image-workspace");
export function createImageWorkspace() {
  return createImagePool(async (file) => {
    let source: Awaited<ReturnType<typeof readImage>> | undefined;
    const urls: string[] = [];
    try {
      source = await readImage(file);
      const thumbnail = await createThumbnail(source);
      const previewBlob = await createThumbnail(source, 1200);
      urls.push(URL.createObjectURL(thumbnail));
      urls.push(URL.createObjectURL(previewBlob));
      return {
        width: source.width,
        height: source.height,
        format: source.format,
        objectUrl: urls[0]!,
        previewBlob,
        previewObjectUrl: urls[1]!,
      };
    } catch (e) {
      urls.forEach((url) => URL.revokeObjectURL(url));
      throw new Error(friendlyError(e));
    } finally {
      source?.bitmap.close();
    }
  });
}
export function provideImageWorkspace() {
  const workspace = createImageWorkspace();
  provide(workspaceKey, workspace);
  onBeforeUnmount(workspace.dispose);
  return workspace;
}
export function useImageWorkspace() {
  const shared = inject(workspaceKey, undefined);
  if (shared) return shared;
  // Standalone component fixtures own their isolated workspace.
  const own = createImageWorkspace();
  onBeforeUnmount(own.dispose);
  return own;
}
