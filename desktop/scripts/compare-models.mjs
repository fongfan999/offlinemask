import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { cpus, totalmem, release } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeText } from '../src/core/text.ts';
import { filterDetections } from '../src/core/detection/options.ts';
import { categories, parseFixture, scoreFixture, summarize } from './model-comparison-metrics.mjs';
import { comparisonMarkdown } from './model-comparison-report.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = await readFile(join(root, 'tests/fixtures/model-comparison.json'), 'utf8');
const fixtures = JSON.parse(source).map(parseFixture);
assert.equal(new Set(fixtures.map(value => value.id)).size, fixtures.length, 'Duplicate fixture ID');
const manifest = JSON.parse(await readFile(join(root, 'scripts/model-manifest.json'), 'utf8'));
const variants = { small: [manifest.models[0].directory], large: [manifest.models[1].directory],
  combined: manifest.models.map(model => model.directory) };
const alternatives = process.argv.includes('--alternatives');
const candidateManifest = alternatives && process.argv[2] !== '--worker'
  ? JSON.parse(await readFile(join(root, 'artifacts/alternative-models/evaluation-manifest.json'), 'utf8')) : null;
if (alternatives) for (const name of ['bigmed', 'underthesea', 'underthesea-fp32']) variants[name] = [];
const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];

if (process.argv[2] === '--worker') {
  const variant = process.argv[3];
  assert.ok(Object.hasOwn(variants, variant));
  globalThis.fetch = async () => { throw new Error('Network access forbidden during comparison'); };
  const baselineRssBytes = process.memoryUsage.rss();
  const { loadDetector } = await import('../src/core/detection/openmed.ts');
  const started = performance.now();
  const detector = variants[variant].length ? await loadDetector(join(root, 'public/models'), '', 'cpu', variants[variant])
    : await (await import('./alternative-detector.mjs')).loadAlternative(join(root, 'artifacts/alternative-models'), variant);
  const loadMs = performance.now() - started;
  try {
    const firstStart = performance.now();
    let warmupError = null;
    try { await detector.detect(fixtures[0].text, () => {}); }
    catch (error) { warmupError = error instanceof Error ? error.message : String(error); }
    const firstInferenceMs = performance.now() - firstStart;
    const cases = [];
    for (const fixture of fixtures) {
      const start = performance.now();
      let detections = [], error = null;
      try {
        detections = await detector.detect(fixture.text, () => {});
      } catch (failure) {
        // A failed request yields no preview in the app. Record it, never skip the case.
        error = failure instanceof Error ? failure.message : String(failure);
        console.error(`${variant}: ${fixture.id} failed: ${error}`);
      }
      const inferenceMs = performance.now() - start;
      const analysis = analyzeText(fixture.text, '12345678', detections);
      const selectedSpans = Object.fromEntries(categories.map(category =>
        [category, analyzeText(fixture.text, '12345678', filterDetections(detections, [category])).spans]));
      cases.push({ ...scoreFixture(fixture, analysis.spans, selectedSpans), inferenceMs, error,
        predictions: analysis.spans.map(span => ({ start: span.start, end: span.end,
          value: fixture.text.slice(span.start, span.end), findingId: span.findingId })) });
      if (cases.length % 10 === 0) console.error(`${variant}: ${cases.length}/${fixtures.length}`);
    }
    const timings = cases.filter(value => value.group !== 'long' && !value.error).map(value => value.inferenceMs);
    console.log(JSON.stringify({ variant, loadMs, firstInferenceMs, warmupError, baselineRssBytes,
      peakRssBytes: process.resourceUsage().maxRSS * 1024,
      medianMs: percentile(timings, .5), p95Ms: percentile(timings, .95),
      longMs: cases.find(value => value.group === 'long').inferenceMs,
      summary: summarize(cases), shortSummary: summarize(cases.filter(value => value.group !== 'long')), cases }));
  } finally { await detector.dispose(); }
} else {
  if (candidateManifest) {
    // Reject modified local candidates before starting the comparison.
    for (const candidate of Object.values(candidateManifest.variants)) for (const [name, expected] of Object.entries(candidate.files)) {
      const hash = createHash('sha256');
      for await (const part of createReadStream(join(root, 'artifacts/alternative-models', candidate.directory, name))) hash.update(part);
      assert.equal(hash.digest('hex'), expected.sha256, `Candidate hash mismatch: ${candidate.directory}/${name}`);
    }
  }
  const output = resolve(process.argv.slice(2).find(arg => !arg.startsWith('--')) ?? join(root, 'artifacts/model-comparison'));
  await mkdir(output, { recursive: true });
  const runs = [];
  // Two fresh-process rounds in reverse orders; checkpoints never run concurrently.
  const order = Object.keys(variants);
  for (const sequence of [order, [...order].reverse()]) {
    for (const variant of sequence) {
      console.log(`Evaluating ${variant}, round ${runs.filter(run => run.variant === variant).length + 1}…`);
      const raw = await new Promise((resolveRun, reject) => {
        const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--worker', variant, ...(alternatives ? ['--alternatives'] : [])], {
          stdio: ['ignore', 'pipe', 'inherit'], cwd: root,
        });
        let stdout = '';
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', chunk => { stdout += chunk; });
        child.on('error', reject);
        child.on('close', code => code === 0 ? resolveRun(stdout) : reject(new Error(`${variant} exited ${code}`)));
      });
      const run = JSON.parse(raw.trim().split('\n').at(-1));
      runs.push(run);
      await writeFile(join(output, `${variant}-${runs.filter(value => value.variant === variant).length}.json`), JSON.stringify(run, null, 2) + '\n');
      console.log(`${variant}: ${run.summary.fullyCovered}/${run.summary.entities} entities fully covered; ${run.summary.falsePositiveChars} ordinary characters masked; p50 ${Math.round(run.medianMs)} ms; peak RSS ${Math.round(run.peakRssBytes / 2 ** 20)} MiB`);
    }
  }
  const results = Object.keys(variants).map(variant => {
    const values = runs.filter(run => run.variant === variant);
    assert.deepEqual(values[0].cases.map(({ inferenceMs, ...quality }) => quality),
      values[1].cases.map(({ inferenceMs, ...quality }) => quality), `${variant}: nondeterministic quality`);
    return { variant, downloadBytes: variants[variant].length ? manifest.models.filter(model => variants[variant].includes(model.directory))
      .reduce((sum, model) => sum + Object.values(model.sizes).reduce((a, b) => a + b, 0), 0) : candidateManifest.variants[variant].downloadBytes,
      summary: values[0].summary, shortSummary: values[0].shortSummary,
      timingRuns: values.map(({ cases, summary, shortSummary, ...timing }) => timing),
      cases: values[0].cases };
  });
  const report = { createdAt: new Date().toISOString(), datasetSha256: createHash('sha256').update(source).digest('hex'),
    environment: { platform: process.platform, osRelease: release(), arch: process.arch, node: process.version,
      cpu: cpus()[0].model, logicalCpus: cpus().length, totalMemoryBytes: totalmem(), backend: 'CPU (Node ONNX Runtime); not desktop WASM' },
    models: manifest.models.map(({ directory, repository, revision, files }) => ({ directory, repository, revision, files })),
    candidateManifest, results };
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await writeFile(join(output, 'report.md'), comparisonMarkdown(report));
  console.log(`Completed comparison: ${join(output, 'report.json')}`);
}
