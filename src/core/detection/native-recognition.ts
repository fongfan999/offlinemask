// Opt-in desktop qualification backend. The default app still runs the WASM backend.
import { AutoTokenizer } from "@huggingface/transformers";
import { loadPackRecognition, type ModelBackend } from "./recognition.ts";
import { recognitionPack, type PackDefinition } from "./pack.ts";
import { tokenPredictions } from "./token-predictions.ts";
import type { EncodeRecognition } from "./recognition-source.ts";

export type NativeCall =
  | { operation: "load" }
  | { operation: "release"; epoch: number }
  | { operation: "run"; epoch: number; model: number; ids: number[] };
export type NativeBridge = (request: NativeCall) => Promise<unknown>;

/** Tokenize in JavaScript, run the graph natively, and decode the logits in JavaScript. */
export function nativeBackend(
  bridge: NativeBridge,
  epoch: number,
  labels: Record<string, string>[],
  pack: PackDefinition,
): ModelBackend {
  return async (model) => {
    const index = pack.models.indexOf(model);
    const tokenizer = await AutoTokenizer.from_pretrained(model.directory, {
      local_files_only: true,
    });
    return {
      tokenizer,
      async predict(text) {
        const words = tokenizer.tokenize(text);
        const content = tokenizer.encode(text, { add_special_tokens: false });
        const ids = tokenizer.encode(text);
        if (
          words.length !== content.length ||
          ids.length !== content.length + 2 ||
          content.some((id, i) => id !== ids[i + 1])
        )
          throw Error("Unsupported token layout");
        const output = (await bridge({ operation: "run", epoch, model: index, ids })) as {
          dims: number[];
          data: number[];
        };
        return tokenPredictions(words, output.dims, output.data, labels[index]!, true);
      },
      dispose: async () => {},
    };
  };
}

export async function loadNativeRecognition(
  root: string,
  encode: EncodeRecognition,
  bridge: NativeBridge,
  pack: PackDefinition = recognitionPack,
) {
  const loaded = (await bridge({ operation: "load" })) as {
    epoch: number;
    labels: Record<string, string>[];
  };
  try {
    if (loaded.labels.length !== pack.models.length)
      throw Error("Native session count differs from the pack");
    const recognition = await loadPackRecognition(
      pack,
      root,
      encode,
      nativeBackend(bridge, loaded.epoch, loaded.labels, pack),
    );
    return {
      ...recognition,
      dispose: async () => {
        await bridge({ operation: "release", epoch: loaded.epoch });
        return [];
      },
    };
  } catch (error) {
    await bridge({ operation: "release", epoch: loaded.epoch });
    throw error;
  }
}
