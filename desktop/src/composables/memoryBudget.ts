import { machineResources } from "../adapters/folder.ts";
import { memoryBudget, memoryMessage, memoryNeed, pdfCharBytes } from "../core/memory.ts";

/** This machine's budget, asked once per launch (decision 0173). */
let budget: Promise<number> | undefined;
export function appMemoryBudget(): Promise<number> {
  return (budget ??= machineResources().then((resources) => memoryBudget(resources.memory)));
}

/** "" when the file fits in `share` of the budget (a folder's files open side by side,
 * each in its share), otherwise the reason it is refused. */
export async function memoryRefusal(file: File, share = 1): Promise<string> {
  const allowed = (await appMemoryBudget()) * share;
  const need = await memoryNeed(file);
  return need > allowed ? memoryMessage(need, allowed) : "";
}

/** The characters a PDF may yield within `share` of the budget, checked page by page. */
export async function pdfCharLimit(share = 1): Promise<number> {
  return Math.floor(((await appMemoryBudget()) * share) / pdfCharBytes);
}
