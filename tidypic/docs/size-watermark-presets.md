# 大小设置与水印预设：实现和验证报告

完成日期：2026-10-11。仅调整本轮相关功能；本轮我未执行 commit 或 push，未增加依赖，开发/预览端口仍为6001 strictPort=true。

## 1. 修改文件

- [tests/watermark-presets.browser.html](/Users/archt/TidyPic/tidypic/tests/watermark-presets.browser.html)

另新增本报告。截图位于 output/playwright/size-limit-375.png 与 watermark-presets-375.png（已忽略的验证产物）。

## 2. 大小设置最终结构

标题“大小设置”，字段组“文件大小上限”，一横排“[不超过 + 数值] [KB/MB]”，随后五个快捷项“不限制 / 100KB / 200KB / 500KB / 1MB”以及“完成”。输入区占主要宽度，单位框固定72px；快捷项按当前参数显示轻量选中态，350KB等自定义值不选中固定项。

## 3. 不限制状态

沿用已有 sizeUnit='none'，保留 sizeLimit 原值；算法仍按已有逻辑省略 maxBytes。数字和单位禁用且保持位置，外部摘要为“大小：不限制”。点击任一固定快捷值恢复相应数值与单位。不建立第二套压缩状态。

## 4. 单位换算

沿用现有1024进制。KB→MB时 value/1024，MB→KB时 value*1024，保留实际上限字节数，例如500KB切换为0.48828125MB，仍为512000字节。外部摘要反映真实参数；压缩/编码算法未改动。

## 5. 水印预设结构

WatermarkPreset={id,name,type:'user',version:1,createdAt,settings:WatermarkSettings,logo?:{name,dataUrl}}。外层存储也有 version:1。水印使用 tidypic.watermark.presets.v1，与 tidypic.resize.presets.v1 分开，互不混入。

## 6. 现有 architecture 复用

PresetControls 变为带类型的共用控制器接口，尺寸和水印直接使用同一选择面板、保存/重命名/删除对话框和样式。抽取 records.ts 的通用版本化加载/保存校验，由现有尺寸预设与新增水印预设共用；名称去空格、30字符限制、Unicode/大小写同名检查复用 validateName。原有尺寸存储key与schema不变，旧预设测试继续通过。

## 7. 保存的参数

完整保存已有15字段：kind、text、color、layout、position、size、fontSize、imageWidthPercent、margin、singleOpacity、tileOpacity、arrangement、density、gap、angle（单点/平铺透明度分别保存）。参数以现有 WatermarkSettings 为准，不增加处理参数或专属预设算法。应用后仍可自由编辑，摘要显示“已修改”；也提供恢复默认设置。面板只提供“我的预设”，没有系统预设。

## 8. 图片素材持久化

支持PNG/JPEG/WebP图片水印预设。原素材不超过1MB时，以真实文件内容生成带正确MIME的data URL，保存在同一版本化localStorage记录中，全部水印预设总量上限4MB；不保存blob:ObjectURL，不引入IndexedDB框架。超过1MB时保存对话框明确提示最大1MB，当前图片水印处理能力仍保留原有导入限制；达到总量/浏览器quota时说明错误且不覆盖旧记录。

刷新后应用预设，从data URL恢复File，走已有readImage校验解码和缩略图流程。预览ObjectURL仅供本次页面显示，替换、恢复默认及卸载时释放，ImageBitmap同时关闭；异步素材加载使用generation防止过期结果覆盖新素材。

## 9. 工具流复用

applyWatermarkPreset 是独立settings层函数，返回WatermarkSettings与恢复的素材File；useWatermarkPresets只接收settings和logoFile引用，不绑定Watermark页面，可直接用于工具流适配。按本轮范围未给工具流增加新UI；以后可使用同一批存储记录与同一PresetControls，素材可用presetLogo适配到工具流已有logoDataUrl。

## 10. 新增测试

新增tests/size-watermark.test.ts，7项测试覆盖所有快捷项、自定义值、单位字节保持、完整参数恢复及可编辑性、与尺寸预设隔离、重命名/删除/同名、非法版本/选项/未激活参数、真实素材File重建、1MB和4MB写入边界及失败不覆盖。

新增tests/watermark-presets.browser.html，真实Vue组件集成验证上传、保存、重新挂载应用、PNG/JPEG/WebP素材序列化及解码、没有MIME的File、独立settings应用、图片名称、默认恢复与URL释放。测试会恢复原有存储；额外“准备图片预设刷新验证”供实际页面刷新检查，创建的QA记录需检查后删除，不进入生产包。

## 11. 全部测试

npm test：86/86通过，失败0、跳过0，原有79项全部通过。实际普通页面验证文字预设保存→刷新→应用、继续编辑、重命名、删除；图片预设刷新后真实素材恢复与预览成功。原有workspace.browser.html回归全部通过，覆盖六工具共享源图、普通结果隔离、真实拼接切分/多图水印、工具流处理、ZIP及资源释放。

大小设置实际验证KB/MB、100/200/500KB/1MB、不限制及350KB手动输入；不限制摘要、disabled状态和固定项选中正常。

## 12. 默认构建

npm run build成功；vue-tsc和Vite通过，PWA service worker正常生成。

## 13. GitHub Pages构建

GITHUB_PAGES=true npm run build成功，base=/tidypic/。没有修改部署配置。

## 14. 375px检查

数值和单位同排：数值区237px、单位72px，顶部对齐；大小设置页面scrollWidth=375，水印页scrollWidth=360≤375。水印预设按钮/素材显示无溢出。两张截图已保存；临时viewport已恢复，QA文字及图片预设均已清理。

## 15. 遗留问题和边界

未发现阻塞功能问题。图片预设限1MB素材及4MB总记录，超过限制会明确提示，浏览器实际quota可能更小；这些是有意设置的存储边界。工具流UI接入未在本轮扩展，但settings/storage/UI均可复用。已验证本地浏览器与两种构建，未部署或实机安装PWA。

最终Git检查：仓库HEAD已更新为4541c5f（261011），其中包含12个主要实现/测试文件；我没有执行提交或推送。当前未提交内容为图片格式浏览器测试补充及本报告。
