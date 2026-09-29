"""Offline evaluation export, using verified locally downloaded weights only."""
import os
from pathlib import Path

os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
os.environ['HF_HUB_DISABLE_TELEMETRY'] = '1'

import torch
from optimum.exporters.onnx import main_export
from onnxruntime.quantization import QuantType, quantize_dynamic

ROOT = Path(__file__).resolve().parents[1] / 'artifacts' / 'alternative-models'

if __name__ == '__main__':
    # CPU-only export; modern torch loads this state dict with weights_only=True.
    torch.set_num_threads(1)
    main_export(str(ROOT / 'underthesea-source'), output=ROOT / 'underthesea',
                task='token-classification', opset=18, local_files_only=True,
                trust_remote_code=False, do_validation=True)
    quantize_dynamic(str(ROOT / 'underthesea/model.onnx'), str(ROOT / 'underthesea/model_int8.onnx'),
                     weight_type=QuantType.QInt8, per_channel=False,
                     op_types_to_quantize=['MatMul'])
    print('Exported FP32 reference and dynamic INT8 candidate.', flush=True)
