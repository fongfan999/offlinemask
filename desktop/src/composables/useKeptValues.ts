import { shallowRef } from "vue";

const none: ReadonlySet<string> = new Set();

/** Per masked file, the aliases whose values the user chose to keep (decision 0079).
 * RAM only, like the file itself: once the file is gone there is nothing to save. */
export function useKeptValues() {
  const kept = shallowRef(new Map<string, ReadonlySet<string>>());
  const of = (id: string) => kept.value.get(id) ?? none;
  function set(id: string, aliases: readonly string[], keep: boolean) {
    const next = new Set(of(id));
    for (const alias of aliases)
      if (keep) next.add(alias);
      else next.delete(alias);
    kept.value = new Map(kept.value).set(id, next);
    return next;
  }
  function forget(id: string) {
    if (!kept.value.has(id)) return;
    const next = new Map(kept.value);
    next.delete(id);
    kept.value = next;
  }
  return { of, set, forget };
}
