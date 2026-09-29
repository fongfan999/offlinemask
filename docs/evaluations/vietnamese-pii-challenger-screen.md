# Vietnamese PII challenger: metadata and preprocessing screen

15 September 2026. **Hold this candidate before scored comparison.** The inspected files establish a concrete label set, but do not establish the fine-tuned model's preprocessing or source-alignment contract. This is not a model-quality rejection. No weights were downloaded and no inference was performed.

The candidate is [Phuc2005/pii-phobert-base-ner](https://huggingface.co/Phuc2005/pii-phobert-base-ner), pinned for this inspection to revision `fc4d654b9906dafb34ea670b9b14c2360e4d3be3`. The repository declares Apache-2.0 and describes Vietnamese PII fine-tuning. Its model card provides no dataset provenance, training recipe or evaluation results. A repository license declaration alone does not document the training-data provenance or complete redistribution review.

## Findings

| Item | Verified metadata or remaining requirement |
| --- | --- |
| Architecture | `RobertaForTokenClassification`, PhoBERT tokenizer; 134,491,501 parameters reported by Hub metadata |
| Labels | 109 BIO labels: `O` plus beginning/inside labels for 54 entity types; not 109 different types |
| Main weight file | `model.safetensors`, 537,989,916 bytes; published LFS SHA-256 `9b1662171d3861ee92f9e4ab5c91df7996fbab7e2bf9a6463512f941176e1d5a` |
| Tokenizer assets | `vocab.txt` and `bpe.codes`; no `tokenizer.json` listed at the inspected revision |
| Published runtime artifact | Safetensors only; no ONNX export listed |
| Context configuration | `max_position_embeddings: 258`, `pad_token_id: 1`; the tokenizer config's enormous default maximum is not a usable model limit |
| Preprocessing | Standard PhoBERT expects pre-segmented words; the fine-tuned checkpoint does not document how its training text was segmented or aligned |
| Desktop work needed | A verified segmentation/tokenization/source-offset path, bounded context appropriate to this architecture, and a locally validated export/quantization |

The label inventory includes person-name components, CCCD, account numbers, contact information, passwords, usernames and address components. It also includes amounts, currencies, ordinary dates, physical attributes and job-related fields. Those labels must be mapped explicitly to OfflineMask policy; broad output labels are not permission to hide all detected information. There is no separately named API-key label in the inventory. See the [pinned configuration](https://huggingface.co/Phuc2005/pii-phobert-base-ner/blob/fc4d654b9906dafb34ea670b9b14c2360e4d3be3/config.json) and [screen metadata](vietnamese-pii-challenger-screen.json).

The [official PhoBERT documentation](https://huggingface.co/docs/transformers/model_doc/phobert) requires word segmentation before encoding. Adding or removing segmentation underscores changes source positions, so an evaluation cannot simply reuse the current Metaspace aligner. The 258-position RoBERTa configuration also requires a shorter valid input budget than the current 384-token common default; validate exact special/padding-position accounting in an admitted adapter rather than relying on the tokenizer's placeholder maximum.

The author's [public demo source](https://huggingface.co/spaces/Phuc2005/pii-demo-ner/blob/2856cc2db64158264a80efc8ad3a30e8ed5017d9/app.py) was inspected at revision `2856cc2db64158264a80efc8ad3a30e8ed5017d9`. It instantiates the author's XLM-R checkpoint only. It does not demonstrate PhoBERT preprocessing or establish that the PhoBERT model was trained on raw rather than segmented text. The source was read, not executed; nothing was submitted to the hosted demo.

## Admission requirements

Establish a reproducible preprocessing contract from training/inference documentation or treat explicitly declared preprocessing alternatives as development hypotheses. Those hypotheses would need their own validation and must not be presented as reproducing the author's training pipeline. Verify original-span mapping, unknown tokens, decomposed Unicode, short context windows, label-policy mapping and local export fidelity before scoring final quality. Complete provenance and redistribution review before any shipping decision.

The same author's XLM-R checkpoint is a separate research lead, not an automatically admitted substitute for this candidate. This screen does not broaden the bounded comparison to additional checkpoints.

Only public metadata and small source/configuration files were read. Local file hashes, the model/demo revisions and the published file inventory are recorded in the JSON screen. The default app, installed pack and offline/no-tracking contract are unchanged.
