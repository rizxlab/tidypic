import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateStitchLayout,
  defaultStitchSettings,
  resolveStitchFormat,
  validateStitchOutput,
} from "../src/utils/image/stitch/geometry.ts";
const images = [
  { width: 800, height: 1200 },
  { width: 1000, height: 800 },
  { width: 600, height: 900 },
];
test("vertical auto width is minimum, proportions preserved and integer boundaries meet", () => {
  const l = calculateStitchLayout(images, defaultStitchSettings());
  assert.equal(l.width, 600);
  assert.deepEqual(
    l.items.map((i) => i.height),
    [900, 480, 900],
  );
  assert.equal(l.height, 2280);
  for (let i = 1; i < l.items.length; i++)
    assert.equal(l.items[i]!.y, l.items[i - 1]!.y + l.items[i - 1]!.height);
});
test("horizontal auto height and custom upscaling preserve proportions", () => {
  const s = { ...defaultStitchSettings(), direction: "horizontal" as const };
  const l = calculateStitchLayout(images, s);
  assert.equal(l.height, 800);
  assert.deepEqual(
    l.items.map((i) => i.width),
    [533, 1000, 533],
  );
  assert.equal(l.width, 2066);
  const custom = calculateStitchLayout(images, { ...s, target: 1600 });
  assert.deepEqual(
    custom.items.map((i) => i.width),
    [1067, 2000, 1067],
  );
});
test("original sizes, alignment and gaps in both directions", () => {
  for (const direction of ["vertical", "horizontal"] as const)
    for (const alignment of ["start", "center", "end"] as const) {
      const l = calculateStitchLayout(images, {
        ...defaultStitchSettings(),
        size: "original",
        gap: 17,
        direction,
        alignment,
      });
      if (direction === "vertical") {
        assert.equal(l.height, 2934);
        assert.equal(l.width, 1000);
        assert.equal(
          l.items[0]!.x,
          alignment === "start" ? 0 : alignment === "center" ? 100 : 200,
        );
      } else {
        assert.equal(l.width, 2434);
        assert.equal(l.height, 1200);
        assert.equal(
          l.items[1]!.y,
          alignment === "start" ? 0 : alignment === "center" ? 200 : 400,
        );
      }
    }
});
test("reject bad settings and excessive output before canvas allocation", () => {
  for (const target of [0, -1, NaN, 1.5, 16385])
    assert.throws(() =>
      calculateStitchLayout(images, { ...defaultStitchSettings(), target }),
    );
  for (const gap of [-1, NaN, 1.2, 4097])
    assert.throws(() =>
      calculateStitchLayout(images, { ...defaultStitchSettings(), gap }),
    );
  const huge = calculateStitchLayout(
    Array.from({ length: 20 }, () => ({ width: 4000, height: 6000 })),
    defaultStitchSettings(),
  );
  assert.throws(() => validateStitchOutput(huge));
  assert.throws(() => validateStitchOutput({ width: 8000, height: 8000 }));
  assert.doesNotThrow(() =>
    validateStitchOutput({ width: 800, height: 16000 }),
  );
});
test("mixed formats default PNG; uniform original format and explicit overrides retained", () => {
  assert.equal(
    resolveStitchFormat(["image/jpeg", "image/png", "image/webp"], "original"),
    "image/png",
  );
  assert.equal(
    resolveStitchFormat(["image/jpeg", "image/jpeg"], "original"),
    "image/jpeg",
  );
  assert.equal(
    resolveStitchFormat(["image/png", "image/png"], "original"),
    "image/png",
  );
  assert.equal(
    resolveStitchFormat(["image/webp", "image/webp"], "original"),
    "image/webp",
  );
  assert.equal(resolveStitchFormat(["image/png"], "image/jpeg"), "image/jpeg");
});
test("unused custom target does not block original-size mode", () => {
  assert.doesNotThrow(() =>
    calculateStitchLayout(images, {
      ...defaultStitchSettings(),
      size: "original",
      target: 0,
    }),
  );
});
