import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  packInstalledBytes,
  packTransportBytes,
  recognitionPack,
  validatePackDefinition,
} from "../src/core/detection/pack.ts";
import { createRecognition, loadPackRecognition } from "../src/core/detection/recognition.ts";
import { loadNativeRecognition } from "../src/core/detection/native-recognition.ts";
import { createModelRunner } from "../src/core/detection/model-runner.ts";

const hash = (seed) => seed.repeat(64).slice(0, 64);
const asset = (directory, name, overrides = {}) => ({
  directory,
  name,
  bytes: 10,
  sha256: hash("a"),
  transport: { url: null, bytes: 10, sha256: hash("a"), encoding: "identity", parts: [] },
  ...overrides,
});
const modelFiles = (directory, graph = "model") =>
  [`${graph}.onnx`, "config.json", "tokenizer.json", "tokenizer_config.json"].map((name) =>
    asset(directory, name),
  );
const minimal = () => ({
  id: "synthetic-pack",
  name: "Synthetic pack",
  attribution: "Synthetic fixtures only.",
  models: [{ directory: "one", source: "One", graph: "model", offsets: "sequential" }],
  assets: modelFiles("one"),
});

test("the shipping pack definition is valid and self-consistent", async () => {
  const raw = JSON.parse(
    await readFile(new URL("../packs/vietnamese-pii-v1.json", import.meta.url)),
  );
  assert.deepEqual(validatePackDefinition(raw), recognitionPack);
  assert.equal(recognitionPack.id, "vietnamese-pii-v1");
  assert.ok(recognitionPack.models.length >= 1);
  assert.ok(recognitionPack.models.some((model) => model.offsets === "native"));
  // Settings shows these two figures; they come from the same pinned catalog the installer uses.
  assert.equal(packTransportBytes(), 712_190_910);
  assert.equal(packInstalledBytes(), 1_137_855_937);
});

test("pack validation rejects what a contributor is most likely to get wrong", () => {
  assert.doesNotThrow(() => validatePackDefinition(minimal()));
  const broken = [
    ["no models", (p) => (p.models = [])],
    ["unsafe id", (p) => (p.id = "../elsewhere")],
    ["blank name", (p) => (p.name = " ")],
    ["bad offsets", (p) => (p.models[0].offsets = "guess")],
    ["missing graph file", (p) => (p.models[0].graph = "absent")],
    ["missing tokenizer", (p) => p.assets.splice(2, 1)],
    ["duplicate model", (p) => p.models.push({ ...p.models[0] })],
    ["orphan asset directory", (p) => p.assets.push(asset("two", "model.onnx"))],
    ["duplicate asset", (p) => p.assets.push(asset("one", "model.onnx"))],
    ["bad hash", (p) => (p.assets[0].sha256 = "nope")],
    ["zero bytes", (p) => (p.assets[0].bytes = 0)],
    ["http url", (p) => (p.assets[0].transport.url = "http://example.com/x")],
    ["credentials in url", (p) => (p.assets[0].transport.url = "https://u:p@example.com/x")],
    ["identity mismatch", (p) => (p.assets[0].transport.bytes = 11)],
    ["installer-owned LICENSE", (p) => p.assets.push(asset("one", "LICENSE"))],
    ["label map values", (p) => (p.models[0].labels = { PER: 3 })],
    ["score above one", (p) => (p.models[0].minScore = 1.2)],
    ["score as text", (p) => (p.models[0].minScore = "0.3")],
    [
      "parts do not add up",
      (p) =>
        (p.assets[0].transport = {
          url: null,
          bytes: 10,
          sha256: hash("b"),
          encoding: "zstd",
          parts: [{ url: "https://example.com/a", bytes: 4, sha256: hash("c") }],
        }),
    ],
    [
      "url with parts",
      (p) =>
        (p.assets[0].transport = {
          url: "https://example.com/all",
          bytes: 4,
          sha256: hash("b"),
          encoding: "zstd",
          parts: [{ url: "https://example.com/a", bytes: 4, sha256: hash("c") }],
        }),
    ],
  ];
  for (const [label, mutate] of broken) {
    const pack = minimal();
    mutate(pack);
    assert.throws(() => validatePackDefinition(pack), /Invalid recognition pack/, label);
  }
  // Unpublished developer packs may omit download URLs; the app reports them as unavailable.
  const unpublished = minimal();
  unpublished.assets[0].transport.url = null;
  assert.doesNotThrow(() => validatePackDefinition(unpublished));
});

/** A fake model whose tokenizer splits on spaces and that labels one known name. */
function fakeSession(log, { name = "Lê Minh An", label = "B-PERSON" } = {}) {
  const words = (text) => text.split(/(?<= )|(?= )/u).filter((piece) => piece.trim());
  return {
    tokenizer: { encode: (text) => words(text).map((_, i) => i + 1) },
    async predict(text) {
      log.predicted.push(text);
      const pieces = words(text);
      return pieces.map((word, i) => ({
        word,
        index: i + 1,
        entity: name.split(" ").includes(word)
          ? word === name.split(" ")[0]
            ? label
            : label.replace("B-", "I-")
          : "O",
        score: 1,
      }));
    },
    async dispose() {
      log.disposed++;
    },
  };
}
/** Native offsets for the same space tokenizer, as the Rust tokenizer would report them. */
async function fakeEncode(text, directory) {
  const ids = [],
    offsets = [];
  for (const match of text.matchAll(/\S+/gu)) {
    ids.push(ids.length + 1);
    offsets.push([match.index, match.index + match[0].length]);
  }
  fakeEncode.calls.push(directory);
  return { ids, offsets };
}
fakeEncode.calls = [];

test("a pack loads every model in order through one backend and attributes findings to the pack", async () => {
  const pack = validatePackDefinition({
    ...minimal(),
    models: [
      {
        directory: "one",
        source: "One",
        graph: "model",
        offsets: "native",
        labels: { PER: "PERSON" },
      },
      { directory: "two", source: "Two", graph: "graph_int8", offsets: "sequential" },
    ],
    assets: [...modelFiles("one"), ...modelFiles("two", "graph_int8")],
  });
  const log = { predicted: [], disposed: 0 };
  const loaded = [];
  fakeEncode.calls = [];
  const recognition = await loadPackRecognition(
    pack,
    "/verified",
    fakeEncode,
    async (model, root) => {
      loaded.push([model.directory, root]);
      // The native model reports raw labels the pack map must translate.
      return fakeSession(log, model.offsets === "native" ? { label: "B-PER" } : {});
    },
  );
  assert.deepEqual(loaded, [
    ["one", "/verified"],
    ["two", "/verified"],
  ]);
  const text = "Khách hàng Lê Minh An đã thanh toán 2.500.000 đồng.";
  const result = await recognition.inspect(text);
  assert.deepEqual(fakeEncode.calls, ["one"]);
  assert.equal(log.predicted.length, 2);
  const names = result.complete.filter((d) => d.type === "TEN");
  assert.equal(names.length, 1);
  assert.equal(text.slice(names[0].start, names[0].end), "Lê Minh An");
  // Model provenance is replaced by the pack name before the user sees it.
  assert.equal(names[0].source, pack.name);
  assert.ok(!result.complete.some((d) => ["One", "Two"].includes(d.source)));
  assert.ok(text.slice(names[0].end).includes("2.500.000 đồng"));
  assert.deepEqual(await recognition.detect(text), result.complete);
  await recognition.dispose();
  assert.equal(log.disposed, 2);
});

test("native offsets fail closed when the pack model's tokenizer disagrees", async () => {
  const pack = validatePackDefinition({
    ...minimal(),
    models: [{ directory: "one", source: "One", graph: "model", offsets: "native" }],
  });
  const log = { predicted: [], disposed: 0 };
  const recognition = await loadPackRecognition(
    pack,
    "/verified",
    async () => ({ ids: [9, 9, 9], offsets: [] }),
    async () => fakeSession(log),
  );
  await assert.rejects(recognition.detect("Lê Minh An gửi tiền"), /Tokenizer identity mismatch/);
  await recognition.dispose();
});

test("a model that fails to load disposes the models loaded before it", async () => {
  const pack = validatePackDefinition({
    ...minimal(),
    models: [
      { directory: "one", source: "One", graph: "model", offsets: "sequential" },
      { directory: "two", source: "Two", graph: "model", offsets: "sequential" },
    ],
    assets: [...modelFiles("one"), ...modelFiles("two")],
  });
  const log = { predicted: [], disposed: 0 };
  await assert.rejects(
    loadPackRecognition(pack, "/verified", fakeEncode, async (model) => {
      if (model.directory === "two") throw new Error("synthetic load failure");
      return fakeSession(log);
    }),
    /synthetic load failure/,
  );
  assert.equal(log.disposed, 1);
});

test("the native bridge is released when the session count does not match the pack", async () => {
  const calls = [];
  const bridge = async (request) => {
    calls.push(request.operation);
    if (request.operation === "load") return { epoch: 7, labels: [{ 0: "O" }] };
    return {};
  };
  await assert.rejects(loadNativeRecognition("/verified", fakeEncode, bridge), /session count/);
  assert.deepEqual(calls, ["load", "release"]);
});

test("createRecognition relabels only the pack's own model sources", async () => {
  const text = "Lê Minh An";
  const runner = createModelRunner([
    {
      source: "Elsewhere",
      tokenCount: () => 2,
      async predict(value) {
        return [{ word: value, index: 1, entity: "B-PERSON", score: 1 }];
      },
      async dispose() {},
    },
  ]);
  const result = await createRecognition([runner], validatePackDefinition(minimal())).inspect(text);
  assert.equal(result.modelOnly[0].source, "Elsewhere");
});
