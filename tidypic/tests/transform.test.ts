import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateTransform,
  calculateCropRect,
  defaultSettings,
  validateSettings,
} from "../src/utils/image/transform/geometry.ts";
test("limits keep proportions and never upscale, across all axes", () => {
  for (const [w, h] of [
    [1600, 900],
    [900, 1600],
    [600, 400],
    [800, 800],
  ])
    for (const axis of ["width", "height", "longest", "original"] as const) {
      const t = calculateTransform(w!, h!, { ...defaultSettings(), axis });
      assert.ok(t.canvasWidth <= w! && t.canvasHeight <= h!);
      assert.ok(Math.abs(t.canvasWidth / t.canvasHeight - w! / h!) < 0.004);
      if (axis !== "original")
        assert.ok(
          (axis === "width"
            ? t.canvasWidth
            : axis === "height"
              ? t.canvasHeight
              : Math.max(t.canvasWidth, t.canvasHeight)) <= 800,
        );
    }
});
test("cover is exact, integer bounded source, native ratio crop and independent positions", () => {
  for (const [w, h] of [
    [1600, 900],
    [900, 1600],
    [800, 800],
    [16000, 100],
  ])
    for (const [tw, th] of [
      [800, 800],
      [800, 1200],
      [1200, 800],
    ]) {
      const t = calculateTransform(w!, h!, {
        ...defaultSettings(),
        mode: "exact",
        width: tw!,
        height: th!,
      });
      assert.equal(t.canvasWidth, tw);
      assert.equal(t.canvasHeight, th);
      const r = t.sourceRect;
      assert.ok(Object.values(r).every(Number.isInteger));
      assert.ok(
        r.x >= 0 && r.y >= 0 && r.x + r.width <= w! && r.y + r.height <= h!,
      );
      assert.equal(t.destinationRect.width, tw);
      assert.equal(t.destinationRect.height, th);
    }
  assert.deepEqual(calculateCropRect(1600, 900, 1), {
    x: 350,
    y: 0,
    width: 900,
    height: 900,
  });
  assert.equal(calculateCropRect(1600, 900, 1, { x: 0, y: 0.5, zoom: 1 }).x, 0);
  assert.equal(
    calculateCropRect(1600, 900, 1, { x: 1, y: 0.5, zoom: 1 }).x,
    700,
  );
  assert.equal(
    calculateCropRect(1600, 900, 1, { x: 0.5, y: 0.5, zoom: 2 }).width,
    450,
  );
});
test("ratio presets retain largest native area; invalid settings fail before allocation", () => {
  for (const [a, b] of [
    [1, 1],
    [3, 4],
    [4, 3],
    [16, 9],
    [9, 16],
    [3, 2],
  ])
    for (const [w, h] of [
      [1600, 900],
      [900, 1600],
    ]) {
      const t = calculateTransform(w!, h!, {
        ...defaultSettings(),
        mode: "ratio",
        ratioWidth: a!,
        ratioHeight: b!,
      });
      assert.ok(Math.abs(t.canvasWidth / t.canvasHeight - a! / b!) < 0.003);
      assert.ok(t.canvasWidth === w || t.canvasHeight === h);
    }
  for (const n of [0, -1, NaN, Infinity])
    assert.throws(() =>
      validateSettings({ ...defaultSettings(), mode: "ratio", ratioWidth: n }),
    );
  for (const [w, h] of [
    [20000, 10],
    [8192, 8192],
    [0, 100],
    [1.5, 2],
  ])
    assert.throws(() =>
      calculateTransform(800, 800, {
        ...defaultSettings(),
        mode: "exact",
        width: w!,
        height: h!,
      }),
    );
  assert.throws(() =>
    validateSettings({ ...defaultSettings(), sizeLimit: 0.1 }),
  );
});
test("padding is centered, exact, proportional and reports enlargement", () => {
  const t = calculateTransform(1200, 1600, {
    ...defaultSettings(),
    mode: "exact",
    fit: "pad",
    width: 1000,
    height: 1000,
  });
  assert.deepEqual(t.destinationRect, {
    x: 125,
    y: 0,
    width: 750,
    height: 1000,
  });
  assert.equal(t.background, "#ffffff");
  const p = calculateTransform(1600, 900, {
    ...defaultSettings(),
    mode: "exact",
    fit: "pad",
    background: "transparent",
  });
  assert.deepEqual(p.destinationRect, {
    x: 0,
    y: 175,
    width: 800,
    height: 450,
  });
  assert.equal(p.background, "transparent");
  assert.equal(
    calculateTransform(400, 400, {
      ...defaultSettings(),
      mode: "exact",
      width: 1200,
      height: 1200,
    }).upscaled,
    true,
  );
});
