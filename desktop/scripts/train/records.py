"""The training records of scripts/export-training-set.mjs, as token labels (decision 0163).

A record is one paragraph the app's reader produced: its text, the spans the models must
find (PERSON, LOCATION, ORGANIZATION), the kept texts as negatives and the ignored spans
whose tokens the loss skips. Consecutive paragraphs of a document are packed with the
scanner's separator ("\\n\\n", src/core/sheet/mask.ts) into windows of at most 384
tokens, the window the app gives a model, so training sees paragraphs in the company
the app shows them in.

The label set is the model's own (config.json id2label): B/I for LOC, MISC, ORG, PER and
O. The synthetic set never labels MISC; the general slice (prepare_general.py) keeps the
teacher's MISC so the head does not forget it. Every piece of a span is labelled, the
first B- and the rest I-, because the app reads the argmax of every piece
(src/core/detection/token-predictions.ts).
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, Iterator

SEPARATOR = "\n\n"
MAX_TOKENS = 384
IGNORE_INDEX = -100

# Canonical label (the pack maps the model's short names to these) ↔ the model's names.
CANONICAL = {"PER": "PERSON", "LOC": "LOCATION", "ORG": "ORGANIZATION", "MISC": "MISC"}
SHORT = {canonical: short for short, canonical in CANONICAL.items()}


@dataclass
class Span:
    start: int
    end: int
    label: str  # canonical


@dataclass
class Record:
    id: str
    document: str
    text: str
    spans: list[Span]
    negatives: list[tuple[int, int]] = field(default_factory=list)
    ignore: list[tuple[int, int]] = field(default_factory=list)


def read_records(path: Path) -> list[Record]:
    records = []
    with path.open(encoding="utf-8") as stream:
        for line in stream:
            if not line.strip():
                continue
            raw = json.loads(line)
            records.append(
                Record(
                    id=raw["id"],
                    document=raw.get("document", raw["id"]),
                    text=raw["text"],
                    spans=[Span(s["start"], s["end"], s["label"]) for s in raw.get("spans", [])],
                    negatives=[(s["start"], s["end"]) for s in raw.get("negatives", [])],
                    ignore=[(s["start"], s["end"]) for s in raw.get("ignore", [])],
                )
            )
    return records


def write_records(path: Path, records: Iterable[Record]) -> None:
    with path.open("w", encoding="utf-8") as stream:
        for record in records:
            stream.write(
                json.dumps(
                    {
                        "id": record.id,
                        "document": record.document,
                        "text": record.text,
                        "spans": [{"start": s.start, "end": s.end, "label": s.label} for s in record.spans],
                        "negatives": [{"start": a, "end": b} for a, b in record.negatives],
                        "ignore": [{"start": a, "end": b} for a, b in record.ignore],
                    },
                    ensure_ascii=False,
                )
                + "\n"
            )


def pack_documents(records: list[Record], tokenizer, max_tokens: int = MAX_TOKENS) -> list[Record]:
    """Joins consecutive paragraphs of each document with the scanner's separator while
    they fit one model window (special tokens included); a paragraph that does not fit
    on its own is kept whole and truncated by the tokenizer later."""
    budget = max_tokens - 2
    packed: list[Record] = []
    by_document: dict[str, list[Record]] = {}
    for record in records:
        by_document.setdefault(record.document, []).append(record)
    for document, paragraphs in by_document.items():
        counts = [len(ids) for ids in tokenizer([p.text for p in paragraphs], add_special_tokens=False)["input_ids"]]
        separator_count = len(tokenizer(SEPARATOR, add_special_tokens=False)["input_ids"])
        current: list[Record] = []
        current_tokens = 0

        def flush() -> None:
            if not current:
                return
            text = ""
            spans: list[Span] = []
            negatives: list[tuple[int, int]] = []
            ignore: list[tuple[int, int]] = []
            for index, part in enumerate(current):
                if index:
                    text += SEPARATOR
                offset = len(text)
                text += part.text
                spans.extend(Span(s.start + offset, s.end + offset, s.label) for s in part.spans)
                negatives.extend((a + offset, b + offset) for a, b in part.negatives)
                ignore.extend((a + offset, b + offset) for a, b in part.ignore)
            packed.append(Record(f"{document}#{len(packed)}", document, text, spans, negatives, ignore))

        for paragraph, count in zip(paragraphs, counts):
            extra = count + (separator_count if current else 0)
            if current and current_tokens + extra > budget:
                flush()
                current, current_tokens = [], 0
                extra = count
            current.append(paragraph)
            current_tokens += extra
        flush()
    return packed


def encode(record: Record, tokenizer, label2id: dict[str, int], max_tokens: int = MAX_TOKENS) -> dict:
    """Token ids with one label per piece: B-/I- of the span the piece starts in, O
    elsewhere, IGNORE_INDEX on special tokens and on pieces inside an ignored span."""
    encoded = tokenizer(
        record.text,
        add_special_tokens=True,
        truncation=True,
        max_length=max_tokens,
        return_offsets_mapping=True,
    )
    offsets = encoded["offset_mapping"]
    labels = []
    started: set[int] = set()
    for index, (start, end) in enumerate(offsets):
        if end <= start:  # special token or an empty piece
            labels.append(IGNORE_INDEX)
            continue
        if any(start < b and end > a for a, b in record.ignore):
            labels.append(IGNORE_INDEX)
            continue
        label = "O"
        for span_index, span in enumerate(record.spans):
            if span.start <= start < span.end:
                prefix = "I-" if span_index in started else "B-"
                started.add(span_index)
                label = prefix + SHORT[span.label]
                break
        labels.append(label2id[label])
    return {
        "input_ids": encoded["input_ids"],
        "attention_mask": encoded["attention_mask"],
        "token_type_ids": encoded.get("token_type_ids", [0] * len(encoded["input_ids"])),
        "labels": labels,
        "offsets": offsets,
    }


def decode(offsets: list[tuple[int, int]], label_names: list[str]) -> list[Span]:
    """Character spans from one label per piece: a B- starts a span, an I- of the same
    type continues it, anything else ends it. The app decodes more leniently; this is a
    dev measurement, not the product."""
    spans: list[Span] = []
    current: Span | None = None
    for (start, end), name in zip(offsets, label_names):
        if end <= start:
            continue
        prefix, _, short = name.partition("-")
        kind = CANONICAL.get(short) if prefix in ("B", "I") else None
        if kind and current and prefix == "I" and current.label == kind:
            current.end = end
            continue
        if current:
            spans.append(current)
            current = None
        if kind:
            current = Span(start, end, kind)
    if current:
        spans.append(current)
    return spans


def chunks(items: list, size: int) -> Iterator[list]:
    for index in range(0, len(items), size):
        yield items[index : index + size]


def pick_device(name: str = "auto") -> "torch.device":
    """The device a run uses: "auto" takes a CUDA GPU, then Apple's MPS, then the CPU, so the
    same command runs on a cloud GPU, on a Mac and in CI without edits (decision 0163)."""
    import torch

    if name != "auto":
        return torch.device(name)
    if torch.cuda.is_available():
        return torch.device("cuda")
    if torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def checkpoint_dirs(out: Path, epoch: int, f1: float, best_f1: float, keep_epochs: bool) -> list[Path]:
    """Where an epoch's model is saved. `<out>/checkpoint` holds the best epoch by overall dev
    F1, as every run has saved it; with --keep-epochs each epoch is also saved as
    `<out>/checkpoint-<epoch>`, so the export and comparison steps can try another epoch
    than the best one: run 1 kept an epoch whose organization precision decided the overall
    F1 and discarded the epoch with the best location recall (decision 0166)."""
    targets = []
    if keep_epochs:
        targets.append(out / f"checkpoint-{epoch}")
    if f1 > best_f1:
        targets.append(out / "checkpoint")
    return targets
