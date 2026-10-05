export type ToolId =
  "resize" | "convert" | "watermark" | "split" | "join" | "rename";
export interface ToolDefinition {
  id: ToolId | "workflow";
  name: string;
  icon: string;
  desc: string;
  inputMode: "single" | "multiple";
  minImages: number;
  maxImages?: number;
  outputMode: "same" | "single" | "multiple";
  group: "image" | "structure" | "file" | "workflow";
}
export const toolDefinitions: Record<ToolId, ToolDefinition> = {
  resize: {
    id: "resize",
    name: "尺寸调整 + 压缩",
    icon: "resize",
    desc: "尺寸与大小，一次搞定",
    inputMode: "multiple",
    minImages: 1,
    outputMode: "same",
    group: "image",
  },
  convert: {
    id: "convert",
    name: "格式转换",
    icon: "convert",
    desc: "JPG、PNG、WebP 自由转换",
    inputMode: "multiple",
    minImages: 1,
    outputMode: "same",
    group: "image",
  },
  watermark: {
    id: "watermark",
    name: "添加水印",
    icon: "watermark",
    desc: "为图片添加文字或 Logo",
    inputMode: "multiple",
    minImages: 1,
    outputMode: "same",
    group: "image",
  },
  split: {
    id: "split",
    name: "长图切分",
    icon: "split",
    desc: "长图分段，轻松上传",
    inputMode: "single",
    minImages: 1,
    maxImages: 1,
    outputMode: "multiple",
    group: "structure",
  },
  join: {
    id: "join",
    name: "图片拼接",
    icon: "join",
    desc: "多张图片，整齐拼在一起",
    inputMode: "multiple",
    minImages: 2,
    outputMode: "single",
    group: "structure",
  },
  rename: {
    id: "rename",
    name: "批量改名",
    icon: "rename",
    desc: "批量整理文件名",
    inputMode: "multiple",
    minImages: 1,
    maxImages: 200,
    outputMode: "same",
    group: "file",
  },
};
export const tools: ToolDefinition[] = [
  ...Object.values(toolDefinitions),
  {
    id: "workflow",
    name: "自定义工具流",
    icon: "workflow",
    desc: "按顺序组合图片处理步骤",
    inputMode: "multiple",
    minImages: 1,
    outputMode: "multiple",
    group: "workflow",
  },
];
export function inputCountError(tool: ToolDefinition, count: number) {
  if (count < tool.minImages) return `此步骤至少需要 ${tool.minImages} 张图片`;
  if (tool.maxImages !== undefined && count > tool.maxImages)
    return tool.inputMode === "single"
      ? "此步骤需要 1 张图片"
      : `此步骤最多支持 ${tool.maxImages} 张图片`;
  return "";
}
