import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultSettings,
  validateSettings,
} from "../src/utils/image/transform/geometry.ts";
import {
  sizeShortcuts,
  selectSizeShortcut,
  isSizeShortcut,
  changeSizeUnit,
} from "../src/utils/image/sizeLimit.ts";
import { defaultWatermarkSettings } from "../src/utils/image/watermark/types.ts";
import {
  WATERMARK_PRESET_KEY,
  loadWatermarkPresets,
  saveWatermarkPresets,
  applyWatermarkPreset,
  parseWatermarkPreset,
  presetLogoFile,
  presetLogo,
  type WatermarkPreset,
} from "../src/utils/presets/watermark.ts";
import {
  PRESET_STORAGE_KEY,
  loadPresets,
} from "../src/utils/presets/storage.ts";
function store() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };
}
const preset = (): WatermarkPreset => ({
  id: "p",
  name: "店铺右下角",
  type: "user",
  version: 1,
  createdAt: new Date().toISOString(),
  settings: {
    ...defaultWatermarkSettings(),
    text: "@小店",
    layout: "tiled",
    position: 3,
    size: "custom",
    fontSize: 45,
    imageWidthPercent: 22,
    margin: 15,
    singleOpacity: 57,
    tileOpacity: 33,
    arrangement: "grid",
    density: "custom",
    gap: 105,
    angle: 12,
    color: "#123456",
  },
});
test("all size shortcuts map existing settings and custom values deselect fixed values", () => {
  const s = defaultSettings();
  for (const shortcut of sizeShortcuts) {
    selectSizeShortcut(s, shortcut);
    assert.equal(s.sizeUnit, shortcut.unit);
    assert.equal(sizeShortcuts.filter((p) => isSizeShortcut(s, p)).length, 1);
    if (shortcut.unit !== "none") assert.equal(s.sizeLimit, shortcut.value);
    validateSettings(s);
  }
  s.sizeUnit = "KB";
  s.sizeLimit = 350;
  assert.ok(sizeShortcuts.every((p) => !isSizeShortcut(s, p)));
  selectSizeShortcut(s, sizeShortcuts[0]);
  assert.equal(s.sizeUnit, "none");
  assert.equal(s.sizeLimit, 350);
  validateSettings(s);
});
test("pure unit changes preserve byte limit and roundtrip fractional MB", () => {
  const s = defaultSettings();
  changeSizeUnit(s, "MB");
  assert.equal(s.sizeLimit, 500 / 1024);
  assert.equal(s.sizeLimit * 1048576, 512000);
  changeSizeUnit(s, "KB");
  assert.equal(s.sizeLimit, 500);
  s.sizeUnit = "none";
  changeSizeUnit(s, "MB");
  assert.equal(s.sizeUnit, "none");
});
test("watermark versioned storage restores every parameter and stays separate from resize presets", () => {
  const db = store(),
    p = preset();
  saveWatermarkPresets(db, [p]);
  assert.deepEqual(loadWatermarkPresets(db), [p]);
  assert.deepEqual(loadPresets(db), []);
  assert.ok(db.data.has(WATERMARK_PRESET_KEY));
  assert.ok(!db.data.has(PRESET_STORAGE_KEY));
  const restored = applyWatermarkPreset(loadWatermarkPresets(db)[0]!);
  assert.deepEqual(restored.settings, p.settings);
  restored.settings.text = "可编辑";
  assert.equal(p.settings.text, "@小店");
});
test("rename, deletion and duplicate names use shared record validation", () => {
  const db = store(),
    p = preset();
  saveWatermarkPresets(db, [p]);
  saveWatermarkPresets(db, [{ ...p, name: "新名字" }]);
  assert.equal(loadWatermarkPresets(db)[0]!.name, "新名字");
  assert.throws(() => saveWatermarkPresets(db, [p, { ...p, id: "q" }]), /同名/);
  assert.equal(loadWatermarkPresets(db)[0]!.name, "新名字");
  saveWatermarkPresets(db, []);
  assert.deepEqual(loadWatermarkPresets(db), []);
});
test("corrupt version, unknown options and invalid inactive parameters are rejected without overwrite", () => {
  const db = store();
  db.data.set(WATERMARK_PRESET_KEY, '{"version":99,"presets":[]}');
  assert.throws(() => loadWatermarkPresets(db));
  assert.equal(
    db.data.get(WATERMARK_PRESET_KEY),
    '{"version":99,"presets":[]}',
  );
  assert.throws(() =>
    parseWatermarkPreset(
      { ...preset(), settings: { ...preset().settings, layout: "unknown" } },
      [],
    ),
  );
  assert.throws(() =>
    parseWatermarkPreset(
      {
        ...preset(),
        settings: { ...preset().settings, layout: "single", angle: 999 },
      },
      [],
    ),
  );
});
test("image preset persists bytes instead of object URLs, reconstructs File and strips unrelated fields", () => {
  const p = preset();
  p.settings.kind = "image";
  p.logo = { name: "logo.png", dataUrl: "data:image/png;base64,iVBORw0KGgo=" };
  const db = store();
  saveWatermarkPresets(db, [p]);
  const restored = applyWatermarkPreset(loadWatermarkPresets(db)[0]!);
  assert.equal(restored.logo!.name, "logo.png");
  assert.equal(restored.logo!.type, "image/png");
  assert.equal(restored.logo!.size, 8);
  assert.ok(!db.data.get(WATERMARK_PRESET_KEY)!.includes("blob:"));
  assert.throws(() =>
    parseWatermarkPreset(
      { ...p, logo: { ...p.logo, dataUrl: "blob:temporary" } },
      [],
    ),
  );
});
test("image presets require a material and enforce 1MB and total 4MB bounds before writing", async () => {
  const p = preset();
  p.settings.kind = "image";
  assert.throws(() => parseWatermarkPreset(p, []));
  await assert.rejects(
    presetLogo(new File([new Uint8Array(1024 * 1024 + 1)], "large.png")),
    /最大 1MB/,
  );
  p.logo = {
    name: "logo.png",
    dataUrl:
      "data:image/png;base64," + btoa("\x89PNG" + "a".repeat(1024 * 1024 - 4)),
  };
  const db = store();
  assert.throws(
    () =>
      saveWatermarkPresets(
        db,
        Array.from({ length: 4 }, (_, i) => ({
          ...p,
          id: String(i),
          name: String(i),
        })),
      ),
    /4MB/,
  );
  assert.equal(db.getItem(WATERMARK_PRESET_KEY), null);
  assert.equal(presetLogoFile(p.logo).size, 1024 * 1024);
});
