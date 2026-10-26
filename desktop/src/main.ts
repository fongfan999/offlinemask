import { createApp } from "vue";
import App from "./App.vue";
import { refuseStrayFileDrops } from "./composables/strayDrops.ts";
import { applyStoredTheme } from "./composables/useTheme.ts";
import "./style.css";

applyStoredTheme();
refuseStrayFileDrops();
createApp(App).mount("#app");
