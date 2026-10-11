/** Chunked model transfer for the desktop asset protocol.
 *
 * Tauri's `asset:` handler answers every request on the host's main thread and
 * hands the whole body to WebKit in one call, so fetching a 900 MB model file
 * froze the window for about three seconds. The same handler honours `Range`
 * and caps each reply at about 1 MB. This fetch asks for the file in ranges and
 * streams the chunks, in order, through one `Response` carrying the full
 * `content-length`. The caller sees an ordinary download; the main thread only
 * ever copies one chunk between events.
 */
export interface RangedFetchOptions {
  /** URLs fetched in ranges. Everything else goes straight to `fetch`. */
  shouldRange: (url: string) => boolean;
  fetch?: typeof globalThis.fetch;
  /** Bytes asked for per range. The server may answer with less: its first reply sets the step. */
  chunkBytes?: number;
  /** Ranges kept in flight ahead of the consumer. */
  concurrency?: number;
}

/** Matches the cap in Tauri's asset protocol, so each reply is one full range. */
export const defaultChunkBytes = 1000 * 1024;

export function parseContentRange(
  value: string | null,
): { start: number; end: number; total: number } | null {
  const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(value ?? "");
  if (!match) return null;
  const [start, end, total] = match.slice(1).map(Number) as [number, number, number];
  return start <= end && end < total ? { start, end, total } : null;
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}

export function createRangedFetch({
  shouldRange,
  fetch: base = globalThis.fetch.bind(globalThis),
  chunkBytes = defaultChunkBytes,
  concurrency = 4,
}: RangedFetchOptions): typeof globalThis.fetch {
  return async (input, init) => {
    const url = requestUrl(input);
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    if (
      method.toUpperCase() !== "GET" ||
      !shouldRange(url) ||
      new Headers(init?.headers).has("range")
    ) {
      return base(input, init);
    }
    const part = (start: number, end: number) => {
      const headers = new Headers(init?.headers);
      headers.set("range", `bytes=${start}-${end}`);
      // Small ranges fit the runtime's memory cache, where a whole model would otherwise
      // linger a second time; the pack is read from disk on every load anyway.
      return base(url, { ...init, headers, cache: "no-store" });
    };

    const first = await part(0, chunkBytes - 1);
    // A server that ignores the range answers 200 with the whole body, which is fine as is.
    if (first.status !== 206) return first;
    const range = parseContentRange(first.headers.get("content-range"));
    if (!range || range.start !== 0) throw new Error("Unexpected content range");
    const { total } = range;
    const step = range.end + 1;

    /** One verified range, delivered as the pieces the runtime already produced. */
    type Chunk = { response: Response; length: number };
    const chunk = async (start: number): Promise<Chunk> => {
      const end = Math.min(start + step, total) - 1;
      const response = await part(start, end);
      const got =
        response.status === 206 ? parseContentRange(response.headers.get("content-range")) : null;
      if (!got || got.start !== start || got.end !== end || got.total !== total)
        throw new Error("Unexpected content range");
      return { response, length: end - start + 1 };
    };
    // Forward the body pieces as they are instead of concatenating each range: the
    // consumer copies them straight into its own buffer, so no range-sized garbage remains.
    const forward = async (
      { response, length }: Chunk,
      controller: ReadableStreamDefaultController<Uint8Array>,
    ) => {
      if (!response.body) throw new Error("Missing range body");
      const reader = response.body.getReader();
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.length;
        if (received > length) throw new Error("Long range body");
        controller.enqueue(value);
      }
      if (received !== length) throw new Error("Short range body");
    };

    let next = step;
    const inFlight: Promise<Chunk>[] = [];
    const fill = () => {
      while (inFlight.length < concurrency && next < total) {
        const pending = chunk(next);
        // Failures surface when the chunk is consumed; never as an unhandled rejection.
        pending.catch(() => {});
        inFlight.push(pending);
        next += step;
      }
    };
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        fill();
        await forward({ response: first, length: step }, controller);
        if (step === total) controller.close();
      },
      async pull(controller) {
        // Top up before taking the head, so the awaited range counts toward the limit.
        fill();
        const pending = inFlight.shift();
        if (!pending) {
          controller.close();
          return;
        }
        await forward(await pending, controller);
        if (!inFlight.length && next >= total) controller.close();
      },
    });
    return new Response(body, {
      status: 200,
      headers: {
        "content-length": String(total),
        "content-type": first.headers.get("content-type") ?? "application/octet-stream",
      },
    });
  };
}
