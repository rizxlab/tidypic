import test from "node:test";
import assert from "node:assert/strict";
import {
  watermarkStylePresets,
  applyWatermarkStyle,
} from "../src/data/watermarkPresets.ts";
import { defaultWatermarkSettings } from "../src/utils/image/watermark/types.ts";
import {
  validateWatermark,
  calculateTileLayout,
} from "../src/utils/image/watermark/layout.ts";
test("five system styles map existing fields and preserve content, kind and color", () => {
  assert.deepEqual(
    watermarkStylePresets.map((p) => p.name),
    ["轻水印", "明显水印", "居中水印", "满屏平铺", "对角平铺"],
  );
  for (const kind of ["text", "image"] as const)
    for (const p of watermarkStylePresets) {
      const original = {
        ...defaultWatermarkSettings(),
        kind,
        text: "@阿煦的小店",
        color: "#123456",
        fontSize: 39,
        imageWidthPercent: 21,
      };
      const next = applyWatermarkStyle(original, p);
      validateWatermark(next, true);
      for (const k of [
        "kind",
        "text",
        "color",
        "fontSize",
        "imageWidthPercent",
      ] as const)
        assert.equal(next[k], original[k]);
      assert.equal(original.layout, "single");
      assert.equal(original.angle, -30);
    }
});
test("preset placement, opacity, rotation and shared spacing meet requested goals", () => {
  const [light, strong, center, tiled, diagonal] = watermarkStylePresets;
  assert.equal(light!.settings.position, 8);
  assert.equal(light!.settings.size, "small");
  assert.equal(light!.settings.singleOpacity, 45);
  assert.equal(strong!.settings.position, 8);
  assert.equal(strong!.settings.size, "medium");
  assert.equal(strong!.settings.singleOpacity, 75);
  assert.equal(center!.settings.position, 4);
  assert.equal(center!.settings.size, "large");
  assert.equal(center!.settings.singleOpacity, 50);
  for (const p of [tiled!, diagonal!]) {
    const s = applyWatermarkStyle(defaultWatermarkSettings(), p);
    assert.equal(s.layout, "tiled");
    assert.equal(s.tileOpacity, 22);
    assert.equal(s.gap, 80);
    assert.equal(s.size, "small");
    const layout = calculateTileLayout(
      800,
      800,
      { width: 60, height: 20, fontSize: 20 },
      s,
    );
    assert.ok(layout.positions.length > 1);
    assert.ok(layout.stepX >= 80 && layout.stepY >= 80);
  }
  assert.equal(tiled!.settings.angle, 0);
  assert.equal(diagonal!.settings.angle, -30);
});
