import test from "node:test";
import assert from "node:assert/strict";
import { defaultSettings } from "../src/utils/image/transform/geometry.ts";
import {
  applyPreset,
  presetModified,
  cropNeedsReset,
  validateName,
  settingsSnapshot,
  type ImagePreset,
} from "../src/utils/presets/model.ts";
import {
  loadPresets,
  savePresets,
  PRESET_STORAGE_KEY,
} from "../src/utils/presets/storage.ts";
import { commonPresets } from "../src/data/presets/common.ts";
test("all common templates patch ratios without overriding size limit / format / background", () => {
  const current = {
    ...defaultSettings(),
    sizeUnit: "MB" as const,
    sizeLimit: 2,
    format: "image/webp" as const,
    background: "#123456",
  };
  const ratios = [
    [1, 1],
    [3, 4],
    [9, 16],
    [16, 9],
  ];
  for (const [i, p] of commonPresets.entries()) {
    const next = applyPreset(current, p);
    assert.equal(next.mode, "ratio");
    assert.deepEqual([next.ratioWidth, next.ratioHeight], ratios[i]);
    assert.equal(next.sizeLimit, 2);
    assert.equal(next.sizeUnit, "MB");
    assert.equal(next.format, "image/webp");
    assert.equal(next.background, "#123456");
    assert.equal(presetModified(next, p), false);
    assert.equal(presetModified({ ...next, sizeLimit: 5 }, p), false);
    assert.equal(presetModified({ ...next, ratioWidth: 7 }, p), true);
  }
  assert.equal(current.mode, "limit");
});
test("platform schema patches only defined settings; no platform processing mode", () => {
  const p: ImagePreset = {
    id: "test",
    name: "测试场景",
    type: "platform",
    platform: "测试平台",
    settings: { mode: "exact", width: 600, height: 800, fit: "crop" },
    rules: [
      { kind: "recommended", text: "600×800" },
      { kind: "minimum", text: "300×400" },
    ],
    source: {
      label: "测试来源",
      url: "https://example.com",
      checkedAt: "2026-10",
    },
  };
  const next = applyPreset(defaultSettings(), p);
  assert.equal(next.mode, "exact");
  assert.equal(next.sizeLimit, 500);
  assert.equal(next.format, "original");
  assert.equal(presetModified({ ...next, width: 900 }, p), true);
});
test("crop reset follows effective geometry and ignores size / format / unused fields", () => {
  const current = {
    ...defaultSettings(),
    mode: "ratio" as const,
    ratioWidth: 3,
    ratioHeight: 4,
  };
  for (const patch of [
    { sizeLimit: 200 },
    { format: "image/png" as const },
    { width: 700 },
    { ratioWidth: 6, ratioHeight: 8 },
  ])
    assert.equal(cropNeedsReset(current, { ...current, ...patch }), false);
  for (const patch of [
    { ratioWidth: 1 },
    { mode: "exact" as const },
    { mode: "limit" as const },
  ])
    assert.equal(cropNeedsReset(current, { ...current, ...patch }), true);
  const exact = { ...current, mode: "exact" as const };
  assert.equal(cropNeedsReset(exact, { ...exact, fit: "pad" }), true);
  assert.equal(cropNeedsReset(exact, { ...exact, width: 900 }), true);
  assert.equal(
    cropNeedsReset(exact, { ...exact, background: "#000000" }),
    false,
  );
});
test("user preset persistence roundtrips full settings and excludes metadata", () => {
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
  };
  assert.deepEqual(loadPresets(storage), []);
  const settings = {
    ...defaultSettings(),
    mode: "exact" as const,
    width: 1000,
    height: 1000,
    fit: "pad" as const,
    background: "#abcdef",
    format: "image/jpeg" as const,
    sizeUnit: "MB" as const,
    sizeLimit: 1,
    presetId: "ignored",
  };
  const p: ImagePreset = {
    id: "1",
    type: "user",
    name: "商品主图",
    createdAt: "2026-10-04T00:00:00Z",
    settings: settingsSnapshot(settings),
  };
  savePresets(storage, [p]);
  const saved = loadPresets(storage);
  assert.deepEqual(saved, [p]);
  assert.equal(store.get(PRESET_STORAGE_KEY)!.includes("presetId"), false);
  assert.deepEqual(
    applyPreset({ ...defaultSettings(), mode: "ratio" }, saved[0]!),
    settingsSnapshot(settings),
  );
  savePresets(storage, [{ ...p, name: "Product" }]);
  assert.equal(loadPresets(storage)[0]!.name, "Product");
  savePresets(storage, []);
  assert.deepEqual(loadPresets(storage), []);
  for (const corrupt of [
    "bad",
    JSON.stringify({ version: 2, presets: [] }),
    JSON.stringify({
      version: 1,
      presets: [{ ...p, settings: { ...settings, mode: "unknown" } }],
    }),
  ]) {
    store.set(PRESET_STORAGE_KEY, corrupt);
    assert.throws(() => loadPresets(storage));
    assert.equal(store.get(PRESET_STORAGE_KEY), corrupt);
  }
  assert.throws(() =>
    savePresets(
      {
        getItem: () => null,
        setItem: () => {
          throw new Error("quota");
        },
      },
      [p],
    ),
  );
});
test("names trim, reject empty / overlong / duplicate, allow own rename", () => {
  const users: ImagePreset[] = [
    { id: "1", name: "商品主图", type: "user", settings: defaultSettings() },
  ];
  assert.equal(validateName(" Product ", users), "Product");
  assert.equal(validateName("商品主图", users, "1"), "商品主图");
  for (const value of ["", "   ", "商品主图", "图".repeat(31)])
    assert.throws(() => validateName(value, users));
  assert.equal(validateName("图".repeat(30), users).length, 30);
});

test("published Douyin templates change only geometry and preserve output preferences", async () => {
  const { platformPresets: allPlatforms } =
    await import("../src/data/presets/platform.ts");
  const platformPresets = allPlatforms.filter((p) => p.platform === "douyin");
  const { calculateTransform } =
    await import("../src/utils/image/transform/geometry.ts");
  assert.equal(platformPresets.length, 2);
  const current = {
    ...defaultSettings(),
    sizeLimit: 300,
    format: "image/jpeg" as const,
  };
  const vertical = applyPreset(current, platformPresets[0]!);
  assert.deepEqual(vertical, {
    ...current,
    mode: "exact",
    width: 600,
    height: 800,
    fit: "crop",
  });
  assert.deepEqual(platformPresets[0]!.requirements?.minimumSize, {
    width: 300,
    height: 400,
  });
  const square = applyPreset(current, platformPresets[1]!);
  const result = calculateTransform(1920, 1080, square);
  assert.equal(result.canvasWidth, 1080);
  assert.equal(result.canvasHeight, 1080);
  assert.equal(square.sizeLimit, 300);
  assert.equal(square.format, "image/jpeg");
  assert.equal("requirements" in vertical, false);
  assert.equal("source" in vertical, false);
  assert.equal("platform" in vertical, false);
  for (const p of platformPresets) {
    assert.equal(p.platform, "douyin");
    assert.equal(new URL(p.source!.url).search, "");
  }
});
test("platform groups contain only visible scenes and keep internal IDs separate from names", async () => {
  const { platformPresets, platformGroups, visiblePlatformPresets } =
    await import("../src/data/presets/platform.ts");
  const hidden: ImagePreset = {
    id: "hidden",
    name: "hidden",
    platform: "jd",
    platformName: "京东",
    type: "platform",
    settings: {},
    visible: false,
  };
  assert.deepEqual(platformGroups([...platformPresets, hidden]), [
    { id: "pinduoduo", name: "拼多多" },
    { id: "douyin", name: "抖音电商" },
  ]);
  assert.equal(visiblePlatformPresets([hidden]).length, 0);
  assert.deepEqual(platformGroups([{ ...hidden, visible: true }]), [
    { id: "jd", name: "京东" },
  ]);
});
