import { ref } from "vue";
import { machineResources } from "../adapters/folder.ts";
import {
  memoryBudget,
  memoryChoices,
  memoryMessage,
  memoryNeed,
  pdfCharBytes,
  type MemoryChoice,
} from "../core/memory.ts";

/** How much memory OfflineMask may use (decision 0173), chosen in Cài đặt › Nâng cao.
 * One app-wide preference with no user content, kept beside the theme's. */
export const memoryKey = "offlinemask.memory.v1";
function read(): MemoryChoice {
  try {
    const value = localStorage.getItem(memoryKey);
    return memoryChoices.some((entry) => entry.id === value) ? (value as MemoryChoice) : "normal";
  } catch {
    return "normal";
  }
}
export const memoryChoice = ref<MemoryChoice>(read());
export function setMemoryChoice(choice: MemoryChoice) {
  memoryChoice.value = choice;
  try {
    if (choice === "normal") localStorage.removeItem(memoryKey);
    else localStorage.setItem(memoryKey, choice);
  } catch {
    // Unwritable storage: the choice still holds until the app closes.
  }
}

/** The machine's memory, asked once per launch. */
let machine: Promise<number | null> | undefined;
export function machineMemory(): Promise<number | null> {
  return (machine ??= machineResources().then((resources) => resources.memory));
}
export async function appMemoryBudget(choice = memoryChoice.value): Promise<number> {
  return memoryBudget(await machineMemory(), choice);
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
