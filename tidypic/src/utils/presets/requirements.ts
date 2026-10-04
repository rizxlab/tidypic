import type { ImagePreset } from "./model.ts";

/** Advisory checks only: never alter processing settings or block a batch. */
export function validateRequirements(
  output: { width: number; height: number },
  requirements?: ImagePreset["requirements"],
): string[] {
  if (!requirements) return [];
  const warnings: string[] = [];
  if (
    requirements.minWidth !== undefined &&
    output.width < requirements.minWidth
  )
    warnings.push(
      `图片宽度低于 ${requirements.minWidth}px，可能不符合平台要求`,
    );
  if (
    requirements.maxWidth !== undefined &&
    output.width > requirements.maxWidth
  )
    warnings.push(
      `图片宽度超过 ${requirements.maxWidth}px，可能不符合平台要求`,
    );
  if (
    requirements.maxHeight !== undefined &&
    output.height > requirements.maxHeight
  )
    warnings.push(
      `图片高度超过 ${requirements.maxHeight}px，可能不符合平台要求`,
    );
  return warnings;
}
