"""Check JS-planned windows against reference tokenization without inference."""
import os
os.environ.update(HF_HUB_OFFLINE='1', TRANSFORMERS_OFFLINE='1', HF_HUB_DISABLE_TELEMETRY='1')
import json
from pathlib import Path
from transformers import XLMRobertaTokenizer, XLMRobertaTokenizerFast
work = Path(__file__).resolve().parents[2] / 'artifacts/minilm-admission'
slow = XLMRobertaTokenizer.from_pretrained(work / 'source', local_files_only=True)
fast = XLMRobertaTokenizerFast.from_pretrained(work / 'pack', local_files_only=True)
results = []
for r in json.loads((work / 'chunks.json').read_text()):
    s, f = slow.encode(r['text']), fast.encode(r['text'])
    results.append({'id':r['id'], 'start':r['start'], 'jsTokens':len(r['ids']), 'referenceTokens':len(s),
        'jsSlowIdMatch':r['ids']==s, 'jsFastIdMatch':r['ids']==f, 'referenceWithinBudget':len(s)<=384})
report = {'count':len(results), 'jsSlowMismatches':sum(not r['jsSlowIdMatch'] for r in results),
          'jsFastMismatches':sum(not r['jsFastIdMatch'] for r in results),
          'overBudget':sum(not r['referenceWithinBudget'] for r in results), 'rows':results}
with (work / 'chunk-evidence.json').open('x') as f:
    json.dump(report, f, indent=2)
print({k:v for k,v in report.items() if k!='rows'})
