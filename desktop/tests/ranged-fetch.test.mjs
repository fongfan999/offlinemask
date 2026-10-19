import test from "node:test";
import assert from "node:assert/strict";
import {
  createRangedFetch,
  defaultChunkBytes,
  parseContentRange,
} from "../src/core/detection/ranged-fetch.ts";

const root = "asset://localhost/pack/";

function sample(length) {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) bytes[i] = (i * 7919 + (i >> 10)) & 255;
  return bytes;
}

/** A server shaped like Tauri's asset protocol: ranges honoured, replies capped. */
function server(bytes, { cap = defaultChunkBytes, log = [], delayMs = 0, active } = {}) {
  return async (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    const range = new Headers(init?.headers).get("range");
    log.push({ url, range });
    if (active) {
      active.now++;
      active.max = Math.max(active.max, active.now);
    }
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    if (active) active.now--;
    if (!range) return new Response(bytes, { status: 200 });
    const match = /^bytes=(\d+)-(\d+)$/.exec(range);
    const start = Number(match[1]);
    const end = Math.min(Number(match[2]), bytes.length - 1, start + cap - 1);
    if (start >= bytes.length) return new Response(null, { status: 416 });
    return new Response(bytes.subarray(start, end + 1), {
      status: 206,
      headers: {
        "content-range": `bytes ${start}-${end}/${bytes.length}`,
        "content-type": "application/octet-stream",
      },
    });
  };
}

async function body(response) {
  return new Uint8Array(await response.arrayBuffer());
}

test("parses only well-formed single ranges", () => {
  assert.deepEqual(parseContentRange("bytes 0-9/20"), { start: 0, end: 9, total: 20 });
  assert.equal(parseContentRange("bytes 0-20/20"), null);
  assert.equal(parseContentRange("bytes 5-4/20"), null);
  assert.equal(parseContentRange("bytes */20"), null);
  assert.equal(parseContentRange(null), null);
});

test("reassembles a file larger than the server's range cap, in order", async () => {
  const bytes = sample(3 * defaultChunkBytes + 12345);
  const log = [];
  const fetch = createRangedFetch({
    shouldRange: (url) => url.startsWith(root),
    fetch: server(bytes, { log }),
    chunkBytes: 8 * defaultChunkBytes,
  });
  const response = await fetch(`${root}model.onnx`, { headers: { accept: "*/*" } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-length"), String(bytes.length));
  assert.equal(response.headers.get("content-type"), "application/octet-stream");
  assert.deepEqual(await body(response), bytes);
  // The first reply revealed the cap; every later request asks for exactly one capped range.
  assert.equal(log.length, 4);
  assert.equal(log[1].range, `bytes=${defaultChunkBytes}-${2 * defaultChunkBytes - 1}`);
  assert.equal(log[3].range, `bytes=${3 * defaultChunkBytes}-${bytes.length - 1}`);
});

test("a file smaller than one range takes a single request", async () => {
  const bytes = sample(4096);
  const log = [];
  const fetch = createRangedFetch({ shouldRange: () => true, fetch: server(bytes, { log }) });
  assert.deepEqual(await body(await fetch(`${root}tokenizer.json`)), bytes);
  assert.equal(log.length, 1);
});

test("keeps at most the configured number of ranges in flight", async () => {
  const bytes = sample(10 * defaultChunkBytes);
  const active = { now: 0, max: 0 };
  const fetch = createRangedFetch({
    shouldRange: () => true,
    fetch: server(bytes, { active, delayMs: 2 }),
    concurrency: 2,
  });
  assert.deepEqual(await body(await fetch(`${root}model.onnx`)), bytes);
  assert.ok(active.max >= 2 && active.max <= 2, `max in flight ${active.max}`);
});

test("passes through other URLs, methods and explicit ranges untouched", async () => {
  const bytes = sample(2 * defaultChunkBytes);
  const log = [];
  const fetch = createRangedFetch({
    shouldRange: (url) => url.startsWith(root),
    fetch: server(bytes, { log }),
  });
  assert.deepEqual(await body(await fetch("/runtime/ort.wasm")), bytes);
  assert.deepEqual(await body(await fetch(`${root}model.onnx`, { method: "HEAD" })), bytes);
  await fetch(`${root}model.onnx`, { headers: { range: "bytes=0-1" } });
  assert.deepEqual(
    log.map((entry) => entry.range),
    [null, null, "bytes=0-1"],
  );
});

test("returns a plain 200 reply from a server that ignores ranges", async () => {
  const bytes = sample(3 * defaultChunkBytes);
  const fetch = createRangedFetch({
    shouldRange: () => true,
    fetch: async () => new Response(bytes, { status: 200 }),
  });
  assert.deepEqual(await body(await fetch(`${root}model.onnx`)), bytes);
});

test("rejects a reply whose range does not match the request", async () => {
  const bytes = sample(3 * defaultChunkBytes);
  const honest = server(bytes);
  let calls = 0;
  const fetch = createRangedFetch({
    shouldRange: () => true,
    fetch: async (input, init) => {
      const response = await honest(input, init);
      if (++calls !== 2) return response;
      return new Response(await response.arrayBuffer(), {
        status: 206,
        headers: { "content-range": `bytes 0-${defaultChunkBytes - 1}/${bytes.length}` },
      });
    },
  });
  const response = await fetch(`${root}model.onnx`);
  await assert.rejects(response.arrayBuffer(), /content range/);
});
