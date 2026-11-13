<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { EResultParseStatus, ETorrentStatus, getTorrentVolumeFactors, promotionToTags } from "@ptd/site";
import {
  AlertTriangle,
  Ban,
  Check,
  Columns3,
  Database,
  Filter,
  FilterX,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  X,
} from "lucide-vue-next";

import { cn } from "~/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardContent,
  DataTable,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuExtra,
  DropdownMenuTrigger,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Switch,
  Textarea,
  Tooltip,
  type DataTableColumn,
  type DataTableSortItem,
} from "~/components/ui";

import { useMetadataStore } from "@/options/stores/metadata.ts";
import { useConfigStore } from "@/options/stores/config.ts";
import { useRuntimeStore } from "@/options/stores/runtime.ts";
import { formatDate, formatSize, formatTimeAgo } from "@/options/utils.ts";
import type { ISearchResultTorrent } from "@/shared/types.ts";

import SiteName from "@/options/components/SiteName.vue";
import SiteFavicon from "@/options/components/SiteFavicon/Index.vue";
import TorrentTitleTd from "@/options/components/TorrentTitleTd.vue";

import ActionTd from "./ActionTd.vue";
import TorrentProcessTd from "./TorrentProcessTd.vue";
import QuickFilterNotice from "./QuickFilterNotice.vue";
import SearchStatusDialog from "./SearchStatusDialog.vue";
import AdvanceFilterGenerateDialog from "./AdvanceFilterGenerateDialog.vue";

import { tableCustomFilter } from "./utils/filter";
import { doSearch, retrySearch, searchPlanStatus, searchQueue } from "./utils/search";

const { t } = useI18n();
const route = useRoute();
const configStore = useConfigStore();
const metadataStore = useMetadataStore();
const runtimeStore = useRuntimeStore();

const showAdvanceFilterGenerateDialog = ref<boolean>(false);
const showSearchStatusDialog = ref<boolean>(false);

/** 优惠信息的展示形式：tags（默认，仅标签）/ factor / both / none（不显示） */
const promotionDisplay = computed<"tags" | "factor" | "both" | "none">({
  get() {
    const value = configStore.searchEntifyControl.promotionDisplay;
    return value === "factor" || value === "both" || value === "none" ? value : "tags";
  },
  set(val) {
    configStore.searchEntifyControl.promotionDisplay = val;
    configStore.$save();
  },
});
const showPromoColumn = computed(() => promotionDisplay.value === "factor" || promotionDisplay.value === "both");

interface SearchTableColumn extends DataTableColumn<ISearchResultTorrent> {
  required?: boolean;
}

const fullTableHeader = computed<SearchTableColumn[]>(() => [
  {
    title: t("common.site"),
    key: "site",
    align: "start",
    width: 116,
    required: true,
  },
  {
    title: t("SearchEntity.index.table.title"),
    key: "title",
    align: "start",
    minWidth: "260px",
    required: true,
  },
  {
    title: t("SearchEntity.index.table.category"),
    key: "category",
    align: "center",
    width: 96,
  },
  ...(showPromoColumn.value
    ? [
        {
          title: t("SearchEntity.index.table.downloadVolumeFactor"),
          key: "downloadVolumeFactor",
          align: "center" as const,
          width: 92,
          sortValue: promoSortValue,
        },
      ]
    : []),
  {
    title: t("SearchEntity.index.table.size"),
    key: "size",
    align: "end",
    width: 100,
  },
  {
    title: t("SearchEntity.index.table.seeders"),
    key: "seeders",
    align: "end",
    width: 74,
  },
  {
    title: t("SearchEntity.index.table.leechers"),
    key: "leechers",
    align: "end",
    width: 74,
  },
  {
    title: t("SearchEntity.index.table.completed"),
    key: "completed",
    align: "end",
    width: 74,
  },
  {
    title: t("SearchEntity.index.table.comments"),
    key: "comments",
    align: "end",
    width: 74,
  },
  {
    title: t("SearchEntity.index.table.time"),
    key: "time",
    align: "center",
    width: 116,
  },
  {
    title: t("common.action"),
    key: "action",
    align: "center",
    width: 120,
    sortable: false,
    required: true,
  },
]);

const visibleColumns = computed<string[]>(() => configStore.tableBehavior.SearchEntity.columns ?? []);

const tableHeader = computed<DataTableColumn<ISearchResultTorrent>[]>(() =>
  fullTableHeader.value.filter((item) => item.required || visibleColumns.value.includes(item.key)),
);

function isColumnVisible(key: string): boolean {
  return visibleColumns.value.includes(key);
}

function toggleColumn(key: string, checked: boolean | "indeterminate") {
  const current = [...visibleColumns.value];
  const next =
    checked === true ? (current.includes(key) ? current : [...current, key]) : current.filter((k) => k !== key);
  configStore.updateTableBehavior("SearchEntity", "columns", next);
}

/** 优惠信息展示形式与列配置同步 */
watch(
  showPromoColumn,
  (enabled, oldEnabled) => {
    if (enabled === oldEnabled) return;

    const columns = configStore.tableBehavior.SearchEntity.columns ?? [];
    const hasPromoColumn = columns.includes("downloadVolumeFactor");
    if (enabled && !hasPromoColumn) {
      configStore.updateTableBehavior("SearchEntity", "columns", [...columns, "downloadVolumeFactor"]);
    } else if (!enabled && hasPromoColumn) {
      configStore.updateTableBehavior(
        "SearchEntity",
        "columns",
        columns.filter((key) => key !== "downloadVolumeFactor"),
      );
    }
  },
  { immediate: true },
);

const { tableFilterRef, tableWaitFilterRef, tableFilterFn, buildFilterDictFn } = tableCustomFilter;

const selectedIds = ref<string[]>([]);
const tableSelectedItems = computed<ISearchResultTorrent[]>(() => {
  if (selectedIds.value.length === 0) return [];
  const selectedSet = new Set(selectedIds.value);
  return runtimeStore.search.searchResult.filter((item) => selectedSet.has(item.uniqueId));
});

const searchSortBy = computed<DataTableSortItem[]>({
  get: () => (configStore.tableBehavior.SearchEntity.sortBy as DataTableSortItem[]) ?? [],
  set: (v) => configStore.updateTableBehavior("SearchEntity", "sortBy", v),
});

const searchItemsPerPage = computed<number>({
  get: () => configStore.tableBehavior.SearchEntity.itemsPerPage ?? 50,
  set: (v) => configStore.updateTableBehavior("SearchEntity", "itemsPerPage", v),
});

watch(
  () => route.query,
  (newParams, oldParams) => {
    if (
      newParams.flush ||
      (newParams.search && newParams.search != oldParams?.search) ||
      (newParams.plan && newParams.plan != oldParams?.plan)
    ) {
      selectedIds.value = [];
      doSearch((newParams.search as string) ?? "", (newParams.plan as string) ?? "default", true);
    }
  },
  { immediate: true, deep: true },
);

const isSearchingParsed = ref<boolean>(searchQueue.isPaused);

function pauseSearchQueue() {
  searchQueue.pause();
  isSearchingParsed.value = true;
}

function startSearchQueue() {
  searchQueue.start();
  isSearchingParsed.value = false;
}

function cancelSearchQueue() {
  searchQueue.clear();
  for (const key of Object.keys(runtimeStore.search.searchPlan)) {
    // @ts-ignore
    if (runtimeStore.search.searchPlan[key]!.status === EResultParseStatus.waiting) {
      // @ts-ignore
      runtimeStore.search.searchPlan[key]!.status = EResultParseStatus.passParse;
      // @ts-ignore
      runtimeStore.search.searchPlan[key]!.statusMsg = "i18n.userCancel";
    }
  }

  runtimeStore.search.isSearching = false;
}

type TSearchEntityBooleanControlKey =
  | "showSiteName"
  | "showTorrentTag"
  | "showTorrentSubtitle"
  | "showTorrentCover"
  | "uploadAtFormatAsAlive"
  | "highlightSameSizeTorrent";

const filteredTableBooleanControlKeys: TSearchEntityBooleanControlKey[] = [
  "showSiteName",
  "showTorrentTag",
  "showTorrentSubtitle",
  "showTorrentCover",
  "uploadAtFormatAsAlive",
  "highlightSameSizeTorrent",
];

const hiddenTagNamesText = computed({
  get: () => configStore.searchEntifyControl.hiddenTagNames.join("\n"),
  set: (val: string) => {
    configStore.searchEntifyControl.hiddenTagNames = val
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    configStore.$save();
  },
});

// 相同大小种子分组色条
const sizeGroupPalette = ["#EF4444", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#06B6D4", "#84CC16", "#A16207"];

const getSizeKey = (size?: number) => (size ? String(formatSize(size)) : "");

const sizeGroupColors = computed(() => {
  const colors = new Map<string, string>();
  const sortBy = configStore.tableBehavior.SearchEntity.sortBy;

  if (!configStore.searchEntifyControl.highlightSameSizeTorrent || !sortBy?.some((item) => item.key === "size")) {
    return colors;
  }

  const groups = new Map<string, { size: number; count: number }>();
  for (const item of runtimeStore.search.searchResult) {
    if (!item.size) continue;
    const key = getSizeKey(item.size);
    const group = groups.get(key);
    if (group) {
      group.count++;
    } else {
      groups.set(key, { size: item.size, count: 1 });
    }
  }

  [...groups.entries()]
    .sort(([, a], [, b]) => a.size - b.size)
    .forEach(([key, { count }], index) => {
      if (count > 1) colors.set(key, sizeGroupPalette[index % sizeGroupPalette.length]!);
    });

  return colors;
});

function sizeGroupRowStyle(item: ISearchResultTorrent): Record<string, string> | undefined {
  const color = sizeGroupColors.value.get(getSizeKey(item.size));
  return color ? { boxShadow: `inset 3px 0 0 ${color}` } : undefined;
}

const volumeFactorCache = new WeakMap<ISearchResultTorrent, ReturnType<typeof getTorrentVolumeFactors>>();

function getCachedVolumeFactors(item: ISearchResultTorrent) {
  let factors = volumeFactorCache.get(item);
  if (!factors) {
    factors = getTorrentVolumeFactors(item);
    volumeFactorCache.set(item, factors);
  }
  return factors;
}

/** 优惠列排序值：下载系数升序（免费在前），同系数时上传倍数高的在前 */
function promoSortValue(item: ISearchResultTorrent): number {
  const factors = getCachedVolumeFactors(item);
  const download =
    factors.downloadVolumeFactor ??
    (factors.uploadVolumeFactor !== undefined && factors.uploadVolumeFactor !== 1 ? 1 : 999);
  const upload = factors.uploadVolumeFactor ?? 1;
  return download * 1000 - upload;
}

function promoCellText(item: ISearchResultTorrent): string {
  const { downloadVolumeFactor, uploadVolumeFactor } = getCachedVolumeFactors(item);
  if (downloadVolumeFactor === undefined && uploadVolumeFactor === undefined) return "-";

  const text = promotionToTags(downloadVolumeFactor, uploadVolumeFactor)
    .map((tag) => tag.name)
    .join(" · ");
  return text || "-";
}

function onFilterInput(val: string | number) {
  const str = String(val ?? "");
  tableWaitFilterRef.value = str;
  buildFilterDictFn(str);
}

function clearAllFilters() {
  tableWaitFilterRef.value = "";
  buildFilterDictFn("");
}

const hasActiveFilter = computed(() => Boolean((tableFilterRef.value ?? "").trim()));
</script>

<template>
  <Card class="overflow-hidden">
    <!-- 顶部紧凑搜索控制台 -->
    <div class="border-b border-border bg-card px-4 py-3">
      <!-- 状态摘要与站点并发监控胶囊 -->
      <div class="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div class="flex flex-wrap items-center gap-2 text-sm">
          <template v-if="runtimeStore.search.startAt === 0">
            <span class="text-xs text-muted-foreground">{{ t("SearchEntity.index.alert.enterKeyword") }}</span>
          </template>
          <template v-else>
            <Badge variant="secondary" class="border-primary/25 bg-primary/10 text-primary">
              {{ metadataStore.getSearchSolutionName(runtimeStore.search.searchPlanKey) }}
            </Badge>
            <span v-if="runtimeStore.search.searchKey" class="font-semibold text-foreground">
              “{{ runtimeStore.search.searchKey }}”
            </span>
            <span v-if="runtimeStore.search.isSearching" class="text-xs font-medium text-primary tabular-nums">
              {{
                isSearchingParsed
                  ? t("SearchEntity.index.alert.paused")
                  : runtimeStore.search.searchResult.length > 0
                    ? t("SearchEntity.index.alert.searchProgress", [runtimeStore.search.searchResult.length])
                    : t("SearchEntity.index.alert.searching")
              }}
            </span>
            <span v-else class="text-xs text-muted-foreground tabular-nums">
              {{ t("SearchEntity.index.alert.results", [runtimeStore.search.searchResult.length]) }}
              {{ t("SearchEntity.index.alert.duration", [(runtimeStore.searchCostTime / 1000).toFixed(1)]) }}
            </span>
          </template>
        </div>

        <!-- 站点并发状态胶囊按钮 -->
        <Tooltip v-if="runtimeStore.search.startAt > 0" :content="t('SearchEntity.index.alert.searchStatus')">
          <button
            type="button"
            class="inline-flex h-7 items-center gap-2.5 rounded-full border border-border bg-muted/40 px-3 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-accent tabular-nums"
            @click="showSearchStatusDialog = true"
          >
            <span class="inline-flex items-center gap-1 text-success">
              <span class="size-1.5 rounded-full bg-success" />
              <Check class="size-3" />
              <span>{{ searchPlanStatus.success }}</span>
            </span>

            <span v-if="searchPlanStatus.error > 0" class="inline-flex items-center gap-1 text-warning">
              <span class="size-1.5 rounded-full bg-warning" />
              <AlertTriangle class="size-3" />
              <span>{{ searchPlanStatus.error }}</span>
            </span>

            <span v-if="searchPlanStatus.queued > 0" class="inline-flex items-center gap-1 text-muted-foreground">
              <Loader2 class="size-3 animate-spin text-primary" />
              <span>{{ searchPlanStatus.queued }}</span>
            </span>
          </button>
        </Tooltip>
      </div>

      <!-- 工具操作栏 -->
      <div class="flex flex-wrap items-center gap-2">
        <!-- 队列控制按钮组 -->
        <div
          class="inline-flex items-center divide-x divide-border overflow-hidden rounded-md border border-border bg-background shadow-2xs"
        >
          <Tooltip v-if="isSearchingParsed" :content="t('SearchEntity.index.action.start')">
            <Button
              variant="ghost"
              size="sm"
              class="h-8 rounded-none px-2.5 text-success hover:bg-success/10 hover:text-success"
              @click="() => startSearchQueue()"
            >
              <Play class="size-3.5" />
            </Button>
          </Tooltip>
          <Tooltip v-else :content="t('SearchEntity.index.action.pause')">
            <Button
              variant="ghost"
              size="sm"
              class="h-8 rounded-none px-2.5 text-muted-foreground hover:text-foreground"
              @click="() => pauseSearchQueue()"
            >
              <Pause class="size-3.5" />
            </Button>
          </Tooltip>

          <Tooltip v-if="runtimeStore.search.isSearching" :content="t('SearchEntity.index.action.cancel')">
            <Button
              variant="ghost"
              size="sm"
              class="h-8 rounded-none px-2.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
              @click="cancelSearchQueue"
            >
              <Ban class="size-3.5" />
            </Button>
          </Tooltip>
          <Tooltip v-else :content="t('SearchEntity.index.action.retry')">
            <Button
              variant="ghost"
              size="sm"
              :disabled="isSearchingParsed"
              class="h-8 rounded-none px-2.5 text-muted-foreground hover:text-foreground"
              @click="() => doSearch(null as unknown as string, null as unknown as string, true)"
            >
              <RefreshCw class="size-3.5" />
            </Button>
          </Tooltip>

          <Tooltip :content="t('SearchEntity.index.action.retryFailed')">
            <Button
              variant="ghost"
              size="sm"
              :disabled="searchPlanStatus.error === 0"
              class="h-8 rounded-none px-2.5 text-warning hover:bg-warning/10 hover:text-warning"
              @click="() => retrySearch()"
            >
              <RotateCcw class="size-3.5" />
            </Button>
          </Tooltip>
        </div>

        <!-- 批量操作 -->
        <ActionTd :torrent-items="tableSelectedItems" />

        <!-- 显示偏好 Popover -->
        <Popover>
          <PopoverTrigger as-child>
            <Button
              variant="outline"
              size="sm"
              class="h-8 gap-1.5 px-2.5 text-xs"
              :title="t('SearchEntity.index.action.displayPreferences')"
            >
              <Settings2 class="size-3.5" />
              <span class="hidden lg:inline">偏好</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" class="w-80 p-3.5">
            <div class="mb-2.5 text-xs font-semibold text-foreground">
              {{ t("SearchEntity.index.action.displayPreferences") }}
            </div>

            <div class="flex flex-col gap-2">
              <div
                v-for="item in filteredTableBooleanControlKeys"
                :key="item"
                class="flex items-center justify-between gap-2 rounded-md px-1 py-0.5"
              >
                <span class="text-xs text-foreground">{{ t("SearchEntity.index." + item) }}</span>
                <Switch
                  v-model="configStore.searchEntifyControl[item]"
                  @update:model-value="() => configStore.$save()"
                />
              </div>
            </div>

            <div class="mt-3 border-t border-border pt-3">
              <div class="mb-1.5 text-xs font-medium text-foreground">
                {{ t("SetBase.searchEntity.promotionDisplay") }}
              </div>
              <div class="grid grid-cols-2 gap-1">
                <button
                  v-for="opt in ['tags', 'factor', 'both', 'none'] as const"
                  :key="opt"
                  type="button"
                  :class="
                    cn(
                      'rounded-md border px-2 py-1 text-left text-[11px] transition-colors',
                      promotionDisplay === opt
                        ? 'border-primary bg-primary/10 font-medium text-primary'
                        : 'border-border bg-background text-muted-foreground hover:text-foreground',
                    )
                  "
                  @click="promotionDisplay = opt"
                >
                  {{ t(`SetBase.searchEntity.promotionDisplayOptions.${opt}`) }}
                </button>
              </div>
            </div>

            <div v-if="configStore.searchEntifyControl.showTorrentTag" class="mt-3 border-t border-border pt-3">
              <div class="mb-1.5 text-xs font-medium text-foreground">
                {{ t("SetBase.searchEntity.hiddenTagNames") }}
              </div>
              <Textarea v-model="hiddenTagNamesText" :rows="3" class="text-xs" />
            </div>
          </PopoverContent>
        </Popover>

        <!-- 列显隐控制 DropdownMenu -->
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="outline" size="sm" class="h-8 gap-1.5 px-2.5 text-xs">
              <Columns3 class="size-3.5" />
              <span class="hidden lg:inline">列</span>
              <span class="rounded bg-muted px-1 text-[10px] text-muted-foreground tabular-nums">
                {{ tableHeader.length }}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" class="w-48">
            <DropdownMenuExtra>显示列</DropdownMenuExtra>
            <DropdownMenuExtra type="separator" />
            <DropdownMenuCheckboxItem
              v-for="col in fullTableHeader"
              :key="col.key"
              :disabled="col.required"
              :model-value="col.required || isColumnVisible(col.key)"
              @update:model-value="(v) => toggleColumn(col.key, v)"
            >
              {{ col.title }}
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <!-- 右侧二次过滤与高级筛选 -->
        <div class="ml-auto flex flex-wrap items-center gap-2">
          <div class="relative w-52 sm:w-64 md:w-72">
            <Search
              class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              :model-value="tableWaitFilterRef"
              :placeholder="t('SearchEntity.index.filterLabel')"
              class="h-8 pr-7 pl-8 text-xs"
              @update:model-value="onFilterInput"
            />
            <button
              v-if="tableWaitFilterRef"
              type="button"
              class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              @click="clearAllFilters"
            >
              <X class="size-3.5" />
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            :class="cn('relative h-8 gap-1.5 px-2.5 text-xs', hasActiveFilter && 'border-primary/45 text-primary')"
            :title="t('common.AdvanceFilterGenerateDialog.title')"
            @click="showAdvanceFilterGenerateDialog = true"
          >
            <Filter class="size-3.5" />
            <span class="hidden sm:inline">高级筛选</span>
            <span v-if="hasActiveFilter" class="size-1.5 rounded-full bg-primary" />
          </Button>
        </div>
      </div>
    </div>

    <!-- 主体结果区 -->
    <CardContent class="p-0">
      <QuickFilterNotice
        v-if="
          (configStore.searchEntity.quickSiteFilter && runtimeStore.search.searchResult.length > 0) ||
          tableSelectedItems.length > 0 ||
          hasActiveFilter
        "
        :selected-torrents="tableSelectedItems"
      />

      <DataTable
        v-model:selected="selectedIds"
        v-model:sort-by="searchSortBy"
        v-model:items-per-page="searchItemsPerPage"
        :columns="tableHeader"
        :items="runtimeStore.search.searchResult"
        row-key="uniqueId"
        selectable
        :search="tableFilterRef"
        :filter-keys="['uniqueId']"
        :custom-filter="tableFilterFn"
        :multi-sort="configStore.enableTableMultiSort"
        :sticky-action-column="configStore.tableActionColumnFixed"
        :action-position="configStore.tableActionColumnPosition"
        :row-style="sizeGroupRowStyle"
        :loading="runtimeStore.search.isSearching"
        :page-size-options="[25, 50, 100, 200, -1]"
      >
        <!-- 站点图标与名称 -->
        <template #cell-site="{ item }">
          <div
            :class="
              cn(
                'flex items-center gap-1.5',
                configStore.searchEntifyControl.showSiteName ? 'justify-start' : 'justify-center',
              )
            "
            :title="item.solutionId ? `${item.site} (${item.solutionId})` : item.site"
          >
            <SiteFavicon
              :site-id="item.site"
              :size="configStore.searchEntifyControl.showSiteName ? 16 : 20"
              class="shrink-0"
            />
            <SiteName
              v-if="configStore.searchEntifyControl.showSiteName"
              :site-id="item.site"
              class="text-xs font-medium text-foreground"
            />
          </div>
        </template>

        <!-- 主标题、标签、副标题 -->
        <template #cell-title="{ item }">
          <TorrentTitleTd :item="item" />
        </template>

        <!-- 分类 -->
        <template #cell-category="{ item }">
          <Badge v-if="item.category" variant="secondary" class="whitespace-nowrap font-normal">
            {{ item.category }}
          </Badge>
          <span v-else class="text-xs text-muted-foreground/50">-</span>
        </template>

        <!-- 优惠系数 -->
        <template #cell-downloadVolumeFactor="{ item }">
          <span
            :class="
              cn(
                'whitespace-nowrap text-xs',
                promoCellText(item) === '-' ? 'text-muted-foreground/50' : 'font-medium text-foreground',
              )
            "
          >
            {{ promoCellText(item) }}
          </span>
        </template>

        <!-- 种子大小与下载进度 -->
        <template #cell-size="{ item }">
          <div class="flex flex-col items-end tabular-nums">
            <span v-if="typeof item.size === 'number'" class="whitespace-nowrap text-xs font-medium text-foreground">
              {{ formatSize(item.size) }}
            </span>
            <span v-else class="text-xs text-muted-foreground/50">-</span>
            <TorrentProcessTd
              v-if="item.status && (item.status as ETorrentStatus) !== ETorrentStatus.unknown"
              :torrent="item"
            />
          </div>
        </template>

        <!-- 做种数 -->
        <template #cell-seeders="{ item }">
          <span
            v-if="typeof item.seeders === 'number'"
            :class="
              cn(
                'whitespace-nowrap text-xs tabular-nums',
                item.seeders > 0 ? 'font-semibold text-success' : 'text-muted-foreground/50',
              )
            "
          >
            {{ item.seeders }}
          </span>
          <span v-else class="text-xs text-muted-foreground/50">-</span>
        </template>

        <!-- 下载数 -->
        <template #cell-leechers="{ item }">
          <span v-if="typeof item.leechers === 'number'" class="whitespace-nowrap text-xs text-foreground tabular-nums">
            {{ item.leechers }}
          </span>
          <span v-else class="text-xs text-muted-foreground/50">-</span>
        </template>

        <!-- 完成数 -->
        <template #cell-completed="{ item }">
          <span
            v-if="typeof item.completed === 'number'"
            class="whitespace-nowrap text-xs text-foreground tabular-nums"
          >
            {{ item.completed }}
          </span>
          <span v-else class="text-xs text-muted-foreground/50">-</span>
        </template>

        <!-- 评论数 -->
        <template #cell-comments="{ item }">
          <span v-if="typeof item.comments === 'number'" class="whitespace-nowrap text-xs text-foreground tabular-nums">
            {{ item.comments }}
          </span>
          <span v-else class="text-xs text-muted-foreground/50">-</span>
        </template>

        <!-- 发布时间 -->
        <template #cell-time="{ item }">
          <span
            v-if="item.time"
            class="whitespace-nowrap text-xs text-muted-foreground tabular-nums"
            :title="formatDate(item.time) as string"
          >
            {{
              configStore.searchEntifyControl.uploadAtFormatAsAlive ? formatTimeAgo(item.time) : formatDate(item.time)
            }}
          </span>
          <span v-else class="text-xs text-muted-foreground/50">-</span>
        </template>

        <!-- 行内快捷操作 -->
        <template #cell-action="{ item }">
          <ActionTd :torrent-items="[item]" density="compact" />
        </template>

        <!-- 空状态 -->
        <template #empty>
          <div class="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <template v-if="runtimeStore.search.startAt === 0">
              <Search class="size-9 text-muted-foreground/45" />
              <div class="text-sm text-muted-foreground">{{ t("SearchEntity.index.alert.enterKeyword") }}</div>
            </template>

            <template v-else-if="runtimeStore.search.isSearching">
              <Loader2 class="size-7 animate-spin text-primary" />
              <div class="text-sm text-muted-foreground">{{ t("SearchEntity.index.alert.searching") }}</div>
            </template>

            <template v-else-if="runtimeStore.search.searchResult.length > 0 && hasActiveFilter">
              <FilterX class="size-9 text-warning" />
              <div class="text-sm text-muted-foreground">
                {{ t("SearchEntity.index.emptyFiltered", [runtimeStore.search.searchResult.length]) }}
              </div>
              <Button variant="secondary" size="sm" class="mt-1" @click="clearAllFilters">
                <X class="size-3.5" />
                <span>{{ t("SearchEntity.index.clearFilter") }}</span>
              </Button>
            </template>

            <template v-else>
              <Database class="size-9 text-muted-foreground/45" />
              <div class="text-sm text-muted-foreground">{{ t("SearchEntity.index.emptyResult") }}</div>
            </template>
          </div>
        </template>
      </DataTable>
    </CardContent>
  </Card>

  <AdvanceFilterGenerateDialog v-model="showAdvanceFilterGenerateDialog" />
  <SearchStatusDialog v-model="showSearchStatusDialog" />
</template>
