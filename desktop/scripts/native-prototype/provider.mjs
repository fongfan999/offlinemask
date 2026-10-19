// Developer-only transport. Never imported by the shipped application.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import runtimeManifest from './runtime-manifest.json' with { type: 'json' };
import { readFile, readdir, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { AutoTokenizer, env } from '@huggingface/transformers';
import { tokenPredictions } from '../../src/core/detection/token-predictions.ts';
import manifest from '../model-manifest.json' with { type: 'json' };

export async function nativeRuntimePath() {
  const requireTransformers = createRequire(import.meta.resolve('@huggingface/transformers'));
  const entry = requireTransformers.resolve('onnxruntime-node');
  const directory = join(dirname(entry), '..', 'bin', 'napi-v6', process.platform, process.arch);
  const name = (await readdir(directory)).find(file => /^libonnxruntime\.[\d.]+\.dylib$/.test(file));
  if (process.platform !== 'darwin' || !name) throw Error('Prototype currently validated on macOS only');
  const path = await realpath(join(directory, name));
  const bytes = await readFile(path);
  if (name !== runtimeManifest.file || bytes.length !== runtimeManifest.bytes || createHash('sha256').update(bytes).digest('hex') !== runtimeManifest.sha256) throw Error('Unverified native runtime');
  return path;
}
export async function createNativeProvider(root, { threads = 4 } = {}) {
  const runtime = await nativeRuntimePath();
  const binary = new URL('../../src-tauri/target/release/offlinemask-native-prototype', import.meta.url).pathname;
  const child = spawn(binary, [runtime, root, String(threads)], { stdio: ['pipe', 'pipe', 'ignore'] });
  const exited = new Promise(resolve => child.once('close', resolve));
  let sequence = 0, pending, buffer = '', closed = false;
  function fail() {
    closed = true;
    pending?.reject(Error('Native prototype stopped'));
    pending = undefined;
    child.kill();
  }
  child.on('error', fail);
  child.on('exit', fail);
  child.stdin.on('error', fail);
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    buffer += chunk;
    if (buffer.length > 2_000_000) return fail();
    let end;
    while ((end = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
      try {
        const response = JSON.parse(line);
        if (!pending || response.id !== pending.id) return fail();
        const current = pending; pending = undefined;
        if (response.error) current.reject(Error('Native inference failed'));
        else current.resolve(response.result);
      } catch { fail(); }
    }
  });
  function request(model, input_ids) {
    if (closed) return Promise.reject(Error('Native prototype stopped'));
    if (pending) return Promise.reject(Error('Native inference already running'));
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      pending = { id, resolve, reject };
      child.stdin.write(JSON.stringify({ id, model, ...(input_ids ? { input_ids } : {}) }) + '\n');
    });
  }
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = root + '/';
  env.useFSCache = false;
  return {
    pid: child.pid, runtime, binary, threads,
    cancel: fail,
    async dispose() {
      fail(); await exited;
    },
    provider: async directory => {
      const model = manifest.models.findIndex(item => item.directory === directory);
      if (model < 0) throw Error('Unpinned model');
      await request(model);
      const tokenizer = await AutoTokenizer.from_pretrained(directory, { local_files_only: true });
      const config = JSON.parse(await readFile(join(root, directory, 'config.json'), 'utf8'));
      return {
        tokenizer,
        async predict(text) {
          const words = tokenizer.tokenize(text);
          const contentIds = tokenizer.encode(text, { add_special_tokens: false });
          const ids = tokenizer.encode(text);
          if (words.length !== contentIds.length || ids.length !== contentIds.length + 2 || contentIds.some((id, index) => id !== ids[index + 1])) throw Error('Unsupported token layout');
          const logits = await request(model, ids);
          return tokenPredictions(words, logits.dims, logits.data, config.id2label, true);
        },
        async dispose() {}, // The shared child owns both sessions; owner disposes it.
      };
    },
  };
}
