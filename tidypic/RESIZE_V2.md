# 尺寸调整 + 压缩 V2

1. 主要文件：`src/tools/ResizeWorkbench.vue` 编排页面；`src/components/resize/ResizeParameters.vue` 参数弹层；`TransformPreview.vue` 代理预览与裁剪对话框；`src/utils/image/transform/geometry.ts` 纯计算；`browser.ts` 渲染/编码。`App.vue` 接入新工作区，`ImageUploadList.vue` 新增可选行操作插槽，`BatchResults.vue` 补充结果格式，`style.css` 增加局部样式，`tests/transform.test.ts` 增加逻辑测试。
2. 旧尺寸工作流改为统一 transform → render → encode/compress。默认宽≤800px、≤500KB、原格式不变。格式转换仍沿用原实现；其他工具算法、队列未修改。
3. `TransformSettings.mode` 为 limit / exact / ratio。limit 使用 axis + limit，exact 使用 width/height + fit，ratio 使用 ratioWidth/ratioHeight。background、format、sizeUnit/sizeLimit 为输出要求，预留可选 presetId/presetName，无平台预设 UI。
4. `calculateCropRect` 计算最大原像素裁剪区与整数边界；`calculateContainRect` 计算居中完整图区域；`calculateTransform` 输出源矩形、目标矩形、画布尺寸、背景与放大状态。
5. 裁剪编辑器使用原生 dialog、最长边 1200px 的 ImageBitmap 代理、外部遮罩与固定比例框。Pointer Events 支持鼠标/触摸拖动，Slider 缩放 1–4 倍，重置和完成；取消不提交草稿。
6. `cropStateByImage[id]` 保存归一化中心 x/y 与 zoom。每张图独立，未设置时中心裁剪，删除/清空清除对应状态。切换比例保留中心/缩放意图并按新边界约束，重置删除自定义状态。
7. 扩展画布采用完整原图等比适配目标矩形并居中补边，最终严格等于指定宽高。绘制前填背景，避免覆盖已绘制内容。
8. PNG/WebP 支持透明；JPG 透明回退白色，页面轻量提示。每张图的“原格式”独立解析。
9. Preview、Crop Editor 和 Export 共用 calculateTransform/calculateCropRect；预览只对共享矩形做代理坐标映射。现有 PreviewLightbox 用于放大，无新查看库。
10. 压缩复用 findBestEncoding：先变换后编码；最高质量尝试、最低质量 0.1、最多 9 次二分。PNG 达不到目标直接提示失败；满足尺寸/格式/大小且不需要补边时返回原 File。
11. 分配输出 Canvas 前检查正整数、单边 ≤16384、总像素 ≤3200 万；输入继续沿用 40MB/32MP 检查和方向处理。导出 Canvas finally 清零、Bitmap 关闭、预览异步任务用版本号丢弃过期结果；开始批量时释放预览代理。
12. 参数自然换行，窄屏 Popover 转底部面板；裁剪弹窗适配视口、触摸拖动和 Slider，背景锁滚动并在关闭后恢复。
13. 复用现有 images[]、useImageBatch、并发 2 队列、错误隔离、下载和 JSZip。测试详见 TESTING.md：33 组逻辑测试、55 项浏览器像素断言、2/10/30 张队列、下载/ZIP、资源释放及窄屏交互。
14. 已知限制：预览代理不展示最终编码损耗，任意比例有整数像素舍入；PNG 不保证目标大小，双指缩放未加入；尚未实测 iOS/Safari 和极端设备内存。未加入最近使用持久化、平台预设或其他新工具。
