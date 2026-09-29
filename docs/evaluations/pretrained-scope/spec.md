# Pretrained responsibility split diagnostic

Goal: test whether assigning the contextual model only names, addresses and organizations can reduce maintenance and broad-type false positives without hiding structured-value coverage losses. No training, new dataset, download, production change or release-gate change.

Use the frozen 362 observed cases and pinned assets from model-recheck. Re-run actual inference for SuperClinical, mSuperClinical, the pair (control), BigMed with native preprocessing, and Underthesea INT8. The previous Underthesea FP32 comparison did not repair its capability gap; omit that redundant resource variant here. Run sequentially. Verify current code/asset fingerprints and require the unrestricted full/selected outputs to exactly reproduce saved evidence before scoring an ablation. Never reconstruct detector evidence from masked preview spans.

For each case compare: (1) unchanged production-local scope, (2) shared contextual policy with an empty prediction list (experimental rule-only baseline), (3) existing full candidate, (4) same candidate retaining only TEN/DIA_CHI/TO_CHUC model detections before the unchanged shared policy. This retains existing rules; it does not implement missing rules or enable categories in the normal no-pack UI.

Score original full scope uniformly, correcting historical challenge cards to the product's other category for every route. Keep every missed structured value, own-category coverage loss and excess-masked ordinary position. Do not remove unrecognized entities from denominators. Also report contextual name/address categories and organization outcomes where typed annotations exist; the old regression corpus has coarse categories and cannot support invented per-type ground truth.

Record exact gain/loss lists against each candidate and pair, and separate regression/challenge results. Preserve the existing thresholds. All cases are previously observed and cannot qualify a release or provide banking accuracy. No new speed/memory ranking: native-reference preprocessing and harness costs prevent a comparable desktop claim.
