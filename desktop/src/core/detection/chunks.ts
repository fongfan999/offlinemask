import { graphemeBoundaries } from "../unicode.ts";

/** Token-bounded windows with source overlap; never rely on pipeline truncation. */
export function* modelChunkIterator(
  text: string,
  tokenCount: (text: string) => number,
): Generator<{ text: string; start: number }> {
  const boundaries = graphemeBoundaries(text);
  function boundaryAt(offset: number, roundUp: boolean) {
    let low = 0,
      high = boundaries.length - 1;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (boundaries[middle]! < offset) low = middle + 1;
      else high = middle;
    }
    return boundaries[!roundUp && boundaries[low]! > offset ? low - 1 : low]!;
  }
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + 1200, text.length);
    if (tokenCount(text.slice(start, end)) > 384) {
      let low = start + 1;
      let high = end;
      while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        if (tokenCount(text.slice(start, middle)) <= 384) low = middle;
        else high = middle - 1;
      }
      end = low;
    }
    // Split at whitespace when possible, without losing coverage of long words.
    if (end < text.length) {
      const boundary = text.lastIndexOf(" ", end);
      if (boundary > start + (end - start) / 2) end = boundary;
    }
    end = boundaryAt(end, false);
    if (end <= start || tokenCount(text.slice(start, end)) > 384)
      throw new Error("Cannot create a bounded model window");
    yield { text: text.slice(start, end), start };
    if (end === text.length) break;
    let next = Math.max(start + 1, end - 96);

    // Begin the overlap at a word boundary where one is nearby.
    const boundary = text.indexOf(" ", next);
    if (boundary >= 0 && boundary < end - 32) next = boundary + 1;
    start = boundaryAt(next, true);
  }
}

/** Synchronous form for fixtures and CPU evaluations. */
export function modelChunks(text: string, tokenCount: (text: string) => number) {
  return [...modelChunkIterator(text, tokenCount)];
}
