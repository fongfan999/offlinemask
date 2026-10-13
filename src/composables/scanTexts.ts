import { localOptions, type DetectionOption } from "../core/detection/options.ts";
import type { Detection } from "../core/detection/types.ts";
import { scanBatches, splitDetections } from "../core/sheet/mask.ts";
import type { TextDetector } from "./useMaskingRun.ts";

export interface TextScanProgress {
  stage: "loading" | "reading";
  done: number;
  total: number;
}

/** Detect many short texts (spreadsheet cells, Word paragraphs) with the shared
 * detector (decisions 0076, 0078). Each distinct text is read once and its result
 * shared by every key with that text. Texts without a letter cannot hold a name or
 * an address, so they skip the model and meet only the fast email, phone and account
 * rules. Small batches keep progress moving and make cancelling quick. */
export async function scanTexts<Key>(
  detector: TextDetector,
  items: readonly { key: Key; text: string }[],
  options: readonly DetectionOption[],
  modelRoot: string | undefined,
  report?: (progress: TextScanProgress) => void,
  into = new Map<Key, Detection[]>(),
  stopped: () => boolean = () => false,
): Promise<Map<Key, Detection[]>> {
  const byText = new Map<string, Key[]>();
  for (const item of items) {
    const keys = byText.get(item.text);
    if (keys) keys.push(item.key);
    else byText.set(item.text, [item.key]);
  }
  const unique = [...byText.keys()];
  const hasLetter = (text: string) => /\p{L}/u.test(text);
  const groups = [
    { texts: unique.filter(hasLetter), options: [...options], root: modelRoot },
    {
      texts: unique.filter((text) => !hasLetter(text)),
      options: [...localOptions],
      root: undefined,
    },
  ];
  const total = unique.length;
  let done = 0;
  for (const group of groups) {
    const batches = scanBatches(
      group.texts.map((text, index) => ({ key: String(index), text })),
      8_000,
    );
    for (const batch of batches) {
      if (stopped()) throw new DOMException("Cancelled", "AbortError");
      const found = await detector.detect(
        batch.text,
        (step) =>
          report?.(
            step.stage === "loading"
              ? { stage: "loading", done, total }
              : {
                  stage: "reading",
                  done:
                    done +
                    Math.floor((batch.parts.length * step.completed) / Math.max(1, step.total)),
                  total,
                },
          ),
        group.root,
        group.options,
      );
      const spans = splitDetections(batch, found);
      for (const part of batch.parts)
        for (const key of byText.get(group.texts[Number(part.key)]!)!)
          into.set(key, spans.get(part.key) ?? []);
      done += batch.parts.length;
      report?.({ stage: "reading", done, total });
    }
  }
  return into;
}
