import { createApp } from "vue";
import App from "./App.vue";
import "./style.css";
import { preventPageZoom } from "./utils/browser/preventPageZoom";
const restorePageZoom = preventPageZoom();
if (import.meta.hot) import.meta.hot.dispose(restorePageZoom);
createApp(App).mount("#app");
