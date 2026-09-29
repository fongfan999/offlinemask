import { meetsScreeningFloor } from './model-comparison-metrics.mjs';
const labels = { small: 'Small alone', large: 'Large alone', combined: 'Both models', bigmed: 'BigMed INT8',
  underthesea: 'Underthesea INT8', 'underthesea-fp32': 'Underthesea FP32' };
const pct = (count, total) => `${(100 * count / total).toFixed(1)}%`;
const escape = value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
const range = (values, format) => `${format(Math.min(...values))}–${format(Math.max(...values))}`;

export function comparisonMarkdown(report) {
  const { results } = report;
  const pair = results.find(value => value.variant === 'combined');
  const entities = value => new Map(value.cases.flatMap(c => c.entities.map(e => [`${c.id}:${e.start}:${e.end}`, e])));
  const pairEntities = entities(pair);
  const eligible = results.filter(meetsScreeningFloor);
  const lines = [
    `# Vietnamese model comparison — ${report.createdAt.slice(0, 10)}`, '',
    eligible.length ? `**Passes the provisional numeric floor: ${eligible.map(value => labels[value.variant]).join(', ')}.** Existing regressions and loss-of-coverage checks are still required before changing the pack.`
      : '**No candidate meets the provisional screening floor. Keep the pack unchanged pending further work.**', '',
    '## Scope', '',
    `${pair.summary.cases} synthetic cases, ${pair.summary.entities} annotated entity occurrences, including ${pair.summary.negativeCases} entirely non-sensitive cases and one long document. ${results.length} configurations, each run twice in a fresh process. Quality outputs were identical across repeats. All use the existing local recognizers and final masking policy. Inference uses local files with network fetch disabled.`, '',
    'Full coverage requires every non-whitespace character in an annotation to be hidden. Partial spans fail. Some strict failures expose only punctuation or generic address labels; inspect the examples below before interpreting these numbers as privacy leakage. This is a small diagnostic set, not an independent production accuracy estimate.', '',
    '## Coverage and excess masking', '',
    '| Configuration | Download including metadata | Fully covered | Partial / wholly missed | Ordinary text masked¹ | Negative cases affected | Requests failed |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const result of results) {
    const s = result.summary;
    lines.push(`| ${labels[result.variant]} | ${(result.downloadBytes / 1e6).toFixed(1)} MB | ${s.fullyCovered}/${s.entities} (${pct(s.fullyCovered, s.entities)}) | ${s.partial} / ${s.missed} | ${pct(result.shortSummary.falsePositiveChars, result.shortSummary.ordinaryChars)} | ${s.falsePositiveNegativeCases}/${s.negativeCases} | ${s.failedCases} |`);
  }
  lines.push('', '¹ Percentage of unannotated letters/numbers/combining marks masked in the 65 short cases; the long repeated boilerplate is excluded from this denominator. A failed request yields no preview and is reported separately, not treated as a successful negative case.', '',
    `| Category | ${results.map(r => labels[r.variant] + ': all / category only').join(' | ')} |`,
    `| --- | ${results.map(() => '---:').join(' | ')} |`);
  for (const category of Object.keys(pair.summary.byCategory)) {
    lines.push(`| ${category} | ${results.map(result => { const s = result.summary.byCategory[category]; return `${s.full}/${s.total} / ${s.selectedFull}/${s.total}`; }).join(' | ')} |`);
  }
  lines.push('', '“Category only” applies the actual selection filter before transformation. Differences from all-options coverage expose category mistakes that a broad masking score can hide.', '',
    '## What each checkpoint adds', '',
    '| Compared with the pair | Additional fully covered entities from the pair | Fully covered entities lost by the pair |',
    '| --- | ---: | ---: |');
  for (const result of results.filter(value => value.variant !== 'combined')) {
    const single = entities(result);
    lines.push(`| ${labels[result.variant]} | ${[...pairEntities].filter(([key, value]) => value.full && !single.get(key).full).length} | ${[...single].filter(([key, value]) => value.full && !pairEntities.get(key).full).length} |`);
  }
  lines.push('', 'Coverage gains should be weighed against the category table and excess masking above. Adding a checkpoint can combine false positives as well as useful detections.', '',
    '## Runtime and memory', '',
    `Measured on ${report.environment.cpu}, ${report.environment.arch}, ${report.environment.platform} ${report.environment.osRelease}, Node ${report.environment.node}, ${(report.environment.totalMemoryBytes / 2 ** 30).toFixed(0)} GiB system RAM. CPU backend; **these are not desktop WebView/WASM performance numbers**. Ranges span two runs, not confidence intervals.`, '',
    '| Configuration | Local load (s) | First inference (ms) | Warm short p50 (ms) | Warm short p95 (ms) | Long case (s) | Peak process RSS (MiB) |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const result of results) {
    const r = result.timingRuns;
    lines.push(`| ${labels[result.variant]} | ${range(r.map(x => x.loadMs / 1000), x => x.toFixed(2))} | ${range(r.map(x => x.firstInferenceMs), Math.round)} | ${range(r.map(x => x.medianMs), x => x.toFixed(1))} | ${range(r.map(x => x.p95Ms), x => x.toFixed(1))} | ${range(r.map(x => x.longMs / 1000), x => x.toFixed(2))} | ${range(r.map(x => x.peakRssBytes / 2 ** 20), Math.round)} |`);
  }
  lines.push('', 'Peak RSS includes the process, model runtime, allocations and weights. It varies substantially between repeats; it is not a minimum-RAM requirement, and the larger single model can peak above the pair. Model load is process-cold, not filesystem-cache-cold. Latencies exclude failed requests.', '',
    '## Request failures', '');
  for (const result of results) for (const c of result.cases.filter(value => value.error))
    lines.push(`- ${labels[result.variant]}: ${c.id} — ${escape(c.error)}`);
  if (results.every(result => !result.summary.failedCases)) lines.push('None.');
  lines.push('',
    '## Pair: incomplete annotated spans', '',
    '| Case | Expected value | Still visible |',
    '| --- | --- | --- |');
  for (const c of pair.cases) for (const e of c.entities.filter(value => !value.full)) {
    let visible = '';
    for (let i = e.start; i < e.end; i++) if (!c.predictions.some(p => p.start <= i && p.end > i)) visible += e.value[i - e.start];
    lines.push(`| ${c.id} | ${escape(e.value)} | ${escape(visible.trim())} |`);
  }
  lines.push('', '## Reproduction and provenance', '',
    report.candidateManifest
      ? 'After preparing and verifying the candidate assets, run `mise exec -- node scripts/compare-models.mjs artifacts/model-alternatives --alternatives`. See `docs/evaluations/alternative-model-protocol.md` for explicit downloads, conversion, hashes, and the separate native-offset quality reference.'
      : '`mise exec -- pnpm compare:models` verifies local pinned files, runs the comparison sequentially with network fetch disabled, and writes raw JSON plus this report to `artifacts/model-comparison/`.', '',
    'Dataset SHA-256: `' + report.datasetSha256 + '`. Exact model repositories, revisions, hashes, environment, predictions and per-case outcomes are in the companion JSON report. Method and provisional gates are documented in `docs/evaluations/model-comparison-protocol.md`. No confidence intervals or population-level claims are warranted from this small authored set.', '');
  return lines.join('\n');
}
