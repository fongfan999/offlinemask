import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { modelChunkIterator } from '../../src/core/detection/chunks.ts';

export function attachReferenceOffsets(text, tokens, ids, reference) {
  assert.deepEqual(ids, reference.ids, 'Native/JS tokenizer IDs differ');
  assert.equal(tokens.length, reference.offsets.length, 'Native/JS token counts differ');
  let previous = 0;
  return tokens.map((token, i) => {
    const [start, end] = reference.offsets[i];
    assert.ok(Number.isInteger(start) && Number.isInteger(end) && start >= previous && end > start && end <= text.length,
      'Invalid native source offsets');
    assert.equal(token.index, i + 1, 'Changed token index');
    previous = start;
    // Native normalization may legitimately remove source marks/control characters.
    // Preserve its offsets, not a guessed match for [UNK] or decoded subwords.
    return { ...token, start, end, word: text.slice(start, end) };
  });
}

export async function prepareReferenceOffsets(tokenizer, tokenizerPath, texts) {
  const python = process.env.OFFLINEMASK_EVAL_PYTHON;
  if (!python) throw Error('Set OFFLINEMASK_EVAL_PYTHON to the existing tokenizers 0.22.2 evaluation interpreter');
  const chunks = [...new Set(texts.flatMap(text => [...modelChunkIterator(text, value => tokenizer.encode(value).length)].map(c => c.text)))];
  const output = await new Promise((resolve, reject) => {
    const child = spawn(python, [fileURLToPath(new URL('./native-offsets.py', import.meta.url)), tokenizerPath],
      { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1' } });
    let stdout = '', stderr = '';
    child.on('error', reject);
    child.stdin.on('error', reject);
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('close', code => {
      if (code !== 0) return reject(Error(`Native tokenizer failed (${code}): ${stderr}`));
      try { resolve(JSON.parse(stdout)); } catch (error) { reject(error); }
    });
    child.stdin.end(JSON.stringify(chunks));
  });
  assert.equal(output.encodings.length, chunks.length);
  return new Map(chunks.map((text, i) => [text, output.encodings[i]]));
}
