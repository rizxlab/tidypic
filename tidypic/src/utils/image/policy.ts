import { dimensions } from "./geometry.ts";
import type { ProcessOptions } from "./types.ts";
export function canKeepOriginal(
  source: { width: number; height: number; format: string; size: number },
  options: ProcessOptions,
) {
  const output = dimensions(source.width, source.height, options);
  return (
    output.width === source.width &&
    output.height === source.height &&
    options.format === source.format &&
    (options.maxBytes === undefined || source.size <= options.maxBytes)
  );
}
