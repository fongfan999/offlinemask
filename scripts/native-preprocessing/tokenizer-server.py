"""Local synthetic evaluation transport; never imported or shipped by the app."""
import json
import sys
import tokenizers
from tokenizers import Tokenizer

if tokenizers.__version__ != '0.22.2':
    raise RuntimeError('Expected tokenizers 0.22.2')
tokenizer = Tokenizer.from_file(sys.argv[1])
tokenizer.no_truncation()
tokenizer.no_padding()
for line in sys.stdin:
    request = json.loads(line)
    try:
        text = request['text']
        offsets = [0]
        for char in text:
            offsets.append(offsets[-1] + len(char.encode('utf-16-le')) // 2)
        content = tokenizer.encode(text, add_special_tokens=False)
        full = tokenizer.encode(text, add_special_tokens=True)
        result = {'input_ids': full.ids, 'attention_mask': full.attention_mask,
                  'token_type_ids': full.type_ids, 'special_tokens_mask': full.special_tokens_mask,
                  'content_ids': content.ids, 'words': content.tokens,
                  'offsets': [[offsets[a], offsets[b]] for a, b in content.offsets]}
        print(json.dumps({'id': request['id'], 'result': result}), flush=True)
    except Exception:
        print(json.dumps({'id': request['id'], 'error': 'Native tokenization failed'}), flush=True)
