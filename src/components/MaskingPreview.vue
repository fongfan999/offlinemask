<script setup lang="ts">
import AppIcon from "./AppIcon.vue";
</script>

<template>
  <figure
    class="masking-preview"
    aria-label="Ba bước: dán văn bản và bấm Ẩn thông tin, sao chép bản đã ẩn sang AI, rồi dán câu trả lời của AI vào OfflineMask để thấy lại tên thật"
  >
    <div class="preview-flow">
      <div class="preview-document glass">
        <div class="preview-step">
          <span class="step-number">1</span><span>Dán, bấm <strong>Ẩn thông tin</strong></span>
        </div>
        <div class="preview-label"><AppIcon name="file" :size="14" />Bản gốc</div>
        <div class="preview-value original-value">Phong Phan</div>
        <div class="preview-amount">2.500.000 ₫</div>
      </div>
      <div class="preview-connector" aria-hidden="true">
        <AppIcon name="arrow" :size="22" />
      </div>
      <div class="preview-document preview-result glass">
        <div class="preview-step preview-outcome">Kết quả</div>
        <div class="preview-label"><AppIcon name="check" :size="14" />Bản đã ẩn</div>
        <div class="preview-value alias-value">[TEN_1_3030]</div>
        <div class="preview-amount">2.500.000 ₫</div>
      </div>
      <div class="preview-connector ai-connector" aria-hidden="true">
        <AppIcon name="arrow" :size="22" />
      </div>
      <div class="preview-document preview-ai glass">
        <div class="preview-step"><span class="step-number">2</span>Sao chép sang AI</div>
        <div class="preview-label"><AppIcon name="sparkle" :size="14" />AI của bạn</div>
        <strong>Hỏi AI như bình thường</strong>
        <small>ChatGPT, Gemini, Claude, Perplexity…</small>
      </div>
    </div>
    <figcaption class="preview-return">
      <span class="preview-step"
        ><span class="step-number">3</span>Dán câu trả lời của AI vào OfflineMask</span
      >
      <span>Tên thật hiện lại, vẫn chỉ trên máy bạn.</span>
    </figcaption>
  </figure>
</template>

<style scoped>
.masking-preview {
  max-width: 730px;
  margin: 30px auto 0;
}
.preview-flow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 40px minmax(0, 1fr) 40px minmax(0, 0.9fr);
  align-items: center;
}
.preview-document {
  align-self: stretch;
  padding: 16px 18px 18px;
  border-radius: 8px;
  text-align: left;
}
/* The AI panel is the notebook's sticky note: cobalt paper, slightly tilted. */
.preview-ai {
  background: var(--note);
  color: var(--note-ink);
  border-color: transparent;
  transform: rotate(2deg);
}
.preview-ai .preview-label {
  color: inherit;
  opacity: 0.8;
}
.preview-ai strong {
  display: block;
  margin-top: 14px;
  font-family: var(--serif);
  font-style: italic;
  font-size: 15px;
  line-height: 1.4;
  font-weight: 400;
}
.preview-ai > small {
  display: block;
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.6;
}
.preview-result {
  border-color: var(--line-strong);
}
/* Each panel opens with the action the reader takes; the eyebrow names what they see. */
.preview-step {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  color: var(--ink);
  min-height: 20px;
}
.preview-step strong {
  font-weight: 650;
}
/* The middle panel is what step 1 produces, not a step of its own. */
.preview-outcome {
  color: var(--muted);
  font-weight: 400;
}
.preview-ai .preview-step {
  color: inherit;
}
.preview-ai .step-number {
  background: var(--note-ink);
  color: var(--note);
}
.preview-label {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 16px 0 10px;
  color: var(--muted);
  font: 12px var(--mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.preview-value {
  width: fit-content;
  max-width: 100%;
  padding: 5px 7px;
  border-radius: 5px;
  font-size: 13px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.original-value {
  background: var(--paper-sunk);
  color: var(--ink);
}
.alias-value {
  color: var(--accent);
  background: var(--accent-soft);
  font-family: var(--mono);
}
.preview-amount {
  margin-top: 10px;
  font: 12px var(--mono);
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.preview-connector {
  display: grid;
  justify-items: center;
  gap: 7px;
  color: var(--accent-strong);
}
.preview-return {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 6px 12px;
  margin-top: 18px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--muted);
}
@media (max-height: 780px) and (min-width: 761px) {
  .masking-preview {
    margin-top: 24px;
  }
}
/* Phones read the flow top to bottom. */
@media (max-width: 600px) {
  .preview-flow {
    grid-template-columns: minmax(0, 1fr);
    max-width: 340px;
    margin: 0 auto;
  }
  .preview-connector {
    padding: 8px 0;
    transform: rotate(90deg);
  }
  .preview-ai {
    transform: rotate(1deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .preview-ai {
    transform: none;
  }
}
@media (max-width: 440px) {
  .preview-document {
    padding: 14px 16px;
  }
}
</style>
