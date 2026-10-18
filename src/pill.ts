import { createApp } from "vue";
import PillApp from "./PillApp.vue";
import { applyStoredTheme } from "./composables/useTheme.ts";
import "./style.css";

// The floating quick-action panel (decision 0090): a second, tiny window.
applyStoredTheme();
createApp(PillApp).mount("#app");
