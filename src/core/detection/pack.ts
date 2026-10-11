import definition from "../../../packs/vietnamese-pii-v1.json" with { type: "json" };

/** One token-classification model inside a recognition pack. */
export interface PackModel {
  /** Subdirectory of the pack root holding this model's files. */
  directory: string;
  /** Provenance shown while a finding is attributed to this model alone. */
  source: string;
  /** ONNX graph file name without the `.onnx` extension. */
  graph: string;
  /**
   * How token positions are mapped back to the source text.
   * `sequential`: the JavaScript aligner walks the tokenizer pieces in order (NFC/Metaspace tokenizers).
   * `native`: the Rust `tokenizers` crate reports exact offsets; the JavaScript token IDs must match.
   */
  offsets: "native" | "sequential";
  /**
   * Optional model label → canonical label map (for example `PER` → `PERSON`).
   * When present, labels missing from the map are treated as `O`.
   */
  labels?: Record<string, string>;
}

export interface PackTransportPart {
  url: string;
  bytes: number;
  sha256: string;
}
export interface PackTransport {
  /** `null` for unpublished developer packs; the app then reports the pack as unavailable to download. */
  url: string | null;
  bytes: number;
  sha256: string;
  encoding: "identity" | "zstd";
  parts: PackTransportPart[];
}
export interface PackAsset {
  directory: string;
  name: string;
  bytes: number;
  sha256: string;
  transport: PackTransport;
}

/** The complete, pinned description of an optional recognition pack. */
export interface PackDefinition {
  /** Stable identifier; also the app-local directory that holds installed versions. */
  id: string;
  /** User-facing pack name, also used as the provenance of every model finding. */
  name: string;
  /** Concise source/license attribution shown under “Thông tin gói”. */
  attribution: string;
  models: PackModel[];
  assets: PackAsset[];
}

const requiredModelFiles = ["config.json", "tokenizer.json", "tokenizer_config.json"];
const component = /^(?!\.{1,2}$)[A-Za-z0-9._-]{1,128}$/;
const sha256 = /^[0-9a-f]{64}$/;

function fail(reason: string): never {
  throw new Error(`Invalid recognition pack: ${reason}`);
}
function text(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) fail(`${field} must be a non-empty string`);
  return value;
}
function count(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0)
    fail(`${field} must be a positive integer`);
  return value as number;
}
function digest(value: unknown, field: string): string {
  if (typeof value !== "string" || !sha256.test(value))
    fail(`${field} must be a lowercase SHA-256 hex digest`);
  return value;
}
function pathComponent(value: unknown, field: string): string {
  if (typeof value !== "string" || !component.test(value))
    fail(`${field} must be a plain file-name component`);
  return value;
}
function httpsUrl(value: unknown, field: string): string {
  let url: URL;
  try {
    url = new URL(text(value, field));
  } catch {
    fail(`${field} must be an absolute URL`);
  }
  if (url.protocol !== "https:" || url.username || url.password || url.hash)
    fail(`${field} must be a plain https URL`);
  return url.href;
}
function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(`${field} must be an object`);
  return value as Record<string, unknown>;
}

function validateModel(value: unknown, index: number): PackModel {
  const field = `models[${index}]`;
  const model = record(value, field);
  const offsets = model.offsets;
  if (offsets !== "native" && offsets !== "sequential")
    fail(`${field}.offsets must be "native" or "sequential"`);
  let labels: Record<string, string> | undefined;
  if (model.labels !== undefined) {
    labels = {};
    for (const [from, to] of Object.entries(record(model.labels, `${field}.labels`)))
      labels[text(from, `${field}.labels key`)] = text(to, `${field}.labels.${from}`);
  }
  return {
    directory: pathComponent(model.directory, `${field}.directory`),
    source: text(model.source, `${field}.source`),
    graph: pathComponent(model.graph, `${field}.graph`),
    offsets,
    ...(labels ? { labels } : {}),
  };
}

function validateAsset(value: unknown, index: number): PackAsset {
  const field = `assets[${index}]`;
  const asset = record(value, field);
  const transport = record(asset.transport, `${field}.transport`);
  const encoding = transport.encoding;
  if (encoding !== "identity" && encoding !== "zstd")
    fail(`${field}.transport.encoding must be "identity" or "zstd"`);
  const parts = Array.isArray(transport.parts)
    ? transport.parts
    : transport.parts === undefined
      ? []
      : fail(`${field}.transport.parts must be an array`);
  const result: PackAsset = {
    directory: pathComponent(asset.directory, `${field}.directory`),
    name: pathComponent(asset.name, `${field}.name`),
    bytes: count(asset.bytes, `${field}.bytes`),
    sha256: digest(asset.sha256, `${field}.sha256`),
    transport: {
      url:
        transport.url === null || transport.url === undefined
          ? null
          : httpsUrl(transport.url, `${field}.transport.url`),
      bytes: count(transport.bytes, `${field}.transport.bytes`),
      sha256: digest(transport.sha256, `${field}.transport.sha256`),
      encoding,
      parts: parts.map((part, partIndex) => {
        const partField = `${field}.transport.parts[${partIndex}]`;
        const entry = record(part, partField);
        return {
          url: httpsUrl(entry.url, `${partField}.url`),
          bytes: count(entry.bytes, `${partField}.bytes`),
          sha256: digest(entry.sha256, `${partField}.sha256`),
        };
      }),
    },
  };
  if (result.name === "LICENSE") fail(`${field}.name LICENSE is written by the installer`);
  if (result.transport.parts.length) {
    if (result.transport.url !== null)
      fail(`${field}.transport.url must be null when parts are listed`);
    const total = result.transport.parts.reduce((sum, part) => sum + part.bytes, 0);
    if (total !== result.transport.bytes)
      fail(`${field}.transport.parts do not add up to transport.bytes`);
  }
  if (
    encoding === "identity" &&
    (result.bytes !== result.transport.bytes || result.sha256 !== result.transport.sha256)
  )
    fail(`${field} identity transport must match the installed file`);
  return result;
}

/**
 * Check a pack definition before anything loads it. Every rule here is one a
 * contributor replacing the models must satisfy; the Rust installer repeats the
 * transport rules it depends on.
 */
export function validatePackDefinition(value: unknown): PackDefinition {
  const pack = record(value, "pack");
  const id = pathComponent(pack.id, "id");
  const name = text(pack.name, "name");
  const attribution = text(pack.attribution, "attribution");
  if (!Array.isArray(pack.models) || !pack.models.length)
    fail("models must list at least one model");
  if (!Array.isArray(pack.assets) || !pack.assets.length)
    fail("assets must list at least one file");
  if (pack.assets.length > 256) fail("assets must list at most 256 files");
  const models = pack.models.map(validateModel);
  const assets = pack.assets.map(validateAsset);
  const directories = new Set<string>();
  for (const model of models) {
    if (directories.has(model.directory)) fail(`duplicate model directory ${model.directory}`);
    directories.add(model.directory);
  }
  const files = new Set<string>();
  for (const asset of assets) {
    const key = `${asset.directory}/${asset.name}`;
    if (files.has(key)) fail(`duplicate asset ${key}`);
    files.add(key);
    if (!directories.has(asset.directory)) fail(`asset directory ${asset.directory} has no model`);
  }
  for (const model of models) {
    for (const file of [`${model.graph}.onnx`, ...requiredModelFiles])
      if (!files.has(`${model.directory}/${file}`))
        fail(`model ${model.directory} is missing ${file}`);
  }
  return { id, name, attribution, models, assets };
}

/** The pack this build offers in Settings and loads for contextual categories. */
export const recognitionPack: PackDefinition = validatePackDefinition(definition);

export const packInstalledBytes = (pack: PackDefinition = recognitionPack) =>
  pack.assets.reduce((sum, asset) => sum + asset.bytes, 0);
export const packTransportBytes = (pack: PackDefinition = recognitionPack) =>
  pack.assets.reduce((sum, asset) => sum + asset.transport.bytes, 0);
