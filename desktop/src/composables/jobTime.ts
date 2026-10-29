import { ref } from "vue";
import { estimateSeconds, modelLoadSeconds } from "../core/folder.ts";

/** How long a job takes on this machine, the same for a text, a file and a folder
 * (decision 0173): the characters the model will read at the measured pace, plus the
 * model's load. Without the recognition pack only the fast rules run, far quicker. */
const measuredPace = ref<number | null>(null);

export function jobSeconds(chars: number, packReady: boolean): number {
  return estimateSeconds(chars, measuredPace.value ?? undefined) / (packReady ? 1 : 20);
}

/** The pace a finished run kept, load included, for every estimate after it in this
 * launch (RAM only). Short runs say little about the pace and are left out. */
export function recordPace(chars: number, seconds: number, packReady: boolean) {
  if (packReady && chars > 20_000 && seconds > 0)
    measuredPace.value = chars / Math.max(1, seconds - modelLoadSeconds);
}
