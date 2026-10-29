import type { OcrLine, OcrPage } from "./ocr.ts";

/** Text in pictures read by OfflineMask's own models (decision 0172), where the system
 * has no Vietnamese recognition of its own (Windows). Two ONNX graphs, described by
 * `reading/reading-v1.json` and carried inside the app: PaddleOCR's PP-OCRv4 detector
 * finds the lines, and the recogniser trained for OfflineMask reads each one. The result
 * is the same `OcrPage` the system's engine gives, a box for every word, so the rest of
 * the reading (`ocr.ts`, then the reader by place) is shared.
 *
 * Nothing here knows where the graphs run: the app runs them in a worker on the ONNX
 * Runtime WASM build it already carries, the measurements on the Node build. */

export interface ReadingDefinition {
  id: string;
  attribution: string;
  detector: ModelFile & {
    /** A picture whose longer side is larger is scaled down to it for detection. */
    maxSide: number;
    /** PaddleOCR's DB post-processing: the text probability a pixel needs, the mean a
     * region needs, and how far its box is pushed out (area × unclip / perimeter). */
    threshold: number;
    boxScore: number;
    unclip: number;
  };
  recogniser: ModelFile & {
    /** Lines are read at this height; each output step covers `stride` columns. */
    height: number;
    stride: number;
    /** The detector's boxes touch the ink; the recogniser learnt lines with room around
     * them, so each box is widened by this share of its height on every side. */
    grow: number;
    /** A line wider than this at `height` is read in pieces cut at word gaps. */
    piece: number;
    /** The classes, blank first. */
    alphabet: string[];
  };
}
interface ModelFile {
  name: string;
  bytes: number;
  sha256: string;
  /** Where the build fetches the file when it is neither committed in `reading/` nor in
   * `artifacts/reading/`. */
  source: string | null;
}

export interface ReadingModels {
  /** The detector's text probability for every pixel of a 1 × 3 × height × width input
   * (BGR, ImageNet's mean and spread), row by row. */
  detect(input: Float32Array, width: number, height: number): Promise<Float32Array>;
  /** The recogniser's class probabilities, step by step, for a 1 × 1 × height × width
   * line in −1…1. */
  recognise(
    input: Float32Array,
    width: number,
  ): Promise<{ data: Float32Array; steps: number; classes: number }>;
}

/** A decoded picture: RGBA, already drawn over white. */
export interface Picture {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  /** The detector's own text, in the page's pixels: the rows it found before its box
   * was pushed out (this line's letters and no other's), and its box across. */
  core?: { top: number; bottom: number; left: number; right: number };
}

/** PIL's bilinear resize (the filter the recogniser was trained with): a tent as wide as
 * the scale when shrinking, so every source pixel counts. One channel of `source`
 * (`stride` values a pixel, from `offset`) over `box`, to `width` × `height`. */
function resample(
  source: ArrayLike<number>,
  sourceWidth: number,
  sourceHeight: number,
  stride: number,
  offset: number,
  box: Box,
  width: number,
  height: number,
): Float32Array {
  const across = taps(box.x, box.width, width, sourceWidth);
  const down = taps(box.y, box.height, height, sourceHeight);
  const top = Math.min(...down.map((tap) => tap.first));
  const bottom = Math.max(...down.map((tap) => tap.first + tap.weights.length));
  const rows = new Float32Array((bottom - top) * width);
  for (let y = top; y < bottom; y++)
    for (let x = 0; x < width; x++) {
      const { first, weights } = across[x]!;
      let sum = 0;
      for (let k = 0; k < weights.length; k++)
        sum += weights[k]! * source[(y * sourceWidth + first + k) * stride + offset]!;
      rows[(y - top) * width + x] = sum;
    }
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const { first, weights } = down[y]!;
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = 0; k < weights.length; k++)
        sum += weights[k]! * rows[(first + k - top) * width + x]!;
      out[y * width + x] = sum;
    }
  }
  return out;
}
function taps(start: number, span: number, count: number, limit: number) {
  const scale = span / count;
  const support = Math.max(scale, 1);
  return Array.from({ length: count }, (_, index) => {
    const centre = start + (index + 0.5) * scale;
    let first = Math.max(0, Math.floor(centre - support + 0.5));
    const last = Math.min(limit, Math.max(first + 1, Math.floor(centre + support + 0.5)));
    first = Math.min(first, last - 1);
    const weights = new Float32Array(last - first);
    let sum = 0;
    for (let at = first; at < last; at++) {
      const weight = Math.max(0, 1 - Math.abs((at + 0.5 - centre) / support));
      weights[at - first] = weight;
      sum += weight;
    }
    if (sum) for (let k = 0; k < weights.length; k++) weights[k]! /= sum;
    else weights.fill(1 / weights.length);
    return { first, weights };
  });
}

/** The lines on the page, as boxes in its pixels: the detector's probability map read
 * the way PaddleOCR does (regions above `threshold`, kept when their mean reaches
 * `boxScore`, pushed out by `unclip`), each as an upright box. And the page's tilt, in
 * radians, clockwise: the weighted median of the long regions' own directions (from the
 * second moments of their pixels). */
async function detectLines(
  picture: Picture,
  models: ReadingModels,
  definition: ReadingDefinition["detector"],
): Promise<{ boxes: Box[]; tilt: number }> {
  const scale = Math.min(1, definition.maxSide / Math.max(picture.width, picture.height));
  const drawn = {
    width: Math.max(1, Math.round(picture.width * scale)),
    height: Math.max(1, Math.round(picture.height * scale)),
  };
  const width = Math.ceil(drawn.width / 32) * 32;
  const height = Math.ceil(drawn.height / 32) * 32;
  const plane = width * height;
  const input = new Float32Array(3 * plane);
  const mean = [0.485, 0.456, 0.406];
  const spread = [0.229, 0.224, 0.225];
  const whole = { x: 0, y: 0, width: picture.width, height: picture.height };
  for (let channel = 0; channel < 3; channel++) {
    // BGR: the first plane is blue.
    const values =
      scale < 1
        ? resample(
            picture.data,
            picture.width,
            picture.height,
            4,
            2 - channel,
            whole,
            drawn.width,
            drawn.height,
          )
        : undefined;
    const white = (1 - mean[channel]!) / spread[channel]!;
    const out = input.subarray(channel * plane, (channel + 1) * plane);
    out.fill(white);
    for (let y = 0; y < drawn.height; y++)
      for (let x = 0; x < drawn.width; x++) {
        const value = values
          ? values[y * drawn.width + x]!
          : picture.data[(y * picture.width + x) * 4 + 2 - channel]!;
        out[y * width + x] = (value / 255 - mean[channel]!) / spread[channel]!;
      }
  }
  const map = await models.detect(input, width, height);
  const seen = new Uint8Array(plane);
  const stack = new Int32Array(plane);
  const boxes: Box[] = [];
  const directions: { angle: number; weight: number }[] = [];
  for (let start = 0; start < plane; start++) {
    if (seen[start] || map[start]! <= definition.threshold) continue;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    let x0 = width,
      y0 = height,
      x1 = 0,
      y1 = 0,
      count = 0,
      sum = 0,
      sx = 0,
      sy = 0,
      sxx = 0,
      syy = 0,
      sxy = 0;
    while (top) {
      const at = stack[--top]!;
      const x = at % width;
      const y = (at - x) / width;
      count++;
      sum += map[at]!;
      sx += x;
      sy += y;
      sxx += x * x;
      syy += y * y;
      sxy += x * y;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (const next of [
        x > 0 ? at - 1 : -1,
        x < width - 1 ? at + 1 : -1,
        at - width,
        at + width,
      ]) {
        if (next < 0 || next >= plane || seen[next] || map[next]! <= definition.threshold) continue;
        seen[next] = 1;
        stack[top++] = next;
      }
    }
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    if (Math.min(w, h) < 3 || sum / count < definition.boxScore) continue;
    if (w >= h * 5 && count >= 50) {
      const mx = sx / count;
      const my = sy / count;
      const xx = sxx / count - mx * mx;
      const yy = syy / count - my * my;
      const xy = sxy / count - mx * my;
      directions.push({ angle: Math.atan2(2 * xy, xx - yy) / 2, weight: count });
    }
    const distance = (w * h * definition.unclip) / (2 * (w + h));
    const left = Math.max(0, (x0 - distance) / scale);
    const upper = Math.max(0, (y0 - distance) / scale);
    boxes.push({
      x: left,
      y: upper,
      width: Math.min(picture.width, (x1 + 1 + distance) / scale) - left,
      height: Math.min(picture.height, (y1 + 1 + distance) / scale) - upper,
      core: {
        top: y0 / scale,
        bottom: (y1 + 1) / scale,
        left,
        right: Math.min(picture.width, (x1 + 1 + distance) / scale),
      },
    });
  }
  directions.sort((a, b) => a.angle - b.angle);
  const half = directions.reduce((total, direction) => total + direction.weight, 0) / 2;
  let tilt = 0;
  for (let seen = 0, index = 0; index < directions.length; index++) {
    seen += directions[index]!.weight;
    if (seen >= half) {
      tilt = directions[index]!.angle;
      break;
    }
  }
  return { boxes, tilt: directions.length >= 3 ? tilt : 0 };
}

/** A page is turned upright when it leans more than this, and not past `maxTilt`: beyond
 * it the long regions are no longer lines. */
const minTilt = (0.25 * Math.PI) / 180;
const maxTilt = (15 * Math.PI) / 180;
/** The picture turned by `tilt` about its centre, so that lines leaning by it lie level:
 * same size, sampled bilinearly, white where the turned page does not reach. */
function straighten(picture: Picture, tilt: number): Picture {
  const { width, height, data } = picture;
  const out = new Uint8ClampedArray(data.length).fill(255);
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  const cx = width / 2;
  const cy = height / 2;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const sx = cx + dx * cos - dy * sin - 0.5;
      const sy = cy + dx * sin + dy * cos - 0.5;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      if (x0 < 0 || y0 < 0 || x0 + 1 >= width || y0 + 1 >= height) continue;
      const fx = sx - x0;
      const fy = sy - y0;
      const at = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        const a = data[(y0 * width + x0) * 4 + channel]!;
        const b = data[(y0 * width + x0 + 1) * 4 + channel]!;
        const c = data[((y0 + 1) * width + x0) * 4 + channel]!;
        const d = data[((y0 + 1) * width + x0 + 1) * 4 + channel]!;
        out[at + channel] = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
      }
    }
  return { data: out, width, height };
}

/** A column with a pixel this dark holds ink. Only the detector's own text counts: its
 * rows before the box was pushed out, and its box across. The box is widened before it
 * is read, and the margin takes in the lines above and below and the end of the word
 * beside it, which would stretch every word to the next cell. */
const inkBelow = 159;
function inkColumns(line: Float32Array, width: number, height: number, box: Box): boolean[] {
  const core = box.core;
  const row = (y: number) => ((y - box.y) / box.height) * height;
  const column = (x: number) => ((x - box.x) / box.width) * width;
  const top = core ? Math.max(0, Math.floor(row(core.top))) : 0;
  const bottom = core ? Math.min(height, Math.ceil(row(core.bottom))) : height;
  const left = core ? Math.max(0, Math.floor(column(core.left))) : 0;
  const right = core ? Math.min(width, Math.ceil(column(core.right))) : width;
  return Array.from({ length: width }, (_, x) => {
    if (x < left || x >= right) return false;
    for (let y = top; y < bottom; y++) if (line[y * width + x]! < inkBelow) return true;
    return false;
  });
}

/** Where a box wider than `piece` at the recogniser's height is cut: at the widest run of
 * blank columns near every `piece` of width, in the box's own columns at that height. */
function cuts(ink: boolean[], piece: number): number[] {
  const width = ink.length;
  const gaps: [number, number][] = [];
  for (let x = 0; x < width;) {
    if (ink[x]) {
      x++;
      continue;
    }
    const start = x;
    while (x < width && !ink[x]) x++;
    if (x - start >= 2 && start > 0 && x < width) gaps.push([start, x]);
  }
  const out = [0];
  while (width - out.at(-1)! > piece + piece / 6) {
    const from = out.at(-1)!;
    let best: [number, number] | undefined;
    for (const gap of gaps) {
      const middle = (gap[0] + gap[1]) / 2;
      if (middle <= from + piece / 2 || middle >= from + piece * 1.15) continue;
      if (!best || gap[1] - gap[0] > best[1] - best[0]) best = gap;
    }
    out.push(best ? Math.round((best[0] + best[1]) / 2) : from + piece);
  }
  out.push(width);
  return out;
}

/** One piece of a line read: its words, each with the columns it spans in `width`. The
 * recogniser is read greedily (the best class at every step, repeats merged, blanks
 * dropped), and every letter keeps the step it was read at. Two words part at the step
 * the space between them was read at, and each word's span is then drawn in to its own
 * ink. */
const paperFrom = 205;
const paperTo = 230;
async function readPiece(
  grey: Uint8Array,
  picture: Picture,
  box: Box,
  models: ReadingModels,
  definition: ReadingDefinition["recogniser"],
): Promise<{ text: string; start: number; end: number; confidence: number }[]> {
  const height = definition.height;
  const width = Math.max(32, Math.round((height * box.width) / box.height));
  const line = resample(grey, picture.width, picture.height, 1, 0, box, width, height);
  // The recogniser learnt on paper from grey 205 to white; a photograph's shadowed corner
  // is darker, and is brought up to it, the print with it.
  const paper = [...line].sort((a, b) => a - b)[Math.floor(line.length * 0.75)]!;
  const lift = paper && paper < paperFrom ? paperTo / paper : 1;
  const input = new Float32Array(line.length);
  for (let at = 0; at < line.length; at++)
    input[at] = (Math.min(255, line[at]! * lift) / 255 - 0.5) / 0.5;
  const { data, steps, classes } = await models.recognise(input, width);
  const letters: { char: string; step: number; probability: number }[] = [];
  let previous = 0;
  for (let step = 0; step < steps; step++) {
    let best = 0;
    for (let index = 1; index < classes; index++)
      if (data[step * classes + index]! > data[step * classes + best]!) best = index;
    if (best !== previous && best !== 0)
      letters.push({
        char: definition.alphabet[best]!,
        step,
        probability: data[step * classes + best]!,
      });
    previous = best;
  }
  const ink = inkColumns(line, width, height, box);
  const stride = definition.stride;
  const words: { text: string; start: number; end: number; confidence: number }[] = [];
  let word: typeof letters = [];
  let boundary = 0;
  const close = (end: number) => {
    if (!word.length) return;
    let start = boundary;
    let stop = Math.min(width, Math.max(start + 1, end));
    while (start < stop - 1 && !ink[start]) start++;
    while (stop > start + 1 && !ink[stop - 1]) stop--;
    words.push({
      text: word.map((letter) => letter.char).join(""),
      start,
      end: stop,
      confidence: word.reduce((sum, letter) => sum + letter.probability, 0) / word.length,
    });
    word = [];
  };
  for (const letter of letters) {
    if (letter.char !== " ") {
      word.push(letter);
      continue;
    }
    if (!word.length) continue;
    const at = Math.min(width, Math.round((letter.step + 0.5) * stride));
    close(at);
    boundary = at;
  }
  close(width);
  return words;
}

/** How tall the line's print is, from the band of rows where its ink is densest (at least
 * half the densest row's): about half the font size in lower case, nearer three quarters
 * in capitals and digits (a least-squares fit over 1 882 lines of seed 1's scans against
 * their text PDFs, decision 0172). Unlike the letters' widths it does not grow with bold
 * print; `ocr.ts` takes the mean of the two. */
const band = { dense: 0.5, lower: 0.529, capitals: 0.206, ink: 0.02, paper: 0.5, rule: 0.9 };
function bandSize(grey: Uint8Array, picture: Picture, found: Box, words: OcrLine[]): number {
  const left = Math.max(0, Math.floor(Math.min(...words.map((word) => word.x)) * picture.width));
  const right = Math.min(
    picture.width,
    Math.ceil(Math.max(...words.map((word) => word.x + word.width)) * picture.width),
  );
  // Ink is what is darker than halfway between the line's paper and its print, which
  // stays at the letters' edges when a photograph blurs them or lights the page unevenly.
  const top = Math.floor(found.y);
  const bottom = Math.min(picture.height, found.y + found.height);
  const levels = new Uint32Array(256);
  for (let y = top; y < bottom; y++)
    for (let x = left; x < right; x++) levels[grey[y * picture.width + x]!]!++;
  const level = (share: number) => {
    const wanted = share * (bottom - top) * (right - left);
    for (let value = 0, seen = 0; value < 256; value++)
      if ((seen += levels[value]!) >= wanted) return value;
    return 255;
  };
  const threshold = (level(band.ink) + level(band.paper)) / 2;
  const counts: number[] = [];
  for (let y = top; y < bottom; y++) {
    let dark = 0;
    for (let x = left; x < right; x++) if (grey[y * picture.width + x]! < threshold) dark++;
    // A row inked all the way across is a table's rule, not print.
    counts.push(dark >= (right - left) * band.rule ? 0 : dark);
  }
  // The densest row is taken no denser than twice the middle inked row: a few strokes
  // across (the bars of capital Ts) would otherwise stand for the whole band.
  const inked = counts.filter(Boolean).sort((a, b) => a - b);
  const densest = Math.min(Math.max(0, ...counts), 2 * (inked[inked.length >> 1] ?? 0));
  const rows = counts.flatMap((count, index) => (count >= densest * band.dense ? [index] : []));
  const letters = [
    ...words
      .map((word) => word.text)
      .join("")
      .replace(/[^\p{L}\p{N}]/gu, ""),
  ];
  if (!densest || letters.length < 3) return 0;
  const capitals = letters.filter((char) => /[\p{Lu}\p{N}]/u.test(char)).length / letters.length;
  return (rows.at(-1)! - rows[0]! + 1) / (band.lower + band.capitals * capitals);
}

/** Every word in the picture with its box, in fractions of the picture, origin top
 * left; the words of one line share its y, height, number and measured size, and all but
 * its last keep the space after them, as `ocr.ts` expects of an engine. */
export async function readPicture(
  original: Picture,
  models: ReadingModels,
  definition: ReadingDefinition,
): Promise<OcrPage> {
  // A crooked page is turned upright and its lines found again: an upright box around a
  // leaning line takes in the next one. The words' places are then the upright page's,
  // as the reader by place wants them.
  let picture = original;
  const first = await detectLines(picture, models, definition.detector);
  const { tilt } = first;
  let detected = first.boxes;
  if (Math.abs(tilt) > minTilt && Math.abs(tilt) < maxTilt) {
    picture = straighten(original, tilt);
    detected = (await detectLines(picture, models, definition.detector)).boxes;
  }
  const grey = new Uint8Array(picture.width * picture.height);
  for (let at = 0; at < grey.length; at++)
    grey[at] =
      (299 * picture.data[at * 4]! +
        587 * picture.data[at * 4 + 1]! +
        114 * picture.data[at * 4 + 2]!) /
      1000;
  const { recogniser } = definition;
  const lines: OcrLine[] = [];
  let number = 0;
  for (const found of detected) {
    number++;
    const by = recogniser.grow * found.height;
    const x = Math.max(0, found.x - by);
    const y = Math.max(0, found.y - by);
    const box: Box = {
      x,
      y,
      width: Math.min(picture.width, found.x + found.width + by) - x,
      height: Math.min(picture.height, found.y + found.height + by) - y,
      ...(found.core ? { core: found.core } : {}),
    };
    const across = Math.max(32, Math.ceil((recogniser.height * box.width) / box.height));
    const pieces: Box[] = [box];
    if (across > recogniser.piece + recogniser.piece / 6) {
      const whole = resample(
        grey,
        picture.width,
        picture.height,
        1,
        0,
        box,
        across,
        recogniser.height,
      );
      const at = cuts(inkColumns(whole, across, recogniser.height, box), recogniser.piece);
      const scale = box.width / across;
      pieces.splice(
        0,
        1,
        ...at.slice(0, -1).map((start, index) => ({
          ...box,
          x: box.x + start * scale,
          width: (at[index + 1]! - start) * scale,
        })),
      );
    }
    const words: OcrLine[] = [];
    for (const piece of pieces) {
      const scale =
        piece.width / Math.max(32, Math.round((recogniser.height * piece.width) / piece.height));
      for (const word of await readPiece(grey, picture, piece, models, recogniser))
        words.push({
          text: word.text,
          confidence: word.confidence,
          x: (piece.x + word.start * scale) / picture.width,
          y: found.y / picture.height,
          width: ((word.end - word.start) * scale) / picture.width,
          height: found.height / picture.height,
        });
    }
    const size = words.length ? bandSize(grey, picture, found, words) : 0;
    words.forEach((word, index) => {
      if (index + 1 < words.length) word.text += " ";
      if (size) word.size = size / picture.height;
      word.line = number;
    });
    lines.push(...words);
  }
  return { lines };
}
