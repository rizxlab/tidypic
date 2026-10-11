# 上传原图共享预览

1. **原有实现**：长图切分完成图入口在 `src/tools/SplitWorkbench.vue` 的 `preview()`；图片拼接完成图入口在 `StitchWorkbench.vue` 的 `showResult()`。两者调用现有 `PreviewLightbox.vue`。水印、尺寸调整裁剪/扩展、拼接实时预览也使用同一个组件。普通批量结果列表此前没有独立大图入口，本轮不扩展这些结果入口。
2. **共享组件**：已有 `src/components/PreviewLightbox.vue`，采用原生 dialog、Teleport、深色遮罩、关闭按钮、Esc/点击空白关闭、Canvas 适应窗口；此前没有缩放、拖动或图库导航。
3. **复用方式**：直接扩展现有组件，保留 `open(canvas)`，增加 `openImages(collection, index)`，没有建立第二套 Lightbox，也没有替换实时 Canvas。
4. **通用 API**：`PreviewLightbox` 加 `src/utils/image/preview.ts` 的 `PreviewImage` / `createPreviewUrls`；后者只管理临时 URL 的归属与释放。
5. **工具覆盖**：尺寸调整 + 压缩（含裁剪/扩展输入）、格式转换、添加水印、长图切分、图片拼接、批量改名、自定义工具流。它们直接或通过 `SortableImageList` 复用 `ImageUploadList`；批量输入自然支持多图原图图库。
6. **特殊接入**：没有独立上传 UI 需要逐页接入。长图切分的结果入口传入自己的结果集合，使多张切片可翻页；拼接完成图和各实时预览仍调用原有 Canvas API。
7. **集合区分**：上传图库取当前上传列表中已解码图片的 `originalFile`，不取 thumbnail、previewBlob、实时 Canvas 或处理结果。切片图库只取 `allResults` 的文件名和已有结果 URL。两种图库通过不同调用、不同组件实例隔离。
8. **多图导航**：按列表顺序创建图库快照，通过点击图片的 id 定位初始序号；上一张/下一张及键盘左右箭头改变图库内部 index，不修改 activeId、currentImage 或处理状态。首尾按钮禁用，单图不显示导航。排序后下一次打开使用新顺序。
9. **资源管理**：图片池没有原始 File 的完整 Object URL，只有派生预览 URL；因此按需为实际浏览的原始 File 创建 URL，图库内同一 Blob 缓存复用，关闭/重新打开/组件卸载释放。结果 URL 为借用，仅由原有结果集合管理释放。没有上传服务器、base64 或复制图片数据。
10. **本轮文件**：`src/components/ImageUploadList.vue`、`src/components/PreviewLightbox.vue`、`src/tools/SplitWorkbench.vue`、`src/utils/image/preview.ts`、`src/style.css`、`tests/preview.test.ts`、`tests/source-preview.browser.html`、本文。未改动处理算法、上传、限制、共享图片池、设置、预设、下载或导航。
11. **验证**：`npm test` 91/91 PASS（原有 88 项 + 3 项预览资源测试）；`npm run build` PASS，包含 PWA service worker 生成；`git diff --check` PASS。浏览器访问固定 `http://localhost:6001/tests/source-preview.browser.html`：七工具原始分辨率、缩略图/文件名/信息点击、C 直接 3/4、上下翻页、单图隐藏导航、处理图片选择独立、排序/指针拖拽/删除、原有水印和拼接 Canvas、焦点恢复、URL 缓存/关闭/卸载/重新打开均通过。实际 Enter / Space 打开、Esc 关闭通过。375×812、768×1024、1440×900 下 1536×8000 原图保持比例、适应视口、没有横向溢出；手机实测显示约 134.4×700。新验证页面无 console error 或 warn。既有 `workspace.browser.html` 全部通过（真实切分、拼接、水印、尺寸调整、格式转换、改名、ZIP、工作流与池生命周期），无 console error。
12. **长图切分双预览**：完整 1536×8000 原图和宽 1536、高不超过 1200 的切片均验证成功；点击第二张切片显示独立结果序号并能翻页，关闭不释放结果 URL，重新点击上传原图仍显示完整 8000 高原图；预览 C 不改变当前处理图片 A。

可预览区域是独立 `role=button`，支持 Enter/Space，打开前聚焦该区域并在关闭后恢复焦点。删除、排序、当前图片选择、裁剪调整等按钮位于区域之外，避免嵌套按钮和事件误触。原来通过文件名/整行选择当前处理图片的行为改为独立选择按钮，保留原有 select 事件与当前图片下拉选择。

本轮没有 commit 或 push。预览截图在忽略的 `output/preview/` 目录。
