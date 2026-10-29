<script setup lang="ts">
import { computed, ref } from "vue";
import type { ReviewGroup } from "../core/file-review.ts";

/** Every value a masked file hides, most frequent first, to keep the ones that need
 * no hiding (decision 0079). A value is kept everywhere in the file; a type can be
 * kept as a whole. */
const props = defineProps<{
  groups: readonly ReviewGroup[];
  /** For a folder (decision 0171): how many files each alias appears in. */
  files?: ReadonlyMap<string, number>;
}>();
const emit = defineEmits<{ change: [aliases: string[], keep: boolean] }>();

const shownLimit = 100;
const query = ref("");
const fold = (text: string) =>
  text.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "d").toLowerCase();

const items = computed(() =>
  props.groups
    .flatMap((group) => group.items)
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "vi")),
);
const matches = computed(() => {
  const wanted = fold(query.value.trim());
  return wanted ? items.value.filter((item) => fold(item.value).includes(wanted)) : items.value;
});
const shown = computed(() => matches.value.slice(0, shownLimit));
const types = computed(() =>
  props.groups.map((group) => {
    const hidden = group.items.filter((item) => !item.kept).length;
    return { group, hidden, all: hidden === group.items.length };
  }),
);

function toggleType(group: ReviewGroup, all: boolean) {
  emit(
    "change",
    group.items.map((item) => item.alias),
    all,
  );
}
</script>

<template>
  <section class="review-list" aria-labelledby="review-list-title">
    <header class="review-head">
      <strong id="review-list-title">Kiểm tra trước khi tải</strong>
      <span
        >Bỏ chọn những gì không cần ẩn, như tên nhân vật lịch sử hay địa danh. Giá trị bỏ chọn được
        giữ nguyên ở mọi chỗ trong {{ files ? "mọi tệp" : "tệp" }}.</span
      >
    </header>
    <div class="review-types" role="group" aria-label="Loại thông tin">
      <label
        v-for="{ group, hidden, all } in types"
        :key="group.type"
        class="review-type"
        :class="{ 'is-off': !hidden }"
      >
        <input
          type="checkbox"
          :checked="all"
          :indeterminate="!!hidden && !all"
          @change="toggleType(group, all)"
        />{{ group.label }} <span>{{ hidden.toLocaleString("vi-VN") }}</span>
      </label>
    </div>
    <input
      v-if="items.length > 12"
      v-model="query"
      type="search"
      class="review-search"
      placeholder="Tìm giá trị…"
      aria-label="Tìm giá trị"
    />
    <ul class="review-values" :class="{ 'is-steady': items.length > 12 }">
      <li v-for="item in shown" :key="item.alias">
        <label class="review-value" :class="{ 'is-kept': item.kept }">
          <input
            type="checkbox"
            :checked="!item.kept"
            @change="emit('change', [item.alias], !item.kept)"
          /><span class="review-text">{{ item.value }}</span
          ><span class="review-meta"
            >{{ item.label }} · {{ item.count.toLocaleString("vi-VN") }} chỗ<template v-if="files">
              · {{ (files.get(item.alias) ?? 1).toLocaleString("vi-VN") }} tệp</template
            ></span
          >
        </label>
      </li>
      <li v-if="!matches.length" class="review-empty">Không có giá trị khớp.</li>
    </ul>
    <p v-if="matches.length > shownLimit" class="review-more">
      Đang hiện {{ shownLimit }} / {{ matches.length.toLocaleString("vi-VN") }} giá trị nhiều chỗ
      nhất. Gõ để tìm giá trị khác.
    </p>
  </section>
</template>
