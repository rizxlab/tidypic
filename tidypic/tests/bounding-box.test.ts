import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateTransform,
  defaultSettings,
  validateSettings,
} from "../src/utils/image/transform/geometry.ts";
import {
  applyPreset,
  parseSettings,
  presetModified,
  cropNeedsReset,
} from "../src/utils/presets/model.ts";
import { findBestEncoding } from "../src/utils/image/compress.ts";
const settings = {
  ...defaultSettings(),
  axis: "boundingBox" as const,
  maxWidth: 1200,
  maxHeight: 1500,
};
for (const [w, h, ow, oh] of [
  [2400, 1600, 1200, 800],
  [1000, 2000, 750, 1500],
  [2400, 3000, 1200, 1500],
  [800, 1000, 800, 1000],
  [2000, 2000, 1200, 1200],
  [16000, 100, 1200, 8],
  [100, 16000, 9, 1500],
]) {
  test(`bounding box ${w}×${h} → ${ow}×${oh}`, () => {
    const t = calculateTransform(w!, h!, settings);
    assert.deepEqual([t.canvasWidth, t.canvasHeight], [ow, oh]);
    assert.deepEqual(t.sourceRect, { x: 0, y: 0, width: w, height: h });
    assert.deepEqual(t.destinationRect, { x: 0, y: 0, width: ow, height: oh });
    assert.equal(t.upscaled, false);
    assert.equal(t.background, "transparent");
  });
}
test("both bounds reject missing, noninteger, nonfinite or unsafe values", () => {
  for (const key of ["maxWidth", "maxHeight"])
    for (const value of [0, -1, 1.5, NaN, Infinity, 16385, undefined, ""])
      assert.throws(() => validateSettings({ ...settings, [key]: value }));
  assert.doesNotThrow(() =>
    validateSettings({ ...settings, maxWidth: 1, maxHeight: 16384 }),
  );
  assert.equal(
    calculateTransform(800, 600, {
      ...settings,
      maxWidth: 16384,
      maxHeight: 16384,
    }).canvasWidth,
    800,
  );
});
test("batch dimensions are independent with shared immutable settings", () => {
  const before = { ...settings };
  assert.deepEqual(
    [
      [2400, 1600],
      [1000, 2000],
      [800, 1000],
    ].map(([w, h]) => {
      const t = calculateTransform(w!, h!, settings);
      return [t.canvasWidth, t.canvasHeight];
    }),
    [
      [1200, 800],
      [750, 1500],
      [800, 1000],
    ],
  );
  assert.deepEqual(settings, before);
});
test("bounds combine with existing format and compression policy", async () => {
  for (const format of ["image/jpeg", "image/png", "image/webp"] as const) {
    const t = calculateTransform(2400, 1600, { ...settings, format });
    assert.deepEqual([t.canvasWidth, t.canvasHeight], [1200, 800]);
    const blob = await findBestEncoding(
      async (q) =>
        new Blob(
          [
            new Uint8Array(
              format === "image/png" ? 400000 : Math.round(700000 * q),
            ),
          ],
          { type: format },
        ),
      500 * 1024,
      format === "image/png",
    );
    assert.equal(blob.type, format);
    assert.ok(blob.size <= 500 * 1024);
  }
});
test("presets apply and roundtrip bounds, while legacy settings remain readable", () => {
  const preset = {
    id: "bounds",
    name: "宽高限制",
    type: "user" as const,
    settings: {
      mode: "limit" as const,
      axis: "boundingBox" as const,
      maxWidth: 1200,
      maxHeight: 1500,
    },
  };
  const next = applyPreset(defaultSettings(), preset);
  assert.deepEqual(next, settings);
  assert.deepEqual(parseSettings(JSON.parse(JSON.stringify(next))), next);
  for (const key of ["maxWidth", "maxHeight"]) {
    const changed = { ...next, [key]: 900 };
    assert.equal(presetModified(changed, preset), true);
    assert.equal(cropNeedsReset(next, changed), true);
  }
  const legacy = { ...defaultSettings() } as Record<string, unknown>;
  delete legacy.maxWidth;
  delete legacy.maxHeight;
  assert.deepEqual(parseSettings(legacy), defaultSettings());
  assert.throws(() => parseSettings({ ...legacy, axis: "boundingBox" }));
});
