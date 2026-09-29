import { createTextDetector } from '../../src/adapters/text-detection';
import { modelStatus } from '../../src/adapters/models';
import { detectionOptions } from '../../src/core/detection/options';
import { analyzeText } from '../../src/core/text';

const button = document.querySelector<HTMLButtonElement>('#run')!;
const cancel = document.querySelector<HTMLButtonElement>('#cancel')!;
const status = document.querySelector<HTMLElement>('#status')!;
const report = document.querySelector<HTMLElement>('#report')!;
const detector = createTextDetector();
// This entry point accepts no user text. Persist only synthetic benchmark metrics,
// in the isolated benchmark app, so a WebContent termination remains observable.
const storageKey = 'offlinemask-recognition-performance-v1';
type Result = { label: string; utf16Length: number; detectionMs: number; firstProcessingMs: number; findings: number; addressCovered: boolean };
type Report = { wallStart: number; wallEnd?: number; phase: string; results: Result[]; maxHeartbeatDelayMs: number };
function render(value: Report) {
  report.replaceChildren();
  for (const row of [JSON.stringify({ ...value, results: undefined }), ...value.results.map(result => JSON.stringify(result))]) {
    const line = document.createElement('p');
    line.textContent = row;
    report.append(line);
  }
}
try {
  const previous = localStorage.getItem(storageKey);
  if (previous) {
    const value: Report = JSON.parse(previous);
    render(value);
    status.textContent = value.wallEnd ? 'Previous run saved' : `Interrupted previous run: ${value.phase}`;
  }
} catch { status.textContent = 'Previous metrics unavailable'; }
let stopped = false;
const suffix = 'Khách hàng Trần Minh Bình nhận thư tại căn 1208, tòa B, 36 Nguyễn Trãi, Thanh Xuân, Hà Nội. Email synthetic@example.org. Ngày 10/09/2026, số tiền 2.500.000 đồng.';
function fixture(length: number) {
  const filler = 'Nội dung tổng hợp đã được kiểm tra. ';
  return filler.repeat(Math.ceil(Math.max(0, length - suffix.length) / filler.length)).slice(0, Math.max(0, length - suffix.length)) + suffix;
}
cancel.onclick = () => { stopped = true; detector.cancel(); status.textContent = 'Cancelled'; };
button.onclick = async () => {
  // Each run has a fresh worker; subsequent cases in the same run reuse it.
  detector.cancel();
  button.disabled = true; cancel.disabled = false; stopped = false;
  const value: Report = { wallStart: Date.now(), phase: 'Checking local test pack', results: [], maxHeartbeatDelayMs: 0 };
  function save(phase: string) {
    value.phase = phase;
    status.textContent = phase;
    localStorage.setItem(storageKey, JSON.stringify(value));
    render(value);
  }
  let last = performance.now();
  const heartbeat = setInterval(() => {
    const now = performance.now();
    value.maxHeartbeatDelayMs = Math.max(value.maxHeartbeatDelayMs, Math.round(now - last - 50));
    last = now;
  }, 50);
  try {
    save(value.phase);
    let models = await modelStatus();
    while (models.stage === 'checking' && !stopped) {
      await new Promise(resolve => setTimeout(resolve, 100)); models = await modelStatus();
    }
    if (!models.root || models.stage !== 'ready') throw Error('Verified local test pack required');
    for (const [label, length] of [['cold-short', suffix.length], ['warm-short-1', suffix.length], ['warm-short-2', suffix.length], ['warm-short-3', suffix.length], ['after-cancel', suffix.length]] as const) {
      if (stopped) break;
      if (label === 'after-cancel') {
        let cancelled = false;
        try {
          await detector.detect(fixture(2000), p => {
            if (!cancelled && p.stage === 'processing') { cancelled = true; detector.cancel(true); }
          }, models.root, detectionOptions.map(option => option.id));
          throw Error('Cancellation did not reject');
        } catch (error) {
          if (!(error instanceof Error) || error.name !== 'AbortError') throw error;
        }
      }
      const text = fixture(length), started = performance.now();
      let firstProcessingMs: number | undefined;
      const ds = await detector.detect(text, progress => {
        if (progress.stage === 'processing' && firstProcessingMs === undefined) firstProcessingMs = performance.now() - started;
        save(`${label}: ${progress.stage} ${progress.completed}/${progress.total}`);
      }, models.root, detectionOptions.map(option => option.id));
      const detectionMs = performance.now() - started;
      save(`${label}: analyzing`);
      const analysis = analyzeText(text, '12345678', ds);
      const address = 'căn 1208, tòa B, 36 Nguyễn Trãi, Thanh Xuân, Hà Nội';
      const at = text.indexOf(address);
      const addressCovered = Array.from({ length: address.length }, (_, index) => at + index).every(index => /\s/u.test(text[index]!) || analysis.spans.some(span => span.start <= index && span.end > index));
      value.results.push({ label, utf16Length: text.length, detectionMs: Math.round(detectionMs), firstProcessingMs: Math.round(firstProcessingMs ?? 0), findings: analysis.findings.length, addressCovered });
      save(`${label}: complete`);
    }
    save(stopped ? 'Cancelled' : 'Completed');
  } catch { save(stopped ? 'Cancelled' : 'Failed'); }
  finally {
    clearInterval(heartbeat); cancel.disabled = true; button.disabled = false;
    value.wallEnd = Date.now(); save(value.phase);
  }
};
