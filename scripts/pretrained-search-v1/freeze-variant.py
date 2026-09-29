"""Reproduce either documented integration correction without overwriting prior evidence."""
import sys, json, hashlib, datetime
from pathlib import Path

root = Path(__file__).resolve().parents[2]
variant = sys.argv[1]
assert variant in ['schema', 'compatible']
base = root / 'artifacts/pretrained-search-v1'
doc = root / 'docs/evaluations/pretrained-search-v1'
scripts = root / 'scripts/pretrained-search-v1'
destination = base / variant
destination.mkdir(exist_ok=True)
(doc / variant).mkdir(exist_ok=True)
assert not (doc / variant / 'protocol.json').exists(), 'Existing experiment is immutable'
for name in ['manifest.json', 'cases.json', 'inputs.json']:
    (destination / name).write_bytes((base / name).read_bytes())
infer = (scripts / 'infer.py').read_text().replace(
    "OUT = ROOT / 'artifacts/pretrained-search-v1'", f"OUT = ROOT / 'artifacts/pretrained-search-v1/{variant}'"
).replace("OUT / 'python-packages'", "OUT.parent / 'python-packages'").replace(
    "OUT / 'greennode'", "OUT.parent / 'greennode'"
).replace('docs/evaluations/pretrained-search-v1/protocol.json', f'docs/evaluations/pretrained-search-v1/{variant}/protocol.json')
if variant == 'compatible':
    infer = infer.replace("OUT.parent / 'python-packages'", "OUT.parent / 'compatible-packages'").replace(
        "versions['transformers'] == '4.57.6'", "versions['transformers'] == '4.51.0' and versions['tokenizers'] == '0.21.4'")
(scripts / f'infer-{variant}.py').write_text(infer)
score = (scripts / 'score.mjs').read_text().replace(
    "dir='artifacts/pretrained-search-v1',doc='docs/evaluations/pretrained-search-v1'",
    f"dir='artifacts/pretrained-search-v1/{variant}',doc='docs/evaluations/pretrained-search-v1/{variant}'"
).replace("canonical={name:'PERSON',", "canonical={person:'PERSON','company name':'ORGANIZATION',")
(scripts / f'score-{variant}.mjs').write_text(score)
report = (scripts / 'report.mjs').read_text().replace(
    "path='docs/evaluations/pretrained-search-v1'", f"path='docs/evaluations/pretrained-search-v1/{variant}'")
(scripts / f'report-{variant}.mjs').write_text(report)
protocol = json.loads((doc / 'protocol.json').read_text())
protocol['frozenAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
protocol['labels'] = ['person', 'street address', 'location', 'organization', 'company name']
protocol['integrationCorrection'] = ('Use person and company name from publisher count.json; keep original failed run. '
    'No threshold, model, annotation or shared-policy tuning. Observed regression evidence.')
files = [Path(__file__), scripts / f'infer-{variant}.py', scripts / f'score-{variant}.mjs',
         scripts / f'report-{variant}.mjs', base / 'metadata/GreenNode-count.json', doc / 'results.json',
         *[destination / name for name in ['manifest.json','cases.json','inputs.json']]]
if variant == 'compatible':
    protocol['runtime'] = 'GLiNER 0.2.22 / torch 2.8.0 / transformers 4.51.0 / tokenizers 0.21.4, CPU FP32, four threads'
    protocol['runtimeCorrection'] = ('Earlier runs reused Transformers 4.57.6, outside GLiNER declared <=4.51.0. '
        'Use the declared dependency range before drawing a decision. Identical labels/threshold/fixtures/weights.')
    files += [doc / 'schema/results.json', *sorted((base / 'compatible-packages/gliner').rglob('*.py'))]
    files += list((base / 'compatible-packages').glob('*.dist-info/METADATA'))
for file in files:
    protocol['files'][str(file.relative_to(root))] = hashlib.sha256(file.read_bytes()).hexdigest()
with (doc / variant / 'protocol.json').open('x') as stream: stream.write(json.dumps(protocol,indent=2)+'\n')
