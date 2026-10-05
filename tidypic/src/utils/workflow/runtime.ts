import { toolDefinitions, inputCountError } from "../../data/tools.ts";
import type { WorkflowStep, ImageMetadata } from "./model";
export interface RuntimeImage extends ImageMetadata {
  file: File;
  generated?: boolean;
}
export interface StepState {
  id: string;
  status: "idle" | "processing" | "success" | "error";
  inputCount: number;
  outputCount: number;
  elapsedMs: number;
  error: string;
}
export type StepProcessor = (
  input: RuntimeImage[],
  step: WorkflowStep,
  cancelled: () => boolean,
) => Promise<RuntimeImage[]>;
/** Only the current generation of files is retained; metadata survives for diagnostics. */
export async function runWorkflow(
  input: RuntimeImage[],
  steps: WorkflowStep[],
  process: StepProcessor,
  update: (states: StepState[]) => void = () => {},
  cancelled = () => false,
) {
  let current = [...input];
  const states: StepState[] = steps.map((s) => ({
    id: s.id,
    status: "idle",
    inputCount: 0,
    outputCount: 0,
    elapsedMs: 0,
    error: "",
  }));
  const publish = () => update(states.map((s) => ({ ...s })));
  publish();
  for (let index = 0; index < steps.length; index++) {
    const step = steps[index]!,
      state = states[index]!,
      start = performance.now();
    state.inputCount = current.length;
    state.status = "processing";
    publish();
    try {
      if (cancelled()) throw Error("处理已停止。");
      const countError = inputCountError(
        toolDefinitions[step.type],
        current.length,
      );
      if (countError) throw Error(countError);
      const next = await process(current, step, cancelled);
      if (cancelled()) throw Error("处理已停止。");
      if (!next.length) throw Error("此步骤没有生成有效图片。");
      const capability = toolDefinitions[step.type];
      if (
        (capability.outputMode === "same" && next.length !== current.length) ||
        (capability.outputMode === "single" && next.length !== 1)
      )
        throw Error("此步骤输出数量与处理能力不一致。");
      current = next;
      state.outputCount = current.length;
      state.status = "success";
    } catch (e) {
      state.status = "error";
      state.error = e instanceof Error ? e.message : "图片处理失败。";
      state.elapsedMs = performance.now() - start;
      publish();
      current = [];
      throw Error(`${toolDefinitions[step.type].name}处理失败：${state.error}`);
    }
    state.elapsedMs = performance.now() - start;
    publish();
  }
  return { images: current, states };
}
