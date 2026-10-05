# 共享图片池 + 自定义工具流：实现与验证报告

完成日期：2026-10-05。未 commit，未 push。开发与预览仍固定 localhost:6001，strictPort=true；没有修改 GitHub Pages 部署配置或增加依赖。

## 1. 修改文件

本轮共修改/新增 40 个实现与测试文件，另新增本报告。下方为完整清单；通用剪贴板 uploader 沿用上一轮实现。

- [src/App.vue](/Users/archt/TidyPic/tidypic/src/App.vue)
- [src/components/AppIcon.vue](/Users/archt/TidyPic/tidypic/src/components/AppIcon.vue)
- [src/components/ParameterBar.vue](/Users/archt/TidyPic/tidypic/src/components/ParameterBar.vue)
- [src/components/SortableImageList.vue](/Users/archt/TidyPic/tidypic/src/components/SortableImageList.vue)
- [src/components/WatermarkPreview.vue](/Users/archt/TidyPic/tidypic/src/components/WatermarkPreview.vue)
- [src/components/resize/PresetControls.vue](/Users/archt/TidyPic/tidypic/src/components/resize/PresetControls.vue)
- [src/components/resize/ResizeParameters.vue](/Users/archt/TidyPic/tidypic/src/components/resize/ResizeParameters.vue)
- [src/components/resize/TransformPreview.vue](/Users/archt/TidyPic/tidypic/src/components/resize/TransformPreview.vue)
- [src/components/split/GuideEditor.vue](/Users/archt/TidyPic/tidypic/src/components/split/GuideEditor.vue)
- [src/components/stitch/StitchPreview.vue](/Users/archt/TidyPic/tidypic/src/components/stitch/StitchPreview.vue)
- [src/composables/useImageBatch.ts](/Users/archt/TidyPic/tidypic/src/composables/useImageBatch.ts)
- [src/composables/useRenameFiles.ts](/Users/archt/TidyPic/tidypic/src/composables/useRenameFiles.ts)
- [src/style.css](/Users/archt/TidyPic/tidypic/src/style.css)
- [src/tools/ImageWorkbench.vue](/Users/archt/TidyPic/tidypic/src/tools/ImageWorkbench.vue)
- [src/tools/RenameWorkbench.vue](/Users/archt/TidyPic/tidypic/src/tools/RenameWorkbench.vue)
- [src/tools/ResizeWorkbench.vue](/Users/archt/TidyPic/tidypic/src/tools/ResizeWorkbench.vue)
- [src/tools/SplitWorkbench.vue](/Users/archt/TidyPic/tidypic/src/tools/SplitWorkbench.vue)
- [src/tools/StitchWorkbench.vue](/Users/archt/TidyPic/tidypic/src/tools/StitchWorkbench.vue)
- [src/tools/WatermarkWorkbench.vue](/Users/archt/TidyPic/tidypic/src/tools/WatermarkWorkbench.vue)
- [src/utils/image/browser.ts](/Users/archt/TidyPic/tidypic/src/utils/image/browser.ts)
- [src/utils/image/stitch/browser.ts](/Users/archt/TidyPic/tidypic/src/utils/image/stitch/browser.ts)
- [src/utils/image/types.ts](/Users/archt/TidyPic/tidypic/src/utils/image/types.ts)
- [src/utils/presets/model.ts](/Users/archt/TidyPic/tidypic/src/utils/presets/model.ts)
- [src/components/ToolInputSelection.vue](/Users/archt/TidyPic/tidypic/src/components/ToolInputSelection.vue)
- [src/components/WorkflowStepEditor.vue](/Users/archt/TidyPic/tidypic/src/components/WorkflowStepEditor.vue)
- [src/components/rename/RenameSettingsEditor.vue](/Users/archt/TidyPic/tidypic/src/components/rename/RenameSettingsEditor.vue)
- [src/components/watermark/WatermarkContent.vue](/Users/archt/TidyPic/tidypic/src/components/watermark/WatermarkContent.vue)
- [src/composables/useImageWorkspace.ts](/Users/archt/TidyPic/tidypic/src/composables/useImageWorkspace.ts)
- [src/composables/usePointerSort.ts](/Users/archt/TidyPic/tidypic/src/composables/usePointerSort.ts)
- [src/data/tools.ts](/Users/archt/TidyPic/tidypic/src/data/tools.ts)
- [src/processors/images.ts](/Users/archt/TidyPic/tidypic/src/processors/images.ts)
- [src/processors/workflow.ts](/Users/archt/TidyPic/tidypic/src/processors/workflow.ts)
- [src/tools/WorkflowWorkbench.vue](/Users/archt/TidyPic/tidypic/src/tools/WorkflowWorkbench.vue)
- [src/utils/image/pool.ts](/Users/archt/TidyPic/tidypic/src/utils/image/pool.ts)
- [src/utils/workflow/model.ts](/Users/archt/TidyPic/tidypic/src/utils/workflow/model.ts)
- [src/utils/workflow/runtime.ts](/Users/archt/TidyPic/tidypic/src/utils/workflow/runtime.ts)
- [src/utils/workflow/storage.ts](/Users/archt/TidyPic/tidypic/src/utils/workflow/storage.ts)
- [tests/pool.test.ts](/Users/archt/TidyPic/tidypic/tests/pool.test.ts)
- [tests/workflow.test.ts](/Users/archt/TidyPic/tidypic/tests/workflow.test.ts)
- [tests/workspace.browser.html](/Users/archt/TidyPic/tidypic/tests/workspace.browser.html)

## 2. 共享图片池结构

`ImageAsset` 保存 id、原始 File、name/type/size、width/height/format、缩略图 objectUrl、低分辨率 previewBlob/previewObjectUrl、导入 status/error。workspace 保存 assets 顺序、activeId、loading 和正在处理/打包的任务计数；工具参数与处理结果属于各工具自身。

## 3. 切换工具不会丢图片

App 根组件 provide 一份 useImageWorkspace；六个工具和工具流 inject 同一实例。useImageBatch 把共享资产映射成工具自己的 job，并复用相同 File 引用。普通工具卸载只清理自身结果，源图仍留在池中。导入时读取原图一次并建立共享缩略图与缩小预览；切换页面的预览解码共享 previewBlob，不重新读取原始 File。实际处理时才按需读取原图。

## 4. single / multiple

多图工具使用全部有效源图片；长图切分通过“当前图片”选择器使用 active image，缺失时回退第一张。其它图片仍留在池中。共享删除/清空/排序同步影响所有工具；不会把普通工具生成结果自动设成新原图。

## 5. capability

ToolDefinition 统一描述 id/name/icon/group、inputMode、minImages、maxImages、outputMode。resize/convert/watermark/rename 为 N→N，join 至少2张且 N→1，split 单张且1→N；rename 沿用最多200张限制。普通工具的输入选择、工作流预检和实际 runtime 都使用此规则。

## 6. processor 复用

`processors/images.ts` 建立六个共用入口：resizeImage、convertImage、watermarkImage、stitchImages、splitImage、renameEntries。resize/convert、水印、拼接、切分几何/编码、改名仍调用已有 utils；把切分页内的处理循环作最小抽离。普通页面与工具流调用相同入口，没有第二套图片算法。

## 7. runtime 数据结构

RuntimeImage 包含 File、文件名、尺寸、格式和 generated 标识。每步保存 StepState：id、idle/processing/success/error、inputCount/outputCount、elapsedMs、error。执行参数使用快照，按步骤顺序串行执行；某步失败立即终止，后续保持 idle。排序与删除直接更改实际步骤数组。

## 8. 数量转换

每步返回 RuntimeImage[]，其输出数组作为下一步输入。预检调用现有尺寸/切片几何预估数量、尺寸和命名；runtime 再校验真实输入/输出数量。浏览器验证3张拼接→1张→切成5张成功，切分后多图水印成功。数量不符时保留步骤、显示原因并禁用开始。

## 9. 中间资源

runtime 只保留当前一代文件，旧中间 Blob/File 在下一步替换后失去引用，由浏览器回收；不保存所有步骤的大图。processor 的 ImageBitmap 在 finally 关闭，图片水印 logo 同样关闭；中间步骤不创建 ObjectURL。最终预览 URL 在修改输入/步骤或卸载时释放；共享源预览 URL 只在删除、清空或整个 workspace 销毁时释放，包括异步导入在销毁后才返回的 URL。任务计数在真正异步结束时归还，避免切换工具提前解除资源锁。40MB 限制仍适用于用户导入，内部生成文件允许作为后续输入，仍执行格式/像素安全校验。

## 10. 我的预设

工具流直接使用现有 ResizeParameters、PresetControls、useImagePresets 与原有存储。支持保存当前模块设置及应用已有用户预设；旧预设解析兼容仍受现有测试覆盖。其它模块也复用现有参数组件；抽出水印内容和改名参数供普通页面共用。

## 11. 系统预设

工作流 resize 设置传入 userOnly，整个常用/平台预设区均不渲染，仅显示“我的预设”。实际浏览器检查确认没有平台或系统默认预设；普通尺寸调整页仍保留原有预设。

## 12. 我的工具流

localStorage key 为 tidypic.workflows.v1；外层和每条 Workflow 均为 version:1。Workflow 包含 id/name/createdAt/updatedAt/steps，step 为 id/type/settings。支持保存、另存为、读取，恢复参数与步骤顺序。解析校验版本、类型、枚举、日期、重复id和图片水印数据；损坏/未知版本显示错误，不覆盖旧记录。Logo 用已验证的真实图片 MIME 存为 data URL，不依赖临时 URL。

## 13. 测试结果

- npm test：79/79 通过，无失败、无跳过。覆盖全部原有测试及新增共享池、任务锁、预检、runtime、失败停止、排序、持久化、异常schema测试。
- tests/workspace.browser.html：真实 Vue 组件与真实处理器全部通过：六工具保留3图及 File/metadata 身份、切换不重读原图、共享 URL 生命周期、active B 单图切分、普通结果隔离、拼接→切分5图、resize→watermark→WebP→rename、多图水印、图片 Logo、40MB导入校验与生成文件解码、5图 ZIP 创建并解包、中间结果隔离、失败停止、排序执行、保存恢复、共享删除/清空。
- 实际页面操作：参数编辑、删除步骤、数量不足提示与禁用、鼠标拖动改变顺序后真实执行成功、用户预设保存应用、整条工具流保存后刷新恢复成功。
- tests/clipboard.browser.html 浏览器回归全部通过：PNG/JPEG/WebP、连续/多图/去重、纯文本及输入区域保护、40MB/不支持格式错误、三入口一致、改名200张限制。剪贴板原有单元测试通过；通用 uploader 的选择/拖拽/粘贴仍接入 batch.add→workspace.add，共享格式和大小校验。
- 浏览器测试在 localhost:6001/tests/workspace.browser.html，点击“运行共享图片池与工具流验证”可复现；不新增自动化依赖，也不进入生产包。

## 14. 默认构建

npm run build 成功；vue-tsc 与 Vite 均通过，PWA service worker 正常生成。

## 15. GitHub Pages 构建

GITHUB_PAGES=true npm run build 成功，base=/tidypic/，PWA service worker 正常生成。未改部署逻辑。

## 16. 375px 移动端

实际375px视口验证：参数编辑、预设下拉、步骤操作、执行/结果可用，无横向溢出（scrollWidth≤375）；编辑区宽328px。已保存完整截图 output/playwright/workflow-mobile.png。测试创建的 QA 预设及工具流记录已清除，其它用户记录保留。

## 17. 遗留与验证边界

未发现阻塞功能问题。共享源图按要求仅保留当前浏览会话，刷新需重新导入；工具流与我的预设持久保存。较大的图片水印可能达到 localStorage 配额，保存会显示错误。已验证本地浏览器与两种静态构建，未部署线上 Pages，也未实际安装 PWA 验证；本轮没有发布操作。所有图片仍在浏览器本地处理。
