// Capture real OfflineMask UI states (built-in sample data only) at 2x via the Chrome DevTools
// protocol. With the desktop web dev server on :1420, run
// `node landing/scripts/capture-app-shots.mjs <dir> [light|dark]`, then convert the PNGs into
// landing/shots/ with `magick <name>.png -resize 2048x -quality 82 <name>.webp`.
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

// Text: built-in sample, masked, remaining name masked too.
await fresh();
await shot("home");
console.log(await click("Xem thử với ví dụ"));
await sleep(1200);
console.log(
  await evaluate(`(() => {
    const el = [...document.querySelectorAll('button')].find(e =>
      e.textContent.includes('Ẩn thông tin') && !(e.getAttribute('aria-label')||'').startsWith('Bước'));
    el.click(); return 'masked';
  })()`),
);
await sleep(2500);
console.log(await click("Ẩn “"));
await sleep(1500);
await shot("text-masked");
console.log(await click("Bản gốc"));
await sleep(1000);
await shot("text-original");
console.log(await click("Bản đã ẩn"));
await sleep(800);
const codes = await evaluate(
  `[...new Set(document.querySelector('main').innerText.match(/\\[[A-Z_]+_\\d+_[a-z0-9]+\\]/g) || [])]`,
);
console.log("codes", codes);

// Restore a fictional AI reply that uses those codes.
const code = (prefix) => codes.find((c) => c.startsWith(`[${prefix}_`));
const name = codes.find((c) => !/^\[(STK|GD|SDT|EMAIL)_/.test(c));
const reply = `Tóm tắt: Khách hàng ${name} (tài khoản ${code("STK")}) chuyển 2.500.000 đồng ngày 08/09/2026; giao dịch ${code("GD")} chưa đến người nhận.\n\nĐề xuất: gọi lại ${code("SDT")} trong hôm nay và gửi xác nhận tới ${code("EMAIL")}.`;
await evaluate(`document.querySelector('[aria-label="Bước 3: Khôi phục"]').click()`);
await sleep(1200);
console.log(
  await evaluate(`(() => {
    const area = document.querySelector('textarea[placeholder^="Dán phản hồi"]');
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    set.call(area, ${JSON.stringify(reply)});
    area.dispatchEvent(new Event('input', { bubbles: true }));
    return 'reply';
  })()`),
);
await sleep(1500);
await shot("text-restored");

// Spreadsheet sample.
await fresh();
console.log(await click("Bảng tính"));
await sleep(1200);
console.log(await click("Thử với tệp mẫu"));
await sleep(2500);
await shot("sheet-review");
console.log(
  await evaluate(`(() => {
    const el = document.querySelector('.primary-action');
    if (!el) return 'no primary'; el.click(); return el.textContent.trim();
  })()`),
);
await sleep(3000);
await shot("sheet-masked");

// Document sample.
await fresh();
console.log(await click("Tài liệu"));
await sleep(1200);
console.log(await click("Thử với tệp mẫu"));
await sleep(3000);
await shot("doc-review");
console.log(
  await evaluate(`(() => {
    const el = document.querySelector('.primary-action');
    if (!el) return 'no primary'; el.click(); return el.textContent.trim();
  })()`),
);
await sleep(3500);
await shot("doc-masked");

ws.close();
chrome.kill();
