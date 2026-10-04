import type { ImagePreset } from "../../utils/presets/model";

// Metadata documents the source; only settings is passed to the existing pipeline.
export const platformPresets: ImagePreset[] = [
  {
    id: "douyin-product-vertical-3-4",
    platform: "douyin",
    platformName: "抖音电商",
    name: "3:4 商品竖图",
    type: "platform",
    visible: true,
    summary: "建议 600 × 800px",
    category: "服装鞋包资料中的商品竖图",
    settings: { mode: "exact", width: 600, height: 800, fit: "crop" },
    requirements: {
      ratio: "3:4",
      recommendedSize: { width: 600, height: 800 },
      minimumSize: { width: 300, height: 400 },
      note: "来源为《服装鞋包商家泛商城运营白皮书》，应用推荐尺寸。",
    },
    source: {
      label: "抖音电商学习中心 / 官方商家资料",
      url: "https://school.jinritemai.com/doudian/web/article/aHb9JViisd3T",
      checkedAt: "2026-10",
    },
  },
  {
    id: "douyin-product-main-1-1",
    platform: "douyin",
    platformName: "抖音电商",
    name: "1:1 商品主图",
    type: "platform",
    visible: true,
    summary: "建议 1:1",
    settings: { mode: "ratio", ratioWidth: 1, ratioHeight: 1 },
    requirements: {
      ratio: "1:1",
      note: "参考官方类目资料中的比例建议，仅裁成 1:1；不代表所有类目的统一尺寸要求。",
    },
    source: {
      label: "抖音电商官方类目规范公示（2021年，比例参考）",
      url: "https://school.jinritemai.com/doudian/wap/article/aHKMDB9f6YPX",
      checkedAt: "2026-10",
    },
  },
];
export function visiblePlatformPresets(
  presets: ImagePreset[] = platformPresets,
) {
  return presets.filter(
    (p) => p.type === "platform" && p.platform && p.visible !== false,
  );
}
export function platformGroups(presets: ImagePreset[] = platformPresets) {
  return [
    ...new Map(
      visiblePlatformPresets(presets).map((p) => [
        p.platform!,
        { id: p.platform!, name: p.platformName || p.platform! },
      ]),
    ).values(),
  ];
}
