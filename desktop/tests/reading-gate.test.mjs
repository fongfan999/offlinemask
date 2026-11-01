import test from "node:test";
import assert from "node:assert/strict";
import { readingAvailable, readingShipped } from "../src/adapters/ocr.ts";
import definition from "../reading/reading-v1.json" with { type: "json" };

// Decision 0196: the app's asset server answers an unknown path with index.html, 200 and
// text/html, so "the manifest fetched fine" is not proof the models are in the build.
// Only the manifest the worker was built with counts.
const answering = (body, init = {}) => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(body, { status: 200, ...init });
  return () => (globalThis.fetch = original);
};

test(
  "the manifest the build carries makes reading available",
  { skip: !readingShipped },
  async () => {
    const restore = answering(JSON.stringify(definition), {
      headers: { "content-type": "application/json" },
    });
    try {
      assert.equal(await readingAvailable(), true);
    } finally {
      restore();
    }
  },
);

test(
  "the page served in place of a missing manifest does not",
  { skip: !readingShipped },
  async () => {
    const restore = answering('<!DOCTYPE html><html lang="vi"><head></head><body></body></html>', {
      headers: { "content-type": "text/html" },
    });
    try {
      assert.equal(await readingAvailable(), false);
    } finally {
      restore();
    }
  },
);

test(
  "another pack's manifest, a 404 and a network failure do not",
  { skip: !readingShipped },
  async () => {
    for (const [body, init] of [
      [JSON.stringify({ ...definition, id: "reading-v0" }), {}],
      ["", { status: 404 }],
    ]) {
      const restore = answering(body, init);
      try {
        assert.equal(await readingAvailable(), false);
      } finally {
        restore();
      }
    }
    const original = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new TypeError("Failed to fetch");
    };
    try {
      assert.equal(await readingAvailable(), false);
    } finally {
      globalThis.fetch = original;
    }
  },
);
