import {
  toolDefinitions,
  inputCountError,
  type ToolId,
} from "../../data/tools.ts";
import {
  defaultSettings,
  calculateTransform,
  validateSettings,
  type TransformSettings,
} from "../image/transform/geometry.ts";
import {
  defaultStitchSettings,
  calculateStitchLayout,
  resolveStitchFormat,
  validateStitchOutput,
  type StitchSettings,
} from "../image/stitch/geometry.ts";
import { outputFilename } from "../image/names.ts";
import { calculateSlices, sliceFilename } from "../image/split/geometry.ts";
import {
  defaultWatermarkSettings,
  type WatermarkSettings,
} from "../image/watermark/types.ts";
import { validateWatermark } from "../image/watermark/layout.ts";
import {
  defaultRenameSettings,
  generateRenamedFiles,
  type RenameSettings,
} from "../files/rename.ts";
import { parseSettings } from "../presets/model.ts";
import type { ImageFormat, OutputSettings } from "../image/types";
import type { SplitOptions } from "../../processors/images";
export interface StepSettings {
  resize: TransformSettings;
  convert: OutputSettings;
  watermark: WatermarkSettings & { logoDataUrl?: string };
  join: StitchSettings;
  split: SplitOptions;
  rename: RenameSettings;
}
export type WorkflowStep = {
  [K in ToolId]: { id: string; type: K; settings: StepSettings[K] };
}[ToolId];
export interface Workflow {
  id: string;
  name: string;
  version: 1;
  createdAt: string;
  updatedAt: string;
  steps: WorkflowStep[];
}
export interface ImageMetadata {
  name: string;
  width: number;
  height: number;
  format: ImageFormat;
}
export function defaultStep(
  type: ToolId,
  id: string = crypto.randomUUID(),
): WorkflowStep {
  const settings: StepSettings = {
    resize: defaultSettings(),
    convert: {
      mode: "original",
      width: 800,
      height: 800,
      fit: "contain",
      format: "image/jpeg",
      sizeUnit: "none",
      sizeLimit: 500,
    },
    watermark: defaultWatermarkSettings(),
    join: defaultStitchSettings(),
    split: {
      mode: "height",
      height: 1200,
      count: 6,
      format: "original",
      guides: [],
    },
    rename: defaultRenameSettings(),
  };
  return { id, type, settings: settings[type] } as WorkflowStep;
}
export function moveStep(steps: WorkflowStep[], id: string, index: number) {
  const from = steps.findIndex((s) => s.id === id);
  if (from < 0 || index < 0 || index >= steps.length || from === index)
    return steps;
  const next = [...steps],
    [step] = next.splice(from, 1);
  next.splice(index, 0, step!);
  return next;
}
export function stepSummary(step: WorkflowStep) {
  switch (step.type) {
    case "resize": {
      const r = step.settings;
      return r.mode === "exact"
        ? `${r.width} × ${r.height} · ${r.fit === "crop" ? "裁剪填满" : "扩展画布"}`
        : r.mode === "ratio"
          ? `比例 ${r.ratioWidth}:${r.ratioHeight}`
          : r.axis === "boundingBox"
            ? `宽≤${r.maxWidth} · 高≤${r.maxHeight}`
            : r.axis === "original"
              ? "保持原尺寸"
              : `${{ width: "宽", height: "高", longest: "长边" }[r.axis]}≤${r.limit}`;
    }
    case "convert":
      return {
        original: "原格式",
        "image/jpeg": "JPG",
        "image/png": "PNG",
        "image/webp": "WebP",
      }[step.settings.format];
    case "watermark":
      return `${step.settings.kind === "text" ? step.settings.text || "设置水印文字" : "图片水印"} · ${step.settings.layout === "single" ? "单个" : "平铺"} · ${step.settings.layout === "single" ? step.settings.singleOpacity : step.settings.tileOpacity}%`;
    case "join":
      return `${step.settings.direction === "vertical" ? "纵向" : "横向"} · 间距 ${step.settings.gap}px`;
    case "split":
      return step.settings.mode === "height"
        ? `每段 ${step.settings.height}px`
        : step.settings.mode === "count"
          ? `${step.settings.count} 张`
          : `${step.settings.guides?.length || 0} 条切线`;
    case "rename":
      return { uniform: "统一名称", prefix: "添加前缀", suffix: "添加后缀" }[
        step.settings.mode
      ];
  }
}
export function projectStep(
  input: ImageMetadata[],
  step: WorkflowStep,
): ImageMetadata[] {
  const error = inputCountError(toolDefinitions[step.type], input.length);
  if (error) throw Error(error);
  switch (step.type) {
    case "resize":
      validateSettings(step.settings);
      return input.map((i) => {
        const t = calculateTransform(i.width, i.height, step.settings);
        const format =
          step.settings.format === "original" ? i.format : step.settings.format;
        return {
          ...i,
          name: outputFilename(i.name, format),
          width: t.canvasWidth,
          height: t.canvasHeight,
          format,
        };
      });
    case "convert":
      if (
        step.settings.sizeUnit !== "none" &&
        (!Number.isFinite(step.settings.sizeLimit) ||
          step.settings.sizeLimit *
            (step.settings.sizeUnit === "MB" ? 1048576 : 1024) <
            1024)
      )
        throw Error("文件大小目标至少为 1 KB。");
      return input.map((i) => {
        const format =
          step.settings.format === "original" ? i.format : step.settings.format;
        return { ...i, name: outputFilename(i.name, format), format };
      });
    case "watermark":
      validateWatermark(step.settings, !!step.settings.logoDataUrl);
      return input.map((i) => ({
        ...i,
        name: outputFilename(i.name, i.format),
      }));
    case "join": {
      const layout = calculateStitchLayout(input, step.settings);
      validateStitchOutput(layout);
      const format = resolveStitchFormat(
        input.map((i) => i.format),
        step.settings.format,
      );
      return [
        {
          name: outputFilename("tidypic-stitched.png", format),
          width: layout.width,
          height: layout.height,
          format,
        },
      ];
    }
    case "split": {
      const image = input[0]!;
      const slices = calculateSlices(
          image.height,
          step.settings,
          step.settings.guides,
        ),
        format =
          step.settings.format === "original"
            ? image.format
            : step.settings.format;
      return slices.map((s, index) => ({
        ...image,
        name: sliceFilename(
          image.name,
          format === "image/jpeg" ? "jpg" : format.split("/")[1]!,
          index,
          slices.length,
        ),
        height: s.height,
        format,
      }));
    }
    case "rename": {
      const renamed = generateRenamedFiles(
        input.map((i, index) => ({ id: String(index), filename: i.name })),
        step.settings,
      );
      if (renamed.error) throw Error(renamed.error);
      return input.map((i, index) => ({
        ...i,
        name: renamed.entries[index]!.name,
      }));
    }
  }
}
export function planWorkflow(input: ImageMetadata[], steps: WorkflowStep[]) {
  let current = input;
  const states: {
    id: string;
    inputCount: number;
    outputCount: number;
    error: string;
  }[] = [];
  let blocked = !input.length;
  for (const step of steps) {
    const before = current.length;
    if (blocked) {
      states.push({ id: step.id, inputCount: 0, outputCount: 0, error: "" });
      continue;
    }
    try {
      current = projectStep(current, step);
      states.push({
        id: step.id,
        inputCount: before,
        outputCount: current.length,
        error: "",
      });
    } catch (e) {
      states.push({
        id: step.id,
        inputCount: before,
        outputCount: 0,
        error: (e as Error).message,
      });
      blocked = true;
    }
  }
  return { states, valid: !blocked && steps.length > 0, output: current };
}
// Reject corrupt records and unknown versions without overwriting saved data.
export function parseStep(value: unknown): WorkflowStep {
  const v = value as WorkflowStep;
  if (
    !v ||
    typeof v.id !== "string" ||
    !v.id ||
    !Object.hasOwn(toolDefinitions, v.type) ||
    !v.settings ||
    typeof v.settings !== "object"
  )
    throw Error("工具流步骤数据无效。");
  const defaults = defaultStep(v.type, v.id);
  const s = v.settings as unknown as Record<string, unknown>;
  for (const [key, d] of Object.entries(defaults.settings)) {
    if (key === "guides") continue;
    if (d === null) {
      if (
        s[key] !== null &&
        !(typeof s[key] === "number" && Number.isFinite(s[key]))
      )
        throw Error("工具流参数数据无效。");
      continue;
    }
    if (
      typeof s[key] !== typeof d ||
      (typeof d === "number" && !Number.isFinite(s[key]))
    )
      throw Error("工具流参数数据无效。");
  }
  const step = JSON.parse(JSON.stringify(v)) as WorkflowStep;
  if (step.type === "resize") step.settings = parseSettings(step.settings);
  // Validate enum fields, including settings that may be incomplete for execution.
  const allowed: Record<string, string[]> = {
    format: ["original", "image/jpeg", "image/png", "image/webp"],
    sizeUnit: ["none", "KB", "MB"],
    kind: ["text", "image"],
    layout: ["single", "tiled"],
    size: ["small", "medium", "large", "custom", "uniform", "original"],
    arrangement: ["grid", "staggered"],
    density: ["sparse", "medium", "dense", "custom"],
    direction: ["vertical", "horizontal"],
    separator: ["_", "-", " ", ""],
  };
  for (const [key, values] of Object.entries(allowed))
    if (key in s && !values.includes(String(s[key])))
      throw Error("工具流参数选项无效。");
  if (
    step.type === "convert" &&
    (step.settings.mode !== "original" ||
      !["contain", "cover"].includes(step.settings.fit))
  )
    throw Error("格式转换参数无效。");
  if (
    step.type === "split" &&
    (!["height", "count", "guides"].includes(step.settings.mode) ||
      (step.settings.guides !== undefined &&
        (!Array.isArray(step.settings.guides) ||
          step.settings.guides.some((n) => !Number.isFinite(n)))))
  )
    throw Error("切分参数无效。");
  if (
    step.type === "join" &&
    (!["uniform", "original"].includes(step.settings.size) ||
      !["start", "center", "end"].includes(step.settings.alignment))
  )
    throw Error("拼接参数选项无效。");
  if (step.type === "join") {
    calculateStitchLayout(
      [
        { width: 8, height: 6 },
        { width: 8, height: 6 },
      ],
      step.settings,
    );
  }
  if (
    step.type === "rename" &&
    (!["uniform", "prefix", "suffix"].includes(step.settings.mode) ||
      ![1, 2, 3].includes(step.settings.digits))
  )
    throw Error("改名参数无效。");
  if (step.type === "watermark") {
    if (!["small", "medium", "large", "custom"].includes(step.settings.size))
      throw Error("水印尺寸选项无效。");
    if (
      step.settings.logoDataUrl !== undefined &&
      !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(
        step.settings.logoDataUrl,
      )
    )
      throw Error("水印图片数据无效。");
    validateWatermark(
      { ...step.settings, kind: "text", text: step.settings.text || "验证" },
      true,
    );
  }
  return step;
}
