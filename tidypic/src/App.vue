<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useRegisterSW } from "virtual:pwa-register/vue";
import AppIcon from "./components/AppIcon.vue";
import ResizeWorkbench from "./tools/ResizeWorkbench.vue";
import ImageWorkbench from "./tools/ImageWorkbench.vue";
import RenameWorkbench from "./tools/RenameWorkbench.vue";
import StitchWorkbench from "./tools/StitchWorkbench.vue";
import SplitWorkbench from "./tools/SplitWorkbench.vue";
import WatermarkWorkbench from "./tools/WatermarkWorkbench.vue";
const tools = [
  {
    id: "resize",
    name: "尺寸调整 + 压缩",
    icon: "resize",
    desc: "尺寸与大小，一次搞定",
  },
  {
    id: "convert",
    name: "格式转换",
    icon: "convert",
    desc: "JPG、PNG、WebP 自由转换",
  },
  {
    id: "watermark",
    name: "添加水印",
    icon: "watermark",
    desc: "为图片添加文字或 Logo",
  },
  { id: "split", name: "长图切分", icon: "split", desc: "长图分段，轻松上传" },
  {
    id: "join",
    name: "图片拼接",
    icon: "join",
    desc: "多张图片，整齐拼在一起",
  },
  { id: "rename", name: "批量改名", icon: "rename", desc: "批量整理文件名" },
];
const current = ref("resize"),
  menu = ref(false),
  menuEl = ref<HTMLElement>();
function syncRoute() {
  const id = location.hash.slice(1);
  current.value = tools.some((t) => t.id === id) ? id : "resize";
}
function select(id: string) {
  current.value = id;
  location.hash = id;
  menu.value = false;
}
function outside(e: PointerEvent) {
  if (!menuEl.value?.contains(e.target as Node)) menu.value = false;
}
const { needRefresh, updateServiceWorker } = useRegisterSW();
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
const installPrompt = ref<InstallPrompt>();
function canInstall(e: Event) {
  e.preventDefault();
  installPrompt.value = e as InstallPrompt;
}
async function install() {
  if (!installPrompt.value) return;
  await installPrompt.value.prompt();
  await installPrompt.value.userChoice;
  installPrompt.value = undefined;
}
onMounted(() => {
  syncRoute();
  window.addEventListener("hashchange", syncRoute);
  document.addEventListener("pointerdown", outside);
  window.addEventListener("beforeinstallprompt", canInstall);
});
onUnmounted(() => {
  window.removeEventListener("hashchange", syncRoute);
  document.removeEventListener("pointerdown", outside);
  window.removeEventListener("beforeinstallprompt", canInstall);
});
</script>
<template>
  <header class="app-header">
    <div class="header-left">
      <a href="#resize" class="brand" @click="select('resize')"
        ><span class="brand-mark"><AppIcon :size="22" /></span
        ><strong>图整整</strong></a
      >
      <div ref="menuEl" class="tool-menu" @keydown.esc="menu = false">
        <button
          class="tool-trigger"
          :aria-expanded="menu"
          aria-controls="tool-options"
          @click="menu = !menu"
        >
          <AppIcon name="grid" :size="18" />工具箱<AppIcon
            class="tool-chevron" name="chevron" :size="14"
          />
        </button>
        <nav
          v-if="menu"
          id="tool-options"
          class="menu-popover"
          aria-label="工具选择"
        >
          <button
            v-for="tool in tools"
            :key="tool.id"
            :class="{ selected: current === tool.id }"
            @click="select(tool.id)"
          >
            <AppIcon :name="tool.icon" /><span>{{ tool.name }}</span
            ><AppIcon v-if="current === tool.id" name="check" :size="16" />
          </button>
          <button v-if="installPrompt" @click="install">
            <AppIcon name="download" :size="18" />安装应用
          </button>
        </nav>
      </div>
    </div>
    <div class="header-right" aria-hidden="true"></div>
  </header>
  <main>
    <div v-if="needRefresh" class="update-notice">
      新版本已准备好，请保存处理结果后更新。<button
        @click="updateServiceWorker()"
      >
        更新应用
      </button>
    </div>
    <ResizeWorkbench v-if="current === 'resize'" />
    <ImageWorkbench
      v-else-if="current === 'convert'"
      :key="current"
      :tool="current"
    />
    <SplitWorkbench v-else-if="current === 'split'" />
    <WatermarkWorkbench v-else-if="current === 'watermark'" />
    <StitchWorkbench v-else-if="current === 'join'" />
    <RenameWorkbench v-else />
  </main>
</template>
