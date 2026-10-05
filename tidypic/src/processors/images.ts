import { processTransform } from "../utils/image/transform/browser";
import { processImage, ImageError, readImage } from "../utils/image/browser";
import { applyWatermark } from "../utils/image/watermark/draw";
import {
  calculateStitchLayout,
  resolveStitchFormat,
  type StitchSettings,
} from "../utils/image/stitch/geometry";
import { encodeStitchedImage } from "../utils/image/stitch/browser";
import {
  calculateSlices,
  sliceFilename,
  type SplitSettings,
} from "../utils/image/split/geometry";
import { encodeSlice } from "../utils/image/split/browser";
import {
  generateRenamedFiles,
  type RenameSettings,
  type RenameSource,
} from "../utils/files/rename";
import type {
  ImageFormat,
  ImageResult,
  ImageSource,
  OutputSettings,
} from "../utils/image/types";
export const resizeImage = processTransform;
export const watermarkImage = applyWatermark;
export function convertImage(source: ImageSource, settings: OutputSettings) {
  const maxBytes =
    settings.sizeUnit === "none"
      ? undefined
      : Math.floor(
          settings.sizeLimit * (settings.sizeUnit === "MB" ? 1048576 : 1024),
        );
  return processImage(source, {
    ...settings,
    mode: "original",
    format: settings.format === "original" ? source.format : settings.format,
    maxBytes,
  });
}
export function stitchImages(
  files: File[],
  inputs: {
    width: number;
    height: number;
    format?: ImageFormat;
    generated?: boolean;
  }[],
  settings: StitchSettings,
  cancelled = () => false,
) {
  const layout = calculateStitchLayout(inputs, settings);
  const format = resolveStitchFormat(
    inputs.flatMap((i) => (i.format ? [i.format] : [])),
    settings.format,
  );
  return encodeStitchedImage(
    files,
    layout,
    settings,
    format,
    cancelled,
    (file, index) => readImage(file, { generated: inputs[index]?.generated }),
  );
}
export type SplitOptions = SplitSettings & {
  format: ImageFormat | "original";
  guides?: number[];
};
export async function splitImage(
  source: ImageSource,
  name: string,
  settings: SplitOptions,
  cancelled = () => false,
): Promise<(ImageResult & { name: string })[]> {
  const slices = calculateSlices(source.height, settings, settings.guides);
  const format =
    settings.format === "original" ? source.format : settings.format;
  const outputs = [];
  for (let index = 0; index < slices.length; index++) {
    if (cancelled()) throw new ImageError("处理已停止。");
    const result = await encodeSlice(source, slices[index]!, format);
    outputs.push({
      ...result,
      name: sliceFilename(
        name,
        format === "image/jpeg" ? "jpg" : format.split("/")[1]!,
        index,
        slices.length,
      ),
    });
  }
  return outputs;
}
export function renameEntries(input: RenameSource[], settings: RenameSettings) {
  const result = generateRenamedFiles(input, settings);
  if (result.error) throw new ImageError(result.error);
  return result.entries;
}
