# TidyPic｜图整整

Vue 3 + Vite + TypeScript 本地图片工作台。图片不上传服务器，支持 PWA。

## 运行

建议 Node.js 24 LTS。

开发与生产预览统一使用 http://localhost:6001/ 。端口被占用时直接报错，不自动切换；除非用户明确要求，否则不得修改端口。

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

普通生产构建可将 `dist/` 发布到 HTTPS 静态站点根路径；GitHub Pages 工作流通过 `GITHUB_PAGES=true` 构建到 `/tidypic/` 子路径，部署步骤见[仓库根 README](../README.md)。PWA 仅在生产构建启用；首次在线缓存后支持离线使用，更新时由用户确认。浏览器菜单可安装应用，iOS 使用“分享 → 添加到主屏幕”。

## 当前功能

- 单张与批量共用上传入口，支持拖放、继续添加、逐项删除、清空。
- 紧凑可滚动文件列表，图片状态为读取中、等待、处理中、完成、失败。
- 输出参数栏：尺寸、文件大小、格式，点击展开对应设置；桌面横排，手机换行。
- 尺寸：原尺寸、限制宽度/高度/最长边、指定尺寸（等比适配/居中裁剪）。限制模式不放大。
- 大小：不限制、KB、MB、自定义数值、200KB/500KB/1MB/2MB 快捷值。
- 尺寸和文件大小一次处理；JPG/WebP 使用有限质量搜索，PNG 无法满足大小时明确报错。
- 尺寸、格式、大小全部满足时直接返回原文件，逐字节不变；避免额外有损压缩。
- JPG/PNG/WebP 输出，转换 JPG 时透明区域填白。已有格式转换使用同一批量引擎。
- 逐张下载；单张“下载图片”直接保存，多张“全部下载”打包为 `tidypic-images.zip`。
- 下载保留原文件名，换格式只换扩展名；ZIP 内重名自动加 `(2)` 等编号。
- 添加水印：文字/图片 Logo、九宫格单点、水平/交错平铺、实时预览与批量导出；透明 PNG 保留透明背景。
- 水印多张下载为 `tidypic-watermarked.zip`，单张直接下载。长图切分支持三种方式，图片拼接支持纵向与横向合成。

## 结构

```text
src/
  App.vue                          顶栏、工具箱、工具切换、PWA
  style.css                        中性灰 + 蓝色设计变量与响应式样式
  components/
    AppIcon.vue                    SVG 图标
    ParameterBar.vue               三个参数弹窗
    ImageUploadList.vue            共享上传与批量列表
    BatchResults.vue               共享结果与下载
    WatermarkPreview.vue           当前选中图片的实时预览
  tools/ImageWorkbench.vue         尺寸压缩与格式转换
  tools/WatermarkWorkbench.vue     水印设置及共享批量流程
  composables/useImageBatch.ts     images[] 状态及 UI 生命周期适配
  utils/image/
    types.ts                       ImageJob、OutputSettings 等协议
    geometry.ts                    尺寸验证、缩放和裁剪计算
    policy.ts                      是否可以直接保留原文件
    queue.ts                       独立于 Vue 的受控任务队列
    compress.ts                    编码器注入和有限压缩搜索
    browser.ts                     解码、缩略图、Canvas 处理
    names.ts                       文件名与 ZIP 重名处理
    download.ts                    浏览器下载与按需加载 JSZip
    watermark/types.ts             水印协议、默认值
    watermark/layout.ts            验证、比例、位置、平铺算法
    watermark/draw.ts              Canvas 绘制与导出
 tests/
    image.test.ts                  尺寸及压缩策略
    batch.test.ts                  并发、停止队列、原图保留、文件名
    watermark.test.ts              比例、九宫格、旋转边界与密度
```

品牌色由 `style.css` 顶部 `--accent`、`--accent-hover`、`--accent-soft`、`--focus` 管理。应用安装图标与 manifest theme_color 同步为蓝色；更换品牌时需一并更新静态图标和 manifest。

## 批量数据与生命周期

核心数据为 `images: ImageJob[]`。每项独立保存 `id`、`originalFile`、`filename`、尺寸、原大小、格式、小缩略图 URL、`processingStatus`、结果 Blob/尺寸/大小/格式、`preservedOriginal` 和错误。不存在单图/批量模式分支，单图只是数组长度为 1。

上传解码并发为 1：读取元信息并生成最长边 96px 的缩略图，然后立即关闭原始 ImageBitmap。处理并发为 2：按需解码，调用独立处理模块，最终关闭 Bitmap/释放 Canvas。一个失败任务不会中断队列；可单独重试，也可处理全部未完成项。成功项不会无故重跑；参数变化时旧结果清除。切换工具时停止继续派发任务，正在执行的任务结束后清理，不再回写结果。

JSZip 在下载多张结果时动态加载，使用 STORE 模式（图片已压缩，不再消耗 CPU 二次压缩），只打包成功结果。文件名去重不区分大小写，避免解压到大小写不敏感文件系统时覆盖。

纯尺寸计算、保留策略、任务队列、文件名算法独立于 Vue。微信小程序迁移时需替换浏览器编解码与 Blob/下载适配。

## 边界

- 仅支持 JPG、PNG、WebP；单文件最大 40MB，解码后最多 3200 万像素、单边不超过 16384px。输出参数最多 8192px，画布最多 3200 万像素。
- 文件与成功结果会保留在内存中，ZIP 也需在内存中生成。没有数量硬上限，但大量高分辨率图片仍可能耗尽浏览器内存；可减少单批数量或逐张下载。
- 读取、处理、ZIP 打包期间暂时禁用添加/删除/参数修改，防止批次状态冲突。结束后可继续添加。
- 刷新或切换工具清除当前批次，请先下载；PWA 只缓存应用资源，不存储用户图片。
- 原样保留路径保留源文件全部内容；Canvas 重编码不保留 EXIF 等元数据，动画 PNG/WebP 仅导出静态帧。
- 依赖浏览器 createImageBitmap、Canvas 与格式编码器；PNG 不支持通过质量参数降低文件大小。
- 移动布局已在 Chromium 的 320px / 390px 视口检查，尚未在真实 iOS/Android 设备上验证安装和大量图片内存表现。

详细验收记录见 [TESTING.md](./TESTING.md)。

## 水印实现

水印通过 `runWithProcessor` 接入原有队列，继续使用 `images[]` 和并发 2。预览仅处理当前选中图片，80ms 防抖，缓存最长边 1000px 的位图；参数变化只重绘 Canvas，不编码全部图片。导出使用原图分辨率，开始批处理前释放预览位图。

预设大小和间距按图片短边计算；自定义字号、边距、间距以 800px 短边为基准等比缩放，图片水印自定义宽度为原图宽度百分比。平铺按旋转后的外接矩形加间距计算步长，交错行偏移半个水平步长，边缘额外延展并裁掉画布外部分。

水印使用系统字体；不同系统的字形可能略有差异。JPEG/WebP 导出会重编码，水印工具不限制输出文件大小。极密平铺超过 5000 个候选位置会提示调整参数，防止长时间卡顿。Canvas、Bitmap 和 Object URL 在替换、清空、完成或卸载时释放。

## 长图切分 V1

入口 #split，支持按高度、按数量、自定义切线。复用统一上传、images[]、并发 2 队列和下载。runWithProcessor 增加兼容的第二参数 ImageJob，将切片关联到原图，既有工具处理器保持不变。

纯算法位于 src/utils/image/split/geometry.ts，逐片编码在 browser.ts。按高度保留尾段；按数量使用整除的商作为基础高度，将余数逐个分配给前面的切片。自定义切线以 Record<imageId, number[]> 独立保存每张图片的 Y 坐标，显示和导出排序，拒绝重复和边界外切线，每段至少 1px。

每张原图最多 100 片，沿用 40MB、3200 万像素、单边 16384px 限制。每次仅创建当前切片大小的输出画布，编码后立即释放；原始 Bitmap 按队列任务解码和释放。切片放大复用 PreviewLightbox，预览最长边 1600px。

文件名为原文件名_01.ext，100 片时使用三位编号。多文件下载 tidypic-split.zip，平铺目录，重名自动编号，复用 JSZip STORE；只有一片时直接下载。图片、切片 Blob 和 ZIP 仍占用内存；Safari/iOS 真机边界未验证。

## 图片拼接 V1

入口 #join，五个基础工具均已启用。至少两张可读取图片才允许导出，一张也可预览。上传列表仅新增可选 row-start 插槽，拼接通过 SortableImageList 注入 40×44px 排序手柄，使用 Pointer Events、边缘自动滚动和方向键排序，不影响其他工具。

- src/utils/image/stitch/geometry.ts：尺寸、整数位置、对齐、输出安全校验、格式选择。
- src/utils/image/stitch/browser.ts：合成绘制与编码，独立于 Vue。
- src/components/stitch/：参数弹窗、排序列表、低分辨率预览。
- src/tools/StitchWorkbench.vue：设置状态、处理按钮和单文件下载。

纵向自动统一到最小原图宽度，横向自动统一到最小原图高度；另一边等比计算并四舍五入到整数。保持原尺寸时使用最大横向占用空间，对齐偏移为 0、空白宽度/高度的一半向下取整、或全部空白。偏移与累积尺寸均使用整数，间距只出现在图片之间，避免小数累积白缝。

预览 100ms 防抖，合成画布最长边 1600px；各图缓存最长边不超过 512px 的代理位图，图片较多时进一步降低代理尺寸。参数变化只重绘预览，不编码成品。长图/宽图在预览区内滚动；放大复用 PreviewLightbox。正式导出前释放代理缓存，按顺序一次解码一张原图，绘制后立即关闭 Bitmap。输出单边不超过 16384px、总像素不超过 3200 万；超限先提示，不分配正式画布。

同格式输入默认保留格式，混合输入默认 PNG；可指定 JPG/PNG/WebP。透明背景输出 JPG 时提示并使用白底。编码质量沿用 0.95，文件名 tidypic-stitched.ext，无 ZIP。读取沿用 createImageBitmap 的 from-image 方向处理。

限制：预览用于构图，不代表完整输出的细节清晰度；输出仍需一张完整画布，受设备内存和浏览器限制。Safari/iOS 真机未验证。动画与元数据沿用既有 Canvas 行为。

## 批量改名 V1

工具箱新增 #rename：统一名称 + 编号、前缀、后缀，实时名称预览、排序、单文件下载和 tidypic-renamed.zip。现有排序列表提升为共享 SortableImageList，上传组件支持可选缩略图插槽。

- src/utils/files/rename.ts：按最后一个点拆分 basename/extension，保留扩展名原字符和大小写；纯命名、编号、安全字符与重名逻辑。
- src/composables/useRenameFiles.ts：File 列表，仅读取 16 字节签名，不调用图片处理模块。最多 200 文件，单文件 40MB，支持 .jpg/.jpeg/.png/.webp。
- src/components/rename/：紧凑参数弹窗和可见区域缩略图。缩略图交给浏览器 img 显示，IntersectionObserver 只为可见行创建 Object URL，离开可见区域或卸载后撤销；不调用 Canvas/createImageBitmap。
- src/tools/RenameWorkbench.vue：实时预览、完成状态与下载。

编号用起始值 + 当前列表下标；两位/三位模式按最终编号自动扩位，普通数字模式不补零。前后缀分别保留输入状态，后缀位于扩展名前。非法字符替换为下划线，清理首尾空白及尾部句点，处理 Windows 保留名称并显示提示。文件名超过 255 UTF-8 字节提示缩短。大小写不敏感、Unicode NFC 等价重名均阻止导出，不静默去重。

结果只引用原始 File 和新文件名；单文件直接下载，多文件复用 JSZip STORE，正式导出前再次检查重名。原文件不被修改，文件字节、格式和大小不发生变化。文件签名校验不等同于完整图片解码验证，无法显示缩略图时使用图标。ZIP 在内存中生成，大批大文件仍受设备内存限制；真实手机未验证。
