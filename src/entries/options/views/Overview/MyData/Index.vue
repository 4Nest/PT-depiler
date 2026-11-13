<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { watchDebounced } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { isUndefined } from "es-toolkit/compat";
import { useDisplay, type DataTableHeader } from "vuetify";
import { EResultParseStatus, type ISiteUserConfig, type IUserInfo, type TSiteID } from "@ptd/site";
import { siteMetadataIndex } from "@ptd/site/metadataIndex";

import { useConfigStore } from "@/options/stores/config.ts";
import { useRuntimeStore } from "@/options/stores/runtime.ts";
import { useMetadataStore } from "@/options/stores/metadata.ts";
import { useTableCustomFilter } from "@/options/directives/useAdvanceFilter.ts";
import { useTableColumnFit } from "@/options/directives/useTableColumnFit.ts";
import { formatDate, formatSize, formatTimeAgo } from "@/options/utils.ts";

import SiteName from "@/options/components/SiteName.vue";
import SiteFavicon from "@/options/components/SiteFavicon/Index.vue";
import ResultParseStatus from "@/options/components/ResultParseStatus.vue";
import NavButton from "@/options/components/NavButton.vue";
import UserLevelRequirementsTd from "./UserLevelRequirementsTd.vue";
import HistoryDataViewDialog from "./HistoryDataViewDialog.vue";
import BonusFormatSpan from "./BonusFormatSpan.vue";
import ExportUserInfoDialog from "./ExportUserInfoDialog.vue";

import { formatRatio } from "./utils/format.ts";
import { tableData, initTableData, cancelFlushSiteLastUserInfo, flushSiteLastUserInfo } from "./utils/lastUserData.ts";

const { t } = useI18n();
const router = useRouter();
const configStore = useConfigStore();
const runtimeStore = useRuntimeStore();
const metadataStore = useMetadataStore();
const display = useDisplay();

// 等级列是否限制宽度：小屏时生效（与搜索结果页的标题列行为一致）。
// 表头 maxWidth 与单元格截断共用此条件，避免出现「限宽不裁剪」或「裁剪不限宽」的错位。
const limitLevelNameTdWidth = computed(() => display.smAndDown.value);

const currentDate = new Date();

type TExtendDataTableHeader = DataTableHeader & { props?: any };

const fullTableHeader = computed(
  () =>
    [
      {
        title: t("common.site"),
        key: "siteUserConfig.sortIndex",
        align: "start",
        props: { disabled: true },
      },
      { title: t("common.username"), key: "name", align: "center" },
      {
        title: t("MyData.table.levelName"),
        key: "levelName",
        align: "start",
        width: "10%",
        ...(limitLevelNameTdWidth.value ? { maxWidth: "32vw" } : {}),
      },
      // NOTE: 这里将key设为 uploaded, trueUploaded 而不是虚拟的 userData，可以让 v-data-table 使用 uploaded 的进行排序
      { title: t("MyData.table.userData"), key: "uploaded", align: "end" },
      { title: t("MyData.table.trueUserData"), key: "trueUploaded", align: "end" }, // 默认不显示
      { title: t("levelRequirement.ratio"), key: "ratio", align: "end" },
      { title: t("levelRequirement.trueRatio"), key: "trueRatio", align: "end" }, // 默认不显示
      { title: t("levelRequirement.uploads"), key: "uploads", align: "end" },
      { title: t("levelRequirement.seeding"), key: "seeding", align: "end" },
      { title: t("levelRequirement.seedingSize"), key: "seedingSize", align: "end" },
      { title: t("levelRequirement.bonus"), key: "bonus", align: "end" },
      { title: t("levelRequirement.bonusPerHour"), key: "bonusPerHour", align: "end" },
      { title: t("MyData.table.invites"), key: "invites", align: "end" }, // 默认不显示
      { title: t("MyData.table.joinTime"), key: "joinTime", align: "center" },
      { title: t("MyData.table.lastAccessAt"), key: "lastAccessAt", align: "center" }, // 默认不显示
      { title: t("MyData.table.updateAt"), key: "updateAt", align: "center" },
      { title: t("common.action"), key: "action", align: "center", sortable: false, props: { disabled: true } },
    ] as TExtendDataTableHeader[],
);

const tableHeader = computed(() => {
  return fullTableHeader.value.filter(
    (item: TExtendDataTableHeader) =>
      item?.props?.disabled || configStore.tableBehavior.MyData.columns!.includes(item.key!),
  ) as DataTableHeader[];
});

const tableNonBooleanControlKey = [
  "joinTimeFormat",
  // Deprecated
  "joinTimeWeekOnly",
];

// 过滤出表格控制中非布尔类型的键
const filteredTableBooleanControlKeys = computed(() => {
  return Object.keys(configStore.myDataTableControl).filter(
    (key) => tableNonBooleanControlKey.indexOf(key) === -1,
  ) as (keyof typeof configStore.myDataTableControl)[];
});

interface IUserInfoItem extends IUserInfo {
  siteUserConfig: ISiteUserConfig;
  siteName: string;
}

const {
  tableWaitFilterRef,
  tableFilterRef,
  tableFilterFn,
  advanceFilterDictRef,
  updateTableFilterValueFn,
  buildFilterDictFn,
  toggleKeywordStateFn,
} = useTableCustomFilter<IUserInfoItem>({
  parseOptions: {
    keywords: ["site", "status", "siteUserConfig.groups"],
    ranges: ["updateAt", "messageCount"],
  },
  titleFields: ["site", "siteName", "name"],
  format: {
    status: "number",
  },
});

const tableSelected = ref<TSiteID[]>([]); // 选中的站点行

// 当前分页展示的站点，由 v-data-table 的 `update:currentItems` 提供（已应用筛选与排序）
// NOTE: 这是 v-data-table 唯一能拿到的「当前结果」钩子，它只包含当前页，参见 #1663
const tableCurrentPageSites = ref<TSiteID[]>([]);
function updateTableCurrentPageSites(items: any[]) {
  tableCurrentPageSites.value = items.map((item) => item.value as TSiteID);
}

// 表格是否处于筛选状态：筛选词为空时 v-data-table 不会进行任何过滤（此时展示的即是全部站点）
const tableFiltered = computed(() => tableFilterRef.value.trim().length > 0);

// 最近一次更新失败的站点状态，用于快速筛选
// NOTE: 不要在模板的事件回调中直接访问导入枚举的成员：vue-tsc 3.3.12 起会为这类窄化访问生成 `.value`，
//       而闭包内无法通过类型检查（TS2339），故提前在 script 中展开（见 #1601）
const lastUpdateErrorStatuses = [
  EResultParseStatus.parseError,
  EResultParseStatus.unknownError,
  EResultParseStatus.needLogin,
  EResultParseStatus.noUserInput,
].map((item) => item.toString());

// 挂载时加载表格数据
onMounted(() => initTableData());

// 监听用户信息变化（ offscreen 直接定时刷新的情况 ）
watchDebounced(
  () => metadataStore.lastUserInfo,
  () => {
    // 此时前端并没有进行刷新，强制更新
    if (!Object.values(runtimeStore.userInfo.flushPlan).some((isFlushing) => isFlushing)) {
      initTableData();
    }
  },
  { debounce: 5e3, deep: true },
);

const showHistoryDataViewDialog = ref<boolean>(false);
const historyDataViewDialogSiteId = ref<TSiteID | null>(null);
function viewHistoryData(siteId: TSiteID) {
  showHistoryDataViewDialog.value = true;
  historyDataViewDialogSiteId.value = siteId;
}

function multiOpen() {
  let openSiteIds: TSiteID[] = tableSelected.value;

  // #1663：未勾选站点时，按「是否处于筛选状态」决定打开范围，避免筛选后仍然打开全部站点
  // NOTE: v-data-table 没有提供「筛选后的全部结果」的钩子（vuetifyjs/vuetify#19382），
  //       只能取到当前分页展示的站点，故筛选状态下仅打开当前页
  if (openSiteIds.length === 0) {
    if (tableFiltered.value) {
      openSiteIds = tableCurrentPageSites.value;
      if (openSiteIds.length === 0) {
        runtimeStore.showSnackbar(t("MyData.index.noSiteSelectedCancelOpen"), { color: "warning" });
        return;
      }
      runtimeStore.showSnackbar(t("MyData.index.noSiteSelectedOpenFilteredPage", { count: openSiteIds.length }), {
        color: "info",
      });
    } else {
      openSiteIds = tableData.value.map((item) => item.site);
      runtimeStore.showSnackbar(t("MyData.index.noSiteSelectedOpenAll"), { color: "info" });
    }
  }

  // NOTE: 这里必须同步取 URL，若在循环内 `await`，则第一个 `window.open` 之后用户手势即失效，
  //       后续标签页会被浏览器拦截（表格数据均已挂载 `siteUserConfig`，无需再走异步查询）
  for (const siteId of openSiteIds) {
    const siteUrl = metadataStore.sites[siteId]?.url || siteMetadataIndex[siteId]?.urls?.[0];
    if (siteUrl) {
      window.open(siteUrl, "_blank", "noopener noreferrer");
    }
  }
}

async function multiFlush() {
  let flushSiteIds: TSiteID[] = tableSelected.value;
  if (flushSiteIds.length === 0) {
    flushSiteIds = tableData.value.map((item) => item.site);
    runtimeStore.showSnackbar(t("MyData.index.noSiteSelectedRefreshAll"), { color: "info" });
  }

  if (flushSiteIds.length > 0) {
    flushSiteLastUserInfo(flushSiteIds);
  } else {
    runtimeStore.showSnackbar(t("MyData.index.noSiteSelectedCancelRefresh"), { color: "warning" });
  }
}

function viewTimeline() {
  router.push({
    name: "UserDataTimeline",
    query: {
      sites: tableSelected.value,
    },
  });
}

function viewStatistic() {
  router.push({
    name: "UserDataStatistic",
    query: {
      sites: tableSelected.value,
    },
  });
}

const showExportDialog = ref(false);

const hasAddedSites = computed(() => metadataStore.getAddedSiteIds.length > 0);

const kpiSummary = computed(() => {
  let totalUploaded = 0;
  let totalDownloaded = 0;
  let totalSeedingSize = 0;
  let totalSeedingCount = 0;
  let totalBonusPerHour = 0;
  let sitesWithBonusCount = 0;
  let successSiteCount = 0;
  let errorSiteCount = 0;
  let unreadMessageSiteCount = 0;

  for (const item of tableData.value) {
    if (typeof item.uploaded === "number" && item.uploaded > 0) totalUploaded += item.uploaded;
    if (typeof item.downloaded === "number" && item.downloaded > 0) totalDownloaded += item.downloaded;
    if (typeof item.seedingSize === "number" && item.seedingSize > 0) totalSeedingSize += item.seedingSize;
    if (typeof item.seeding === "number" && item.seeding > 0) totalSeedingCount += item.seeding;
    if (typeof item.bonusPerHour === "number" && item.bonusPerHour > 0) {
      totalBonusPerHour += item.bonusPerHour;
      sitesWithBonusCount++;
    }
    if (item.status === EResultParseStatus.success) {
      successSiteCount++;
    } else if (lastUpdateErrorStatuses.includes(String(item.status))) {
      errorSiteCount++;
    }
    if ((item.messageCount ?? 0) > 0) {
      unreadMessageSiteCount++;
    }
  }

  const overallRatio = totalDownloaded > 0 ? (totalUploaded / totalDownloaded).toFixed(2) : "∞";
  return {
    totalUploaded,
    totalDownloaded,
    overallRatio,
    totalSeedingSize,
    totalSeedingCount,
    totalBonusPerHour,
    sitesWithBonusCount,
    successSiteCount,
    errorSiteCount,
    unreadMessageSiteCount,
  };
});

function getSiteUrlSync(siteId: TSiteID): string {
  return metadataStore.sites[siteId]?.url || siteMetadataIndex[siteId]?.urls?.[0] || "#";
}

function filterErrorSites() {
  advanceFilterDictRef.value.status.required = lastUpdateErrorStatuses;
  updateTableFilterValueFn();
}

function filterUnreadSites() {
  advanceFilterDictRef.value.messageCount = [1, " "];
  updateTableFilterValueFn();
}

const { tableRef: fitTableRef, fittedHeaders, tableClass: fitTableClass } = useTableColumnFit(tableHeader);
</script>

<template>
  <!-- 全局指标汇总卡片 -->
  <v-row v-if="hasAddedSites" dense class="mb-4">
    <v-col cols="12" sm="6" lg="3">
      <v-card class="pa-4 h-100 d-flex flex-column justify-space-between">
        <div class="d-flex align-center justify-space-between mb-2">
          <span class="text-body-2 text-medium-emphasis font-weight-medium">{{ t("MyData.kpi.totalUploaded") }}</span>
          <v-avatar color="success" variant="tonal" size="34" rounded="lg">
            <v-icon icon="mdi-swap-vertical" size="20" />
          </v-avatar>
        </div>
        <div class="text-h5 font-weight-bold ptd-num">{{ formatSize(kpiSummary.totalUploaded) }}</div>
        <div class="text-caption text-medium-emphasis mt-1 ptd-num">
          {{
            t("MyData.kpi.downloadAndRatio", {
              downloaded: formatSize(kpiSummary.totalDownloaded),
              ratio: kpiSummary.overallRatio,
            })
          }}
        </div>
      </v-card>
    </v-col>

    <v-col cols="12" sm="6" lg="3">
      <v-card class="pa-4 h-100 d-flex flex-column justify-space-between">
        <div class="d-flex align-center justify-space-between mb-2">
          <span class="text-body-2 text-medium-emphasis font-weight-medium">{{
            t("MyData.kpi.totalSeedingSize")
          }}</span>
          <v-avatar color="primary" variant="tonal" size="34" rounded="lg">
            <v-icon icon="mdi-harddisk" size="20" />
          </v-avatar>
        </div>
        <div class="text-h5 font-weight-bold ptd-num">{{ formatSize(kpiSummary.totalSeedingSize) }}</div>
        <div class="text-caption text-medium-emphasis mt-1 ptd-num">
          {{ t("MyData.kpi.totalSeedingCount", { count: kpiSummary.totalSeedingCount }) }}
        </div>
      </v-card>
    </v-col>

    <v-col cols="12" sm="6" lg="3">
      <v-card class="pa-4 h-100 d-flex flex-column justify-space-between">
        <div class="d-flex align-center justify-space-between mb-2">
          <span class="text-body-2 text-medium-emphasis font-weight-medium">{{
            t("MyData.kpi.totalBonusPerHour")
          }}</span>
          <v-avatar color="warning" variant="tonal" size="34" rounded="lg">
            <v-icon icon="mdi-lightning-bolt" size="20" />
          </v-avatar>
        </div>
        <div class="text-h5 font-weight-bold ptd-num">+{{ kpiSummary.totalBonusPerHour.toFixed(2) }} / h</div>
        <div class="text-caption text-medium-emphasis mt-1 ptd-num">
          {{ t("MyData.kpi.sitesWithBonus", { count: kpiSummary.sitesWithBonusCount }) }}
        </div>
      </v-card>
    </v-col>

    <v-col cols="12" sm="6" lg="3">
      <v-card class="pa-4 h-100 d-flex flex-column justify-space-between">
        <div class="d-flex align-center justify-space-between mb-2">
          <span class="text-body-2 text-medium-emphasis font-weight-medium">{{ t("MyData.kpi.siteHealth") }}</span>
          <v-avatar :color="kpiSummary.errorSiteCount > 0 ? 'error' : 'info'" variant="tonal" size="34" rounded="lg">
            <v-icon
              :icon="kpiSummary.errorSiteCount > 0 ? 'mdi-alert-circle-outline' : 'mdi-check-circle-outline'"
              size="20"
            />
          </v-avatar>
        </div>
        <div class="text-h5 font-weight-bold ptd-num">
          {{ t("MyData.kpi.healthRatio", { success: kpiSummary.successSiteCount, total: tableData.length }) }}
        </div>
        <div class="d-flex align-center flex-wrap ga-1 mt-1">
          <v-chip
            v-if="kpiSummary.unreadMessageSiteCount > 0"
            size="x-small"
            color="info"
            variant="tonal"
            class="cursor-pointer"
            @click="filterUnreadSites"
          >
            {{ t("MyData.kpi.unreadSites", { count: kpiSummary.unreadMessageSiteCount }) }}
          </v-chip>
          <v-chip
            v-if="kpiSummary.errorSiteCount > 0"
            size="x-small"
            color="error"
            variant="tonal"
            class="cursor-pointer"
            @click="filterErrorSites"
          >
            {{ t("MyData.kpi.errorSites", { count: kpiSummary.errorSiteCount }) }}
          </v-chip>
          <span
            v-if="kpiSummary.unreadMessageSiteCount === 0 && kpiSummary.errorSiteCount === 0"
            class="text-caption text-medium-emphasis"
          >
            {{ t("MyData.kpi.allHealthy") }}
          </span>
        </div>
      </v-card>
    </v-col>
  </v-row>

  <!-- 空状态引导 -->
  <v-card v-if="!hasAddedSites" class="pa-8 text-center">
    <v-avatar color="primary" variant="tonal" size="56" class="mb-3">
      <v-icon icon="mdi-earth" size="28" />
    </v-avatar>
    <div class="text-h6 font-weight-bold mb-1">{{ t("MyData.empty.title") }}</div>
    <div class="text-body-2 text-medium-emphasis mb-5">{{ t("MyData.empty.subtitle") }}</div>
    <v-btn color="primary" variant="flat" prepend-icon="mdi-plus" @click="router.push({ name: 'SetSite' })">
      {{ t("MyData.empty.addSiteBtn") }}
    </v-btn>
  </v-card>

  <v-card v-else>
    <v-card-title class="pa-4 border-b">
      <div class="d-flex flex-wrap align-center ga-2">
        <!-- 刷新，取消刷新 -->
        <NavButton
          v-if="runtimeStore.isUserInfoFlush"
          :text="t('MyData.index.flushCancel')"
          color="error"
          variant="tonal"
          icon="mdi-cancel"
          @click="cancelFlushSiteLastUserInfo"
        />

        <NavButton
          v-else
          :text="t('MyData.index.flushSelectSite')"
          color="primary"
          variant="flat"
          icon="mdi-cached"
          @click="multiFlush"
        />

        <NavButton
          :disabled="tableData.length === 0"
          color="secondary"
          icon="mdi-open-in-new"
          :text="t('MyData.index.multiOpen')"
          @click="multiOpen"
        />

        <v-divider class="mx-1" vertical />

        <NavButton
          color="secondary"
          icon="mdi-chart-timeline-variant"
          :text="t('MyData.index.viewTimeline')"
          @click="viewTimeline"
        />
        <NavButton
          color="secondary"
          icon="mdi-equalizer"
          :text="t('MyData.index.viewStatistic')"
          @click="viewStatistic"
        />

        <v-divider class="mx-1" vertical />

        <!-- 导出按钮 -->
        <NavButton
          color="secondary"
          icon="mdi-export"
          :text="t('MyData.index.exportData')"
          @click="showExportDialog = true"
        />

        <v-divider class="mx-1" vertical />
        <v-menu :close-on-content-click="false">
          <template v-slot:activator="{ props }">
            <NavButton color="secondary" icon="mdi-cog-outline" :text="t('MyData.index.setting')" v-bind="props" />
          </template>
          <v-list>
            <!-- 入站时间显示 -->
            <v-list-item>
              <template v-slot:prepend>
                <v-list-item-action start class="ml-2">
                  <v-icon icon="mdi-calendar-account" class="mr-2" />
                  <span class="text-label-large">{{ t("MyData.index.joinTimeFormat") }}</span>
                </v-list-item-action>
              </template>

              <v-btn-toggle
                v-model="configStore.myDataTableControl.joinTimeFormat"
                density="compact"
                class="ml-2"
                @click.stop
                @update:model-value="() => configStore.$save()"
              >
                <v-btn
                  v-for="type in ['alive', 'aliveWeek', 'added']"
                  :key="type"
                  :value="type"
                  :title="t(`MyData.index.joinTimeFormatOptions.${type}`)"
                  density="compact"
                >
                  {{ t(`MyData.index.joinTimeFormatOptions.${type}`) }}
                </v-btn>
              </v-btn-toggle>
            </v-list-item>

            <v-divider />

            <!-- 其他开关控制 -->
            <v-list-item v-for="index in filteredTableBooleanControlKeys" :key="index" :value="index">
              <template v-slot:prepend>
                <v-list-item-action start class="ml-2">
                  <v-switch
                    v-model="configStore.myDataTableControl[index]"
                    :label="`&nbsp;${t('MyData.index.' + index)}`"
                    color="success"
                    density="compact"
                    hide-details
                    @click.stop
                    @update:model-value="() => configStore.$save()"
                  />
                </v-list-item-action>
              </template>
            </v-list-item>
          </v-list>
        </v-menu>

        <v-combobox
          v-model="configStore.tableBehavior.MyData.columns"
          :items="fullTableHeader"
          :return-object="false"
          chips
          class="table-header-filter-clear"
          density="compact"
          hide-details
          item-value="key"
          max-width="200"
          multiple
          prepend-inner-icon="mdi-filter-cog"
          @update:model-value="(v) => configStore.updateTableBehavior('MyData', 'columns', v)"
        >
          <template #chip="{ item, index }">
            <v-chip v-if="index === 0">
              <span>{{ item.title }}</span>
            </v-chip>
            <span v-if="index === 1" class="text-grey text-body-small">
              (+{{ configStore.tableBehavior.MyData.columns!.length - 1 }})
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
          :label="t('common.search')"
          max-width="500"
          single-line
          @click:clear="buildFilterDictFn('')"
        >
          <template #prepend-inner>
            <v-menu min-width="100">
              <template v-slot:activator="{ props }">
                <v-icon v-bind="props" icon="mdi-filter" />
              </template>
              <v-list class="pa-0">
                <v-list-item-subtitle class="ma-2">
                  {{ t("MyData.index.siteStatus") }}
                </v-list-item-subtitle>

                <v-list-item
                  :title="t('MyData.index.filter.todayNotUpdated')"
                  @click.stop="
                    () => {
                      advanceFilterDictRef.updateAt = ['', formatDate(currentDate, 'yyyyMMdd')];
                      updateTableFilterValueFn();
                    }
                  "
                />

                <v-list-item
                  :title="t('MyData.index.filter.lastUpdateError')"
                  @click.stop="
                    () => {
                      advanceFilterDictRef.status.required = lastUpdateErrorStatuses;
                      updateTableFilterValueFn();
                    }
                  "
                />

                <v-list-item
                  :title="t('MyData.index.filter.unreadMessage')"
                  @click.stop="
                    () => {
                      advanceFilterDictRef.messageCount = [1, ' '];
                      updateTableFilterValueFn();
                    }
                  "
                />

                <v-list-item-subtitle class="ma-2">
                  {{ t("MyData.index.siteCategory") }}
                </v-list-item-subtitle>

                <v-list-item
                  v-for="(item, index) in metadataStore.getSitesGroupData"
                  :key="index"
                  :value="index"
                  class="pr-6"
                >
                  <v-checkbox
                    v-model="advanceFilterDictRef[`siteUserConfig.groups`].required"
                    :label="`${index} (${item.length})`"
                    :value="index"
                    density="compact"
                    hide-details
                    indeterminate
                    @click.stop="(v: any) => toggleKeywordStateFn(`siteUserConfig.groups`, index)"
                    @update:model-value="() => updateTableFilterValueFn()"
                  />
                </v-list-item>
              </v-list>
            </v-menu>
          </template>
        </v-text-field>
      </div>
    </v-card-title>
    <v-data-table
      ref="fitTableRef"
      :class="fitTableClass"
      v-model="tableSelected"
      :custom-filter="tableFilterFn"
      :filter-keys="['site'] /* 对每个item值只检索一次 */"
      :headers="fittedHeaders"
      :items="tableData"
      :items-per-page="configStore.tableBehavior.MyData.itemsPerPage"
      :multi-sort="configStore.enableTableMultiSort"
      :search="tableFilterRef"
      :sort-by="configStore.tableBehavior.MyData.sortBy"
      class="table-stripe table-header-no-wrap table-no-ext-padding"
      hover
      item-selectable="selectable"
      item-value="site"
      show-select
      @update:current-items="updateTableCurrentPageSites"
      @update:itemsPerPage="(v) => configStore.updateTableBehavior('MyData', 'itemsPerPage', v)"
      @update:sortBy="(v) => configStore.updateTableBehavior('MyData', 'sortBy', v)"
    >
      <!-- 站点信息 -->
      <template #item.siteUserConfig.sortIndex="{ item }">
        <div class="d-flex align-center ga-2">
          <div class="favicon-hover-wrapper favicon-hover-bg" @click="() => flushSiteLastUserInfo([item.site])">
            <SiteFavicon :site-id="item.site" :size="20" />
          </div>
          <a
            v-if="configStore.myDataTableControl.showSiteName"
            :href="getSiteUrlSync(item.site)"
            target="_blank"
            rel="noopener noreferrer"
            class="text-body-2 font-weight-medium text-high-emphasis text-no-wrap"
          >
            <SiteName :site-id="item.site" tag="span" />
          </a>
          <v-badge
            v-if="configStore.myDataTableControl.showUnreadMessage && (item.messageCount ?? 0) > 0"
            :content="(item.messageCount ?? 0) > 99 ? '99+' : item.messageCount"
            color="error"
            inline
          />
        </div>
      </template>

      <!-- 用户名，用户ID -->
      <template #item.name="{ item }">
        <span :title="item.id as string" class="text-no-wrap text-body-2">
          {{ configStore.myDataTableControl.showUserName ? (item.name ?? "-") : "******" }}
        </span>
      </template>

      <!-- 等级信息，升级信息 -->
      <template #item.levelName="{ item }">
        <UserLevelRequirementsTd :user-info="item" :limit-level-name-td-width="limitLevelNameTdWidth" />
      </template>

      <!-- 上传、下载 -->
      <template #item.uploaded="{ item }">
        <div class="d-flex flex-column align-end ptd-num">
          <div class="d-flex align-center ga-1 text-success font-weight-medium text-no-wrap">
            <span>{{ typeof item.uploaded !== "undefined" ? formatSize(item.uploaded) : "-" }}</span>
            <v-icon icon="mdi-arrow-up" size="14" />
          </div>
          <div class="d-flex align-center ga-1 text-medium-emphasis text-caption text-no-wrap">
            <span>{{ typeof item.downloaded !== "undefined" ? formatSize(item.downloaded) : "-" }}</span>
            <v-icon icon="mdi-arrow-down" size="13" />
          </div>
        </div>
      </template>

      <!-- 真实上传、下载 -->
      <template #item.trueUploaded="{ item }">
        <div class="d-flex flex-column align-end ptd-num">
          <div class="d-flex align-center ga-1 text-success font-weight-medium text-no-wrap">
            <span>{{ typeof item.trueUploaded !== "undefined" ? formatSize(item.trueUploaded) : "-" }}</span>
            <v-icon icon="mdi-arrow-up" size="14" />
          </div>
          <div class="d-flex align-center ga-1 text-medium-emphasis text-caption text-no-wrap">
            <span>{{ typeof item.trueDownloaded !== "undefined" ? formatSize(item.trueDownloaded) : "-" }}</span>
            <v-icon icon="mdi-arrow-down" size="13" />
          </div>
        </div>
      </template>

      <!-- 分享率 -->
      <template #item.ratio="{ item }">
        <span
          :class="[
            'text-no-wrap ptd-num',
            typeof item.ratio === 'number' && item.ratio >= 0 && item.ratio < 1 ? 'text-error font-weight-bold' : '',
          ]"
        >
          {{ formatRatio(item) }}
        </span>
      </template>

      <!-- 真实分享率 -->
      <template #item.trueRatio="{ item }">
        <span
          :class="[
            'text-no-wrap ptd-num',
            typeof item.trueRatio === 'number' && item.trueRatio >= 0 && item.trueRatio < 1
              ? 'text-error font-weight-bold'
              : '',
          ]"
        >
          {{ formatRatio(item, "trueRatio") }}
        </span>
      </template>
      <!-- 发布数 -->
      <template #item.uploads="{ item }">
        <span class="text-no-wrap">{{ item.uploads ?? "-" }}</span>
      </template>

      <!-- 做种数， H&R 情况  -->
      <template #item.seeding="{ item }">
        <v-container class="py-0 pr-0">
          <v-row gap="0" class="align-center justify-end flex-nowrap my-0">
            <span class="text-no-wrap">{{ item.seeding ?? "-" }}</span>
          </v-row>
          <v-row
            gap="0"
            v-if="configStore.myDataTableControl.showHnR"
            class="align-center justify-end flex-nowrap my-0"
          >
            <span
              v-if="typeof item.hnrPreWarning !== 'undefined' && item.hnrPreWarning > 0"
              class="d-inline-flex align-center ml-2"
            >
              <v-icon
                :title="t('levelRequirement.hnrPreWarning')"
                color="yellow-darken-4"
                icon="mdi-alert"
                size="small"
              />
              <span class="text-no-wrap">
                {{ item.hnrPreWarning }}
              </span>
            </span>
            <span
              v-if="typeof item.hnrUnsatisfied !== 'undefined' && item.hnrUnsatisfied > 0"
              class="d-inline-flex align-center ml-1"
            >
              <v-icon
                :title="t('levelRequirement.hnrUnsatisfied')"
                color="red-darken-4"
                icon="mdi-alert-circle"
                size="small"
              />
              <span class="text-no-wrap">
                {{ item.hnrUnsatisfied }}
              </span>
            </span>
          </v-row>
        </v-container>
      </template>

      <!-- 做种量 -->
      <template #item.seedingSize="{ item }">
        <span class="text-no-wrap">
          {{ typeof item.seedingSize !== "undefined" ? formatSize(item.seedingSize) : "-" }}
        </span>
      </template>

      <!-- 魔力/积分 -->
      <template #item.bonus="{ item }">
        <v-container class="py-0 pr-0">
          <v-row gap="0" class="align-center justify-end flex-nowrap">
            <v-icon :title="t('levelRequirement.bonus')" color="green-darken-4" icon="mdi-currency-usd" size="small" />
            <BonusFormatSpan :num="item.bonus" />
          </v-row>
          <v-row
            gap="0"
            v-if="
              configStore.myDataTableControl.showSeedingBonus &&
              item.seedingBonus !== '' &&
              !isUndefined(item.seedingBonus)
            "
            align="center"
            class="flex-nowrap"
            justify="end"
          >
            <v-icon
              :title="t('levelRequirement.seedingBonus')"
              color="green-darken-4"
              icon="mdi-lightning-bolt-circle"
              size="small"
            />
            <BonusFormatSpan :num="item.seedingBonus" />
          </v-row>
        </v-container>
      </template>

      <template #item.bonusPerHour="{ item }">
        <BonusFormatSpan :num="item.bonusPerHour" />
      </template>

      <template #item.invites="{ item }">
        <span class="text-no-wrap">{{ typeof item.invites !== "undefined" ? item.invites : "-" }}</span>
      </template>

      <!-- 入站时间 -->
      <template #item.joinTime="{ item }">
        <span class="text-no-wrap" :title="item.joinTime ? (formatDate(item.joinTime) as string) : '-'">
          {{
            typeof item.joinTime !== "undefined"
              ? configStore.myDataTableControl.joinTimeFormat === "aliveWeek"
                ? formatTimeAgo(item.joinTime, { weekOnly: true })
                : configStore.myDataTableControl.joinTimeFormat === "alive"
                  ? formatTimeAgo(item.joinTime)
                  : formatDate(item.joinTime, "yyyy-MM-dd")
              : "-"
          }}
        </span>
      </template>

      <!-- 最近访问时间 -->
      <template #item.lastAccessAt="{ item }">
        <span class="text-no-wrap" :title="item.lastAccessAt ? (formatDate(item.lastAccessAt) as string) : '-'">
          <template v-if="typeof item.lastAccessAt !== 'undefined'">
            {{ formatDate(item.lastAccessAt) }}
            <v-icon
              v-if="item.lastAccessDuration >= 5"
              icon="mdi-alert"
              :color="item.lastAccessDuration >= 15 ? 'red' : 'amber'"
              :title="t('MyData.table.lastAccessDurationNote', [item.lastAccessDuration])"
            />
          </template>
          <template v-else>-</template>
        </span>
      </template>

      <!-- 更新时间 -->
      <template #item.updateAt="{ item }">
        <template v-if="item.status === EResultParseStatus.success">
          <span class="text-wrap" :title="item.updateAt ? (formatDate(item.updateAt) as string) : '-'">
            {{
              item.updateAt
                ? configStore.myDataTableControl.updateAtFormatAsAlive
                  ? formatTimeAgo(item.updateAt)
                  : formatDate(item.updateAt)
                : "-"
            }}
          </span>
        </template>
        <template v-else>
          <v-chip label>
            <ResultParseStatus :status="item.status" />
          </v-chip>
        </template>
      </template>

      <!-- 操作 -->
      <template #item.action="{ item }">
        <div class="table-action d-flex align-center justify-center ga-1">
          <v-btn
            :title="t('MyData.table.action.viewHistoryData')"
            color="secondary"
            icon="mdi-view-list"
            size="small"
            variant="text"
            @click="() => viewHistoryData(item.site)"
          />
          <v-btn
            :disabled="runtimeStore.userInfo.flushPlan[item.site]"
            :loading="runtimeStore.userInfo.flushPlan[item.site]"
            :title="t('MyData.table.action.flushData')"
            color="primary"
            icon="mdi-cached"
            size="small"
            variant="text"
            @click="() => flushSiteLastUserInfo([item.site])"
          />
        </div>
      </template>
    </v-data-table>
  </v-card>

  <HistoryDataViewDialog v-model="showHistoryDataViewDialog" :site-id="historyDataViewDialogSiteId!" />
  <ExportUserInfoDialog v-model="showExportDialog" :selected-site-ids="tableSelected" />
</template>

<style scoped lang="scss">
.favicon-hover-wrapper {
  cursor: pointer;
}

.favicon-hover-bg {
  border-radius: 50%;
  transition: background 0.2s;
  display: inline-flex;
  padding: 4px;
}

.favicon-hover-bg:hover {
  background: rgba(0, 0, 0, 0.3);
}
</style>
