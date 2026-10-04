import { test } from "node:test";
import assert from "node:assert/strict";
import { runQueue } from "../src/utils/image/queue.ts";
import { canKeepOriginal } from "../src/utils/image/policy.ts";
import { outputFilename, uniqueFilename } from "../src/utils/image/names.ts";
const options = {
  mode: "width" as const,
  width: 800,
  height: 800,
  fit: "contain" as const,
  format: "image/jpeg" as const,
  maxBytes: 500 * 1024,
};
test("keep compliant originals, but resize / format / size changes still run", () => {
  const source = {
    width: 600,
    height: 400,
    format: "image/jpeg",
    size: 300 * 1024,
  };
  assert.equal(canKeepOriginal(source, options), true);
  assert.equal(canKeepOriginal({ ...source, width: 1200 }, options), false);
  assert.equal(
    canKeepOriginal({ ...source, size: 600 * 1024 }, options),
    false,
  );
  assert.equal(
    canKeepOriginal(source, { ...options, format: "image/webp" }),
    false,
  );
  assert.equal(canKeepOriginal(source, { ...options, mode: "exact" }), false);
});
test("queue caps concurrent work at two and lets per-item failures continue", async () => {
  let active = 0,
    max = 0;
  const success: number[] = [],
    failed: number[] = [];
  await runQueue(
    Array.from({ length: 13 }, (_, i) => i),
    async (index) => {
      active++;
      max = Math.max(max, active);
      try {
        await new Promise((resolve) => setTimeout(resolve, 2));
        if (index === 3) throw Error("expected");
        success.push(index);
      } catch {
        failed.push(index);
      } finally {
        active--;
      }
    },
    2,
  );
  assert.equal(max, 2);
  assert.equal(success.length, 12);
  assert.deepEqual(failed, [3]);
});
test("stopped queue does not start additional images", async () => {
  let stop = false;
  let started = 0;
  await runQueue(
    [1, 2, 3, 4],
    async () => {
      started++;
      stop = true;
    },
    2,
    () => stop,
  );
  assert.equal(started, 1);
});
test("preserve names and resolve collisions including pre-existing numbered names", () => {
  assert.equal(
    outputFilename("商品主图01.jpg", "image/jpeg", "image/jpeg"),
    "商品主图01.jpg",
  );
  assert.equal(
    outputFilename("商品主图01.png", "image/webp", "image/png"),
    "商品主图01.webp",
  );
  assert.equal(
    outputFilename("camera.JPEG", "image/jpeg", "image/jpeg"),
    "camera.JPEG",
  );
  const used = new Set<string>();
  assert.deepEqual(
    ["a.jpg", "a (2).jpg", "a.jpg", "A.jpg"].map((n) =>
      uniqueFilename(n, used),
    ),
    ["a.jpg", "a (2).jpg", "a (3).jpg", "A (4).jpg"],
  );
  assert.equal(
    outputFilename("../foo.png", "image/webp", "image/png"),
    ".._foo.webp",
  );
});
