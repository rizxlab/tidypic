import { parseStep, type Workflow } from "./model.ts";
import { validateName } from "../presets/model.ts";
export const WORKFLOW_STORAGE_KEY = "tidypic.workflows.v1";
type Store = Pick<Storage, "getItem" | "setItem">;
export function parseWorkflows(data: unknown): Workflow[] {
  const record = data as { version: number; workflows: Workflow[] };
  if (record?.version !== 1 || !Array.isArray(record.workflows))
    throw Error("工具流存储版本或数据无效，原有数据未被覆盖。");
  const workflows: Workflow[] = [];
  for (const w of record.workflows) {
    if (
      !w ||
      w.version !== 1 ||
      typeof w.id !== "string" ||
      !w.id ||
      typeof w.name !== "string" ||
      typeof w.createdAt !== "string" ||
      typeof w.updatedAt !== "string" ||
      workflows.some((i) => i.id === w.id) ||
      !Number.isFinite(Date.parse(w.createdAt)) ||
      !Number.isFinite(Date.parse(w.updatedAt)) ||
      !Array.isArray(w.steps) ||
      w.steps.length > 50
    )
      throw Error("工具流数据无效，原有数据未被覆盖。");
    const steps = w.steps.map(parseStep);
    if (new Set(steps.map((s) => s.id)).size !== steps.length)
      throw Error("工具流步骤编号重复。");
    workflows.push({ ...w, name: validateName(w.name, workflows), steps });
  }
  return workflows;
}
export function loadWorkflows(storage: Store) {
  const raw = storage.getItem(WORKFLOW_STORAGE_KEY);
  return raw === null ? [] : parseWorkflows(JSON.parse(raw));
}
export function saveWorkflows(storage: Store, workflows: Workflow[]) {
  storage.setItem(
    WORKFLOW_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      workflows: parseWorkflows({ version: 1, workflows }),
    }),
  );
}
