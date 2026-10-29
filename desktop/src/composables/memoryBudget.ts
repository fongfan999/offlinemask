import { machineResources } from "../adapters/folder.ts";
import {
  memoryBudget,
  memoryMessage,
  memoryNeed,
  pdfCharBytes,
  pdfMemoryMessage,
} from "../core/memory.ts";

/** The machine's memory, asked once per launch. */
let machine: Promise<number | null> | undefined;
export function machineMemory(): Promise<number | null> {
  return (machine ??= machineResources().then((resources) => resources.memory));
}
export async function appMemoryBudget(): Promise<number> {
  return memoryBudget(await machineMemory());
}

/** "" when the file fits in `share` of the budget (a folder's files open side by side,
 * each in its share), otherwise the reason it is refused. */
export async function memoryRefusal(file: File, share = 1): Promise<string> {
  const allowed = (await appMemoryBudget()) * share;
  const need = await memoryNeed(file);
  return need > allowed ? memoryMessage(need, allowed) : "";
}
/** Why a PDF stopped part way: its text passed `share` of the budget. */
export async function pdfRefusal(share = 1): Promise<string> {
  return pdfMemoryMessage((await appMemoryBudget()) * share);
}

/** The characters a PDF may yield within `share` of the budget, checked page by page. */
export async function pdfCharLimit(share = 1): Promise<number> {
  return Math.floor(((await appMemoryBudget()) * share) / pdfCharBytes);
}
