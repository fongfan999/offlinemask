import { createApp } from "vue";
import PillApp from "./PillApp.vue";
import { refuseStrayFileDrops } from "./composables/strayDrops.ts";
import { applyStoredTheme } from "./composables/useTheme.ts";
import "./style.css";

// The floating quick-action panel (decision 0090): a second, tiny window.
applyStoredTheme();
refuseStrayFileDrops();
createApp(PillApp).mount("#app");
