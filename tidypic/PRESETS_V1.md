# 尺寸工具预设 V1

1. 主要新增文件：`src/components/resize/PresetControls.vue`、`src/composables/useImagePresets.ts`、`src/utils/presets/model.ts`、`storage.ts`、`src/data/presets/common.ts`、`platform.ts`、`tests/presets.test.ts`。修改 `ResizeParameters.vue`、`ResizeWorkbench.vue`、`style.css` 接入现有卡片；图片处理模块未修改。
2. `ImagePreset` 包含 id/name/type/settings，type 区分 common/platform/user。可选 platform/summary/rules/source/createdAt；rules 区分 required/recommended/minimum/maximum，source 保留 label/url/checkedAt。
3. settings 直接使用 `Partial<TransformSettings>`；用户预设保存完整 TransformSettings，不新建图片参数类型。
4. applyPreset 合并当前参数与模板定义字段并调用现有校验；通用比例模板仅设置 mode、ratioWidth、ratioHeight，文件大小/格式等保留。保存记录经过已知字段白名单及枚举/数值校验。
5. 四个通用模板在 `data/presets/common.ts`：1:1、3:4、9:16、16:9；不声称平台官方规范。
6. 官方数据集中在 `data/presets/platform.ts`，本轮为空。2026-10-04 检索未核实到抖音示例 600×800 / 最低 300×400 的官方原文，遵守“仅采用可靠官方依据”要求，不发布推测规则。平台分组、二级场景列表、规则种类与来源详情组件已预留；未硬凑其他平台。
7. 用户预设由 storage 模块统一写入 localStorage，无账号和服务器。保存完整参数及名称/id/创建时间，不包含图片、裁剪位置、文件或结果。名称去首尾空白、最多 30 个 Unicode 字符，拒绝空名称和同名，重命名不覆盖其他记录。
8. localStorage key：`tidypic.resize.presets.v1`，数据 `{version:1,presets:[...]}`。读取损坏/未知版本时提示并保留原数据；存储失败不假装保存成功。写入前读取最新列表，监听其他页面的 storage 事件。
9. 应用只赋值现有 settings；已有 UI、预览、批量队列和处理 pipeline 自动响应。没有平台判断分支进入处理算法。
10. “已修改”逐项比较模板定义的键；部分模板不因未定义参数改变而误标。重新匹配时自动移除标记，参数不锁定。
11. 应用或恢复默认时比较有效尺寸模式、比例、宽高、适配等；几何发生变化清空 cropStateByImage 到中心裁剪。仅大小/格式/背景变化保留裁剪。图片列表及顺序不变，真实参数改变触发现有结果失效；重复应用完全相同参数保留结果。
12. 没有修改 resize/crop/Canvas/compress/encode、批量队列或下载算法，没有新增依赖。
13. 预设行位于现有输出要求标题下方。桌面紧凑 Popover，手机底部面板，内部滚动、长名称截断。保存/重命名使用小型原生 Dialog，删除单独确认；外部点击/ESC 关闭，参数与预设弹层互斥，支持恢复默认。
14. 40 组逻辑测试和生产构建通过。Chromium 覆盖四个通用预设、手改标记、中文/英文保存、空名/同名、重命名、删除取消/确认、刷新/新页读取、完整补边配置恢复、批量图片保留、旧结果失效、裁剪重置/保留、重复应用、损坏存储保护及 320px 布局。平台结构的合并使用明确标为测试数据的单元测试，无未核实官方条目进入生产列表。
15. 限制：当前无已核实的平台预设；只在当前浏览器/设备保存，清除站点数据会删除用户预设。未实测真实 iOS/Safari；平台二级页面尚无真实数据的浏览器验收。多个页面同一瞬间写入仍受 localStorage 非事务存储限制。
