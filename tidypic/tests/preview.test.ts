import { test } from "node:test";
import assert from "node:assert/strict";
import { createPreviewUrls } from "../src/utils/image/preview.ts";
test("preview lazily caches original Blob URLs and releases each once on close", () => {
  const created: Blob[] = [],
    released: string[] = [];
  const urls = createPreviewUrls(
    (blob) => {
      created.push(blob);
      return `blob:${created.length}`;
    },
    (url) => released.push(url),
  );
  const a = new Blob(["original A"]),
    b = new Blob(["original B"]);
  assert.equal(created.length, 0);
  assert.equal(urls.get({ id: "a", name: "A", blob: a }), "blob:1");
  assert.equal(urls.get({ id: "a", name: "A", blob: a }), "blob:1");
  assert.equal(urls.get({ id: "b", name: "B", blob: b }), "blob:2");
  assert.deepEqual(created, [a, b]);
  urls.clear();
  urls.clear();
  assert.deepEqual(released, ["blob:1", "blob:2"]);
  assert.equal(urls.get({ id: "a", name: "A", blob: a }), "blob:3");
  urls.clear();
  assert.deepEqual(released, ["blob:1", "blob:2", "blob:3"]);
});
test("result URLs are borrowed and never revoked by the preview", () => {
  const urls = createPreviewUrls(
    () => {
      throw Error("must not copy result");
    },
    () => {
      throw Error("must not revoke result");
    },
  );
  assert.equal(
    urls.get({ id: "result", name: "01.png", url: "blob:result" }),
    "blob:result",
  );
  urls.clear();
});
test("missing preview data reports an error without allocating URLs", () => {
  const urls = createPreviewUrls(() => {
    throw Error("must not allocate");
  });
  assert.throws(() => urls.get({ id: "empty", name: "empty" }), /没有可预览/);
  urls.clear();
});
