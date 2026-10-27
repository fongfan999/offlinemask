"""Writes the general Vietnamese slice the trainer mixes in so news-style names are not
forgotten (decision 0163): paragraphs of ordinary text labelled by the base checkpoint
itself (its own PER, LOC, ORG and MISC spans), so the fine-tuned model is pulled towards
the synthetic documents without drifting from what the base model already knew.

    uv run --project desktop/scripts/train prepare_general.py <out.jsonl> --text <file>
    uv run --project desktop/scripts/train prepare_general.py <out.jsonl> --wikipedia 20000

--text reads one paragraph per line from a local file. --wikipedia streams the Vietnamese
Wikipedia dump (wikimedia/wikipedia, 20231101.vi; CC BY-SA 4.0: used as training text
only, never redistributed) and keeps every 7th article's paragraphs of 60–1500 characters
until the count is reached; it needs the `general` extra (`uv sync --extra general`).
Nothing here is private data; the output is a derived artifact under artifacts/.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")

import torch  # noqa: E402
from transformers import AutoModelForTokenClassification, AutoTokenizer  # noqa: E402

from records import MAX_TOKENS, Record, chunks, decode, write_records  # noqa: E402

ARTIFACTS = Path(__file__).resolve().parents[2] / "artifacts" / "train"


def paragraphs_from_text(path: Path):
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            yield "text", line


def paragraphs_from_wikipedia(count: int):
    from datasets import load_dataset

    stream = load_dataset("wikimedia/wikipedia", "20231101.vi", split="train", streaming=True)
    produced = 0
    for index, article in enumerate(stream):
        if index % 7:
            continue
        for paragraph in article["text"].split("\n\n"):
            paragraph = " ".join(paragraph.split())
            if 60 <= len(paragraph) <= 1500 and not paragraph.startswith(("=", "|", "{")):
                yield f"wikipedia/{article['id']}", paragraph
                produced += 1
                if produced >= count:
                    return


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("out", type=Path)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--text", type=Path, help="one paragraph per line")
    source.add_argument("--wikipedia", type=int, metavar="N", help="N paragraphs of the Vietnamese Wikipedia")
    parser.add_argument("--base", type=Path, default=ARTIFACTS / "base" / "underthesea")
    parser.add_argument("--batch", type=int, default=8)
    parser.add_argument("--threads", type=int, default=os.cpu_count() or 4)
    args = parser.parse_args()

    torch.set_num_threads(args.threads)
    tokenizer = AutoTokenizer.from_pretrained(args.base)
    model = AutoModelForTokenClassification.from_pretrained(args.base).eval()
    names = [model.config.id2label[i] for i in range(model.config.num_labels)]
    source_paragraphs = (
        list(paragraphs_from_text(args.text)) if args.text else list(paragraphs_from_wikipedia(args.wikipedia))
    )
    records: list[Record] = []
    with torch.inference_mode():
        for batch in chunks(source_paragraphs, args.batch):
            encoded = tokenizer(
                [text for _, text in batch],
                padding=True,
                truncation=True,
                max_length=MAX_TOKENS,
                return_offsets_mapping=True,
                return_tensors="pt",
            )
            offsets = encoded.pop("offset_mapping").tolist()
            predicted = model(**encoded).logits.argmax(-1).tolist()
            for (origin, text), row_offsets, row_labels, mask in zip(
                batch, offsets, predicted, encoded["attention_mask"].tolist()
            ):
                kept = [(tuple(o), names[l]) for o, l, m in zip(row_offsets, row_labels, mask) if m]
                spans = decode([o for o, _ in kept], [n for _, n in kept])
                index = len(records)
                records.append(Record(f"general/{index}", f"general/{origin}", text, spans))
            if len(records) % (args.batch * 50) == 0:
                print(f"{len(records)} paragraphs labelled", flush=True)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    write_records(args.out, records)
    labelled = sum(1 for r in records if r.spans)
    print(f"Wrote {len(records)} general paragraphs to {args.out}; {labelled} carry a teacher span.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
