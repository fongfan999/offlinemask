<script setup lang="ts">
import { computed } from "vue";
import { columnKinds, type ColumnPlan } from "../core/sheet/columns.ts";

/** The first rows of one sheet. Changed cells are highlighted; with `plans`, each
 * column header carries a choice: keep, scan its cells, or hide the whole column. */
const props = defineProps<{
  header: readonly string[];
  rows: readonly (readonly string[])[];
  /** `row:column` keys of cells to highlight; row -1 is the header. */
  changed?: ReadonlySet<string>;
  /** Highlight every cell that contains an alias, when `changed` is not known. */
  highlightAliases?: boolean;
  plans?: readonly ColumnPlan[];
  /** Restored values read differently from aliases. */
  tone?: "alias" | "value";
  /** Lines above the header (a title, account summary), with their own `row:column` marks. */
  preamble?: readonly (readonly string[])[];
  preambleChanged?: ReadonlySet<string>;
  label: string;
}>();
const emit = defineEmits<{ plan: [column: number, plan: ColumnPlan] }>();

const aliasLike = /\[[A-Z][A-Z_]*_\d+_[a-f0-9]{4,8}\]/;
function marked(row: number, column: number, text: string) {
  if (props.changed) return props.changed.has(`${row}:${column}`);
  return !!props.highlightAliases && aliasLike.test(text);
}
const preambleLines = computed(() =>
  (props.preamble ?? [])
    .map((row, index) =>
      row
        .map((text, column) => ({
          text,
          marked: props.preambleChanged
            ? props.preambleChanged.has(`${index}:${column}`)
            : !!props.highlightAliases && aliasLike.test(text),
        }))
        .filter((cell) => cell.text.trim()),
    )
    .filter((cells) => cells.length),
);
function planValue(plan: ColumnPlan | undefined) {
  return !plan || plan.mode === "keep"
    ? "keep"
    : plan.mode === "scan"
      ? "scan"
      : `hide:${plan.type}`;
}
function choose(column: number, value: string) {
  if (value === "keep" || value === "scan") return emit("plan", column, { mode: value });
  const kind = columnKinds.find((item) => `hide:${item.type}` === value);
  if (kind) emit("plan", column, { mode: "hide", ...kind });
}
</script>

<template>
  <div v-if="preambleLines.length" class="sheet-preamble" aria-label="Phần đầu trang tính">
    <p v-for="(cells, index) in preambleLines" :key="index">
      <template v-for="(cell, position) in cells" :key="position"
        ><span v-if="position" aria-hidden="true"> - </span
        ><mark v-if="cell.marked" :class="tone ?? 'alias'">{{ cell.text }}</mark
        ><template v-else>{{ cell.text }}</template></template
      >
    </p>
  </div>
  <div class="sheet-scroll" tabindex="0" :aria-label="`${label}, cuộn ngang để xem các cột`">
    <table>
      <caption class="sr-only">
        {{
          label
        }}
      </caption>
      <thead>
        <tr v-if="plans" class="plan-row">
          <th scope="col" aria-hidden="true"></th>
          <th v-for="(name, column) in header" :key="column" scope="col">
            <select
              class="plan-select"
              :class="`is-${plans[column]?.mode ?? 'keep'}`"
              :value="planValue(plans[column])"
              :aria-label="`Cột ${name || column + 1}`"
              @change="choose(column, ($event.target as HTMLSelectElement).value)"
            >
              <option value="keep">Giữ nguyên</option>
              <option value="scan">Quét nội dung</option>
              <optgroup label="Ẩn cả cột">
                <option v-for="kind in columnKinds" :key="kind.type" :value="`hide:${kind.type}`">
                  Ẩn: {{ kind.label }}
                </option>
              </optgroup>
            </select>
          </th>
        </tr>
        <tr>
          <th scope="col">#</th>
          <th
            v-for="(name, column) in header"
            :key="column"
            scope="col"
            :class="{ [tone ?? 'alias']: marked(-1, column, name) }"
          >
            {{ name || `Cột ${column + 1}` }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in rows" :key="index">
          <th scope="row">{{ index + 1 }}</th>
          <td
            v-for="(cell, column) in row"
            :key="column"
            :class="{ [tone ?? 'alias']: marked(index, column, cell) }"
          >
            {{ cell }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
