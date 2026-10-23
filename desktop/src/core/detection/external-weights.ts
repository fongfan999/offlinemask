/** ONNX Runtime Web parses a model from one buffer: it copies the bytes into the WASM
 * heap, parses the protobuf (a second copy of every weight) and builds tensors from it
 * (a third). The heap never shrinks, so a 916 MB graph left it at about 2.5 GB.
 * Weights stored as ONNX external data are copied once, straight into their tensors
 * (decision 0129).
 *
 * `externalizeWeights` rewrites the graph so each large top-level initializer points
 * at its own bytes inside the original file: pass the result as the model and the
 * original bytes as external data under `location`. Nothing is copied or changed in
 * the weights themselves. Initializers in nested graphs, typed (non-raw) data and
 * small tensors stay inline. */

// ModelProto.graph, GraphProto.initializer, TensorProto.raw_data / external_data /
// data_location, StringStringEntryProto.key / value (onnx/onnx.proto3).
const modelGraph = 7;
const graphInitializer = 5;
const tensorRawData = 9;
const tensorExternalData = 13;
const tensorDataLocation = 14;
const externalLocation = 1;
const entryKey = 1;
const entryValue = 2;
const lengthDelimited = 2;

type Field = { field: number; wire: number; start: number; valueStart: number; end: number };

function readVarint(bytes: Uint8Array, at: number): [number, number] {
  let value = 0;
  let scale = 1;
  let byte: number;
  do {
    if (at >= bytes.length) throw new Error("Truncated model");
    byte = bytes[at++]!;
    value += (byte & 0x7f) * scale;
    scale *= 128;
  } while (byte & 0x80);
  return [value, at];
}

function varint(value: number): Uint8Array {
  const out: number[] = [];
  while (value > 127) {
    out.push((value % 128) | 0x80);
    value = Math.floor(value / 128);
  }
  out.push(value);
  return Uint8Array.from(out);
}

function* fields(bytes: Uint8Array, start: number, end: number): Generator<Field> {
  let at = start;
  while (at < end) {
    const fieldStart = at;
    let key: number;
    [key, at] = readVarint(bytes, at);
    const wire = key & 7;
    let valueStart = at;
    let valueEnd: number;
    if (wire === 0) [, valueEnd] = readVarint(bytes, at);
    else if (wire === 1) valueEnd = at + 8;
    else if (wire === 5) valueEnd = at + 4;
    else if (wire === lengthDelimited) {
      let length: number;
      [length, valueStart] = readVarint(bytes, at);
      valueEnd = valueStart + length;
    } else throw new Error("Unsupported model encoding");
    if (valueEnd > end) throw new Error("Truncated model");
    at = valueEnd;
    yield { field: Math.floor(key / 8), wire, start: fieldStart, valueStart, end: valueEnd };
  }
}

const byteLength = (parts: Uint8Array[]) => parts.reduce((sum, part) => sum + part.length, 0);
const message = (field: number, parts: Uint8Array[]) => [
  varint(field * 8 + lengthDelimited),
  varint(byteLength(parts)),
  ...parts,
];
const encoder = new TextEncoder();

function externalEntry(key: string, value: string) {
  return message(tensorExternalData, [
    ...message(entryKey, [encoder.encode(key)]),
    ...message(entryValue, [encoder.encode(value)]),
  ]);
}

export function externalizeWeights(
  bytes: Uint8Array,
  location: string,
  minBytes = 1024,
): { model: Uint8Array<ArrayBuffer>; externalBytes: number } {
  const model: Uint8Array[] = [];
  let externalBytes = 0;
  for (const top of fields(bytes, 0, bytes.length)) {
    if (top.field !== modelGraph || top.wire !== lengthDelimited) {
      model.push(bytes.subarray(top.start, top.end));
      continue;
    }
    const graph: Uint8Array[] = [];
    for (const entry of fields(bytes, top.valueStart, top.end)) {
      if (entry.field !== graphInitializer || entry.wire !== lengthDelimited) {
        graph.push(bytes.subarray(entry.start, entry.end));
        continue;
      }
      const tensor: Uint8Array[] = [];
      let raw: Field | undefined;
      for (const part of fields(bytes, entry.valueStart, entry.end)) {
        if (
          part.field === tensorRawData &&
          part.wire === lengthDelimited &&
          part.end - part.valueStart >= minBytes
        )
          raw = part;
        else tensor.push(bytes.subarray(part.start, part.end));
      }
      if (raw) {
        const length = raw.end - raw.valueStart;
        externalBytes += length;
        tensor.push(
          ...externalEntry("location", location),
          ...externalEntry("offset", String(raw.valueStart)),
          ...externalEntry("length", String(length)),
          varint(tensorDataLocation * 8),
          varint(externalLocation),
        );
      }
      graph.push(...message(graphInitializer, tensor));
    }
    model.push(...message(modelGraph, graph));
  }
  const out = new Uint8Array(byteLength(model));
  let at = 0;
  for (const part of model) {
    out.set(part, at);
    at += part.length;
  }
  return { model: out, externalBytes };
}
