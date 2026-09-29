"""Quality reference with native tokenizer offsets; this is not a shipping adapter."""
import json
from pathlib import Path
import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

ROOT = Path(__file__).resolve().parents[1] / 'artifacts' / 'alternative-models'

if __name__ == '__main__':
    tokenizer = Tokenizer.from_file(str(ROOT / 'underthesea/tokenizer.json'))
    tokenizer.enable_truncation(max_length=384, stride=64)
    corpus = json.loads((ROOT / 'corpus.json').read_text())
    labels = json.loads((ROOT / 'underthesea/config.json').read_text())['id2label']
    for variant, filename in [('int8', 'model_int8.onnx'), ('fp32', 'model.onnx')]:
        options = ort.SessionOptions()
        options.intra_op_num_threads = 1
        session = ort.InferenceSession(str(ROOT / 'underthesea' / filename), options, providers=['CPUExecutionProvider'])
        results = []
        for fixture in corpus:
            text = fixture['text']
            # Native offsets count Unicode codepoints; the app uses UTF-16 code units.
            utf16 = [0]
            for char in text:
                utf16.append(utf16[-1] + len(char.encode('utf-16-le')) // 2)
            encoding = tokenizer.encode(text)
            windows = []
            for window in [encoding, *encoding.overflowing]:
                feeds = {'input_ids': np.array([window.ids], dtype=np.int64),
                         'attention_mask': np.array([window.attention_mask], dtype=np.int64),
                         'token_type_ids': np.array([window.type_ids], dtype=np.int64)}
                logits = session.run(None, {i.name: feeds[i.name] for i in session.get_inputs()})[0][0]
                tokens = []
                for index, ((start, end), vector) in enumerate(zip(window.offsets, logits)):
                    if end <= start:
                        continue
                    best = int(vector.argmax())
                    score = float(1 / np.exp(vector - vector[best]).sum())
                    tokens.append({'index': index, 'word': text[start:end], 'start': utf16[start], 'end': utf16[end],
                                   'entity': labels[str(best)], 'score': score})
                windows.append(tokens)
            results.append({'id': fixture['id'], 'windows': windows})
        (ROOT / f'underthesea-{variant}-reference.json').write_text(json.dumps(results, ensure_ascii=False))
        print(f'Completed {variant} exact-offset reference', flush=True)
