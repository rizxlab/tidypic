# 电商平台官方预设 V1

1. 修改文件：`src/data/presets/platform.ts`、`src/utils/presets/model.ts`、`src/components/resize/PresetControls.vue`、`src/composables/useImagePresets.ts`、`tests/presets.test.ts`，以及测试/实现记录。未重新设计样式。
2. 数据仍集中于 platform.ts；没有新增平台处理模块。
3. ImagePreset 增加 platformName、category、visible、requirements；内部平台 ID 为 douyin，显示名为抖音电商。只从有可见条目的平台动态生成入口。
4. settings 继续直接复用 Partial<TransformSettings>。
5. requirements 保存 ratio、recommendedSize、minimumSize 等说明，与 settings 分离，不传给图片算法。
6. source 保存 label、干净 url、checkedAt（2026-10）。3:4 来源：https://school.jinritemai.com/doudian/web/article/aHb9JViisd3T；官方检索正文确认最低 300×400、建议 600×800、比例 3:4。1:1 来源：https://school.jinritemai.com/doudian/wap/article/aHKMDB9f6YPX，是 2021 年官方类目公示中的比例参考，未冒充全平台最新统一规范。
7. 当前只启用抖音电商。未加入京东、小红书等其他平台或隐藏业务数据。
8. 两个预设：douyin-product-vertical-3-4「3:4 商品竖图」、douyin-product-main-1-1「1:1 商品主图」。
9. 3:4 仅写入 mode=exact、width=600、height=800、fit=crop。页面显示“建议”，不是强制尺寸。
10. 1:1 仅写入 mode=ratio、ratioWidth=1、ratioHeight=1；保留原图最大有效像素，不指定 600×600。
11. 文件大小、格式、背景等未定义字段按原 merge 逻辑保留；修改后沿用“已修改”状态，可以另存为用户预设，不继承官方身份。
12. 未修改任何图片处理、上传、导出、ZIP 或任务队列算法。
13. 桌面/移动端沿用同一个选择器，在根列表与平台场景列表之间切换；返回不关闭面板，× 关闭，选择立即应用并关闭；来源详情沿用轻量 details。
14. 42 组逻辑测试及生产构建通过。浏览器验证两张混合图片的真实输出、裁剪重置、结果失效、手动修改/保存、来源信息、零上传选择及 320px 手机导航，详见 TESTING.md。
15. 限制：平台规则存在场景和类目差异，预设仅为尺寸模板，不作上传合规保证；1:1 的来源范围已明确标注。无在线更新，未来需人工维护；未实测实体手机。
