// Capture real OfflineMask UI states (built-in or fictional sample data only) at 2x via the Chrome DevTools
// protocol. With the desktop web dev server on :1420, run
// `node landing/scripts/capture-app-shots.mjs <dir> [light|dark]`, then convert the PNGs into
// landing/shots/ with `magick <name>.png -resize 2048x -quality 82 <name>.webp`.
//
// The published text-original and text-masked shots come from the desktop app with the Vietnamese recognition pack,
// so the name is masked too: size the window to 1280x788, run the same letter with a "Họ và tên"
// line, capture the window below its title bar and crop with
// `magick <frame>.png -crop 2528x1500+16+0 +repage -resize '2048x1216!' -quality 82 <name>.webp`.
// Then add the hero's smaller sizes for its srcset: `magick <name>.webp -resize 800x -quality 82
// <name>-800.webp`, and the same for 1280.
// The text flow below is the web-build fallback without a name; without the pack the app warns that
// names were not checked, so the published shots come from the desktop app. Only the text shots are
// published; spreadsheets and documents are drawn in HTML on the product page.
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";

const out = process.argv[2];
const app = "http://localhost:1420/";
const port = 9333;
mkdirSync(out, { recursive: true });
const chrome = spawn(
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${out}/../chrome-profile`,
    "--hide-scrollbars",
    "--window-size=1440,1000",
    "about:blank",
  ],
  { stdio: "ignore" },
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50; i++) {
  try {
    targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    if (targets.length) break;
  } catch {
    // Chrome is still starting.
  }
  await sleep(200);
}
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const n = ++id;
    pending.set(n, resolve);
    ws.send(JSON.stringify({ id: n, method, params }));
  });
const evaluate = async (expression) => {
  const { result } = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result?.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result?.result?.value;
};
const click = (text, extra = "") =>
  evaluate(`(() => {
    const el = [...document.querySelectorAll('button, a')].find(e =>
      e.textContent.replace(/\\s+/g,' ').includes(${JSON.stringify(text)}) ${extra});
    if (!el) return 'missing: ' + ${JSON.stringify(text)};
    el.click(); return 'ok';
  })()`);
const shot = async (name) => {
  const { result } = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${out}/${name}.png`, Buffer.from(result.data, "base64"));
  console.log("saved", name);
};
const fresh = async () => {
  await send("Page.navigate", { url: app });
  await sleep(2500);
};

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 1280,
  height: 800,
  deviceScaleFactor: 2,
  mobile: false,
});
await send("Emulation.setEmulatedMedia", {
  features: [
    { name: "prefers-color-scheme", value: process.argv[3] ?? "light" },
    { name: "prefers-reduced-motion", value: "reduce" },
  ],
});

// Text: a fictional support message with no personal name, so everything the built-in rules
// catch is masked and no name code appears (names need the recognition pack, which the web build
// cannot run). Shot at 1280x760 so the text panel fills the frame.
await send("Emulation.setDeviceMetricsOverride", {
  width: 1280,
  height: 760,
  deviceScaleFactor: 2,
  mobile: false,
});
const TEXT = `Kính gửi bộ phận hỗ trợ,

Mã khách hàng: KH20931
Số CCCD: 079198004521
Số tài khoản: 001234567890
Số điện thoại: 0901234567
Email: lienhe.kh20931@example.com

Ngày 08/09/2026, tôi chuyển 2.500.000 đồng nhưng người nhận chưa nhận được tiền. Vui lòng kiểm tra giúp giao dịch có mã GD202609080126.

Trân trọng.`;
const setArea = (selector, value) =>
  evaluate(`(() => {
    const area = document.querySelector(${JSON.stringify(selector)});
    if (!area) return 'no area';
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    set.call(area, ${JSON.stringify(value)});
    area.dispatchEvent(new Event('input', { bubbles: true }));
    return 'set';
  })()`);
// Frame the text panel: scroll so the step card sits near the top of the view.
const frame = () =>
  evaluate(`(() => {
    const steps = document.querySelector('[aria-label="Bước 1: Ẩn thông tin"]');
    if (!steps) return 'no steps';
    const box = steps.parentElement.parentElement;
    let el = box;
    while (el && el !== document.body) {
      const s = getComputedStyle(el);
      if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight) break;
      el = el.parentElement;
    }
    const top = box.getBoundingClientRect().top - 24;
    if (el && el !== document.body) el.scrollTop += top; else window.scrollBy(0, top);
    return 'framed';
  })()`);

await fresh();
// Home's text field opens the text page (decision 0172); the page swaps in with a transition.
console.log(await click("Hoặc gõ, dán văn bản"));
await sleep(2000);
console.log(await setArea("#text-input", TEXT));
await sleep(800);
console.log(
  await evaluate(`(() => {
    const el = document.querySelector('.glass-card .primary-action');
    if (!el) return 'no mask button'; el.click(); return 'masked';
  })()`),
);
await sleep(2500);
const codes = await evaluate(
  `[...new Set(document.querySelector('main').innerText.match(/\\[[A-Z_]+_\\d+_[a-z0-9]+\\]/g) || [])]`,
);
console.log("codes", codes);
console.log(await frame());
await sleep(600);
await shot("text-masked");
console.log(await click("Bản gốc"));
await sleep(800);
await shot("text-original");
console.log(await click("Bản đã ẩn"));
await sleep(500);
const code = (prefix) => codes.find((c) => c.startsWith(`[${prefix}_`));
const reply = `Chào quý khách ${code("KH")}, chúng tôi đã kiểm tra giao dịch ${code("GD")} từ tài khoản ${code("STK")}: tiền đang được hoàn lại trong 24 giờ.\n\nChúng tôi sẽ gọi lại số ${code("SDT")} và gửi xác nhận tới ${code("EMAIL")}.`;
await evaluate(`document.querySelector('[aria-label="Bước 3: Khôi phục"]').click()`);
await sleep(1000);
console.log(await setArea('textarea[placeholder^="Dán phản hồi"]', reply));
await sleep(1500);
console.log(await frame());
await sleep(600);
await shot("text-restored");
ws.close();
chrome.kill();
