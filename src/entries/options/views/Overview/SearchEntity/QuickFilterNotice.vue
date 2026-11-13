<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { CheckCircle2, Download, HardDrive } from "lucide-vue-next";

import { getTorrentVolumeFactors } from "@ptd/site";
import { cn } from "~/lib/utils";

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

const { advanceFilterDictRef, advanceItemPropsRef, tableFilterRef, updateTableFilterValueFn } = tableCustomFilter;

// 双向同步 advanceFilterDictRef.site.required（支持单选切换、再次点击取消、Ctrl/Cmd 多选）
const selectedSites = computed<string[]>({
  get: () => advanceFilterDictRef.value.site.required ?? [],
  set: (val: string | string[]) => {
    const arr = Array.isArray(val) ? val : val ? [val] : [];
    advanceFilterDictRef.value.site.required = [...arr];
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

// 直接从当前搜索结果与筛选项合并派生站点列表，按命中结果数降序排列，主力大站自动排在第一屏
const sortedSiteItems = computed<string[]>(() => {
  const counts = siteResultCountMap.value;
  const merged = new Set<string>([...counts.keys(), ...(advanceItemPropsRef.value.site ?? [])]);
  return [...merged].sort((a, b) => {
    const diff = (counts.get(b) ?? 0) - (counts.get(a) ?? 0);
    return diff !== 0 ? diff : a.localeCompare(b);
  });
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
    (configStore.searchEntity.quickSiteFilter && sortedSiteItems.value.length > 0) ||
    selectedTorrents.length > 0 ||
    Boolean(tableFilterRef.value),
);
</script>

<template>
  <div
    v-if="shouldShowNoticeBar"
    class="flex flex-wrap items-start justify-between gap-2.5 border-b border-border/80 bg-muted/15 px-4 py-2"
  >
    <!-- 站点筛选器（按命中条数降序 + 固定全部胶囊 + 无滚动条丝滑横滚 + 一键展开多行平铺） -->
    <div v-if="configStore.searchEntity.quickSiteFilter && sortedSiteItems.length > 0" class="min-w-0 flex-1">
      <FilterChips
        v-model="selectedSites"
        :all-label="t('SearchEntity.siteFilter.all')"
        :all-count="runtimeStore.search.searchResult.length"
        :items="sortedSiteItems"
        :expand-label="t('SearchEntity.siteFilter.expand', [sortedSiteItems.length])"
        :collapse-label="t('SearchEntity.siteFilter.collapse')"
        :hint-text="t('SearchEntity.siteFilter.multiSelectHint')"
      >
        <template #chip="{ item, selected }">
          <SiteFavicon :site-id="item" :size="14" class="shrink-0 rounded-xs" />
          <SiteName :site-id="item" tag="span" class="font-medium" />
          <span
            :class="
              cn(
                'rounded-full px-1.5 py-0.2 text-[10px] leading-4 tabular-nums transition-colors',
                selected ? 'bg-primary text-primary-foreground font-semibold' : 'bg-muted text-muted-foreground',
              )
            "
          >
            {{ siteResultCountMap.get(item) ?? 0 }}
          </span>
        </template>
      </FilterChips>
    </div>

    <!-- 已选种子统计徽章 -->
    <div
      v-if="selectedTorrentsInfo.count > 0"
      class="inline-flex h-7 shrink-0 flex-wrap items-center gap-2 rounded-lg border border-primary/25 bg-primary/8 px-2.5 text-xs font-medium text-primary tabular-nums"
    >
      <span class="inline-flex items-center gap-1">
        <CheckCircle2 class="size-3.5" />
        <span class="sm:hidden">{{ selectedTorrentsInfo.count }}</span>
        <span class="hidden sm:inline">{{
          t("SearchEntity.index.selectedTorrents", [selectedTorrentsInfo.count])
        }}</span>
      </span>

      <span class="h-3 w-px bg-primary/25" />

      <span class="inline-flex items-center gap-1">
        <HardDrive class="size-3.5" />
        <span>{{ formatSize(selectedTorrentsInfo.totalSize) }}</span>
      </span>

      <template v-if="showBillableSize && selectedTorrentsInfo.billableSize !== selectedTorrentsInfo.totalSize">
        <span class="h-3 w-px bg-primary/25" />
        <span class="inline-flex items-center gap-1" :title="t('SearchEntity.index.billableSizeHint')">
          <Download class="size-3.5" />
          <span>{{ t("SearchEntity.index.billableSize") }}: {{ formatSize(selectedTorrentsInfo.billableSize) }}</span>
        </span>
      </template>
    </div>
  </div>
</template>
