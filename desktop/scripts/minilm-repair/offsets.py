"""Check repaired fast offsets independently against native SentencePiece surfaces.

Compare lexical source associations, not whitespace attachment conventions. All
positions are expanded to original graphemes. Added-token text uses its literal
source span; generated BOS/EOS have no source. Never match by searching ahead.
"""
import os
os.environ.update(HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',HF_HUB_DISABLE_TELEMETRY='1')
import json, unicodedata
from bisect import bisect_left
from functools import lru_cache
from pathlib import Path
from transformers import XLMRobertaTokenizer, XLMRobertaTokenizerFast
root=Path(__file__).resolve().parents[2]; old=root/'artifacts/minilm-admission'; work=root/'artifacts/minilm-repair'
slow=XLMRobertaTokenizer.from_pretrained(old/'source',local_files_only=True)
fast=XLMRobertaTokenizerFast.from_pretrained(old/'pack',local_files_only=True)

def utf16(text):
    positions=[0]
    for c in text: positions.append(positions[-1]+len(c.encode('utf-16-le'))//2)
    return positions

def mapped(spans,a,b):
    if a==b: return None
    assert 0<=a<b<=len(spans)
    return [spans[a][0],spans[b-1][1]]

def native(text,spans):
    result=[]; cursor=0
    # Exact added-token boundaries from the reference library. Current pinned
    # config has no single_word/right-strip tokens; assert rather than infer.
    for segment in slow.tokens_trie.split(text):
        begin=cursor; cursor+=len(segment)
        if segment in slow.added_tokens_encoder:
            token=slow.added_tokens_decoder[slow.added_tokens_encoder[segment]]
            assert not token.single_word and not token.rstrip
            result.append((slow.added_tokens_encoder[segment],mapped(spans,begin,cursor)))
        else:
            for p in slow.sp_model.encode(segment,out_type='immutable_proto').pieces:
                assert segment[p.begin:p.end]==p.surface
                # Empty surfaces from compatibility expansion inherit the
                # grapheme consumed by the following piece, never another word.
                a,b=begin+p.begin,begin+p.end
                if a==b and a<len(text): b=a+1
                result.append((slow.convert_tokens_to_ids(p.piece),mapped(spans,a,b)))
    assert cursor==len(text)
    return result

@lru_cache(maxsize=2)
def lexical_index(text):
    positions=utf16(text)
    return [positions[i] for i,c in enumerate(text) if unicodedata.category(c)[0] in 'LMN']

def lexical_positions(text,span):
    if span is None: return set()
    positions=lexical_index(text)
    return set(positions[bisect_left(positions,span[0]):bisect_left(positions,span[1])])

results=[]
for row in json.loads((work/'normalized.json').read_text()):
    text=row['text']; normalized=row['normalized']; spans=row['spans']
    assert normalized==unicodedata.normalize('NFC',text)
    encoded=fast(normalized,return_offsets_mapping=True,return_special_tokens_mask=True)
    ids=slow.encode(text)
    offsets=[None if special else mapped(spans,a,b) for (a,b),special in zip(encoded['offset_mapping'],encoded['special_tokens_mask'])]
    reference=native(normalized,spans)
    native_ids=[slow.bos_token_id]+[i for i,_ in reference]+[slow.eos_token_id]
    native_offsets=[None]+[s for _,s in reference]+[None]
    association_errors=[]
    if native_ids==encoded['input_ids']:
        for i,(a,b) in enumerate(zip(offsets,native_offsets)):
            if lexical_positions(text,a)!=lexical_positions(text,b):
                association_errors.append({'token':i,'fast':a,'native':b})
    coverage=set().union(*(lexical_positions(text,s) for s in offsets))
    required=lexical_positions(text,[0,len(text.encode('utf-16-le'))//2])
    results.append({'id':row['id'],'kind':row['kind'],'start':row['start'],
        'idsMatch':ids==encoded['input_ids']==row['jsIds'],
        'masksMatch':encoded['attention_mask']==row['jsMask'],
        'nativeIdsMatch':native_ids==encoded['input_ids'],
        'lexicalGaps':sorted(required-coverage),'associationErrors':association_errors,
        'withinBudget':row['kind']!='window' or len(ids)<=384,
        'offsets':offsets})
summary={'rows':len(results),'full':sum(r['kind']=='full' for r in results),'windows':sum(r['kind']=='window' for r in results),
'idFailures':sum(not r['idsMatch'] for r in results),'maskFailures':sum(not r['masksMatch'] for r in results),
'nativeIdFailures':sum(not r['nativeIdsMatch'] for r in results),'gapCases':sum(bool(r['lexicalGaps']) for r in results),
'associationFailures':sum(bool(r['associationErrors']) for r in results),'overBudget':sum(not r['withinBudget'] for r in results)}
with (work/'offsets.json').open('x') as f: json.dump({'summary':summary,'rows':results},f,indent=2)
print(json.dumps(summary),flush=True)
