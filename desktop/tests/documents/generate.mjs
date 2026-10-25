import { kinds } from "./kinds.mjs";
import { random } from "./data.mjs";
import { renderDocx } from "./render-docx.mjs";
import { renderPdf } from "./render-pdf.mjs";

/** Every synthetic document for a seed (decision 0153): each kind and layout as PDF and
 * Word, plus a second PDF with other values, so a rule that only fits one draw shows.
 * Returns { name, bytes, expect } in a fixed order. */
export async function syntheticDocuments(seed = 1, { variants = 2 } = {}) {
  const documents = [];
  for (const [kind, { layouts, build }] of Object.entries(kinds))
    for (const layout of layouts)
      for (let variant = 0; variant < variants; variant++) {
        const model = build(random(seed * 7919 + documents.length * 104729 + variant), layout);
        const expect = {
          hide: model.hide,
          keep: model.keep,
          ignore: model.ignore,
          generated: { kind, layout, variant, seed },
        };
        const base = `${kind}-${layout}-${variant + 1}`;
        documents.push({ name: `${base}.pdf`, bytes: await renderPdf(model), expect });
        if (variant === 0)
          documents.push({ name: `${base}.docx`, bytes: await renderDocx(model), expect });
      }
  return documents;
}
