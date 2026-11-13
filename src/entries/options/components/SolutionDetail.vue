<script setup lang="ts">
import { onMounted, shallowRef } from "vue";
import { useI18n } from "vue-i18n";
import { isEmpty } from "es-toolkit/compat";
import type { ISearchCategories } from "@ptd/site";
import type { ISearchSolution } from "@/shared/types.ts";
import {
  getCategoryName,
  getCategoryOptionName,
  getSiteMetaCategory,
} from "@/options/views/Settings/SetSearchSolution/utils.ts";

const props = defineProps<{
  solution: ISearchSolution;
}>();

const siteMetaCategory = shallowRef<ISearchCategories[]>([]);
const { t } = useI18n();

onMounted(async () => {
  if (props.solution?.siteId) {
    siteMetaCategory.value = await getSiteMetaCategory(props.solution.siteId);
  }
});
</script>

<template>
  <span v-if="solution" class="inline-flex flex-wrap items-center gap-1 text-xs">
    <template v-if="solution.name">
      <span class="font-medium text-foreground">{{ solution.name }}</span>
    </template>
    <template v-else-if="isEmpty(solution.selectedCategories)">
      <span class="text-muted-foreground">{{ t("common.default") }}</span>
    </template>
    <template v-else>
      <span
        v-for="(value, category) in solution.selectedCategories"
        :key="category"
        class="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
        :title="`${getCategoryName(siteMetaCategory, category)}: ${getCategoryOptionName(siteMetaCategory, category, value)}`"
      >
        <strong class="font-medium text-foreground">{{ getCategoryName(siteMetaCategory, category) }}:</strong>
        <span>{{ getCategoryOptionName(siteMetaCategory, category, value) }}</span>
      </span>
    </template>
  </span>
  <span v-else class="text-xs text-muted-foreground">Unknown</span>
</template>
