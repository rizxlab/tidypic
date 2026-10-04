import test from "node:test";
import assert from "node:assert/strict";
import {
  platformPresets,
  visiblePlatformPresets,
} from "../src/data/presets/platform.ts";
import { applyPreset, settingsSnapshot } from "../src/utils/presets/model.ts";
import { validateRequirements } from "../src/utils/presets/requirements.ts";
import {
  defaultSettings,
  calculateTransform,
} from "../src/utils/image/transform/geometry.ts";
import { loadPresets, savePresets } from "../src/utils/presets/storage.ts";
const preset = platformPresets.find((p) => p.id === "pdd-detail")!;
test("PDD detail is visible and resets ordinary parameters to declared defaults", () => {
  assert.ok(visiblePlatformPresets().includes(preset));
  assert.equal(preset.name, "商品详情图");
  const s = applyPreset(
    {
      ...defaultSettings(),
      mode: "exact",
      format: "image/jpeg",
      sizeLimit: 200,
    },
    preset,
  );
  assert.deepEqual(s, {
    ...defaultSettings(),
    axis: "boundingBox",
    maxWidth: 1200,
    maxHeight: 1500,
    sizeUnit: "none",
    format: "original",
  });
  assert.equal("platform" in s, false);
  assert.equal("requirements" in s, false);
});
test("batch requirement warnings only flag the undersized output, without enlargement", () => {
  const s = applyPreset(defaultSettings(), preset);
  const results = [
    [2400, 1600],
    [1000, 2000],
    [800, 1000],
    [400, 800],
  ].map(([w, h]) => {
    const t = calculateTransform(w!, h!, s);
    return { width: t.canvasWidth, height: t.canvasHeight };
  });
  assert.deepEqual(results, [
    { width: 1200, height: 800 },
    { width: 750, height: 1500 },
    { width: 800, height: 1000 },
    { width: 400, height: 800 },
  ]);
  assert.deepEqual(
    results.map((r) => validateRequirements(r, preset.requirements)),
    [[], [], [], ["图片宽度低于 480px，可能不符合平台要求"]],
  );
});
test("generic requirements check boundaries and modified parameters without changing output", () => {
  assert.deepEqual(
    validateRequirements({ width: 480, height: 1500 }, preset.requirements),
    [],
  );
  assert.equal(
    validateRequirements({ width: 1201, height: 1501 }, preset.requirements)
      .length,
    2,
  );
  assert.deepEqual(validateRequirements({ width: 1, height: 1 }), []);
  const s = {
    ...applyPreset(defaultSettings(), preset),
    maxWidth: 300,
    format: "image/jpeg" as const,
    sizeUnit: "KB" as const,
    sizeLimit: 500,
  };
  const t = calculateTransform(800, 1000, s);
  assert.deepEqual([t.canvasWidth, t.canvasHeight], [300, 375]);
  assert.equal(
    validateRequirements(
      { width: t.canvasWidth, height: t.canvasHeight },
      preset.requirements,
    ).length,
    1,
  );
});
test("saving modified platform parameters creates an independent user preset", () => {
  let value = "";
  const storage = {
    getItem: () => value || null,
    setItem: (_k: string, v: string) => {
      value = v;
    },
  };
  const settings = {
    ...applyPreset(defaultSettings(), preset),
    format: "image/jpeg" as const,
    sizeUnit: "KB" as const,
    sizeLimit: 500,
  };
  savePresets(storage, [
    {
      id: "mine",
      createdAt: "2026-10-04T00:00:00Z",
      type: "user",
      name: "我的PDD详情图",
      settings: settingsSnapshot(settings),
    },
  ]);
  const saved = loadPresets(storage)[0]!;
  assert.equal(saved.platform, undefined);
  assert.equal(saved.requirements, undefined);
  assert.deepEqual(applyPreset(defaultSettings(), saved), settings);
});
