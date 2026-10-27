"""Turns a fine-tuned checkpoint into a pack model directory (decision 0163): the ONNX
graph the app loads, quantized to INT8 the way the shipping pack was, with config.json,
tokenizer.json and tokenizer_config.json in the layout packs/README.md requires.

    uv run --project desktop/scripts/train export_pack.py <run>/checkpoint <pack root>/underthesea \\
        [--tokenizer-from <installed pack>/underthesea] [--keep-fp32]

The tokenizer files are copied unchanged from the directory named (by default the base
checkpoint); the fine-tuning never touches the vocabulary, and the Rust and JavaScript
tokenizers must keep producing the same ids (native offsets). The graph takes input_ids,
attention_mask and token_type_ids and returns logits, like the shipping graph; it is
exported with the TorchScript exporter at opset 18 and checked against PyTorch on random
inputs before the dynamic INT8 quantization of its MatMul weights
(scripts/export-underthesea.py did the same for the base model). Pin and check the
result with the node scripts the output names.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import warnings
from pathlib import Path

os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")

import numpy as np  # noqa: E402
import onnx  # noqa: E402
import onnxruntime  # noqa: E402
import torch  # noqa: E402
from onnxruntime.quantization import QuantType, quantize_dynamic  # noqa: E402
from transformers import AutoModelForTokenClassification  # noqa: E402

ARTIFACTS = Path(__file__).resolve().parents[2] / "artifacts" / "train"
INPUTS = ["input_ids", "attention_mask", "token_type_ids"]


def export_graph(model, path: Path) -> None:
    ids = torch.randint(5, model.config.vocab_size, (1, 12))
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        torch.onnx.export(
            model,
            (ids, torch.ones_like(ids), torch.zeros_like(ids)),
            str(path),
            input_names=INPUTS,
            output_names=["logits"],
            dynamic_axes={name: {0: "batch", 1: "sequence"} for name in [*INPUTS, "logits"]},
            opset_version=18,
            dynamo=False,
        )
    onnx.checker.check_model(str(path))


def check_graph(model, path: Path, lengths=(4, 37, 384)) -> float:
    session = onnxruntime.InferenceSession(str(path), providers=["CPUExecutionProvider"])
    names = [i.name for i in session.get_inputs()]
    assert names == INPUTS, f"unexpected inputs {names}"
    assert [o.name for o in session.get_outputs()] == ["logits"]
    worst = 0.0
    for length in lengths:
        ids = torch.randint(5, model.config.vocab_size, (1, length))
        feeds = {
            "input_ids": ids.numpy(),
            "attention_mask": np.ones_like(ids.numpy()),
            "token_type_ids": np.zeros_like(ids.numpy()),
        }
        with torch.inference_mode():
            expected = model(input_ids=ids, attention_mask=torch.ones_like(ids), token_type_ids=torch.zeros_like(ids)).logits.numpy()
        got = session.run(None, feeds)[0]
        assert got.shape == expected.shape == (1, length, model.config.num_labels)
        worst = max(worst, float(np.abs(got - expected).max()))
    return worst


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("checkpoint", type=Path)
    parser.add_argument("out", type=Path, help="the model directory inside a pack root, e.g. <root>/underthesea")
    parser.add_argument("--tokenizer-from", type=Path, default=ARTIFACTS / "base" / "underthesea")
    parser.add_argument("--graph", default="model_int8", help="graph name the pack definition lists")
    parser.add_argument("--keep-fp32", action="store_true", help="leave model.onnx beside the INT8 graph")
    args = parser.parse_args()

    torch.set_num_threads(1)
    model = AutoModelForTokenClassification.from_pretrained(args.checkpoint).eval()
    assert "id2label" in model.config.to_dict() and model.config.num_labels == len(model.config.id2label)
    if args.out.exists():
        shutil.rmtree(args.out)
    args.out.mkdir(parents=True)

    fp32 = args.out / "model.onnx"
    export_graph(model, fp32)
    difference = check_graph(model, fp32)
    print(f"FP32 graph matches PyTorch within {difference:.2e}", flush=True)
    quantize_dynamic(
        str(fp32),
        str(args.out / f"{args.graph}.onnx"),
        weight_type=QuantType.QInt8,
        per_channel=False,
        op_types_to_quantize=["MatMul"],
    )
    int8_difference = check_graph(model, args.out / f"{args.graph}.onnx", lengths=(37,))
    print(f"INT8 graph differs from PyTorch by at most {int8_difference:.2e} on one random window", flush=True)
    if not args.keep_fp32:
        fp32.unlink()

    # config.json with id2label, as the base checkpoint carries it; no training arguments.
    model.config.save_pretrained(args.out)
    for name in ("tokenizer.json", "tokenizer_config.json"):
        source = args.tokenizer_from / name
        if not source.exists():
            print(f"Missing {source}", file=sys.stderr)
            return 1
        shutil.copyfile(source, args.out / name)
    config = json.loads((args.out / "config.json").read_text())
    print(f"Pack model at {args.out}: {sorted(p.name for p in args.out.iterdir())}")
    print(f"labels: {config['id2label']}")
    root = args.out.parent
    print(
        "\nNext, from desktop/:\n"
        f"  cp packs/vietnamese-pii-v1.json {root / 'candidate.json'}\n"
        f"  mise exec -- pnpm pack:prepare {root / 'candidate.json'} {root} {args.out.name}\n"
        f"  mise exec -- node scripts/check-pack.mjs {root} --definition {root / 'candidate.json'}\n"
        f"  mise exec -- pnpm eval:documents <documents> --pack {root}    # with the same candidate.json? see README"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
