import type { Detection } from "./types.ts";
import { mergeModelDetections, plausibleModelDetections } from "./model-policy.ts";
import { completeAddressBoundaries } from "./address-boundaries.ts";
import { detectBankingIdentifiers } from "./banking.ts";
import { detectContactDetails } from "./contact.ts";
import { detectLabelledFields, reconcileLabelledFields } from "./labelled-fields.ts";
import { reconcileStructuredValues } from "./structured-values.ts";
import { reconcileContextFields } from "./context-fields.ts";

/** Local-only scope must not acquire contextual capabilities from a refactor. */
export function localDetections(text: string): Detection[] {
  return reconcileStructuredValues(text, [
    ...detectBankingIdentifiers(text),
    ...detectContactDetails(text),
  ]);
}

/** One policy for every contextual provider, before user category selection.
 * modelOnly includes shared label mapping/overlap merging, but no local field,
 * contact, identifier or address-completion rules. Neither array is persisted.
 */
export function applyDetectionPolicy(text: string, predictions: readonly Detection[]) {
  const modelOnly = plausibleModelDetections(text, mergeModelDetections([...predictions]));
  const fields = detectLabelledFields(text);
  const completed = completeAddressBoundaries(text, [...modelOnly, ...fields.detections]);
  const complete = reconcileStructuredValues(
    text,
    reconcileContextFields(text, [
      ...detectBankingIdentifiers(text),
      ...detectContactDetails(text),
      ...reconcileLabelledFields(text, completed, fields),
    ]),
  );
  return { modelOnly, complete };
}
