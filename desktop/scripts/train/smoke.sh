#!/usr/bin/env bash
# End-to-end smoke test of the fine-tuning pipeline (decision 0163) on a tiny subset:
# export two seeds, train one epoch on 50 documents, export ONNX + INT8, pin a candidate
# pack and load it through the pack contract. Minutes on a laptop CPU; it proves the
# pipeline, not the model. Run from anywhere:
#
#   desktop/scripts/train/smoke.sh [work dir]
#
# Needs the base checkpoint (download_base.py), the installed shipping pack (for the
# OpenMed model the candidate keeps, and its tokenizer files) and the Rust tokenizer
# harness (scripts/pack-runtime.mjs header).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
desktop="$(cd "$here/../.." && pwd)"
work="${1:-$desktop/artifacts/train/smoke}"
installed="${INSTALLED_PACK:-$(ls -d "$HOME/Library/Application Support/dev.offlinemask.desktop/models/vietnamese-pii-v1/packs"/*/ | head -1)}"
run() { echo; echo "+ $*"; "$@"; }

cd "$desktop"
rm -rf "$work"
mkdir -p "$work"
run mise exec -- node scripts/export-training-set.mjs "$work/set" --train 100 --dev 101 --variants 1
run uv run --project "$here" "$here/prepare_general.py" "$work/general.jsonl" --text "$here/smoke-general.txt"
run uv run --project "$here" "$here/train.py" --train "$work/set/train.jsonl" --dev "$work/set/dev.jsonl" \
  --general "$work/general.jsonl" --out "$work/run" --epochs 1 --limit-documents 50 --limit-dev 10 --batch 8
run uv run --project "$here" "$here/export_pack.py" "$work/run/checkpoint" "$work/pack/underthesea" \
  --tokenizer-from "$installed/underthesea"
ln -s "$installed/vietnamese-pii-multilingual" "$work/pack/vietnamese-pii-multilingual"
cp packs/vietnamese-pii-v1.json "$work/pack/candidate.json"
run mise exec -- pnpm pack:prepare "$work/pack/candidate.json" "$work/pack" underthesea
echo "[]" > "$work/no-fixtures.json"
# The contract: pinned files verified, both models loaded offline, nothing fetched.
run mise exec -- node scripts/check-pack.mjs "$work/pack" --definition "$work/pack/candidate.json" --fixtures "$work/no-fixtures.json"
# The shipping fixtures, reported for information: a one-epoch model on 50 documents is not expected to pass them.
mise exec -- node scripts/check-pack.mjs "$work/pack" --definition "$work/pack/candidate.json" || echo "(fixtures fail, as expected for a smoke model)"
echo; echo "Smoke test complete: $work"
