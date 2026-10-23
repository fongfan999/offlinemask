import test from "node:test";
import assert from "node:assert/strict";
import { externalizeWeights } from "../src/core/detection/external-weights.ts";

// A minimal protobuf writer and reader, enough for ModelProto > GraphProto > TensorProto.
const varint = (value) => {
  const out = [];
  while (value > 127) {
    out.push((value % 128) | 0x80);
    value = Math.floor(value / 128);
  }
  out.push(value);
  return out;
};
const bytesField = (field, bytes) => [...varint(field * 8 + 2), ...varint(bytes.length), ...bytes];
const intField = (field, value) => [...varint(field * 8), ...varint(value)];
const text = (value) => [...new TextEncoder().encode(value)];

function read(bytes) {
  const fields = [];
  let at = 0;
  const next = () => {
    let value = 0;
    let scale = 1;
    let byte;
    do {
      byte = bytes[at++];
      value += (byte & 0x7f) * scale;
      scale *= 128;
    } while (byte & 0x80);
    return value;
  };
  while (at < bytes.length) {
    const key = next();
    const field = Math.floor(key / 8);
    if ((key & 7) === 0) fields.push({ field, value: next() });
    else {
      const length = next();
      fields.push({ field, bytes: bytes.subarray(at, at + length), offset: at });
      at += length;
    }
  }
  return fields;
}
const decode = (bytes) => new TextDecoder().decode(bytes);

const weights = Array.from({ length: 2048 }, (_, index) => index % 251);
const large = [...bytesField(8, text("embeddings")), ...intField(2, 3), ...bytesField(9, weights)];
const small = [...bytesField(8, text("bias")), ...intField(2, 1), ...bytesField(9, [1, 2, 3, 4])];
// A node whose attribute holds its own graph: its initializers must stay inline.
const nestedNode = bytesField(5, bytesField(6, bytesField(5, large)));
const nested = bytesField(1, nestedNode);
const graph = [
  ...nested,
  ...bytesField(5, large),
  ...bytesField(5, small),
  ...bytesField(2, text("g")),
];
const model = Uint8Array.from([
  ...intField(1, 8),
  ...bytesField(8, intField(2, 17)),
  ...bytesField(7, graph),
  ...bytesField(14, text("metadata")),
]);

test("large top-level weights point back into the original file; everything else is kept", () => {
  const { model: rewritten, externalBytes } = externalizeWeights(model, "model.onnx_data");
  assert.equal(externalBytes, weights.length);
  assert.ok(rewritten.length < model.length - weights.length + 200);

  const top = read(rewritten);
  assert.deepEqual(
    top.map((f) => f.field),
    [1, 8, 7, 14],
  );
  assert.deepEqual([...top[1].bytes], intField(2, 17));
  assert.equal(decode(top[3].bytes), "metadata");

  const entries = read(top[2].bytes);
  assert.deepEqual(
    entries.map((f) => f.field),
    [1, 5, 5, 2],
  );
  // The nested graph is copied byte for byte, raw weights included.
  assert.deepEqual([...entries[0].bytes], nestedNode);

  const tensor = read(entries[1].bytes);
  assert.equal(
    tensor.some((f) => f.field === 9),
    false,
  );
  assert.equal(decode(tensor.find((f) => f.field === 8).bytes), "embeddings");
  assert.equal(tensor.find((f) => f.field === 14).value, 1);
  const external = Object.fromEntries(
    tensor
      .filter((f) => f.field === 13)
      .map((f) => read(f.bytes).map((entry) => decode(entry.bytes))),
  );
  assert.equal(external.location, "model.onnx_data");
  const offset = Number(external.offset);
  assert.equal(Number(external.length), weights.length);
  assert.deepEqual([...model.subarray(offset, offset + weights.length)], weights);

  // Small tensors stay inline, exactly as they were.
  assert.deepEqual([...entries[2].bytes], small);
});

test("a truncated model is refused instead of rewritten", () => {
  assert.throws(() => externalizeWeights(model.subarray(0, model.length - 5), "model.onnx_data"));
});
