"""Manual developer download of the one admitted checkpoint; never used by app/build."""
import importlib.util
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('downloader', root / 'scripts/download-alternative-models.py')
downloader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(downloader)
downloader.ROOT = root / 'artifacts/pretrained-search-v1'
record = downloader.download((
    'greennode', 'GreenNode/gliner-pii-base-v1.0-tuned',
    '85cf26b39f2a02d9af9af483ac66b2194bf14c9f',
    ['pytorch_model.bin', 'gliner_config.json', 'tokenizer.json', 'tokenizer_config.json',
     'added_tokens.json', 'special_tokens_map.json', 'spm.model', 'README.md'],
))
(downloader.ROOT / 'manifest.json').write_text(json.dumps(record, indent=2) + '\n')
