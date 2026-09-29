import assert from 'node:assert/strict';
import { auditReadiness } from '../detector-corpus-v1/audit.mjs';
import { parseRecord } from '../detector-feasibility/corpus.mjs';

/** Prevent differently named copies from inflating within-partition family quotas. */
export function auditExpansion(rows, capabilities, regressions, ledger) {
  const owners = new Map();
  for (const row of rows) {
    const parsed = parseRecord(row, capabilities);
    for (const [kind, value] of [['text', parsed.normalizedText], ['template', parsed.normalizedSkeleton],
      ['scenario', row.scenarioId ?? row.familyId]]) {
      const key = `${row.split}/${kind}/${value}`, previous = owners.get(key);
      assert.ok(!previous || previous === row.familyId, `Duplicate ${kind} counted as separate families: ${row.id}`);
      owners.set(key, row.familyId);
    }
  }
  const audit = auditReadiness(rows, capabilities, regressions, ledger);
  const target = capabilities.requiredForPilot;
  const gaps = Object.fromEntries(['train', 'development'].map(split => {
    const current = audit.composition[split];
    const minimum = split === 'train' ? target.trainFamilies : target.developmentFamilies;
    return [split, {
      familyDeficit: Math.max(0, minimum - current.families),
      ordinaryFraction: current.families ? current.negativeFamilies / current.families : 0,
      typeDeficits: Object.fromEntries(Object.entries(current.typeFamilies).map(([type, count]) => [type, Math.max(0, target.perTypeFamilies - count)])),
    }];
  }));
  return { ...audit, gaps,
    gapNote: 'Family and per-type deficits overlap; do not sum them as a required record count. Further positive additions need ordinary families to preserve balance. Structural uniqueness is not semantic independence.' };
}
