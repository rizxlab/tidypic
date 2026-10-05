import { readImage, ImageError } from "../utils/image/browser";
import { outputFilename } from "../utils/image/names";
import type { ImageResult } from "../utils/image/types";
import type { RuntimeImage, StepProcessor } from "../utils/workflow/runtime";
import {
  resizeImage,
  convertImage,
  watermarkImage,
  stitchImages,
  splitImage,
  renameEntries,
} from "./images";
function output(result: ImageResult, name: string): RuntimeImage {
  const filename = outputFilename(name, result.format);
  return {
    file: new File([result.blob], filename, { type: result.format }),
    name: filename,
    width: result.width,
    height: result.height,
    format: result.format,
    generated: true,
  };
}
export function logoFile(dataUrl: string) {
  const [header, data] = dataUrl.split(",");
  const type = header!.slice(5).split(";")[0]!;
  const bytes = Uint8Array.from(atob(data!), (c) => c.charCodeAt(0));
  return new File([bytes], "watermark", { type });
}
export const processWorkflowStep: StepProcessor = async (
  input,
  step,
  cancelled,
) => {
  if (step.type === "rename") {
    const names = renameEntries(
      input.map((i, index) => ({ id: String(index), filename: i.name })),
      step.settings,
    );
    return input.map((i, index) => ({ ...i, name: names[index]!.name }));
  }
  if (step.type === "join")
    return [
      output(
        await stitchImages(
          input.map((i) => i.file),
          input,
          step.settings,
          cancelled,
        ),
        "tidypic-stitched.png",
      ),
    ];
  let logo: Awaited<ReturnType<typeof readImage>> | undefined;
  const outputs: RuntimeImage[] = [];
  try {
    if (
      step.type === "watermark" &&
      step.settings.kind === "image" &&
      step.settings.logoDataUrl
    )
      logo = await readImage(logoFile(step.settings.logoDataUrl));
    for (const image of input) {
      if (cancelled()) throw new ImageError("处理已停止。");
      const source = await readImage(image.file, {
        generated: image.generated,
      });
      try {
        if (step.type === "split") {
          const parts = await splitImage(
            source,
            image.name,
            step.settings,
            cancelled,
          );
          outputs.push(...parts.map((part) => output(part, part.name)));
        } else {
          const result =
            step.type === "resize"
              ? await resizeImage(source, step.settings)
              : step.type === "convert"
                ? await convertImage(source, step.settings)
                : await watermarkImage(source, step.settings, logo?.bitmap);
          outputs.push(output(result, image.name));
        }
      } finally {
        source.bitmap.close();
      }
    }
    return outputs;
  } finally {
    logo?.bitmap.close();
  }
};
