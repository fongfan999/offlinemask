"""Trains OfflineMask's own Vietnamese line recogniser (decision 0172).

A CRNN (a small convolutional stack, two bidirectional LSTM layers) read with CTC: a
picture of one printed line or cell, 32 pixels high, becomes its text. The lines are the
synthetic set's texts (`export-lines.mjs`, seeds 100-399; seeds 1-26 never), drawn on the
fly in the fonts of `--fonts`, which must not include the documents' own Be Vietnam Pro
and Noto Serif: the measurement on the scanned seeds then reads print the model never
saw. Each picture goes through what a copier does to a page (resolution, blur, JPEG,
tilt, grey paper, table rules beside the text), and with `--copier` a share of them
through what an office copier's bi-level scan does (decision 0177): strokes thickened
or broken by the threshold, specks, the neighbouring lines' marks in the box, and
values in italics.

  uv run --project desktop/scripts/ocr-train train.py --lines <lines.txt> --dev <dev.txt>
      --fonts <folder> --out <run folder> [--hours 2] [--batch 48]
      [--copier 0.4] [--init <run folder>]

The run folder gets `charset.json`, `checkpoint.pt` (the best by dev character error) and
`metrics.json`; `--export` writes `recogniser.onnx` from the checkpoint instead. `--init`
starts from another run's checkpoint and alphabet with a fresh schedule (a fine-tune).
`--evaluate` reads the dev lines with the checkpoint of `--out`, as before and as a
copier leaves them, and writes nothing.
"""

from __future__ import annotations

import argparse
import io
import json
import math
import random
import time
import unicodedata
from pathlib import Path

import numpy as np
import torch
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from torch import nn
from torch.utils.data import DataLoader, IterableDataset

HEIGHT = 32
MAX_WIDTH = 1024
HELD_OUT = ("bevietnampro", "notoserif")
# Times New Roman is what Vietnamese administrative documents are printed in (Decree
# 30/2020/ND-CP) and what contracts copy; Tinos has its metrics, and with `--copier` it
# is drawn for this share of lines.
TIMES = ("tinos",)
TIMES_SHARE = 0.3


def nfc(text: str) -> str:
    return unicodedata.normalize("NFC", text)


class Fonts:
    """The training fonts, each with the characters it has, its weights and styles."""

    def __init__(self, folder: Path):
        self.faces = []
        for path in sorted(folder.glob("*.ttf")):
            key = path.name.lower().replace("-", "").replace("_", "")
            if any(key.startswith(name) for name in HELD_OUT):
                raise SystemExit(f"{path.name} is a held-out document font")
            font = TTFont(path, lazy=True)
            cmap = set(font.getBestCmap() or {})
            axes = {axis.axisTag: (axis.minValue, axis.maxValue) for axis in font["fvar"].axes} if "fvar" in font else {}
            font.close()
            self.faces.append({"path": str(path), "cmap": cmap, "axes": axes, "name": path.stem})
        if not self.faces:
            raise SystemExit("No fonts")

    def has(self, face, text: str) -> bool:
        return all(ord(char) in face["cmap"] for char in text if not char.isspace())

    def pick(self, rng: random.Random, text: str, size: int, times: float = 0.0):
        faces = [face for face in self.faces if self.has(face, text)]
        if not faces:
            return None, None
        favoured = [face for face in faces if face["name"].lower().startswith(TIMES)]
        face = rng.choice(favoured if favoured and rng.random() < times else faces)
        font = ImageFont.truetype(face["path"], size)
        if face["axes"]:
            values = []
            for tag, (low, high) in face["axes"].items():
                if tag == "wght":
                    values.append(min(high, max(low, rng.choice([400, 400, 400, 500, 700, 700]))))
                elif tag == "opsz":
                    values.append(min(high, max(low, size * 0.75)))
                else:
                    values.append(min(high, max(low, 100)))
            try:
                font.set_variation_by_axes(values)
            except OSError:
                pass
        return font, face["name"]


def bilevel(image: Image.Image, size: int, rng: random.Random) -> Image.Image | None:
    """An office copier's bi-level scan of a line printed at `size` pixels (decision
    0177): toner spread or thinned, the page read at a lower resolution and cut at one
    grey into black and white, so that strokes join or break, a few specks, then drawn
    back at the line's size, sharp or smoothed as pdf.js draws a 1-bit picture. None
    when nothing legible is left (a blot, or no ink)."""
    if size >= 24 and rng.random() < 0.4:
        image = image.filter(ImageFilter.MinFilter(3))
    elif size >= 30 and rng.random() < 0.15:
        image = image.filter(ImageFilter.MaxFilter(3))
    factor = rng.uniform(0.5, 0.9)
    whole = image.size
    small = image.resize((max(1, int(whole[0] * factor)), max(1, int(whole[1] * factor))), Image.BILINEAR)
    if rng.random() < 0.6:
        small = small.filter(ImageFilter.GaussianBlur(rng.uniform(0.2, 0.7)))
    noise = np.random.default_rng(rng.randrange(1 << 30))
    array = np.asarray(small, dtype=np.float32)
    array = array + noise.normal(0, rng.uniform(0, 15), array.shape)
    array = np.where(array < rng.uniform(100, 200), 0, 255).astype(np.uint8)
    # Few specks: more taught the recogniser to drop a colon's two dots as dirt.
    if rng.random() < 0.2:
        array[noise.random(array.shape) < rng.uniform(0.0002, 0.001)] = 0
    if not 0.02 < (array == 0).mean() < 0.5:
        return None
    image = Image.fromarray(array).resize(whole, Image.NEAREST if rng.random() < 0.4 else Image.BILINEAR)
    # Black on white, as a dark or a pale copy prints it.
    ink, paper = rng.randint(0, 70), rng.randint(225, 255)
    array = np.asarray(image, dtype=np.float32) / 255.0
    return Image.fromarray((ink + array * (paper - ink)).astype(np.uint8))


def render(text: str, fonts: Fonts, rng: random.Random, copier: float = 0.0, lines: list[str] | None = None) -> Image.Image | None:
    """One line as a copier would leave it, greyscale, `HEIGHT` pixels high; a share
    `copier` of them as an office copier's bi-level scan, with neighbours from `lines`."""
    size = rng.randint(18, 44)
    copied = rng.random() < copier
    font, _ = fonts.pick(rng, text, size, TIMES_SHARE if copier else 0.0)
    if font is None:
        return None
    left, top, right, bottom = font.getbbox(text)
    ascent, descent = font.getmetrics()
    # The detector's box: the text's own extent (diacritics included) plus a margin.
    pad_x = int(size * rng.uniform(0.1, 0.7))
    pad_top = int(size * rng.uniform(0.05, 0.45))
    pad_bottom = int(size * rng.uniform(0.05, 0.45))
    text_top = min(top, 0)
    text_bottom = max(bottom, ascent + descent // 2)
    width = right - left + 2 * pad_x
    height = text_bottom - text_top + pad_top + pad_bottom
    # A copier's line starts black on white; its greys come from `bilevel`.
    paper = 255 if copied else rng.randint(205, 255)
    ink = 0 if copied else rng.randint(0, 80)
    # Values printed in italics, as a registration certificate's are: an upright face
    # slanted, its box widened for it.
    slant = rng.uniform(0.12, 0.25) if copier and rng.random() < 0.12 else 0.0
    width += int(slant * height)
    image = Image.new("L", (width, height), paper)
    draw = ImageDraw.Draw(image)
    draw.text((pad_x - left, pad_top - text_top), text, font=font, fill=ink)
    # Close-set lines: the detector's box takes in the foot of the line above and the
    # head of the line below.
    if lines and copied and rng.random() < 0.4:
        gap = size * rng.uniform(1.0, 1.3)
        for direction in (-1, 1):
            if rng.random() < 0.7:
                at = (pad_x - left + rng.randint(-size, size), pad_top - text_top + direction * gap)
                draw.text(at, rng.choice(lines), font=font, fill=ink)
    if slant:
        image = image.transform(image.size, Image.AFFINE, (1, slant, -slant * height * 0.5, 0, 1, 0), resample=Image.BILINEAR, fillcolor=paper)
    # Table rules the detector's box takes in beside or above the text.
    if rng.random() < 0.15:
        x = rng.choice([rng.randint(0, max(0, pad_x // 2)), width - 1 - rng.randint(0, max(0, pad_x // 2))])
        draw.line([(x, 0), (x, height)], fill=ink, width=rng.randint(1, 2))
    if rng.random() < 0.1:
        y = rng.choice([rng.randint(0, max(0, pad_top // 2)), height - 1 - rng.randint(0, max(0, pad_bottom // 2))])
        draw.line([(0, y), (width, y)], fill=ink, width=1)
    if rng.random() < 0.5:
        image = image.rotate(rng.uniform(-1.2, 1.2), resample=Image.BILINEAR, expand=True, fillcolor=paper)
    if copied and (image := bilevel(image, size, rng)) is None:
        return None
    # A lower scan resolution and back, then blur, noise and JPEG.
    if rng.random() < 0.6:
        factor = rng.uniform(0.5, 0.95)
        small = image.resize((max(1, int(image.width * factor)), max(1, int(image.height * factor))), Image.BILINEAR)
        image = small.resize(image.size, Image.BILINEAR)
    if rng.random() < 0.4:
        image = image.filter(ImageFilter.GaussianBlur(rng.uniform(0.2, 0.9)))
    if rng.random() < 0.4:
        array = np.asarray(image, dtype=np.float32)
        array += np.random.default_rng(rng.randrange(1 << 30)).normal(0, rng.uniform(2, 12), array.shape)
        image = Image.fromarray(np.clip(array, 0, 255).astype(np.uint8))
    if rng.random() < 0.8:
        buffer = io.BytesIO()
        image.save(buffer, "JPEG", quality=rng.randint(40, 95))
        image = Image.open(io.BytesIO(buffer.getvalue())).convert("L")
    new_width = max(HEIGHT, round(image.width * HEIGHT / image.height))
    if new_width > MAX_WIDTH:
        return None
    return image.resize((new_width, HEIGHT), Image.BILINEAR)


def variants(text: str, rng: random.Random) -> str:
    """What else the same documents print: the line in capitals, or with marks dropped as
    in a bank statement's transfer text."""
    roll = rng.random()
    if roll < 0.08:
        return text.upper()
    if roll < 0.12:
        stripped = unicodedata.normalize("NFD", text)
        stripped = "".join(char for char in stripped if unicodedata.category(char) != "Mn")
        return nfc(stripped.replace("đ", "d").replace("Đ", "D"))
    return text


class Lines(IterableDataset):
    def __init__(self, lines: list[str], fonts: Fonts, charset: dict[str, int], seed: int, batch: int, augment: bool = True, copier: float = 0.0):
        self.lines, self.fonts, self.charset, self.seed, self.batch, self.augment = lines, fonts, charset, seed, batch, augment
        self.copier = copier

    def __iter__(self):
        info = torch.utils.data.get_worker_info()
        rng = random.Random(self.seed + (info.id if info else 0) * 7919 + int(time.time()))
        while True:
            # A pool of samples sorted by width, cut into batches of similar widths.
            pool = []
            while len(pool) < self.batch * 16:
                text = rng.choice(self.lines)
                if self.augment:
                    text = variants(text, rng)
                if not all(char in self.charset for char in text):
                    continue
                image = render(text, self.fonts, rng, self.copier, self.lines)
                if image is not None and image.width // 4 >= 2 * len(text) + 2:
                    pool.append((image, text))
            pool.sort(key=lambda sample: sample[0].width)
            batches = [pool[index : index + self.batch] for index in range(0, len(pool), self.batch)]
            rng.shuffle(batches)
            for batch in batches:
                yield collate(batch, self.charset)


def collate(batch, charset):
    width = max(image.width for image, _ in batch)
    images = torch.ones(len(batch), 1, HEIGHT, width)
    for index, (image, _) in enumerate(batch):
        array = torch.from_numpy(np.asarray(image, dtype=np.float32) / 255.0)
        images[index, 0, :, : image.width] = array
        # Past the line, the paper's own shade.
        images[index, 0, :, image.width :] = array[:, -1:].mean()
    images = (images - 0.5) / 0.5
    targets = [torch.tensor([charset[char] for char in text]) for _, text in batch]
    return images, torch.cat(targets), torch.tensor([len(t) for t in targets]), [text for _, text in batch]


class Recogniser(nn.Module):
    """32 x W picture -> W/4 steps of character scores (index 0 is CTC's blank)."""

    def __init__(self, classes: int):
        super().__init__()

        def block(cin, cout, kernel=3, stride=1, padding=1):
            return [nn.Conv2d(cin, cout, kernel, stride, padding, bias=False), nn.BatchNorm2d(cout), nn.ReLU(inplace=True)]

        # Sized for a CPU: a strided first layer and slim channels train at about 75
        # lines a second on six cores (a VGG-like stack of twice the width, 30).
        self.cnn = nn.Sequential(
            *block(1, 24, stride=2),  # 16 x W/2
            *block(24, 48),
            nn.MaxPool2d(2),  # 8 x W/4
            *block(48, 96),
            *block(96, 96),
            nn.MaxPool2d((2, 1)),  # 4 x W/4
            *block(96, 160),
            *block(160, 160),
            nn.MaxPool2d((2, 1)),  # 2 x W/4
            *block(160, 256, kernel=(2, 1), padding=0),  # 1 x W/4
        )
        self.rnn = nn.LSTM(256, 160, num_layers=2, bidirectional=True, dropout=0.1)
        self.head = nn.Linear(320, classes)

    def forward(self, images):
        features = self.cnn(images)  # N, 256, 1, W/4
        features = features.squeeze(2).permute(2, 0, 1)  # T, N, 256
        output, _ = self.rnn(features)
        return self.head(output)  # T, N, classes


def decode(logits, alphabet):
    best = logits.argmax(-1).transpose(0, 1).tolist()
    texts = []
    for row in best:
        chars, previous = [], 0
        for index in row:
            if index != previous and index != 0:
                chars.append(alphabet[index])
            previous = index
        texts.append("".join(chars))
    return texts


def distance(a: str, b: str) -> int:
    row = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        previous, row[0] = row[0], i
        for j, cb in enumerate(b, 1):
            previous, row[j] = row[j], min(row[j] + 1, row[j - 1] + 1, previous + (ca != cb))
    return row[-1]


def evaluate(model, batches, alphabet):
    model.eval()
    errors = chars = exact = count = 0
    with torch.no_grad():
        for images, _, _, texts in batches:
            for read, truth in zip(decode(model(images), alphabet), texts):
                errors += distance(read, truth)
                chars += len(truth)
                exact += read == truth
                count += 1
    model.train()
    return {"cer": errors / max(1, chars), "line_accuracy": exact / max(1, count)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--lines", type=Path)
    parser.add_argument("--dev", type=Path)
    parser.add_argument("--fonts", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--hours", type=float, default=2.0)
    parser.add_argument("--batch", type=int, default=48)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--threads", type=int, default=6)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--export", action="store_true")
    parser.add_argument("--copier", type=float, default=0.0)
    parser.add_argument("--init", type=Path)
    parser.add_argument("--evaluate", action="store_true")
    args = parser.parse_args()
    torch.set_num_threads(args.threads)
    args.out.mkdir(parents=True, exist_ok=True)

    if args.export:
        export(args.out)
        return

    lines = [nfc(line.strip()) for line in args.lines.read_text("utf-8").splitlines() if line.strip()]
    dev_lines = [nfc(line.strip()) for line in args.dev.read_text("utf-8").splitlines() if line.strip()]
    charset_path = args.out / "charset.json"
    if args.init:
        # A fine-tune keeps the alphabet, so the app's reading definition keeps its classes.
        alphabet = json.loads((args.init / "charset.json").read_text("utf-8"))
        charset_path.write_text(json.dumps(alphabet, ensure_ascii=False), "utf-8")
    elif (args.resume or args.evaluate) and charset_path.exists():
        alphabet = json.loads(charset_path.read_text("utf-8"))
    else:
        # Every character of the texts, the Vietnamese alphabet in both cases and printable ASCII.
        vietnamese = "aàảãáạăằẳẵắặâầẩẫấậbcdđeèẻẽéẹêềểễếệghiìỉĩíịklmnoòỏõóọôồổỗốộơờởỡớợpqrstuùủũúụưừửữứựvxyỳỷỹýỵfjwz"
        chars = set("".join(lines)) | set(vietnamese) | set(vietnamese.upper()) | {chr(c) for c in range(33, 127)} | {" "}
        alphabet = ["<blank>"] + sorted(chars)
        charset_path.write_text(json.dumps(alphabet, ensure_ascii=False), "utf-8")
    charset = {char: index for index, char in enumerate(alphabet)}
    fonts = Fonts(args.fonts)
    print(f"{len(lines)} lines, {len(dev_lines)} dev lines, {len(fonts.faces)} fonts, {len(alphabet)} classes", flush=True)

    # Fixed dev sets of 2 000 lines drawn once: as before (the old augmentation) and, when
    # copier print is trained or evaluated, all as a copier's bi-level scan.
    def dev_set(copier: float):
        rng = random.Random(1)
        dev = []
        while len(dev) < 2000:
            text = variants(rng.choice(dev_lines), rng)
            if all(char in charset for char in text) and (image := render(text, fonts, rng, copier, dev_lines)) is not None:
                dev.append((image, text))
        dev.sort(key=lambda sample: sample[0].width)
        batches = [collate(dev[index : index + 64], charset) for index in range(0, len(dev), 64)]
        return [(images.to(memory_format=torch.channels_last), *rest) for images, *rest in batches]

    dev_sets = {"cer": dev_set(0.0)}
    if args.copier or args.evaluate:
        dev_sets["copier"] = dev_set(1.0)

    def measure(model):
        results = {name: evaluate(model, batches, alphabet) for name, batches in dev_sets.items()}
        metrics = results["cer"] | {f"{name}_{key}": value for name, result in results.items() if name != "cer" for key, value in result.items()}
        # The checkpoint kept is the best over both kinds of print, the old kind counted
        # twice: a fine-tune for copiers must not unlearn clean scans.
        metrics["score"] = (2 * results["cer"]["cer"] + sum(result["cer"] for name, result in results.items() if name != "cer")) / (len(results) + 1)
        return metrics

    model = Recogniser(len(alphabet))
    checkpoint_path = args.out / "checkpoint.pt"
    step, best, history = 0, math.inf, []
    if args.evaluate:
        model.load_state_dict(torch.load(checkpoint_path, weights_only=False)["model"])
        print(json.dumps(measure(model.to(memory_format=torch.channels_last))), flush=True)
        return
    if args.init:
        model.load_state_dict(torch.load(args.init / "checkpoint.pt", weights_only=False)["model"])
    elif args.resume and checkpoint_path.exists():
        state = torch.load(checkpoint_path, weights_only=False)
        model.load_state_dict(state["model"])
        step, best, history = state["step"], state["best"], state["history"]
    # Channels-last convolutions are a fifth faster on the CPU's oneDNN.
    model = model.to(memory_format=torch.channels_last)
    optimiser = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    ctc = nn.CTCLoss(blank=0, zero_infinity=True)
    loader = DataLoader(Lines(lines, fonts, charset, 1 + step, args.batch, copier=args.copier), batch_size=None, num_workers=args.workers, persistent_workers=True, prefetch_factor=4)
    deadline = time.time() + args.hours * 3600
    started = time.time()
    running = 0.0
    model.train()
    for images, targets, lengths, _ in loader:
        images = images.to(memory_format=torch.channels_last)
        # One-cycle-like schedule over the time budget: warm up, then cosine down.
        progress = min(1.0, (time.time() - started) / (args.hours * 3600))
        lr = args.lr * min(1.0, (step + 1) / 500) * (0.05 + 0.95 * 0.5 * (1 + math.cos(math.pi * progress)))
        for group in optimiser.param_groups:
            group["lr"] = lr
        logits = model(images)
        log_probs = logits.log_softmax(-1)
        input_lengths = torch.full((images.shape[0],), log_probs.shape[0], dtype=torch.long)
        loss = ctc(log_probs, targets, input_lengths, lengths)
        optimiser.zero_grad()
        loss.backward()
        nn.utils.clip_grad_norm_(model.parameters(), 5.0)
        optimiser.step()
        step += 1
        running = 0.98 * running + 0.02 * loss.item() if step > 1 else loss.item()
        if step % 100 == 0:
            print(f"step {step} loss {running:.3f} lr {lr:.2e} {(time.time() - started) / 60:.0f} min", flush=True)
        if step % 1000 == 0 or time.time() > deadline:
            metrics = measure(model) | {"step": step, "minutes": (time.time() - started) / 60, "loss": running}
            history.append(metrics)
            print(f"dev {metrics}", flush=True)
            if metrics["score"] < best:
                best = metrics["score"]
                torch.save({"model": model.state_dict(), "step": step, "best": best, "history": history, "classes": len(alphabet)}, checkpoint_path)
            (args.out / "metrics.json").write_text(json.dumps({"best_cer": best, "history": history}, indent=2), "utf-8")
            if time.time() > deadline:
                break


def export(out: Path):
    alphabet = json.loads((out / "charset.json").read_text("utf-8"))
    state = torch.load(out / "checkpoint.pt", weights_only=False)
    model = Recogniser(len(alphabet))
    model.load_state_dict(state["model"])
    model.eval()

    class Exported(nn.Module):
        def __init__(self, inner):
            super().__init__()
            self.inner = inner

        def forward(self, images):
            return self.inner(images).softmax(-1)

    wrapped = Exported(model).eval()
    example = torch.zeros(1, 1, HEIGHT, 320)
    torch.onnx.export(
        wrapped,
        (example,),
        str(out / "recogniser.onnx"),
        input_names=["image"],
        output_names=["probabilities"],
        dynamic_axes={"image": {0: "batch", 3: "width"}, "probabilities": {0: "steps", 1: "batch"}},
        opset_version=18,
        dynamo=False,
    )
    import onnxruntime

    session = onnxruntime.InferenceSession(str(out / "recogniser.onnx"))
    for width in (64, 320, 900):
        sample = torch.randn(2, 1, HEIGHT, width)
        with torch.no_grad():
            expected = wrapped(sample).numpy()
        got = session.run(None, {"image": sample.numpy()})[0]
        assert np.abs(expected - got).max() < 1e-4, width
    print(f"exported {out / 'recogniser.onnx'} at step {state['step']}, dev CER {state['best']:.4f}")


if __name__ == "__main__":
    main()
