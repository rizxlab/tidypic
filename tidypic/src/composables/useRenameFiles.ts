import { useImageBatch } from "./useImageBatch";
export function useRenameFiles() {
  const batch = useImageBatch("tidypic-renamed.zip", "rename");
  return {
    ...batch,
    retry: (image: import("../utils/image/types").ImageJob) =>
      batch.runWithProcessor(
        async (source) => ({
          blob: source.file,
          width: source.width,
          height: source.height,
          format: source.format,
          preservedOriginal: true,
        }),
        image,
      ),
  };
}
