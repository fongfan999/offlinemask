import type { Detection } from "./types.ts";

const space = /\s/u;
/** Where each non-whitespace code unit of `text` sits. */
function solid(text: string) {
  const at: number[] = [];
  for (let index = 0; index < text.length; index++) if (!space.test(text[index]!)) at.push(index);
  return at;
}

/** Detections found in `from`, moved onto `to` when the two differ only in whitespace
 * (decision 0131). Accessibility reports a Chromium selection without some of the line
 * breaks its copy has; the check made on the first is the click's answer for the
 * second. Each span covers the same characters; null when the texts differ otherwise. */
export function carryDetections(
  detections: readonly Detection[],
  from: string,
  to: string,
): Detection[] | null {
  if (from === to) return [...detections];
  const source = solid(from);
  const target = solid(to);
  if (source.length !== target.length || source.some((at, i) => from[at] !== to[target[i]!]))
    return null;
  // For each position of `from`, the rank of the first solid unit at or after it.
  const rank = new Array<number>(from.length + 1);
  let next = source.length;
  for (let index = from.length; index >= 0; index--) {
    if (index < from.length && !space.test(from[index]!)) next--;
    rank[index] = next;
  }
  const carried: Detection[] = [];
  for (const detection of detections) {
    const first = rank[detection.start]!;
    const last = rank[detection.end]! - 1;
    if (first > last) continue;
    carried.push({ ...detection, start: target[first]!, end: target[last]! + 1 });
  }
  return carried;
}
