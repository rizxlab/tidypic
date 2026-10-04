import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";
// Pages is a repository subpath; local development/preview stays at /.
const base = process.env.GITHUB_PAGES === "true" ? "/tidypic/" : "/";
export default defineConfig({
  base,
  server: { port: 6001, strictPort: true },
  preview: { port: 6001, strictPort: true },
  plugins: [
    vue(),
    VitePWA({
      registerType: "prompt",
      base,
      scope: base,
      includeAssets: ["icon.svg", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "图整整",
        short_name: "图整整",
        description: "店图工具箱 · 图片仅在本机处理",
        lang: "zh-CN",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#f6f7f9",
        theme_color: "#365cf5",
        icons: [
          {
            src: `${base}icon-192.png`,
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: `${base}icon-512.png`,
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
});
