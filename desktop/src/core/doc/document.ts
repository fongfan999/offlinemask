import { mailtoTargets, openDocx, writeDocx, type DocEdits, type DocSource } from "./docx.ts";
import { odtMailtoTargets, openOdt, writeOdt } from "./odt.ts";

/** An ODF package starts with an uncompressed `mimetype` entry, so its name sits right
 * after the first local file header; anything else is read as Word. */
function isOdf(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes.subarray(30, 38)) === "mimetype";
}

/** Open a Word or OpenDocument text file (decisions 0078, 0084). */
export async function openDocument(bytes: Uint8Array) {
  const opened = isOdf(bytes) ? await openOdt(bytes) : await openDocx(bytes);
  return {
    ...opened,
    mailto:
      opened.source.format === "odt"
        ? odtMailtoTargets(opened.source)
        : mailtoTargets(opened.source),
  };
}
export function writeDocument(source: DocSource, edits: DocEdits): Promise<Uint8Array> {
  return source.format === "odt" ? writeOdt(source, edits) : writeDocx(source, edits);
}
