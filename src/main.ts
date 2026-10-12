import { createApp } from "vue";
import App from "./App.vue";
import { applyStoredTheme } from "./composables/useTheme.ts";
import "./style.css";

applyStoredTheme();
createApp(App).mount("#app");
