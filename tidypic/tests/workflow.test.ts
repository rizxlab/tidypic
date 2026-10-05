import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultStep,
  planWorkflow,
  moveStep,
  parseStep,
  type Workflow,
  type WorkflowStep,
} from "../src/utils/workflow/model.ts";
import {
  runWorkflow,
  type RuntimeImage,
  type StepState,
} from "../src/utils/workflow/runtime.ts";
import {
  loadWorkflows,
  saveWorkflows,
  WORKFLOW_STORAGE_KEY,
} from "../src/utils/workflow/storage.ts";
const image = (name = "a.png"): RuntimeImage => ({
  file: new File([name], name, { type: "image/png" }),
  name,
  width: 8,
  height: 6,
  format: "image/png",
});
const step = (type: WorkflowStep["type"]) => defaultStep(type, type);

test("capability planner projects stitch→split N→1→N using existing geometry", () => {
  const join = step("join"),
    split = step("split");
  if (split.type === "split") {
    split.settings.mode = "count";
    split.settings.count = 5;
  }
  const plan = planWorkflow(
    [image(), image("b.png"), image("c.png")],
    [join, split],
  );
  assert.equal(plan.valid, true);
  assert.deepEqual(
    plan.states.map((s) => [s.inputCount, s.outputCount]),
    [
      [3, 1],
      [1, 5],
    ],
  );
  assert.equal(
    plan.output.reduce((n, i) => n + i.height, 0),
    18,
  );
});
test("capability planner permits resize→watermark→convert N→N and split→watermark 1→N→N", () => {
  const resize = step("resize"),
    mark = step("watermark"),
    convert = step("convert");
  if (mark.type === "watermark") mark.settings.text = "shop";
  const plan = planWorkflow([image(), image("b.png")], [resize, mark, convert]);
  assert.equal(plan.valid, true);
  assert.deepEqual(
    plan.states.map((s) => s.outputCount),
    [2, 2, 2],
  );
  assert.ok(plan.output.every((i) => i.format === "image/jpeg"));
  const split = step("split");
  if (split.type === "split") {
    split.settings.mode = "count";
    split.settings.count = 3;
  }
  assert.deepEqual(
    planWorkflow([image()], [split, mark]).states.map((s) => s.outputCount),
    [3, 3],
  );
});
test("incompatible counts, invalid dimensions and empty watermark block execution without deleting steps", () => {
  assert.match(
    planWorkflow([image()], [step("join")]).states[0]!.error,
    /至少需要 2/,
  );
  assert.match(
    planWorkflow([image(), image("b.png")], [step("split")]).states[0]!.error,
    /需要 1/,
  );
  assert.equal(planWorkflow([image()], [step("watermark")]).valid, false);
  const resize = step("resize");
  if (resize.type === "resize") resize.settings.limit = -1;
  assert.equal(planWorkflow([image()], [resize, step("convert")]).valid, false);
  assert.equal(
    planWorkflow([image()], [resize, step("convert")]).states.length,
    2,
  );
});
test("runtime passes only prior outputs, updates counts and never changes source input", async () => {
  const input = [image(), image("b.png")];
  const steps = [step("join"), step("split"), step("convert")];
  let firstOutput: RuntimeImage[] = [];
  const called: string[] = [];
  const output = await runWorkflow(input, steps, async (current, s) => {
    called.push(s.type);
    if (s.type === "join") {
      assert.equal(current[0]!.file, input[0]!.file);
      firstOutput = [image("joined.png")];
      return firstOutput;
    }
    if (s.type === "split") {
      assert.equal(current, firstOutput);
      return [image("1.png"), image("2.png"), image("3.png")];
    }
    assert.equal(current.length, 3);
    return current;
  });
  assert.deepEqual(called, ["join", "split", "convert"]);
  assert.deepEqual(
    output.states.map((s) => [s.inputCount, s.outputCount, s.status]),
    [
      [2, 1, "success"],
      [1, 3, "success"],
      [3, 3, "success"],
    ],
  );
  assert.equal(input.length, 2);
  assert.equal(input[0]!.name, "a.png");
});
test("failure stops subsequent steps and retains lightweight error metadata", async () => {
  const called: string[] = [];
  let states: StepState[] = [];
  await assert.rejects(
    runWorkflow(
      [image()],
      [step("resize"), step("watermark"), step("convert")],
      async (input, s) => {
        called.push(s.type);
        if (s.type === "watermark") throw Error("编码失败");
        return input;
      },
      (next) => {
        states = next;
      },
    ),
    /添加水印处理失败：编码失败/,
  );
  assert.deepEqual(called, ["resize", "watermark"]);
  assert.deepEqual(
    states.map((s) => s.status),
    ["success", "error", "idle"],
  );
  assert.ok(
    states.every((s) => !Object.hasOwn(s, "file") && !Object.hasOwn(s, "blob")),
  );
});
test("runtime rejects real count mismatches and cancellation before processors run", async () => {
  let called = false;
  await assert.rejects(
    runWorkflow([image()], [step("join")], async (i) => {
      called = true;
      return i;
    }),
    /至少需要 2/,
  );
  await assert.rejects(
    runWorkflow(
      [image()],
      [step("resize")],
      async (i) => {
        called = true;
        return i;
      },
      undefined,
      () => true,
    ),
    /处理已停止/,
  );
  assert.equal(called, false);
});
test("sorting changes actual execution order and removal removes execution", async () => {
  const original = [step("resize"), step("convert"), step("rename")];
  const ordered = moveStep(original, "rename", 0).filter(
    (s) => s.id !== "convert",
  );
  const called: string[] = [];
  await runWorkflow([image()], ordered, async (i, s) => {
    called.push(s.type);
    return i;
  });
  assert.deepEqual(called, ["rename", "resize"]);
  assert.deepEqual(
    original.map((s) => s.type),
    ["resize", "convert", "rename"],
  );
});
test("versioned workflow storage roundtrips all modules and custom parameters", () => {
  let raw = "";
  const store = {
    getItem: () => raw || null,
    setItem: (key: string, value: string) => {
      assert.equal(key, WORKFLOW_STORAGE_KEY);
      raw = value;
    },
  };
  const steps = [
    step("resize"),
    step("watermark"),
    step("convert"),
    step("join"),
    step("split"),
    step("rename"),
  ];
  if (steps[3]!.type === "join") steps[3]!.settings.target = 1000;
  const now = new Date().toISOString();
  const workflow: Workflow = {
    id: "flow",
    name: "详情图处理",
    version: 1,
    createdAt: now,
    updatedAt: now,
    steps,
  };
  saveWorkflows(store, [workflow]);
  assert.deepEqual(loadWorkflows(store), [workflow]);
  assert.equal(JSON.parse(raw).version, 1);
  raw = JSON.stringify({ version: 2, workflows: [] });
  assert.throws(() => loadWorkflows(store));
  const corrupt = raw;
  assert.throws(() =>
    saveWorkflows(store, [
      {
        ...workflow,
        steps: [{ ...steps[0]!, type: "unknown" } as WorkflowStep],
      },
    ]),
  );
  assert.equal(raw, corrupt);
});
test("storage rejects duplicate identities, invalid enum values and corrupt image payloads", () => {
  assert.throws(() =>
    parseStep({
      ...step("convert"),
      settings: { ...step("convert").settings, format: "image/gif" },
    }),
  );
  assert.throws(() =>
    parseStep({
      ...step("watermark"),
      settings: {
        ...step("watermark").settings,
        logoDataUrl: "https://example.com/image.png",
      },
    }),
  );
});

test("planner uses converted extensions and split names when validating a following rename", () => {
  const convert = step("convert"),
    rename = step("rename");
  if (rename.type === "rename") {
    rename.settings.mode = "prefix";
    rename.settings.prefix = "shop";
  }
  const plan = planWorkflow(
    [image("a.png"), image("a.webp")],
    [convert, rename],
  );
  assert.equal(plan.valid, false);
  assert.match(plan.states[1]!.error, /重复文件名/);
  const split = step("split");
  if (split.type === "split") {
    split.settings.mode = "count";
    split.settings.count = 3;
  }
  assert.equal(planWorkflow([image()], [split, rename]).valid, true);
});

test("runtime enforces declared output counts", async () => {
  await assert.rejects(
    runWorkflow([image(), image("b.png")], [step("resize")], async (input) => [
      input[0]!,
    ]),
    /输出数量/,
  );
});

test("invalid module enums and duplicate persisted step ids are rejected", () => {
  const join = step("join"),
    mark = step("watermark");
  assert.throws(() =>
    parseStep({
      ...join,
      settings: { ...join.settings, alignment: "unknown" },
    }),
  );
  assert.throws(() =>
    parseStep({ ...mark, settings: { ...mark.settings, size: "uniform" } }),
  );
  const now = new Date().toISOString();
  assert.throws(() =>
    saveWorkflows({ getItem: () => null, setItem: () => {} }, [
      {
        id: "flow",
        name: "duplicate",
        version: 1,
        createdAt: now,
        updatedAt: now,
        steps: [step("resize"), step("resize")],
      },
    ]),
  );
});

test("persisted workflows reject non-string dates and object-valued nullable settings", () => {
  const join = step("join");
  assert.throws(() =>
    parseStep({ ...join, settings: { ...join.settings, target: {} } }),
  );
  const now = new Date().toISOString();
  assert.throws(() =>
    saveWorkflows({ getItem: () => null, setItem: () => {} }, [
      {
        id: "bad-date",
        name: "invalid",
        version: 1,
        createdAt: 2026 as unknown as string,
        updatedAt: now,
        steps: [step("resize")],
      },
    ]),
  );
});
