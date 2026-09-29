import { categories, summarize, meetsScreeningFloor } from '../model-comparison-metrics.mjs';

export function summarizeStage(rows) {
  const summary = summarize(rows);
  const shortSummary = summarize(rows.filter(r => r.group !== 'long'));
  const categoryPass = categories.every(c => {
    const value = summary.byCategory[c];
    return value.total > 0 && value.selectedFull / value.total >= (['email', 'phone', 'banking'].includes(c) ? .99 : .95);
  });
  return { summary, shortSummary, screeningPass: categoryPass && meetsScreeningFloor({ summary, shortSummary }) };
}
