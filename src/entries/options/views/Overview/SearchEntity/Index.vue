<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { useDisplay, type DataTableHeader } from "vuetify";
import { EResultParseStatus, ETorrentStatus, getTorrentVolumeFactors, promotionToTags } from "@ptd/site";

import { useMetadataStore } from "@/options/stores/metadata.ts";
import { useConfigStore } from "@/options/stores/config.ts";
import { useRuntimeStore } from "@/options/stores/runtime.ts";
import { useTableColumnFit } from "@/options/directives/useTableColumnFit.ts";
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

// 主要助手方法
import { tableCustomFilter } from "./utils/filter";
import { doSearch, retrySearch, searchPlanStatus, searchQueue } from "./utils/search";

const { t } = useI18n();
const route = useRoute();
const configStore = useConfigStore();
const metadataStore = useMetadataStore();
const runtimeStore = useRuntimeStore();
const display = useDisplay();

const showAdvanceFilterGenerateDialog = ref<boolean>(false);
const showSearchStatusDialog = ref<boolean>(false);

/** 优惠信息的展示形式：tags（默认，仅标签）/ factor / both / none（不显示），见 SetBase → 搜索 */
const promotionDisplay = computed<"tags" | "factor" | "both" | "none">(() => {
  const value = configStore.searchEntifyControl.promotionDisplay;
  return value === "factor" || value === "both" || value === "none" ? value : "tags";
});
const showPromoColumn = computed(() => promotionDisplay.value === "factor" || promotionDisplay.value === "both");

const fullTableHeader = computed(
  () =>
    [
      { title: t("common.site"), key: "site", align: "center", width: 84, props: { disabled: true } },
      {
        title: t("SearchEntity.index.table.title"),
        key: "title",
        align: "start",
        minWidth: "240px",
        ...(display.smAndDown.value ? { maxWidth: "40vw" } : {}),
        props: { disabled: true },
      },
      { title: t("SearchEntity.index.table.category"), key: "category", align: "center", width: 92 },
      ...(showPromoColumn.value
        ? [
            {
              title: t("SearchEntity.index.table.downloadVolumeFactor"),
              key: "downloadVolumeFactor",
              align: "center",
              width: 88,
              sortRaw: promoSortRaw,
            },
          ]
        : []),
      { title: t("SearchEntity.index.table.size"), key: "size", align: "end", width: 92 },
      { title: t("SearchEntity.index.table.seeders"), key: "seeders", align: "end", width: 68 },
      { title: t("SearchEntity.index.table.leechers"), key: "leechers", align: "end", width: 68 },
      { title: t("SearchEntity.index.table.completed"), key: "completed", align: "end", width: 68 },
      { title: t("SearchEntity.index.table.comments"), key: "comments", align: "end", width: 68 },
      { title: t("SearchEntity.index.table.time"), key: "time", align: "center", width: 110 },
      {
        title: t("common.action"),
        key: "action",
        align: "center",
        width: 120,
        sortable: false,
        props: { disabled: true },
      },
    ] as (DataTableHeader & { props?: any })[],
);
const tableHeader = computed(() => {
  return fullTableHeader.value.filter(
    (item) => item?.props?.disabled || configStore.tableBehavior.SearchEntity.columns!.includes(item.key!),
  ) as DataTableHeader[];
});

/**
 * 优惠信息展示形式与列配置同步：切到 factor / both 时自动勾选「优惠」列，
 * 切回 tags 时取消（顺带清理旧版本残留在列配置里的 key）。
 * 只监听模式变化，这样用户在 factor 模式下仍可在列选择器里手动取消该列。
 */
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

const { tableFilterRef, tableWaitFilterRef, tableFilterFn, buildAdvanceItemPropsFn, buildFilterDictFn } =
  tableCustomFilter;

// 使用 shallowRef 优化：种子对象数组不需要深度响应式，提升性能
const tableSelectedRaw = shallowRef<ISearchResultTorrent[]>([]);

watch(
  () => route.query,
  (newParams, oldParams) => {
    if (
      newParams.flush ||
      (newParams.search && newParams.search != oldParams?.search) ||
      (newParams.plan && newParams.plan != oldParams?.plan)
    ) {
      // 清理已选择项 （ #622 ）
      tableSelectedRaw.value = [];
      // doSearch 会自动处理过滤器重置
      doSearch((newParams.search as string) ?? "", (newParams.plan as string) ?? "default", true);
    }
  },
  { immediate: true, deep: true },
);

const isSearchingParsed = ref<boolean>(searchQueue.isPaused);

function pauseSearchQueue() {
  console.log("pauseSearchQueue", searchQueue);
  searchQueue.pause();
  isSearchingParsed.value = true;
}

function startSearchQueue() {
  console.log("startSearchQueue", searchQueue);
  searchQueue.start();
  isSearchingParsed.value = false;
}

function cancelSearchQueue() {
  console.log("cancelSearchQueue", searchQueue);
  searchQueue.clear(); // 清空搜索队列
  // 将搜索队列中状态设置为跳过
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

const tableNonBooleanControlKey = ["maxTagCountBeforeGroup", "hiddenTagNames", "promotionDisplay"];

// 过滤出表格控制中非布尔类型的键
const filteredTableBooleanControlKeys = computed(() => {
  return Object.keys(configStore.searchEntifyControl).filter(
    (key) => tableNonBooleanControlKey.indexOf(key) === -1,
  ) as (keyof typeof configStore.searchEntifyControl)[];
});

const hiddenTagNamesText = computed({
  get: () => configStore.searchEntifyControl.hiddenTagNames.join("\n"),
  set: (val: string) => {
    configStore.searchEntifyControl.hiddenTagNames = val
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  },
});

// 相同大小种子分组色条（ #1411 ），len 为 8，按 size 升序循环，保证相邻分组不同色
const sizeGroupPalette = ["#F44336", "#2196F3", "#4CAF50", "#FF9800", "#9C27B0", "#00BCD4", "#8BC34A", "#795548"];

// sizeKey 以表格中实际展示的大小文本为准：web 解析出的 1.02 GiB 与 API 给出的 bytes 只要展示一致就会同组
const getSizeKey = (size?: number) => (size ? String(formatSize(size)) : "");

const sizeGroupColors = computed(() => {
  const colors = new Map<string, string>();
  const sortBy = configStore.tableBehavior.SearchEntity.sortBy;

  // 仅在开启开关且当前按大小排序时生效
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

  // 按 size 升序编号（仅在 count > 1 时才画出色条）
  [...groups.entries()]
    .sort(([, a], [, b]) => a.size - b.size)
    .forEach(([key, { count }], index) => {
      if (count > 1) colors.set(key, sizeGroupPalette[index % sizeGroupPalette.length]!);
    });

  return colors;
});

function sizeGroupRowProps({ item }: { item: ISearchResultTorrent }) {
  const color = sizeGroupColors.value.get(getSizeKey(item.size));
  return color ? { style: { "--ptd-size-group-color": color } } : {};
}

/**
 * 缓存每个种子的量系数：promoSortRaw 在排序时会被调用 O(n log n) 次，
 * 若每次都从 tags 反推（每条标签要跑一遍预定义正则），上万条结果时会直接把界面卡死。
 */
const volumeFactorCache = new WeakMap<ISearchResultTorrent, ReturnType<typeof getTorrentVolumeFactors>>();

function getCachedVolumeFactors(item: ISearchResultTorrent) {
  let factors = volumeFactorCache.get(item);
  if (!factors) {
    factors = getTorrentVolumeFactors(item);
    volumeFactorCache.set(item, factors);
  }
  return factors;
}

/**
 * 优惠列的排序：下载系数升序（免费在前），同系数时上传倍数高的在前。
 * 只有上传倍率、没有下载折扣的种子按「正常下载」参与排序（不能当成未知排到最后）。
 */
function promoSortRaw(a: ISearchResultTorrent, b: ISearchResultTorrent): number {
  const factorsA = getCachedVolumeFactors(a);
  const factorsB = getCachedVolumeFactors(b);

  const downloadA =
    factorsA.downloadVolumeFactor ??
    (factorsA.uploadVolumeFactor !== undefined && factorsA.uploadVolumeFactor !== 1 ? 1 : Number.POSITIVE_INFINITY);
  const downloadB =
    factorsB.downloadVolumeFactor ??
    (factorsB.uploadVolumeFactor !== undefined && factorsB.uploadVolumeFactor !== 1 ? 1 : Number.POSITIVE_INFINITY);

  if (downloadA !== downloadB) return downloadA - downloadB;

  return (factorsB.uploadVolumeFactor ?? 1) - (factorsA.uploadVolumeFactor ?? 1);
}

/**
 * 优惠列展示：与标签使用同一套「因子 → 标签」规则（promotionToTags）。
 * 这样只有上传倍率的种子（如 2xUp）也会显示出来，而不是被当成「无优惠」显示 -。
 */
function promoCellText(item: ISearchResultTorrent): string {
  const { downloadVolumeFactor, uploadVolumeFactor } = getCachedVolumeFactors(item);
  if (downloadVolumeFactor === undefined && uploadVolumeFactor === undefined) return "-";

  const text = promotionToTags(downloadVolumeFactor, uploadVolumeFactor)
    .map((tag) => tag.name)
    .join(" · ");
  return text || "-";
}

const { tableRef: fitTableRef, fittedHeaders, tableClass: fitTableClass } = useTableColumnFit(tableHeader);
</script>

<template>
  <v-card>
    <!-- 一体化状态与工具头 -->
    <div class="pa-4 border-b">
      <div class="d-flex flex-wrap align-center justify-space-between ga-2 mb-3">
        <div class="d-flex flex-wrap align-center ga-2 text-body-2">
          <template v-if="runtimeStore.search.startAt === 0">
            <span class="text-medium-emphasis">{{ t("SearchEntity.index.alert.enterKeyword") }}</span>
          </template>
          <template v-else>
            <v-chip color="primary" size="small" variant="tonal" label>
              {{ metadataStore.getSearchSolutionName(runtimeStore.search.searchPlanKey) }}
            </v-chip>
            <span v-if="runtimeStore.search.searchKey" class="font-weight-semibold">
              “{{ runtimeStore.search.searchKey }}”
            </span>
            <span v-if="runtimeStore.search.isSearching" class="text-primary font-weight-medium">
              {{
                isSearchingParsed
                  ? t("SearchEntity.index.alert.paused")
                  : runtimeStore.search.searchResult.length > 0
                    ? t("SearchEntity.index.alert.searchProgress", [runtimeStore.search.searchResult.length])
                    : t("SearchEntity.index.alert.searching")
              }}
            </span>
            <span v-else class="text-medium-emphasis ptd-num">
              {{ t("SearchEntity.index.alert.results", [runtimeStore.search.searchResult.length]) }}
              {{ t("SearchEntity.index.alert.duration", [(runtimeStore.searchCostTime / 1000).toFixed(1)]) }}
            </span>
          </template>
        </div>

        <v-btn
          v-if="runtimeStore.search.startAt > 0"
          :title="t('SearchEntity.index.alert.searchStatus')"
          class="status-btn ptd-num"
          color="secondary"
          size="small"
          variant="tonal"
          @click="showSearchStatusDialog = true"
        >
          <span class="d-inline-flex align-center ga-1 text-success">
            <v-icon icon="mdi-check" size="14" />{{ searchPlanStatus.success }}
          </span>
          <span v-if="searchPlanStatus.error > 0" class="d-inline-flex align-center ga-1 text-warning ml-2">
            <v-icon icon="mdi-alert" size="14" />{{ searchPlanStatus.error }}
          </span>
          <span v-if="searchPlanStatus.queued > 0" class="d-inline-flex align-center ga-1 text-medium-emphasis ml-2">
            <v-icon icon="mdi-clock" size="14" />{{ searchPlanStatus.queued }}
          </span>
        </v-btn>
      </div>

      <div class="d-flex flex-wrap align-center ga-2">
        <v-btn-group density="compact" variant="tonal">
          <v-btn
            v-show="isSearchingParsed"
            :title="t('SearchEntity.index.action.start')"
            color="success"
            icon="mdi-play"
            @click="() => startSearchQueue()"
          />
          <v-btn
            v-show="!isSearchingParsed"
            :title="t('SearchEntity.index.action.pause')"
            color="success"
            icon="mdi-pause"
            @click="() => pauseSearchQueue()"
          />

          <v-btn
            v-show="runtimeStore.search.isSearching"
            :title="t('SearchEntity.index.action.cancel')"
            color="error"
            icon="mdi-cancel"
            @click="cancelSearchQueue"
          />
          <v-btn
            v-show="!runtimeStore.search.isSearching"
            :disabled="isSearchingParsed"
            :title="t('SearchEntity.index.action.retry')"
            color="primary"
            icon="mdi-sync"
            @click="() => doSearch(null as unknown as string, null as unknown as string, true)"
          />

          <v-btn
            :disabled="searchPlanStatus.error === 0"
            :title="t('SearchEntity.index.action.retryFailed')"
            color="warning"
            icon="mdi-sync-alert"
            @click="() => retrySearch()"
          />
        </v-btn-group>

        <v-divider vertical />

        <ActionTd :torrent-items="tableSelectedRaw" />

        <v-divider vertical />

        <v-menu :close-on-content-click="false">
          <template v-slot:activator="{ props }">
            <v-btn-group variant="text">
              <v-btn
                :title="t('SearchEntity.index.action.displayPreferences')"
                color="blue"
                icon="mdi-cog"
                v-bind="props"
              />
            </v-btn-group>
          </template>
          <v-list>
            <v-list-item v-for="item in filteredTableBooleanControlKeys" :key="item" :value="item">
              <template v-slot:prepend>
                <v-list-item-action start class="ml-2">
                  <v-switch
                    v-model="configStore.searchEntifyControl[item]"
                    :label="`&nbsp;${t('SearchEntity.index.' + item)}`"
                    color="success"
                    density="compact"
                    hide-details
                    @click.stop
                    @update:model-value="() => configStore.$save()"
                  />
                </v-list-item-action>
              </template>
            </v-list-item>
            <v-list-item v-if="configStore.searchEntifyControl.showTorrentTag" class="mt-2">
              <v-textarea
                v-model="hiddenTagNamesText"
                :label="t('SetBase.searchEntity.hiddenTagNames')"
                hide-details
                clearable
                rows="5"
              />
            </v-list-item>
          </v-list>
        </v-menu>

        <v-combobox
          v-model="configStore.tableBehavior.SearchEntity.columns"
          :items="fullTableHeader"
          :return-object="false"
          chips
          class="table-header-filter-clear ml-1"
          density="compact"
          hide-details
          item-value="key"
          max-width="180"
          multiple
          prepend-inner-icon="mdi-filter-cog"
          @update:model-value="(v) => configStore.updateTableBehavior('SearchEntity', 'columns', v)"
        >
          <template #chip="{ item, index }">
            <v-chip v-if="index === 0">
              <span>{{ item.title }}</span>
            </v-chip>
            <span v-if="index === 1" class="text-grey text-body-small">
              (+{{ configStore.tableBehavior.SearchEntity.columns!.length - 1 }})
            </span>
          </template>
        </v-combobox>

        <v-spacer />
        <v-text-field
          v-model="tableWaitFilterRef"
          append-icon="mdi-magnify"
          clearable
          density="compact"
          hide-details
          :label="t('SearchEntity.index.filterLabel')"
          max-width="500"
          prepend-inner-icon="mdi-filter"
          single-line
          @click:prepend-inner="showAdvanceFilterGenerateDialog = true"
          @update:model-value="(val) => buildFilterDictFn(val)"
        />
      </div>
    </div>
    <v-card-text class="pt-2 pb-0">
      <!-- 站点筛选器、已选种子等提示信息 -->
      <QuickFilterNotice :selected-torrents="tableSelectedRaw" />

      <v-data-table
        ref="fitTableRef"
        :class="fitTableClass"
        id="ptd-search-entity-table"
        v-model="tableSelectedRaw"
        :custom-filter="tableFilterFn"
        :filter-keys="['uniqueId'] /* 对每个item值只检索一次 */"
        :headers="fittedHeaders"
        :items="runtimeStore.search.searchResult"
        :items-per-page="configStore.tableBehavior.SearchEntity.itemsPerPage"
        :search="tableFilterRef"
        :sort-by="configStore.tableBehavior.SearchEntity.sortBy"
        class="search-entity-table table-stripe table-header-no-wrap"
        hover
        item-value="uniqueId"
        :multi-sort="configStore.enableTableMultiSort"
        :row-props="sizeGroupRowProps"
        show-select
        return-object
        @update:itemsPerPage="(v) => configStore.updateTableBehavior('SearchEntity', 'itemsPerPage', v)"
        @update:sortBy="(v) => configStore.updateTableBehavior('SearchEntity', 'sortBy', v)"
      >
        <!-- 站点图标与名称 -->
        <template #item.site="{ item }">
          <div
            class="d-flex flex-column align-center ga-1"
            :title="item.solutionId ? `${item.site} (${item.solutionId})` : item.site"
          >
            <SiteFavicon :site-id="item.site" :size="configStore.searchEntifyControl.showSiteName ? 18 : 22" />
            <SiteName v-if="configStore.searchEntifyControl.showSiteName" :site-id="item.site" class="text-caption" />
          </div>
        </template>

        <!-- 主标题，副标题，优惠及标签 -->
        <template #item.title="{ item }">
          <TorrentTitleTd :item="item" />
        </template>

        <!-- 分类 -->
        <template #item.category="{ item }">
          <span v-if="item.category" class="text-caption text-no-wrap">{{ item.category }}</span>
          <span v-else class="text-disabled">-</span>
        </template>

        <!-- 优惠（下载量系数），默认隐藏，勾选后可按优惠排序 -->
        <template #item.downloadVolumeFactor="{ item }">
          <span class="text-no-wrap" :class="promoCellText(item) === '-' ? 'text-disabled' : ''">
            {{ promoCellText(item) }}
          </span>
        </template>

        <!-- 种子大小，下载情况 -->
        <template #item.size="{ item }">
          <div class="d-flex flex-column align-end ptd-num">
            <span v-if="typeof item.size === 'number'" class="t_size text-no-wrap">{{ formatSize(item.size) }}</span>
            <span v-else class="text-disabled">-</span>
            <TorrentProcessTd
              v-if="item.status && (item.status as ETorrentStatus) !== ETorrentStatus.unknown"
              :torrent="item"
            />
          </div>
        </template>

        <!-- 上传人数 -->
        <template #item.seeders="{ item }">
          <span
            v-if="typeof item.seeders === 'number'"
            :class="[
              't_seeders text-no-wrap ptd-num',
              item.seeders > 0 ? 'text-success font-weight-semibold' : 'text-disabled',
            ]"
          >
            {{ item.seeders }}
          </span>
          <span v-else class="text-disabled">-</span>
        </template>

        <!-- 下载人数 -->
        <template #item.leechers="{ item }">
          <span v-if="typeof item.leechers === 'number'" class="t_leechers text-no-wrap ptd-num">
            {{ item.leechers }}
          </span>
          <span v-else class="text-disabled">-</span>
        </template>

        <!-- 完成人数 -->
        <template #item.completed="{ item }">
          <span v-if="typeof item.completed === 'number'" class="t_completed text-no-wrap ptd-num">
            {{ item.completed }}
          </span>
          <span v-else class="text-disabled">-</span>
        </template>

        <!-- 评论人数 -->
        <template #item.comments="{ item }">
          <span v-if="typeof item.comments === 'number'" class="t_comments text-no-wrap ptd-num">
            {{ item.comments }}
          </span>
          <span v-else class="text-disabled">-</span>
        </template>

        <!-- 发布日期 -->
        <template #item.time="{ item }">
          <span v-if="item.time" class="t_time text-no-wrap ptd-num" :title="formatDate(item.time) as string">
            {{
              configStore.searchEntifyControl.uploadAtFormatAsAlive ? formatTimeAgo(item.time) : formatDate(item.time)
            }}
          </span>
          <span v-else class="text-disabled">-</span>
        </template>

        <!-- 其他操作 -->
        <template #item.action="{ item }">
          <ActionTd :torrent-items="[item]" density="compact" />
        </template>

        <!-- 空状态与筛选无结果提示 -->
        <template #no-data>
          <div class="py-10 text-center">
            <template v-if="runtimeStore.search.startAt === 0">
              <v-icon icon="mdi-magnify" size="36" color="medium-emphasis" class="mb-2" />
              <div class="text-body-2 text-medium-emphasis">{{ t("SearchEntity.index.alert.enterKeyword") }}</div>
            </template>
            <template v-else-if="runtimeStore.search.isSearching">
              <v-progress-circular indeterminate color="primary" size="28" width="3" class="mb-2" />
              <div class="text-body-2 text-medium-emphasis">{{ t("SearchEntity.index.alert.searching") }}</div>
            </template>
            <template v-else-if="runtimeStore.search.searchResult.length > 0 && tableFilterRef">
              <v-icon icon="mdi-filter-off-outline" size="36" color="warning" class="mb-2" />
              <div class="text-body-2 text-medium-emphasis mb-3">
                {{ t("SearchEntity.index.emptyFiltered", [runtimeStore.search.searchResult.length]) }}
              </div>
              <v-btn
                color="primary"
                size="small"
                variant="tonal"
                prepend-icon="mdi-filter-remove"
                @click="buildFilterDictFn('')"
              >
                {{ t("SearchEntity.index.clearFilter") }}
              </v-btn>
            </template>
            <template v-else>
              <v-icon icon="mdi-database-search-outline" size="36" color="medium-emphasis" class="mb-2" />
              <div class="text-body-2 text-medium-emphasis">{{ t("SearchEntity.index.emptyResult") }}</div>
            </template>
          </div>
        </template>
      </v-data-table>
    </v-card-text>
  </v-card>

  <AdvanceFilterGenerateDialog v-model="showAdvanceFilterGenerateDialog" />
  <SearchStatusDialog v-model="showSearchStatusDialog" />
</template>

<style scoped lang="scss">
#ptd-search-entity-table {
  :deep(td.v-data-table__td),
  :deep(th.v-data-table__th) {
    padding: 8px 6px;
  }

  /* 相同大小种子的分组色条（ #1411 ），颜色由 row-props 写入的 --ptd-size-group-color 提供 */
  :deep(td.v-data-table__td--select-row) {
    position: relative;

    &::before {
      content: "";
      position: absolute;
      top: 4px;
      bottom: 4px;
      left: 1px;
      width: 3px;
      border-radius: 2px;
      background-color: var(--ptd-size-group-color, transparent);
    }
  }
}
</style>
