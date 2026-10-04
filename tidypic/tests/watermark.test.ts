import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultWatermarkSettings } from "../src/utils/image/watermark/types.ts";
import {
  calculateWatermarkSize,
  calculateTileLayout,
  singlePosition,
  relativePixels,
  validateWatermark,
} from "../src/utils/image/watermark/layout.ts";
const settings = { ...defaultWatermarkSettings(), text: "@图整整" };
const content = { aspect: 2, textWidthPerEm: 4, textHeightPerEm: 1 };
test("watermark presets scale proportionally at 800px and 4000px", () => {
  for (const kind of ["text", "image"] as const)
    for (const size of ["small", "medium", "large", "custom"] as const) {
      const a = calculateWatermarkSize(
        800,
        800,
        { ...settings, kind, size },
        content,
      );
      const b = calculateWatermarkSize(
        4000,
        4000,
        { ...settings, kind, size },
        content,
      );
      assert.ok(Math.abs(b.width / a.width - 5) < 1e-9);
      assert.ok(Math.abs(b.height / a.height - 5) < 1e-9);
    }
  assert.equal(relativePixels(24, 800, 1200), 24);
  assert.equal(relativePixels(24, 4000, 6000), 120);
});
test("nine-grid positions remain within margins and center aligns exactly", () => {
  const mark = { width: 120, height: 40, fontSize: 32 };
  for (let i = 0; i < 9; i++) {
    const p = singlePosition(800, 600, mark, i, 24);
    assert.ok(p.x >= 84 && p.x <= 716 && p.y >= 44 && p.y <= 556);
  }
  assert.deepEqual(singlePosition(800, 600, mark, 0, 24), { x: 84, y: 44 });
  assert.deepEqual(singlePosition(800, 600, mark, 4, 24), { x: 400, y: 300 });
  assert.deepEqual(singlePosition(800, 600, mark, 8, 24), { x: 716, y: 556 });
});
test("text or logos too large shrink inside target without clipping", () => {
  const mark = calculateWatermarkSize(
    500,
    200,
    { ...settings, size: "custom", fontSize: 400 },
    { aspect: 1, textWidthPerEm: 100, textHeightPerEm: 1 },
  );
  assert.ok(mark.width <= 488 + 1e-9);
  assert.ok(mark.height <= 188 + 1e-9);
});
test("tile density, rotation bounds and scale are stable on landscape, portrait and square", () => {
  for (const [w, h] of [
    [800, 800],
    [1920, 1080],
    [1080, 1920],
    [4200, 3000],
  ]) {
    for (const angle of [-30, 0, 30])
      for (const arrangement of ["grid", "staggered"] as const) {
        const config = {
          ...settings,
          layout: "tiled" as const,
          angle,
          arrangement,
        };
        const mark = calculateWatermarkSize(w!, h!, config, content);
        const result = calculateTileLayout(w!, h!, mark, config);
        const scaled = calculateTileLayout(
          w! * 5,
          h! * 5,
          {
            width: mark.width * 5,
            height: mark.height * 5,
            fontSize: mark.fontSize * 5,
          },
          config,
        );
        assert.equal(result.positions.length, scaled.positions.length);
        assert.ok(result.positions.length > 1);
        assert.ok(result.boundWidth > 0 && result.boundHeight > 0);
        assert.ok(
          result.positions.some(
            (p) => p.x <= result.stepX && p.y <= result.stepY,
          ),
        );
      }
  }
  const mark = calculateWatermarkSize(
    800,
    800,
    { ...settings, layout: "tiled" },
    content,
  );
  const counts = (["sparse", "medium", "dense"] as const).map(
    (density) =>
      calculateTileLayout(800, 800, mark, {
        ...settings,
        layout: "tiled",
        density,
      }).positions.length,
  );
  assert.ok(counts[0]! < counts[1]! && counts[1]! < counts[2]!);
});
test("invalid parameters and excessive tiling fail with bounded work", () => {
  assert.throws(
    () => validateWatermark({ ...settings, text: "  " }, false),
    /文字/,
  );
  assert.throws(
    () => validateWatermark({ ...settings, kind: "image" }, false),
    /上传/,
  );
  assert.throws(
    () =>
      validateWatermark({ ...settings, layout: "tiled", angle: NaN }, false),
    /角度/,
  );
  assert.throws(
    () => validateWatermark({ ...settings, singleOpacity: 101 }, false),
    /透明度/,
  );
  assert.throws(
    () =>
      calculateTileLayout(
        16000,
        100,
        { width: 0.1, height: 0.1, fontSize: 1 },
        { ...settings, layout: "tiled", density: "custom", gap: 0 },
      ),
    /密集/,
  );
});
