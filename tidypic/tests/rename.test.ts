import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultRenameSettings,
  generateRenamedFiles,
  splitFilename,
  sanitizeFilename,
  detectDuplicateNames,
  formatNumber,
} from "../src/utils/files/rename.ts";
const files = ["A.jpeg", "B.PNG", "C.webp"].map((filename, i) => ({
  id: String(i),
  filename,
}));
test("uniform names preserve exact extension and Unicode", () => {
  for (const name of ["商品主图", "Product", "产品Photo", "商品📸"]) {
    const r = generateRenamedFiles(files, { ...defaultRenameSettings(), name });
    assert.equal(r.error, "");
    assert.deepEqual(
      r.entries.map((e) => e.name),
      [`${name}_01.jpeg`, `${name}_02.PNG`, `${name}_03.webp`],
    );
  }
  assert.deepEqual(splitFilename("商品.v2.jpeg"), {
    basename: "商品.v2",
    extension: ".jpeg",
  });
});
test("numbering handles starts, widths and 120 files without truncation", () => {
  assert.equal(formatNumber(0, 120, 2, 1), "001");
  assert.equal(formatNumber(119, 120, 2, 1), "120");
  assert.equal(formatNumber(0, 120, 1, 1), "1");
  assert.equal(formatNumber(0, 3, 2, 5), "05");
  assert.equal(formatNumber(0, 3, 2, 100), "100");
  assert.equal(formatNumber(0, 3, 3, 1), "001");
  for (const start of [-1, NaN, 1.5, Number.MAX_SAFE_INTEGER])
    assert.ok(
      generateRenamedFiles(files, {
        ...defaultRenameSettings(),
        name: "图",
        start,
      }).error,
    );
});
test("prefix and suffix keep basename and extensions; separators supported", () => {
  for (const separator of ["_", "-", " ", ""] as const) {
    assert.equal(
      generateRenamedFiles(files, {
        ...defaultRenameSettings(),
        mode: "prefix",
        prefix: "主图",
        separator,
      }).entries[0]!.name,
      `主图${separator}A.jpeg`,
    );
    assert.equal(
      generateRenamedFiles(files, {
        ...defaultRenameSettings(),
        mode: "suffix",
        suffix: "Done",
        separator,
      }).entries[0]!.name,
      `A${separator}Done.jpeg`,
    );
  }
  assert.equal(
    generateRenamedFiles([...files].reverse(), {
      ...defaultRenameSettings(),
      name: "图",
    }).entries[0]!.name,
    "图_01.webp",
  );
});
test("sanitize unsafe names, reserved Windows names and empty names", () => {
  assert.equal(sanitizeFilename('x/\\:*?"<>|'), "x_________");
  assert.equal(sanitizeFilename("CON"), "_CON");
  assert.equal(sanitizeFilename("abc.  "), "abc");
  for (const mode of ["prefix", "suffix"] as const)
    assert.ok(
      generateRenamedFiles(files, { ...defaultRenameSettings(), mode }).error,
    );
  assert.equal(
    generateRenamedFiles(files, { ...defaultRenameSettings(), name: "a/b" })
      .sanitized,
    true,
  );
  assert.ok(
    generateRenamedFiles(files, {
      ...defaultRenameSettings(),
      name: "图".repeat(100),
    }).error,
  );
});
test("duplicates are rejected case-insensitively and with canonical Unicode equivalence", () => {
  assert.equal(detectDuplicateNames(["Product.jpg", "product.JPG"]).size, 1);
  assert.equal(detectDuplicateNames(["é.png", "e\u0301.png"]).size, 1);
  const r = generateRenamedFiles(
    [
      { id: "1", filename: "a.jpeg" },
      { id: "2", filename: "A.JPEG" },
    ],
    { ...defaultRenameSettings(), mode: "prefix", prefix: "商品" },
  );
  assert.match(r.error, /重复文件名/);
  assert.equal(r.entries.length, 2);
});
test("extension-only image names retain their extension", () => {
  assert.deepEqual(splitFilename(".jpeg"), {
    basename: "",
    extension: ".jpeg",
  });
  assert.equal(
    generateRenamedFiles([{ id: "1", filename: ".jpeg" }], {
      ...defaultRenameSettings(),
      name: "图",
    }).entries[0]!.name,
    "图_01.jpeg",
  );
});


test("empty uniform names use only numbers for every separator and numbering style", () => {
  for (const separator of ["_", "-", " ", ""] as const)
    for (const digits of [1, 2, 3] as const)
      for (const start of [1, 8, 10]) {
        const result = generateRenamedFiles(files, {
          ...defaultRenameSettings(), separator, digits, start,
        });
        assert.equal(result.error, "");
        assert.deepEqual(result.entries.map(e => e.name), files.map((f, i) =>
          String(start + i).padStart(digits, "0") + splitFilename(f.filename).extension));
      }
});
test("live name transitions and sorting retain number-to-file mapping", () => {
  const settings = defaultRenameSettings();
  for (const name of ["商品主图", "", "新图", "   ", "..."]) {
    settings.name = name;
    const result = generateRenamedFiles(files, settings);
    assert.equal(result.error, "");
    assert.equal(result.entries[0]!.name,
      (sanitizeFilename(name) ? sanitizeFilename(name) + "_" : "") + "01.jpeg");
  }
  settings.name = "";
  const reversed = generateRenamedFiles([...files].reverse(), settings);
  assert.deepEqual(reversed.entries.map(e => [e.id, e.name]),
    [["2", "01.webp"], ["1", "02.PNG"], ["0", "03.jpeg"]]);
});
