import { test } from "node:test";
import assert from "node:assert/strict";
import { dimensions, cropRect } from "../src/utils/image/geometry.ts";
import { findBestEncoding } from "../src/utils/image/compress.ts";
const options = {
  mode: "width" as const,
  width: 800,
  height: 1200,
  fit: "contain" as const,
};
test("proportional constraints and no upscale for limits", () => {
  assert.deepEqual(dimensions(3024, 4032, options), {
    width: 800,
    height: 1067,
  });
  assert.deepEqual(dimensions(400, 300, options), { width: 400, height: 300 });
  assert.deepEqual(dimensions(3024, 4032, { ...options, mode: "height" }), {
    width: 900,
    height: 1200,
  });
  assert.deepEqual(dimensions(3024, 4032, { ...options, mode: "longest" }), {
    width: 600,
    height: 800,
  });
  assert.deepEqual(
    dimensions(1600, 900, { ...options, mode: "exact", height: 800 }),
    { width: 800, height: 450 },
  );
  assert.deepEqual(
    dimensions(1600, 900, {
      ...options,
      mode: "exact",
      height: 800,
      fit: "cover",
    }),
    { width: 800, height: 800 },
  );
  assert.deepEqual(cropRect(1600, 900, 800, 800), {
    x: 350,
    y: 0,
    width: 900,
    height: 900,
  });
});
test("invalid and oversized output rejected", () => {
  for (const width of [0, -1, NaN, Infinity, 1.5, 9000])
    assert.throws(() => dimensions(1000, 1000, { ...options, width }));
  assert.throws(() =>
    dimensions(1000, 1000, {
      ...options,
      mode: "exact",
      width: 8192,
      height: 8192,
    }),
  );
});
test("bounded compression search respects size and seeks highest quality", async () => {
  let calls = 0;
  const blob = await findBestEncoding(async (q) => {
    calls++;
    return new Blob([new Uint8Array(Math.round(10000 * q))]);
  }, 5000);
  assert.ok(blob.size <= 5000 && blob.size >= 4970);
  assert.ok(calls <= 11);
});
test("impossible, lossless and invalid targets fail clearly", async () => {
  const encode = async () => new Blob([new Uint8Array(9000)]);
  await assert.rejects(findBestEncoding(encode, 1024), /无法达到/);
  await assert.rejects(findBestEncoding(encode, 1024, true), /PNG/);
  await assert.rejects(findBestEncoding(encode, 10), /太低/);
  assert.equal((await findBestEncoding(encode)).size, 9000);
});
