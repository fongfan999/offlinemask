// Offline CPU reference for the same synthetic sequence as the desktop harness.
// This is not a packaged-desktop measurement; the native backend uses its defaults.
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { loadDetector } from '../src/core/detection/openmed.ts';
import { analyzeText } from '../src/core/text.ts';

globalThis.fetch = async () => { throw Error('Network disabled for benchmark'); };
const suffix = 'Khách hàng Trần Minh Bình nhận thư tại căn 1208, tòa B, 36 Nguyễn Trãi, Thanh Xuân, Hà Nội. Email synthetic@example.org. Ngày 10/09/2026, số tiền 2.500.000 đồng.';
const filler = 'Nội dung tổng hợp đã được kiểm tra. ';
const results = [];
let detector;
try {
  for (const [label, length] of [['cold-short', suffix.length], ['warm-short-1', suffix.length], ['warm-short-2', suffix.length], ['warm-short-3', suffix.length], ['medium', 2000], ['long', 10000], ['limit', 50000]]) {
    const text = filler.repeat(Math.ceil(Math.max(0, length - suffix.length) / filler.length)).slice(0, Math.max(0, length - suffix.length)) + suffix;
    const started = performance.now();
    detector ??= await loadDetector(new URL('../public/models', import.meta.url).pathname, '', 'cpu');
    const detections = await detector.detect(text, () => {});
    const detectionMs = Math.round(performance.now() - started);
    const analysis = analyzeText(text, '12345678', detections);
    const address = 'căn 1208, tòa B, 36 Nguyễn Trãi, Thanh Xuân, Hà Nội';
    const at = text.indexOf(address);
    const addressCovered = [...address].every((_, index) => /\s/u.test(text[at + index]) || analysis.spans.some(span => span.start <= at + index && span.end > at + index));
    results.push({ label, utf16Length: text.length, detectionMs, findings: analysis.findings.length, addressCovered });
    console.log(label, detectionMs, 'ms');
  }
  const report = { runtime: 'Node native ONNX CPU reference; default CPU threading; not packaged desktop', node: process.version, platform: process.platform, arch: process.arch, network: 'fetch disabled', results };
  await mkdir(new URL('../artifacts/native-benchmark/', import.meta.url), { recursive: true });
  await writeFile(new URL('../artifacts/native-benchmark/cpu-reference.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
} finally { await detector?.dispose(); }
