"""Fine-tunes the pack's Underthesea model on the exported synthetic set (decision 0163).

    uv run --project desktop/scripts/train train.py --train <dir>/train.jsonl --dev <dir>/dev.jsonl \\
        --general <general.jsonl> --out desktop/artifacts/train/run-1 [--epochs 3] [--lr 3e-5]

The base checkpoint (download_base.py) keeps its label head: nine BIO labels over LOC,
MISC, ORG and PER. Each epoch sees every packed window of the synthetic training set and
a sample of the general slice (--general-ratio of the synthetic count), labelled by the
base model so what it knew about news text is replayed. The dev split is measured after
every epoch as exact spans per label, plus the share of kept texts a predicted span
touches (the over-masking the vetoes exist for); the best epoch by dev F1 is saved to
<out>/checkpoint with metrics.json beside it. --limit-documents keeps a smoke test short.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import sys
import time
from collections import Counter
from pathlib import Path

os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

import torch  # noqa: E402
from torch.utils.data import DataLoader  # noqa: E402
from transformers import AutoModelForTokenClassification, AutoTokenizer, get_linear_schedule_with_warmup  # noqa: E402

from records import (  # noqa: E402
    IGNORE_INDEX,
    MAX_TOKENS,
    Record,
    Span,
    decode,
    encode,
    pack_documents,
    pick_device,
    read_records,
)

ARTIFACTS = Path(__file__).resolve().parents[2] / "artifacts" / "train"
LABELS = ["PERSON", "LOCATION", "ORGANIZATION"]


def limit_documents(records: list[Record], count: int | None) -> list[Record]:
    if not count:
        return records
    kept: list[str] = []
    for record in records:
        if record.document not in kept:
            if len(kept) >= count:
                break
            kept.append(record.document)
    return [r for r in records if r.document in set(kept)]


def collate(pad_id: int):
    def batch(items: list[dict]) -> dict[str, torch.Tensor]:
        width = max(len(item["input_ids"]) for item in items)

        def column(key: str, fill: int) -> torch.Tensor:
            return torch.tensor([item[key] + [fill] * (width - len(item[key])) for item in items])

        return {
            "input_ids": column("input_ids", pad_id),
            "attention_mask": column("attention_mask", 0),
            "token_type_ids": column("token_type_ids", 0),
            "labels": column("labels", IGNORE_INDEX),
        }

    return batch


def measure(model, examples: list[dict], names: list[str], batch_size: int, pad_id: int, device) -> dict:
    """Exact-span precision, recall and F1 per label on the dev windows, and the share of
    negatives (kept texts) that a predicted span of any label touches."""
    model.eval()
    counts = {label: Counter() for label in LABELS}
    negatives_total = negatives_touched = 0
    loader = DataLoader(examples, batch_size=batch_size, collate_fn=collate(pad_id))
    with torch.inference_mode():
        cursor = 0
        for batch in loader:
            logits = model(**{k: v.to(device) for k, v in batch.items() if k != "labels"}).logits
            predicted = logits.argmax(-1).cpu().tolist()
            for row in predicted:
                example = examples[cursor]
                cursor += 1
                width = len(example["offsets"])
                found = decode(example["offsets"], [names[i] for i in row[:width]])
                gold = example["record"].spans
                for label in LABELS:
                    got = {(s.start, s.end) for s in found if s.label == label}
                    want = {(s.start, s.end) for s in gold if s.label == label}
                    counts[label]["tp"] += len(got & want)
                    counts[label]["fp"] += len(got - want)
                    counts[label]["fn"] += len(want - got)
                for a, b in example["record"].negatives:
                    negatives_total += 1
                    if any(s.start < b and s.end > a for s in found):
                        negatives_touched += 1
    result = {}
    tp = fp = fn = 0
    for label in LABELS:
        c = counts[label]
        tp, fp, fn = tp + c["tp"], fp + c["fp"], fn + c["fn"]
        precision = c["tp"] / (c["tp"] + c["fp"]) if c["tp"] + c["fp"] else 0.0
        recall = c["tp"] / (c["tp"] + c["fn"]) if c["tp"] + c["fn"] else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        result[label] = {"precision": precision, "recall": recall, "f1": f1, "gold": c["tp"] + c["fn"]}
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    result["all"] = {
        "precision": precision,
        "recall": recall,
        "f1": 2 * precision * recall / (precision + recall) if precision + recall else 0.0,
        "gold": tp + fn,
    }
    result["negatives_touched"] = negatives_touched / negatives_total if negatives_total else 0.0
    result["negatives"] = negatives_total
    model.train()
    return result


def report(metrics: dict) -> str:
    rows = [f"{'label':14}{'P':>8}{'R':>8}{'F1':>8}{'gold':>7}"]
    for label in [*LABELS, "all"]:
        m = metrics[label]
        rows.append(f"{label:14}{m['precision']:8.3f}{m['recall']:8.3f}{m['f1']:8.3f}{m['gold']:7d}")
    rows.append(f"kept texts touched by a span: {metrics['negatives_touched']:.3%} of {metrics['negatives']}")
    return "\n".join(rows)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--train", type=Path, required=True)
    parser.add_argument("--dev", type=Path, required=True)
    parser.add_argument("--general", type=Path, help="prepare_general.py output")
    parser.add_argument("--general-ratio", type=float, default=0.5, help="general windows per synthetic window, per epoch")
    parser.add_argument("--base", type=Path, default=ARTIFACTS / "base" / "underthesea")
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--lr", type=float, default=3e-5)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--max-tokens", type=int, default=MAX_TOKENS)
    parser.add_argument("--limit-documents", type=int, help="train on the first N documents only (smoke test)")
    parser.add_argument("--limit-dev", type=int, help="measure the first N dev documents only")
    parser.add_argument("--seed", type=int, default=20261027)
    parser.add_argument("--threads", type=int, default=os.cpu_count() or 4)
    parser.add_argument("--device", default="auto", help="auto (CUDA, then MPS, then CPU), cuda, mps or cpu")
    args = parser.parse_args()

    random.seed(args.seed)
    torch.manual_seed(args.seed)
    torch.set_num_threads(args.threads)
    args.out.mkdir(parents=True, exist_ok=True)

    tokenizer = AutoTokenizer.from_pretrained(args.base)
    device = pick_device(args.device)
    model = AutoModelForTokenClassification.from_pretrained(args.base).to(device)
    print(f"device: {device}", flush=True)
    label2id = {name: int(i) for i, name in model.config.id2label.items()}
    names = [model.config.id2label[i] for i in range(model.config.num_labels)]
    for short in ("PER", "LOC", "ORG"):
        assert f"B-{short}" in label2id, f"base model lacks B-{short}"

    def prepare(records: list[Record], packed: bool) -> list[dict]:
        windows = pack_documents(records, tokenizer, args.max_tokens) if packed else records
        examples = []
        for record in windows:
            example = encode(record, tokenizer, label2id, args.max_tokens)
            example["record"] = record
            examples.append(example)
        return examples

    train_records = limit_documents(read_records(args.train), args.limit_documents)
    dev_records = limit_documents(read_records(args.dev), args.limit_dev)
    train_examples = prepare(train_records, packed=True)
    dev_examples = prepare(dev_records, packed=True)
    general_examples = prepare(read_records(args.general), packed=False) if args.general else []
    print(
        f"train: {len(train_records)} paragraphs in {len(train_examples)} windows; "
        f"dev: {len(dev_records)} paragraphs in {len(dev_examples)} windows; "
        f"general: {len(general_examples)} paragraphs",
        flush=True,
    )
    span_count = Counter(s.label for e in train_examples for s in e["record"].spans)
    print("train spans: " + ", ".join(f"{k} {v}" for k, v in sorted(span_count.items())), flush=True)

    general_per_epoch = min(len(general_examples), math.ceil(len(train_examples) * args.general_ratio))
    steps_per_epoch = math.ceil((len(train_examples) + general_per_epoch) / args.batch)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.01)
    schedule = get_linear_schedule_with_warmup(
        optimizer, int(0.1 * steps_per_epoch * args.epochs), steps_per_epoch * args.epochs
    )
    pad_id = tokenizer.pad_token_id or 0
    history = []
    best_f1 = -1.0
    started = time.time()
    # The base model on the same dev windows, so a run shows what it changed.
    baseline = measure(model, dev_examples, names, args.batch, pad_id, device)
    baseline["epoch"] = 0
    history.append(baseline)
    print(f"\nbase model on dev:\n{report(baseline)}\n", flush=True)
    model.train()
    for epoch in range(1, args.epochs + 1):
        epoch_examples = train_examples + random.sample(general_examples, general_per_epoch)
        random.shuffle(epoch_examples)
        loader = DataLoader(epoch_examples, batch_size=args.batch, collate_fn=collate(pad_id))
        total_loss = 0.0
        for step, batch in enumerate(loader, 1):
            loss = model(**{k: v.to(device) for k, v in batch.items()}).loss
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            schedule.step()
            optimizer.zero_grad()
            total_loss += loss.item()
            if step % 10 == 0 or step == steps_per_epoch:
                elapsed = time.time() - started
                print(
                    f"epoch {epoch} step {step}/{steps_per_epoch} loss {total_loss / step:.4f} ({elapsed:.0f} s)",
                    flush=True,
                )
        metrics = measure(model, dev_examples, names, args.batch, pad_id, device)
        metrics["epoch"] = epoch
        metrics["train_loss"] = total_loss / max(1, steps_per_epoch)
        metrics["seconds"] = time.time() - started
        history.append(metrics)
        print(f"\nepoch {epoch} dev:\n{report(metrics)}\n", flush=True)
        if metrics["all"]["f1"] > best_f1:
            best_f1 = metrics["all"]["f1"]
            checkpoint = args.out / "checkpoint"
            model.save_pretrained(checkpoint, safe_serialization=True)
            tokenizer.save_pretrained(checkpoint)
            print(f"saved {checkpoint} (dev F1 {best_f1:.3f})", flush=True)
    (args.out / "metrics.json").write_text(
        json.dumps(
            {
                "args": {k: str(v) if isinstance(v, Path) else v for k, v in vars(args).items()},
                "base": str(args.base),
                "device": str(device),
                "train_windows": len(train_examples),
                "dev_windows": len(dev_examples),
                "general_paragraphs": len(general_examples),
                "general_per_epoch": general_per_epoch,
                "history": history,
                "best_dev_f1": best_f1,
            },
            indent=2,
        )
        + "\n"
    )
    print(f"Done in {time.time() - started:.0f} s; metrics in {args.out / 'metrics.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
