"""Fetches the base checkpoint the pack's Underthesea model was exported from, pinned to
the revision recorded in scripts/build-r2-pack.mjs, into artifacts/train/base/underthesea.
Developer-only; the app never downloads model weights from Hugging Face.

    uv run --project desktop/scripts/train download_base.py

The repository's metadata must declare Apache-2.0, as it did when the pack was built;
provenance.json records what was fetched. Weights are never committed (artifacts/ is ignored).
"""

import json
import os
import sys
from pathlib import Path

os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")

from huggingface_hub import HfApi, snapshot_download  # noqa: E402

REPOSITORY = "undertheseanlp/vietnamese-ner-v1.4.0a2"
REVISION = "a51e05fc09e1b1f0800dbad8ae84e86ad311debd"
FILES = [
    "config.json",
    "pytorch_model.bin",
    "model.safetensors",
    "tokenizer.json",
    "tokenizer_config.json",
    "special_tokens_map.json",
    "vocab.txt",
]
ARTIFACTS = Path(__file__).resolve().parents[2] / "artifacts" / "train"
BASE = ARTIFACTS / "base" / "underthesea"


def main() -> int:
    info = HfApi().model_info(REPOSITORY, revision=REVISION)
    license_tag = (info.card_data or {}).get("license") if info.card_data else None
    if license_tag != "apache-2.0":
        print(f"{REPOSITORY} no longer declares apache-2.0 (got {license_tag!r}); stopping.", file=sys.stderr)
        return 1
    if info.sha != REVISION:
        print(f"Revision mismatch: {info.sha} != {REVISION}", file=sys.stderr)
        return 1
    BASE.mkdir(parents=True, exist_ok=True)
    snapshot_download(
        REPOSITORY,
        revision=REVISION,
        allow_patterns=FILES,
        local_dir=BASE,
    )
    present = sorted(name for name in FILES if (BASE / name).exists())
    (BASE / "provenance.json").write_text(
        json.dumps(
            {
                "repository": REPOSITORY,
                "revision": REVISION,
                "license": "Apache-2.0",
                "files": {name: (BASE / name).stat().st_size for name in present},
            },
            indent=2,
        )
        + "\n"
    )
    print(f"Base checkpoint at {BASE}: {', '.join(present)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
