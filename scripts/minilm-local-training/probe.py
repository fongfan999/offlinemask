"""Bounded MPS backward diagnostic. No optimizer updates or corpus access."""
import os
os.environ.update(HF_HUB_OFFLINE='1', TRANSFORMERS_OFFLINE='1', HF_HUB_DISABLE_TELEMETRY='1',
                  TOKENIZERS_PARALLELISM='false', PYTORCH_ENABLE_MPS_FALLBACK='0')
import hashlib
import importlib.metadata
import json
import platform
import resource
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'artifacts/minilm-local-training'
SOURCE = ROOT / 'artifacts/minilm-admission/source'
report = {'completed': False, 'optimizerSteps': 0, 'checkpointSaved': False, 'corpusUsed': False,
          'passes': [], 'memory': [], 'cpuFallbackEnabled': False}

def sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

def block_network(event, args):
    if event in {'socket.connect', 'socket.getaddrinfo', 'socket.bind'}:
        raise RuntimeError('Network access disabled in local diagnostic')

sys.addaudithook(block_network)
try:
    import torch
    from transformers import BertForTokenClassification
    report['environment'] = {'python': platform.python_version(), 'macOS': platform.mac_ver()[0],
        'machine': platform.machine(), **{name: importlib.metadata.version(name) for name in ['torch', 'transformers']}}
    assert report['environment']['python'] == '3.12.7'
    assert report['environment']['torch'] == '2.8.0'
    assert report['environment']['transformers'] == '4.57.6'
    assert platform.system() == 'Darwin', 'RSS units and backend require macOS'
    assert torch.backends.mps.is_available(), 'MPS unavailable; no silent CPU fallback'
    manifest = json.loads((ROOT / 'docs/evaluations/minilm-admission/download-evidence.json').read_text())
    for name, entry in manifest['files'].items():
        assert sha(SOURCE / name) == entry['sha256'], f'Cached source hash mismatch: {name}'
    report['sourceRevision'] = manifest['revision']
    report['sourceHashes'] = {name: entry['sha256'] for name, entry in manifest['files'].items()}
    torch.set_num_threads(1)
    torch.manual_seed(9182026)
    recommended = torch.mps.recommended_max_memory()
    limit = 6 * 1024**3
    torch.mps.set_per_process_memory_fraction(float(limit / recommended))
    report['allocatorLimitBytes'] = limit
    report['recommendedGpuWorkingSetBytes'] = recommended
    types = json.loads((ROOT / 'docs/evaluations/detector-feasibility/capabilities.json').read_text())['types']
    labels = ['O'] + [f'{bio}-{name.upper()}' for name in types for bio in ['B', 'I']]
    model, loading = BertForTokenClassification.from_pretrained(SOURCE, local_files_only=True, weights_only=True,
        attn_implementation='eager', id2label=dict(enumerate(labels)), label2id={label: i for i, label in enumerate(labels)},
        output_loading_info=True)
    assert set(loading['missing_keys']) == {'classifier.weight', 'classifier.bias'}
    assert not loading.get('mismatched_keys') and not loading.get('error_msgs')
    report['parameters'] = sum(p.numel() for p in model.parameters())
    report['parameterBytes'] = sum(p.numel() * p.element_size() for p in model.parameters())

    def parameter_hash():
        result = hashlib.sha256()
        for name, parameter in model.named_parameters():
            result.update(name.encode())
            # Small CPU copies avoid duplicating the full embedding table for hashing.
            for chunk in parameter.detach().reshape(-1).split(1024 * 1024):
                result.update(chunk.cpu().numpy().tobytes())
        return result.hexdigest()

    before = parameter_hash()
    model.to('mps').train()
    # Explicit resident moment storage; no optimizer object/update is executed.
    moments = [(torch.zeros_like(p), torch.zeros_like(p)) for p in model.parameters()]
    report['reservedMomentBytes'] = 2 * report['parameterBytes']

    def memory(phase):
        torch.mps.synchronize()
        row = {'phase': phase, 'tensorBytes': torch.mps.current_allocated_memory(),
               'driverBytes': torch.mps.driver_allocated_memory(),
               'processPeakRssBytes': resource.getrusage(resource.RUSAGE_SELF).ru_maxrss}
        report['memory'].append(row)
        assert row['driverBytes'] <= limit, 'Observed driver memory exceeds diagnostic limit'
        assert row['processPeakRssBytes'] <= 8 * 1024**3, 'Process memory exceeds diagnostic guard'

    memory('loaded-with-moment-reserve')
    for batch, length in [(1, 128), (1, 384), (2, 384)]:
        ids = (torch.arange(batch * length).reshape(batch, length) % (model.config.vocab_size - 10) + 10).to('mps')
        mask = torch.ones_like(ids)
        targets = (torch.arange(batch * length).reshape(batch, length) % len(labels)).to('mps')
        targets[:, 0] = -100
        targets[:, -1] = -100
        for repetition in range(2):
            model.zero_grad(set_to_none=True)
            torch.mps.synchronize()
            started = time.perf_counter()
            output = model(input_ids=ids, attention_mask=mask, token_type_ids=torch.zeros_like(ids), labels=targets)
            loss = output.loss
            loss.backward()
            torch.mps.synchronize()
            elapsed = (time.perf_counter() - started) * 1000
            assert torch.isfinite(loss).item(), 'Nonfinite loss'
            gradients = 0
            nonzero = False
            for parameter in model.parameters():
                assert parameter.grad is not None, 'Missing parameter gradient'
                assert torch.isfinite(parameter.grad).all().item(), 'Nonfinite gradient'
                gradients += parameter.grad.numel()
                nonzero = nonzero or bool(parameter.grad.abs().max().item() > 0)
            assert nonzero, 'All gradients zero'
            memory(f'{batch}x{length}-pass-{repetition + 1}')
            row = {'batch': batch, 'tokens': length, 'repetition': repetition + 1,
                   'forwardBackwardMs': elapsed, 'loss': loss.detach().item(), 'finiteGradientElements': gradients}
            report['passes'].append(row)
            print(json.dumps(row), flush=True)
            del output, loss
        del ids, mask, targets
    model.zero_grad(set_to_none=True)
    del moments
    torch.mps.synchronize()
    after = parameter_hash()
    assert before == after, 'Diagnostic changed model parameters'
    report['parametersUnchanged'] = True
    report['parameterSha256'] = before
    for name, entry in manifest['files'].items():
        assert sha(SOURCE / name) == entry['sha256'], 'Cached source modified'
    report['completed'] = True
except Exception as error:
    report['failure'] = {'type': type(error).__name__, 'message': str(error)[:1500]}
finally:
    report['limits'] = 'Artificial IDs/labels, FP32, eager attention, six backward passes only. Moment tensors reserve storage but do not test optimizer updates/temporaries. Phase memory snapshots can miss peaks; process RSS and driver memory overlap. No label alignment, quality, sustained training or duration qualification.'
    with (OUT / 'report.json').open('x') as stream:
        json.dump(report, stream, indent=2)
        stream.write('\n')
if not report['completed']:
    print(json.dumps(report.get('failure')), flush=True)
    sys.exit(1)
