<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useDisplay } from "vuetify/framework";

import { getTorrentVolumeFactors } from "@ptd/site";

import { useConfigStore } from "@/options/stores/config.ts";
import { useRuntimeStore } from "@/options/stores/runtime.ts";
import { formatSize } from "@/options/utils.ts";
import type { ISearchResultTorrent } from "@/shared/types/storages/runtime.ts";

import { tableCustomFilter } from "./utils/filter.ts";

import FilterChips from "@/options/components/FilterChips.vue";
import SiteName from "@/options/components/SiteName.vue";
import SiteFavicon from "@/options/components/SiteFavicon/Index.vue";

const { selectedTorrents } = defineProps<{
  selectedTorrents: ISearchResultTorrent[];
}>();

const { t } = useI18n();
const configStore = useConfigStore();
const runtimeStore = useRuntimeStore();
const display = useDisplay();

const { advanceFilterDictRef, advanceItemPropsRef, tableFilterRef, updateTableFilterValueFn } = tableCustomFilter;

// 直接双向同步 advanceFilterDictRef.site.required，保证重置/高级筛选时 UI 永远一致
const selectedSites = computed<string[]>({
  get: () => advanceFilterDictRef.value.site.required ?? [],
  set: (val: string[]) => {
    advanceFilterDictRef.value.site.required = [...val];
    advanceFilterDictRef.value.site.exclude = [];
    updateTableFilterValueFn();
  },
});

// 统计每个站点在当前搜索结果中的命中条数
const siteResultCountMap = computed(() => {
  const counts = new Map<string, number>();
  for (const item of runtimeStore.search.searchResult) {
    if (item.site) {
      counts.set(item.site, (counts.get(item.site) ?? 0) + 1);
    }
  }
  return counts;
});

const showBillableSize = computed(() => configStore.searchEntifyControl.promotionDisplay !== "none");

const selectedTorrentsInfo = computed(() => {
  const selectedObjects = selectedTorrents;
  const totalSize = selectedObjects.reduce((sum, torrent) => sum + (torrent.size || 0), 0);
  const billableSize = selectedObjects.reduce((sum, torrent) => {
    const { downloadVolumeFactor } = getTorrentVolumeFactors(torrent);
    return sum + (torrent.size || 0) * (downloadVolumeFactor ?? 1);
  }, 0);

  return {
    count: selectedObjects.length,
    totalSize,
    billableSize,
  };
});

const shouldShowNoticeBar = computed(
  () =>
    (configStore.searchEntity.quickSiteFilter && advanceItemPropsRef.value.site.length > 0) ||
    selectedTorrents.length > 0 ||
    Boolean(tableFilterRef.value),
);
</script>

<template>
  <div
    v-if="shouldShowNoticeBar"
    class="bg-surface-variant rounded-lg px-3 py-2 mb-3 d-flex flex-wrap align-center justify-space-between ga-2"
  >
    <!-- 站点筛选器（含各站命中条数） -->
    <div class="flex-grow-1" style="min-width: 0">
      <FilterChips
        v-if="configStore.searchEntity.quickSiteFilter && advanceItemPropsRef.site.length > 0"
        v-model="selectedSites"
        :all-label="t('SearchEntity.siteFilter.all')"
        :items="advanceItemPropsRef.site"
        mandatory
      >
        <template #chip="{ item }">
          <SiteFavicon :site-id="item" :size="14" class="mr-1" />
          <SiteName :site-id="item" tag="span" />
          <span class="ml-1 text-caption text-medium-emphasis ptd-num">
            ({{ siteResultCountMap.get(item) ?? 0 }})
          </span>
        </template>
      </FilterChips>
    </div>

    <!-- 已选种子统计徽章 -->
    <div class="d-flex align-center flex-wrap ga-2 ptd-num">
      <v-chip class="chip_limit_width" color="primary" size="small" variant="tonal">
        <v-icon icon="mdi-checkbox-marked-circle" start />
        {{
          display.smAndDown.value
            ? selectedTorrentsInfo.count
            : t("SearchEntity.index.selectedTorrents", [selectedTorrentsInfo.count])
        }}
        <v-divider class="mx-2" vertical />
        <v-icon icon="mdi-harddisk" start />
        {{ formatSize(selectedTorrentsInfo.totalSize) }}
        <template v-if="showBillableSize && selectedTorrentsInfo.billableSize !== selectedTorrentsInfo.totalSize">
          <v-divider class="mx-2" vertical />
          <v-icon icon="mdi-download" start />
          <span :title="t('SearchEntity.index.billableSizeHint')">
            {{ t("SearchEntity.index.billableSize") }}: {{ formatSize(selectedTorrentsInfo.billableSize) }}
          </span>
        </template>
      </v-chip>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.chip_limit_width {
  min-width: fit-content;
}
</style>
