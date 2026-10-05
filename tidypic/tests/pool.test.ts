import test from "node:test";
import assert from "node:assert/strict";
import { createImagePool } from "../src/utils/image/pool.ts";

test("session pool keeps original File identity, metadata, order and active image until explicit removal", async () => {
  let reads = 0;
  const released: string[] = [];
  const pool = createImagePool(
    async () => ({
      width: 8,
      height: 6,
      format: "image/png",
      objectUrl: `thumb-${++reads}`,
    }),
    (url) => released.push(url),
  );
  const files = ["A", "B", "C"].map(
    (name) => new File([name], name + ".png", { type: "image/png" }),
  );
  await pool.add(files);
  assert.equal(reads, 3);
  pool.assets.value.forEach((asset, i) => assert.equal(asset.file, files[i]));
  const ids = pool.assets.value.map((a) => a.id);
  pool.activeId.value = ids[1]!;
  assert.equal(pool.active.value?.name, "B.png");
  // Any tool subscribes to these same assets; observing them never re-inspects files.
  for (let tool = 0; tool < 6; tool++)
    assert.equal(pool.assets.value.length, 3);
  assert.equal(reads, 3);
  assert.deepEqual(released, []);
  pool.reorder([...ids].reverse());
  assert.equal(pool.assets.value[0]?.name, "C.png");
  pool.remove(ids[1]!);
  assert.deepEqual(released, ["thumb-2"]);
  assert.equal(pool.assets.value.length, 2);
  assert.equal(pool.active.value?.name, "C.png");
  pool.clear();
  assert.equal(pool.assets.value.length, 0);
  assert.equal(released.length, 3);
  pool.dispose();
  assert.equal(released.length, 3);
});
test("disposing during import releases its late URL and forbids further imports", async () => {
  let finish!: (value: {
    width: number;
    height: number;
    objectUrl: string;
  }) => void;
  const released: string[] = [];
  const pool = createImagePool(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    (url) => released.push(url),
  );
  const task = pool.add([new File(["x"], "x.png")]);
  pool.dispose();
  finish({ width: 1, height: 1, objectUrl: "late" });
  await task;
  assert.deepEqual(released, ["late"]);
  assert.equal(pool.assets.value.length, 0);
  await pool.add([new File(["x"], "x.png")]);
  assert.equal(pool.assets.value.length, 0);
});

test("shared source thumbnails and reduced preview URLs are released together only on removal", async () => {
  const released: string[] = [];
  const pool = createImagePool(
    async () => ({
      width: 8,
      height: 6,
      objectUrl: "thumb",
      previewBlob: new Blob(["preview"]),
      previewObjectUrl: "preview",
    }),
    (url) => released.push(url),
  );
  await pool.add([new File(["source"], "a.png")]);
  assert.deepEqual(released, []);
  pool.dispose();
  assert.deepEqual(released, ["thumb", "preview"]);
});

test("processing and packing hold independent leases until their asynchronous cleanup finishes", async () => {
  const { workspaceTaskFlag } = await import("../src/utils/image/pool.ts");
  const pool = createImagePool(
    async () => ({ width: 8, height: 6, objectUrl: "thumb" }),
    () => {},
  );
  await pool.add([new File(["source"], "a.png")]);
  const processing = workspaceTaskFlag(pool),
    packing = workspaceTaskFlag(pool);
  processing.value = true;
  processing.value = true;
  packing.value = true;
  assert.equal(pool.tasks.value, 2);
  pool.clear();
  assert.equal(pool.assets.value.length, 1);
  // Component unmount does not release a task that is still encoding/packing.
  processing.value = false;
  assert.equal(pool.locked.value, true);
  packing.value = false;
  assert.equal(pool.tasks.value, 0);
  pool.clear();
  assert.equal(pool.assets.value.length, 0);
});
