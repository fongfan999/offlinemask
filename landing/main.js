import "./product.css";
import { initOfflineMask } from "./product.js";

const dispose = initOfflineMask(document.querySelector("[data-om-page]"));
if (import.meta.hot) import.meta.hot.dispose(dispose);
