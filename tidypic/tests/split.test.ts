import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateSlices,
  splitByHeight,
  splitByCount,
  splitByGuides,
  sliceFilename,
} from "../src/utils/image/split/geometry.ts";
test("height slices cover exact original with short tail and no enlargement", () => {
  assert.deepEqual(
    splitByHeight(5000, 1200).map((s) => s.height),
    [1200, 1200, 1200, 1200, 200],
  );
  assert.deepEqual(splitByHeight(5000, 6000), [{ y: 0, height: 5000 }]);
  assert.equal(splitByHeight(12000, 1200).length, 10);
});
test("count distributes remainder without losing or duplicating rows", () => {
  for (const height of [1, 7, 5000, 12000, 16384])
    for (const count of [1, 2, 6, 10, 100].filter((n) => n <= height)) {
      const slices = splitByCount(height, count);
      assert.equal(slices.length, count);
      let y = 0;
      for (const s of slices) {
        assert.equal(s.y, y);
        assert.ok(s.height > 0);
        y += s.height;
      }
      assert.equal(y, height);
      assert.ok(
        Math.max(...slices.map((s) => s.height)) -
          Math.min(...slices.map((s) => s.height)) <=
          1,
      );
    }
});
test("guides sort crossed positions and reject duplicates, invalid or excess slices", () => {
  assert.deepEqual(splitByGuides(5000, [4000, 1000, 2000]), [
    { y: 0, height: 1000 },
    { y: 1000, height: 1000 },
    { y: 2000, height: 2000 },
    { y: 4000, height: 1000 },
  ]);
  for (const guides of [[0], [5000], [10, 10], [NaN], [-1], [1.2]])
    assert.throws(() => splitByGuides(5000, guides));
  for (const n of [0, -1, 1.5, NaN, Infinity])
    assert.throws(() => splitByHeight(5000, n));
  for (const n of [0, 101, 1.2, NaN, Infinity])
    assert.throws(() => splitByCount(5000, n));
  assert.throws(() => splitByCount(2, 3));
  assert.throws(() => splitByHeight(5000, 1));
  assert.throws(() =>
    calculateSlices(0, { mode: "height", height: 1200, count: 6 }),
  );
});
test("slice names keep original stem and natural ordering beyond 99", () => {
  assert.equal(sliceFilename("商品详情.jpg", "png", 0, 5), "商品详情_01.png");
  assert.equal(
    sliceFilename("商品详情.jpg", "webp", 99, 100),
    "商品详情_100.webp",
  );
  assert.equal(
    sliceFilename("商品详情.jpg", "jpg", 0, 100),
    "商品详情_001.jpg",
  );
});
