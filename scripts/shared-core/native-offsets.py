"""Synthetic evaluation helper only; uses an already installed native tokenizer."""
import json
import sys
import tokenizers
from tokenizers import Tokenizer

if tokenizers.__version__ != '0.22.2':
    raise RuntimeError('Use the pinned evaluation tokenizers 0.22.2')
tokenizer = Tokenizer.from_file(sys.argv[1])
tokenizer.no_truncation()
tokenizer.no_padding()
result = []
for text in json.load(sys.stdin):
    utf16 = [0]
    for char in text:
        utf16.append(utf16[-1] + len(char.encode('utf-16-le')) // 2)
    encoding = tokenizer.encode(text, add_special_tokens=False)
    result.append({'ids': encoding.ids,
                   'offsets': [[utf16[a], utf16[b]] for a, b in encoding.offsets]})
json.dump({'version': tokenizers.__version__, 'encodings': result}, sys.stdout)
