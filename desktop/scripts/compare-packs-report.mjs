// The pure part of `compare-packs.mjs` (decision 0164): which runs to make, and what
// their counts say about the mechanisms a pack still needs.
import { vetoNames } from "../src/core/detection/vetoes.ts";

export const counted = ["notRead", "leaked", "over", "unlisted"];

/** The runs of a comparison: the shipping pack, the candidate when given, then the
 * ablations, each the candidate (or the shipping pack without one) with one mechanism
 * switched off. Two mechanisms that cover the same spans (a heading in capitals is both
 * a `capitalHeadings` and a `capitalRoles` case) show nothing when switched off one at a
 * time; "capitalHeadings+capitalRoles" switches them off together in one run. */
export function planRuns({ candidate = false, ablate = [] } = {}) {
  const runs = [{ id: "shipping", pack: "shipping", off: [] }];
  if (candidate) runs.push({ id: "candidate", pack: "candidate", off: [] });
  const base = candidate ? "candidate" : "shipping";
  for (const group of ablate) {
    const off = group.split("+");
    for (const veto of off) if (!vetoNames.includes(veto)) throw new Error(`Unknown veto: ${veto}`);
    runs.push({ id: `${base} without ${group}`, pack: base, off, ablates: group });
  }
  return runs;
}

/** Totals of one run over every set: { setName: totals }. */
function sum(results) {
  const total = { documents: 0, notRead: 0, leaked: 0, over: 0, unlisted: 0 };
  for (const totals of Object.values(results))
    for (const key of Object.keys(total)) total[key] += totals[key];
  return total;
}

/** What each ablation changed against its base run, set by set: a mechanism the pack no
 * longer needs is one whose removal brings back nothing (no leak, no over-masking, no
 * unlisted mask) on any set. `results` is { runId: { setName: totals } }. */
export function judgeAblations(runs, results) {
  const verdicts = [];
  for (const run of runs) {
    if (!run.ablates) continue;
    const base = results[run.pack];
    const own = results[run.id];
    if (!base || !own) continue;
    const returned = {};
    for (const set of Object.keys(own)) {
      const delta = {};
      for (const key of counted) {
        const more = (own[set]?.[key] ?? 0) - (base[set]?.[key] ?? 0);
        if (more > 0) delta[key] = more;
      }
      if (Object.keys(delta).length) returned[set] = delta;
    }
    verdicts.push({
      veto: run.ablates,
      needed: Object.keys(returned).length > 0,
      returned,
    });
  }
  return verdicts;
}

const cell = (totals) => `${totals.notRead} / ${totals.leaked} / ${totals.over} / ${totals.unlisted}`;
/** The comparison as Markdown with counts only, so it can go into docs/evaluations. */
export function comparisonMarkdown({ at, sets, runs, results, seconds, verdicts, packs }) {
  const lines = [
    `# Pack comparison (${at.slice(0, 10)})`,
    "",
    `Shipping pack: \`${packs.shipping}\`${packs.candidate ? `; candidate: \`${packs.candidate}\`` : ""}.`,
    "Cells read not read / leaked / over-masked / unlisted.",
    "",
    `| Run | ${sets.map((set) => `${set.name} (${set.documents})`).join(" | ")} | All |`,
    `| --- | ${sets.map(() => "---").join(" | ")} | --- |`,
  ];
  for (const run of runs) {
    const row = results[run.id];
    if (!row) continue;
    lines.push(
      `| ${run.id} | ${sets.map((set) => (row[set.name] ? cell(row[set.name]) : "–")).join(" | ")} | ${cell(sum(row))} |`,
    );
  }
  if (verdicts.length) {
    const base = runs.some((run) => run.pack === "candidate") ? "candidate" : "shipping pack";
    lines.push("", `## Mechanisms the ${base} still needs`, "");
    for (const verdict of verdicts) {
      if (!verdict.needed) continue;
      const parts = Object.entries(verdict.returned).map(
        ([set, delta]) =>
          `${set}: ${Object.entries(delta)
            .map(([key, n]) => `+${n} ${key}`)
            .join(", ")}`,
      );
      lines.push(`- **${verdict.veto}**: ${parts.join("; ")}`);
    }
    const spare = verdicts.filter((verdict) => !verdict.needed).map((verdict) => verdict.veto);
    lines.push(
      "",
      spare.length
        ? `Mechanisms that brought nothing back when switched off: ${spare.join(", ")}.`
        : "Every mechanism switched off brought something back.",
    );
  }
  lines.push("", `${runs.length} run(s) in ${Math.round(seconds)} s.`, "");
  return lines.join("\n");
}
