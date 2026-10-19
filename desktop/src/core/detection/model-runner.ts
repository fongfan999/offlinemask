import { decodeBioTokenSpans, type RawTokenClassificationEntity } from "openmed";
import { modelChunkIterator } from "./chunks.ts";
import { alignSourceTokens } from "./source-offsets.ts";
import { modelDetections } from "./model-policy.ts";
import { applyDetectionPolicy } from "./policy.ts";
import type { Detection, DetectionProgress } from "./types.ts";

/** A provider owns inference and tokenizer-specific alignment. No pack identity
 * or file-format assumptions belong in the shared runner.
 */
export interface ModelProvider {
  source: string;
  tokenCount(text: string): number;
  predict(text: string): Promise<RawTokenClassificationEntity[]>;
  align?: (text: string, tokens: RawTokenClassificationEntity[]) => RawTokenClassificationEntity[];
  dispose(): Promise<unknown>;
}

/** `threshold` drops a decoded span whose mean token probability is below it; 0 keeps
 * every span, as shipped. Evaluations may raise it (decision 0079). */
export function createModelRunner(
  providers: readonly ModelProvider[],
  { threshold = 0 }: { threshold?: number } = {},
) {
  if (!providers.length) throw new Error("Model provider required");
  const progressDefault = (_value: DetectionProgress) => {};
  async function inspect(text: string, progress = progressDefault, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const plans = [];
    for (const provider of providers) {
      const chunks = [];
      for (const chunk of modelChunkIterator(text, (value) => provider.tokenCount(value))) {
        signal?.throwIfAborted();
        chunks.push(chunk);
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
      plans.push({ provider, chunks });
    }
    const total = plans.reduce((sum, plan) => sum + plan.chunks.length, 0);
    let completed = 0;
    const predictions: Detection[] = [];
    for (const { provider, chunks } of plans) {
      for (const chunk of chunks) {
        signal?.throwIfAborted();
        const tokens = await provider.predict(chunk.text);
        signal?.throwIfAborted();
        const aligned = (provider.align ?? alignSourceTokens)(chunk.text, tokens);
        const spans = decodeBioTokenSpans(chunk.text, aligned, { threshold });
        predictions.push(
          ...modelDetections(chunk.text, spans).map((span) => ({
            ...span,
            start: span.start + chunk.start,
            end: span.end + chunk.start,
            source: provider.source,
          })),
        );
        progress({ stage: "processing", completed: ++completed, total });
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }
    signal?.throwIfAborted();
    return applyDetectionPolicy(text, predictions);
  }
  return {
    inspect,
    async detect(text: string, progress = progressDefault) {
      return (await inspect(text, progress)).complete;
    },
    dispose: () => Promise.all(providers.map((provider) => provider.dispose())),
  };
}
