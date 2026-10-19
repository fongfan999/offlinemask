import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { modelChunkIterator } from '../../src/core/detection/chunks.ts';

export function validateEncoding(text, encoding) {
  const { input_ids: ids, content_ids: content, words, offsets, attention_mask: attention, token_type_ids: types, special_tokens_mask: special } = encoding;
  assert.equal(ids.length, content.length + 2, 'Unsupported native special-token layout');
  assert.deepEqual(ids.slice(1, -1), content, 'Native content/full IDs disagree');
  assert.deepEqual(special, [1, ...content.map(() => 0), 1], 'Unsupported native special-token mask');
  assert.equal(words.length, content.length); assert.equal(offsets.length, content.length);
  assert.equal(attention.length, ids.length); assert.equal(types.length, ids.length);
  assert.ok(ids.every(i => Number.isSafeInteger(i) && i >= 0));
  assert.ok(attention.every(i => i === 1)); assert.ok(types.every(i => i === 0));
  let previous = 0;
  for (const [start, end] of offsets) {
    assert.ok(Number.isInteger(start) && Number.isInteger(end) && start >= previous && end >= start && end <= text.length, 'Invalid native offset');
    previous = start;
  }
  return encoding;
}

/** Replays the unchanged synchronous planner until every requested count has
 * been supplied by the native tokenizer. This is bounded developer preparation
 * for known fixtures, not a shipping IPC/tokenizer implementation.
 */
export async function prepareNativePlans(texts, encode) {
  const encodings = new Map();
  class MissingCount extends Error { constructor(text) { super('Native count required'); this.text = text; } }
  const count = text => {
    if (!encodings.has(text)) throw new MissingCount(text);
    return encodings.get(text).input_ids.length;
  };
  for (const text of texts) {
    assert.ok(text.isWellFormed(), 'Malformed Unicode fixture');
    for (;;) {
      try { [...modelChunkIterator(text, count)]; break; }
      catch (error) {
        if (!(error instanceof MissingCount)) throw error;
        // Binary-search count probes can cut a surrogate pair. Only those
        // probes use replacement; final grapheme-bounded chunks remain exact.
        const probe = error.text.toWellFormed();
        encodings.set(error.text, validateEncoding(probe, await encode(probe)));
      }
    }
  }
  return { count, encoding(text) {
    assert.ok(text.isWellFormed(), 'Malformed Unicode chunk');
    const result = encodings.get(text);
    assert.ok(result && result.input_ids.length <= 384, 'Unprepared or oversized native chunk');
    return result;
  }, cachedQueries: encodings.size };
}

export function startNativeTokenizer(python, tokenizerPath) {
  if (!python) throw Error('Set OFFLINEMASK_EVAL_PYTHON to a local tokenizers 0.22.2 interpreter');
  const child = spawn(python, [fileURLToPath(new URL('./tokenizer-server.py', import.meta.url)), tokenizerPath],
    { stdio: ['pipe', 'pipe', 'ignore'], env: { ...process.env, HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1' } });
  let sequence = 0, pending, buffer = '', closed = false;
  const exited = new Promise(resolve => child.once('close', resolve));
  function fail() {
    closed = true;
    if (pending) { clearTimeout(pending.timer); pending.reject(Error('Native tokenizer stopped')); pending = undefined; }
    child.kill();
  }
  child.on('error', fail); child.on('exit', fail); child.stdin.on('error', fail);
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
        const current = pending; pending = undefined; clearTimeout(current.timer);
        if (response.error) current.reject(Error('Native tokenization failed'));
        else current.resolve(response.result);
      } catch { fail(); }
    }
  });
  return {
    encode(text) {
      if (closed || pending) return Promise.reject(Error('Native tokenizer unavailable or busy'));
      return new Promise((resolve, reject) => {
        const id = ++sequence;
        pending = { id, resolve, reject, timer: setTimeout(fail, 30_000) };
        child.stdin.write(JSON.stringify({ id, text }) + '\n');
      });
    },
    async dispose() { fail(); await exited; },
  };
}
