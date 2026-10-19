/** Development adapter: suppress late IPC results after a local cancel request. */
export function createNativeTokenizer(invoke, nextId) {
  let active;
  return {
    async encode(text, inference = true) {
      if (active) throw Error('Native tokenizer busy');
      const job = { id: nextId(), cancelled: false };
      active = job;
      try {
        const result = await invoke('minilm_encode', { id: job.id, text, inference });
        if (job.cancelled) throw new DOMException('Cancelled', 'AbortError');
        return result;
      } catch {
        if (job.cancelled) throw new DOMException('Cancelled', 'AbortError');
        throw Error('Native tokenizer failed');
      } finally {
        if (active === job) active = undefined;
      }
    },
    async cancel() {
      if (!active) return false;
      const job = active;
      job.cancelled = true;
      // Local cancellation takes effect even when native work has just finished.
      return invoke('minilm_cancel', { id: job.id });
    },
  };
}
