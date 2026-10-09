<script setup lang="ts">
import AppIcon from "./AppIcon.vue";
</script>

<template>
  <figure
    class="masking-preview"
    aria-label="Quy trình: thay thông tin riêng tư bằng bí danh, rồi sao chép sang AI"
  >
    <div class="preview-flow">
      <div class="preview-document glass">
        <div class="preview-label"><AppIcon name="file" :size="14" />Bản gốc</div>
        <div class="preview-line"></div>
        <div class="preview-value original-value">Phan Thái Phong</div>
        <div class="preview-amount">2.500.000 ₫</div>
      </div>
      <div class="preview-connector" aria-hidden="true">
        <AppIcon name="arrow" :size="18" />
      </div>
      <div class="preview-document preview-result glass">
        <div class="preview-label"><AppIcon name="check" :size="14" />Bản đã ẩn</div>
        <div class="preview-line"></div>
        <div class="preview-value alias-value">[TEN_DEMO_01]</div>
        <div class="preview-amount">2.500.000 ₫</div>
      </div>
      <div class="preview-connector ai-connector" aria-hidden="true">
        <AppIcon name="arrow" :size="18" />
      </div>
      <div class="preview-document preview-ai glass">
        <div class="preview-label"><AppIcon name="sparkle" :size="14" />AI của bạn</div>
        <strong>Sao chép sang AI</strong>
        <small>ChatGPT, Gemini, Claude,<br />Perplexity…</small>
      </div>
    </div>
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
  padding: 18px 20px;
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
  margin-top: 18px;
  font-family: var(--serif);
  font-style: italic;
  font-size: 15px;
  line-height: 1.4;
  font-weight: 400;
}
.preview-ai > small {
  display: block;
  margin-top: 8px;
  font-size: 11px;
  line-height: 1.6;
  opacity: 0.8;
}
.preview-result {
  border-color: var(--line-strong);
}
.preview-label {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--muted);
  font: 10px var(--mono);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.preview-line {
  height: 4px;
  width: 62%;
  margin: 17px 0 12px;
  border-radius: 2px;
  background: var(--line);
}
.preview-value {
  width: fit-content;
  max-width: 100%;
  padding: 5px 7px;
  border-radius: 5px;
  font-size: 12px;
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
  color: var(--accent);
}
@media (max-height: 780px) and (min-width: 761px) {
  .masking-preview {
    margin-top: 24px;
  }
}
@media (max-width: 600px) {
  .preview-flow {
    grid-template-columns: minmax(0, 1fr) 36px minmax(0, 1fr);
  }
  .ai-connector {
    grid-column: 3;
    padding: 12px 0;
    transform: rotate(90deg);
  }
  .preview-ai {
    grid-column: 3;
  }
}
@media (prefers-reduced-motion: reduce) {
  .preview-ai {
    transform: none;
  }
}
@media (max-width: 440px) {
  .preview-document {
    padding: 14px 10px;
  }
  .preview-value {
    padding: 5px;
    font-size: 10px;
  }
}
</style>
