# 图整整 · 店图工具箱

项目位于 [tidypic](./tidypic/README.md)。

```sh
cd tidypic
npm install
npm run dev
```

## GitHub Pages 自动部署

前端项目位于 `tidypic/`，workflow 为 `.github/workflows/pages.yml`。

1. 在 GitHub 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
2. 在 GitHub Desktop 检查部署配置的改动，提交到 `main`，然后由你点击 **Push origin**。
3. 在 GitHub 的 **Actions** 中查看 `Deploy TidyPic to GitHub Pages`。也可以选择 `main` 后点击 **Run workflow** 手动触发。
4. 成功后访问 https://rizxlab.github.io/tidypic/ ，也可以从手机浏览器打开并添加到主屏幕。

工作流使用 Node.js 24，在 `tidypic/` 中执行 `npm ci`、`npm test`、`npm run build`，上传 `tidypic/dist` 到 Pages artifact，再通过官方 Pages Actions 部署。`dist` 保持忽略，不提交到 main，不需要 gh-pages 分支或个人 Token。

CI 构建设置 `GITHUB_PAGES=true`，Vite base、manifest、图标和 Service Worker 使用 `/tidypic/`。不设置该变量时仍使用 `/`，本地开发端口固定为 6001。

本地验证 Pages 构建（macOS/Linux）：

```sh
cd tidypic
GITHUB_PAGES=true npm run build
GITHUB_PAGES=true npm run preview
# 访问 http://localhost:6001/tidypic/
```

恢复普通本地预览前，停止上述预览，再执行 `npm run build`、`npm run preview`；`npm run dev` 始终按默认环境在 http://localhost:6001/ 运行。不要同时启动多个占用 6001 的服务。

PWA 首次需要在线加载，之后可离线访问；已有安装遇到更新提示时确认更新。Pages 部署是否成功以首次远端 Actions 运行结果为准。
