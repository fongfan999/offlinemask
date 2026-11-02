// Báo lỗi (decision 0147): the app opens the report page with the report in the fragment, and
// the site's Worker keeps what the page sends and nothing about who sent it.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reportKinds, reportUrl, systemName } from "../src/core/report.ts";
import worker, {
  copyToSheet,
  reportKinds as acceptedKinds,
  readReport,
} from "../../landing/worker.js";

test("the report travels in the fragment of the report page", () => {
  const url = new URL(
    reportUrl({
      kind: "missed",
      message: "  Số 0912.345.678 không được ẩn #lỗi & thử  ",
      version: "2.1.1",
      os: "macOS",
      screen: "Tài liệu",
    }),
  );
  assert.equal(`${url.origin}${url.pathname}`, "https://offlinemask.com/bao-loi");
  assert.equal(url.search, "");
  const fields = new URLSearchParams(url.hash.slice(1));
  assert.deepEqual(Object.fromEntries(fields), {
    kind: "missed",
    message: "Số 0912.345.678 không được ẩn #lỗi & thử",
    version: "2.1.1",
    os: "macOS",
    screen: "Tài liệu",
  });
});

test("the app, the page and the Worker offer the same kinds, labels and examples", () => {
  assert.deepEqual(
    reportKinds.map(({ kind }) => kind),
    acceptedKinds,
  );
  const page = readFileSync(new URL("../../landing/bao-loi.html", import.meta.url), "utf8");
  const offered = [
    ...page.matchAll(
      /name="kind"\s+value="(\w+)"\s+data-example="([^"]+)"[^>]*\/>([^<]+)<\/label/g,
    ),
  ].map(([, kind, example, label]) => ({ kind, label: label.replace(/\s+/g, " "), example }));
  assert.deepEqual(
    offered,
    reportKinds.map(({ kind, label, example }) => ({ kind, label, example })),
  );
});

test("only the operating system's family is named", () => {
  const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15";
  const windows = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/141.0";
  assert.equal(systemName(mac), "macOS");
  assert.equal(systemName(windows), "Windows");
  assert.equal(systemName("Mozilla/5.0 (X11; Linux x86_64)"), "Linux");
  assert.equal(systemName("Something else"), "");
});

test("the Worker keeps a report with no trace of the sender", async () => {
  const store = new Map();
  const env = {
    REPORTS: { put: async (key, value, { metadata }) => store.set(key, [value, metadata]) },
  };
  const post = (body) =>
    worker.fetch(
      new Request("https://offlinemask.com/report", {
        method: "POST",
        headers: { "cf-connecting-ip": "203.0.113.9", "user-agent": "Test" },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
      env,
    );
  const report = {
    kind: "crash",
    message: "Treo khi mở tệp",
    version: "2.1.1",
    os: "Windows",
    screen: "Bảng tính",
  };
  assert.equal((await post(report)).status, 204);
  assert.equal(store.size, 1);
  const [[key, [value, metadata]]] = store;
  assert.match(key, /^\d{4}-\d{2}-\d{2}T[\d:.]+Z [0-9a-f]{8}$/);
  const kept = JSON.parse(value);
  assert.deepEqual({ ...kept, at: undefined }, { ...report, at: undefined });
  assert.deepEqual(metadata, { kind: "crash", version: "2.1.1" });
  assert.ok(!value.includes("203.0.113.9") && !value.includes("Test"));

  for (const bad of [
    "not json",
    { ...report, kind: "spam" },
    { ...report, message: "   " },
    { ...report, message: "x".repeat(2001) },
    { ...report, version: "x".repeat(21) },
  ])
    assert.equal((await post(bad)).status, 400);
  assert.equal(
    (await worker.fetch(new Request("https://offlinemask.com/report"), env)).status,
    400,
  );
  assert.equal(store.size, 1);
});

test("a report without the app's details is still a report", () => {
  assert.deepEqual(readReport({ kind: "other", message: "Trang không mở" }), {
    kind: "other",
    message: "Trang không mở",
    version: "",
    os: "",
    screen: "",
  });
});

test("the Worker copies a stored report to the Sheet, after answering and only when set up", async () => {
  const store = new Map();
  const waiting = [];
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    sent.push([url, JSON.parse(init.body)]);
    return new Response("ok");
  };
  try {
    const env = {
      REPORTS: { put: async (key, value) => store.set(key, value) },
      REPORTS_SHEET_URL: "https://script.google.com/macros/s/test/exec",
      REPORTS_SHEET_SECRET: "s3cret",
    };
    const report = { kind: "idea", message: "Ẩn biển số xe", version: "2.6.1", os: "", screen: "" };
    const reply = await worker.fetch(
      new Request("https://offlinemask.com/report", {
        method: "POST",
        headers: { "cf-connecting-ip": "203.0.113.9" },
        body: JSON.stringify(report),
      }),
      env,
      { waitUntil: (promise) => waiting.push(promise) },
    );
    assert.equal(reply.status, 204);
    await Promise.all(waiting);
    const [[key]] = store;
    assert.equal(sent.length, 1);
    const [url, body] = sent[0];
    assert.equal(url, env.REPORTS_SHEET_URL);
    assert.deepEqual(
      { ...body, at: undefined },
      { secret: "s3cret", id: key, ...report, at: undefined },
    );
    assert.ok(!JSON.stringify(body).includes("203.0.113.9"));
  } finally {
    globalThis.fetch = realFetch;
  }

  let called = false;
  await copyToSheet({ id: "x" }, { REPORTS_SHEET_URL: "https://example.test" }, async () => {
    called = true;
  });
  assert.equal(called, false, "no secret, nothing sent");
  await copyToSheet(
    { id: "x" },
    { REPORTS_SHEET_URL: "https://example.test", REPORTS_SHEET_SECRET: "s" },
    async () => {
      throw new Error("offline");
    },
  );
});
