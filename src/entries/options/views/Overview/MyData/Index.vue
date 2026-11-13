<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useMediaQuery, watchDebounced } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { isUndefined } from "es-toolkit/compat";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  CheckCircle2,
  Clock,
  Coins,
  Columns3,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Filter,
  FolderEdit,
  Globe,
  HardDrive,
  History,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
  XCircle,
  Zap,
} from "lucide-vue-next";
import { EResultParseStatus, type ISiteUserConfig, type IUserInfo, type TSiteID } from "@ptd/site";
import { siteMetadataIndex } from "@ptd/site/metadataIndex";

import {
  Badge,
  Button,
  Card,
  CardContent,
  Checkbox,
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
  Separator,
  Switch,
  TagsInput,
  Tooltip,
  type DataTableColumn,
} from "~/components/ui";
import { useConfigStore } from "@/options/stores/config.ts";
import { useRuntimeStore } from "@/options/stores/runtime.ts";
import { useMetadataStore } from "@/options/stores/metadata.ts";
import { useTableCustomFilter } from "@/options/directives/useAdvanceFilter.ts";
import { formatDate, formatSize, formatTimeAgo } from "@/options/utils.ts";

import SiteName from "@/options/components/SiteName.vue";
import SiteFavicon from "@/options/components/SiteFavicon/Index.vue";
import ResultParseStatus from "@/options/components/ResultParseStatus.vue";
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

const limitLevelNameTdWidth = useMediaQuery("(max-width: 959px)");
const currentDate = new Date();

interface IUserInfoItem extends IUserInfo {
  siteUserConfig: ISiteUserConfig;
  siteName: string;
}

type TExtendDataTableColumn = DataTableColumn<IUserInfoItem> & { disabledToggle?: boolean };

const fullTableColumns = computed<TExtendDataTableColumn[]>(() => [
  {
    title: t("common.site"),
    key: "siteUserConfig.sortIndex",
    align: "start",
    sortValue: (row) => row.siteUserConfig?.sortIndex ?? 0,
    disabledToggle: true,
  },
  { title: t("common.username"), key: "name", align: "center" },
  {
    title: t("MyData.table.levelName"),
    key: "levelName",
    align: "start",
    ...(limitLevelNameTdWidth.value ? { maxWidth: "32vw" } : {}),
  },
  { title: t("MyData.table.userData"), key: "uploaded", align: "end" },
  { title: t("MyData.table.trueUserData"), key: "trueUploaded", align: "end" },
  { title: t("levelRequirement.ratio"), key: "ratio", align: "end" },
  { title: t("levelRequirement.trueRatio"), key: "trueRatio", align: "end" },
  { title: t("levelRequirement.uploads"), key: "uploads", align: "end" },
  { title: t("levelRequirement.seeding"), key: "seeding", align: "end" },
  { title: t("levelRequirement.seedingSize"), key: "seedingSize", align: "end" },
  { title: t("levelRequirement.bonus"), key: "bonus", align: "end" },
  { title: t("levelRequirement.bonusPerHour"), key: "bonusPerHour", align: "end" },
  { title: t("MyData.table.invites"), key: "invites", align: "end" },
  { title: t("MyData.table.joinTime"), key: "joinTime", align: "center" },
  { title: t("MyData.table.lastAccessAt"), key: "lastAccessAt", align: "center" },
  { title: t("MyData.table.updateAt"), key: "updateAt", align: "center" },
  {
    title: t("common.action"),
    key: "action",
    align: "center",
    sortable: false,
    disabledToggle: true,
  },
]);

const visibleColumns = computed<DataTableColumn<IUserInfoItem>[]>(() => {
  const configured = configStore.tableBehavior.MyData.columns ?? [];
  return fullTableColumns.value.filter((col) => col.disabledToggle || configured.includes(col.key));
});

const toggleableColumns = computed(() => fullTableColumns.value.filter((col) => !col.disabledToggle));

function isColumnVisible(key: string): boolean {
  return (configStore.tableBehavior.MyData.columns ?? []).includes(key);
}

function toggleColumnVisibility(key: string, checked: boolean | "indeterminate") {
  const current = [...(configStore.tableBehavior.MyData.columns ?? [])];
  if (checked === true) {
    if (!current.includes(key)) current.push(key);
  } else {
    const idx = current.indexOf(key);
    if (idx !== -1) current.splice(idx, 1);
  }
  configStore.updateTableBehavior("MyData", "columns", current);
}

const tableNonBooleanControlKey = ["joinTimeFormat", "joinTimeWeekOnly"];

const filteredTableBooleanControlKeys = computed(() => {
  return Object.keys(configStore.myDataTableControl).filter(
    (key) => tableNonBooleanControlKey.indexOf(key) === -1,
  ) as (keyof typeof configStore.myDataTableControl)[];
});

const {
  tableWaitFilterRef,
  tableFilterRef,
  tableFilterFn,
  advanceFilterDictRef,
  updateTableFilterValueFn,
  buildFilterDictFn,
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

const tableSelected = ref<TSiteID[]>([]);
const tableFiltered = computed(() => tableFilterRef.value.trim().length > 0);

const lastUpdateErrorStatuses = [
  EResultParseStatus.parseError,
  EResultParseStatus.unknownError,
  EResultParseStatus.needLogin,
  EResultParseStatus.noUserInput,
].map((item) => item.toString());

onMounted(() => initTableData());

watchDebounced(
  () => metadataStore.lastUserInfo,
  () => {
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

  if (openSiteIds.length === 0) {
    if (tableFiltered.value) {
      openSiteIds = (tableData.value as IUserInfoItem[])
        .filter((item) => tableFilterFn(null, tableFilterRef.value, { raw: item }))
        .map((item) => item.site);
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

function filterTodayNotUpdated() {
  advanceFilterDictRef.value.updateAt = ["", formatDate(currentDate, "yyyyMMdd")];
  updateTableFilterValueFn();
}

function clearSearchFilter() {
  tableWaitFilterRef.value = "";
  buildFilterDictFn("");
}

const isPrivacyBlurred = computed(() => Boolean(configStore.myDataTableControl.privacyBlur));

function togglePrivacyBlur() {
  configStore.myDataTableControl.privacyBlur = !configStore.myDataTableControl.privacyBlur;
  configStore.$save();
}

function getGroupFilterState(group: string): boolean | "indeterminate" {
  const dict = advanceFilterDictRef.value["siteUserConfig.groups"] as { required: string[]; exclude: string[] };
  if (dict?.required?.includes(group)) return true;
  if (dict?.exclude?.includes(group)) return "indeterminate";
  return false;
}

function cycleGroupFilterState(group: string) {
  const dict = advanceFilterDictRef.value["siteUserConfig.groups"] as { required: string[]; exclude: string[] };
  if (dict.required.includes(group)) {
    dict.required = dict.required.filter((g) => g !== group);
    if (!dict.exclude.includes(group)) dict.exclude.push(group);
  } else if (dict.exclude.includes(group)) {
    dict.exclude = dict.exclude.filter((g) => g !== group);
  } else {
    dict.required.push(group);
  }
  updateTableFilterValueFn();
}

// 站点分组快速编辑 Popover
const showGroupEditPopover = ref(false);
const batchEditGroups = ref<string[]>([]);
const allExistingGroups = computed(() => Object.keys(metadataStore.getSitesGroupData));

function onOpenGroupEditPopover(open: boolean) {
  if (!open) return;
  const groupCounts = new Map<string, number>();
  for (const siteId of tableSelected.value) {
    const groups = metadataStore.sites[siteId]?.groups ?? [];
    for (const g of groups) {
      groupCounts.set(g, (groupCounts.get(g) ?? 0) + 1);
    }
  }
  // 预填所有选中站点共同拥有的分组（如果只有单选就是该站点的分组）
  const selectedLen = tableSelected.value.length;
  batchEditGroups.value = Array.from(groupCounts.entries())
    .filter(([, count]) => count === selectedLen)
    .map(([g]) => g);
}

async function applyBatchGroups() {
  const nextGroups = [...batchEditGroups.value];
  for (const siteId of tableSelected.value) {
    await metadataStore.simplePatch("sites", siteId, "groups", [...nextGroups]);
  }
  await initTableData();
  showGroupEditPopover.value = false;
  runtimeStore.showSnackbar(t("common.saveSuccess"), { color: "success" });
}
</script>

<template>
  <div class="space-y-4">
    <!-- 顶部页头操作区 -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="min-w-0">
        <div class="flex items-center gap-2.5">
          <h1 class="text-lg font-semibold tracking-tight text-foreground">{{ t("route.Overview.MyData") }}</h1>
          <Badge
            v-if="hasAddedSites"
            variant="secondary"
            :class="['tabular-nums transition-[filter] duration-150', isPrivacyBlurred && 'ptd-privacy-blur']"
          >
            {{ kpiSummary.successSiteCount }} / {{ tableData.length }}
          </Badge>
        </div>
        <p class="mt-0.5 text-xs text-muted-foreground">
          <template v-if="metadataStore.lastUserInfoAutoFlushAt > 0">
            {{ t("userInfo.autoRefresh.lastFlushTime") }}
            <span :class="['tabular-nums transition-[filter] duration-150', isPrivacyBlurred && 'ptd-privacy-blur']">
              {{ formatDate(metadataStore.lastUserInfoAutoFlushAt) }}
            </span>
          </template>
          <template v-else>
            {{ t("MyData.kpi.allHealthy") }}
          </template>
        </p>
      </div>

      <div v-if="hasAddedSites" class="flex flex-wrap items-center gap-2">
        <Button
          v-if="runtimeStore.isUserInfoFlush"
          variant="destructive"
          size="sm"
          @click="cancelFlushSiteLastUserInfo"
        >
          <XCircle />
          {{ t("MyData.index.flushCancel") }}
        </Button>
        <Button v-else size="sm" @click="multiFlush">
          <RefreshCw />
          {{ t("MyData.index.flushSelectSite") }}
        </Button>

        <div class="inline-flex items-center rounded-md border border-border bg-card p-0.5 shadow-2xs">
          <Button variant="ghost" size="xs" @click="viewStatistic">
            <BarChart3 />
            {{ t("MyData.index.viewStatistic") }}
          </Button>
          <Button variant="ghost" size="xs" @click="viewTimeline">
            <History />
            {{ t("MyData.index.viewTimeline") }}
          </Button>
          <Button variant="ghost" size="xs" :disabled="tableData.length === 0" @click="multiOpen">
            <ExternalLink />
            {{ t("MyData.index.multiOpen") }}
          </Button>
          <Button variant="ghost" size="xs" @click="showExportDialog = true">
            <Download />
            {{ t("MyData.index.exportData") }}
          </Button>
        </div>
      </div>
    </div>

    <!-- 4 栏 Bento KPI 汇总卡 -->
    <div v-if="hasAddedSites" class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card class="p-4">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-medium text-muted-foreground">{{ t("MyData.kpi.totalUploaded") }}</span>
          <span class="inline-flex size-8 items-center justify-center rounded-lg bg-success/12 text-success">
            <ArrowUpDown class="size-4" />
          </span>
        </div>
        <div :class="['transition-[filter] duration-150', isPrivacyBlurred && 'ptd-privacy-blur']">
          <div class="mt-2 text-2xl font-bold tracking-tight tabular-nums text-foreground">
            {{ formatSize(kpiSummary.totalUploaded) }}
          </div>
          <div class="mt-1 text-xs text-muted-foreground tabular-nums">
            {{
              t("MyData.kpi.downloadAndRatio", {
                downloaded: formatSize(kpiSummary.totalDownloaded),
                ratio: kpiSummary.overallRatio,
              })
            }}
          </div>
        </div>
      </Card>

      <Card class="p-4">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-medium text-muted-foreground">{{ t("MyData.kpi.totalSeedingSize") }}</span>
          <span class="inline-flex size-8 items-center justify-center rounded-lg bg-primary/12 text-primary">
            <HardDrive class="size-4" />
          </span>
        </div>
        <div :class="['transition-[filter] duration-150', isPrivacyBlurred && 'ptd-privacy-blur']">
          <div class="mt-2 text-2xl font-bold tracking-tight tabular-nums text-foreground">
            {{ formatSize(kpiSummary.totalSeedingSize) }}
          </div>
          <div class="mt-1 text-xs text-muted-foreground tabular-nums">
            {{ t("MyData.kpi.totalSeedingCount", { count: kpiSummary.totalSeedingCount }) }}
          </div>
        </div>
      </Card>

      <Card class="p-4">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-medium text-muted-foreground">{{ t("MyData.kpi.totalBonusPerHour") }}</span>
          <span class="inline-flex size-8 items-center justify-center rounded-lg bg-warning/14 text-warning">
            <Zap class="size-4" />
          </span>
        </div>
        <div :class="['transition-[filter] duration-150', isPrivacyBlurred && 'ptd-privacy-blur']">
          <div class="mt-2 text-2xl font-bold tracking-tight tabular-nums text-foreground">
            +{{ kpiSummary.totalBonusPerHour.toFixed(2) }} / h
          </div>
          <div class="mt-1 text-xs text-muted-foreground tabular-nums">
            {{ t("MyData.kpi.sitesWithBonus", { count: kpiSummary.sitesWithBonusCount }) }}
          </div>
        </div>
      </Card>

      <Card class="p-4">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-medium text-muted-foreground">{{ t("MyData.kpi.siteHealth") }}</span>
          <span
            :class="[
              'inline-flex size-8 items-center justify-center rounded-lg',
              kpiSummary.errorSiteCount > 0 ? 'bg-destructive/12 text-destructive' : 'bg-info/12 text-info',
            ]"
          >
            <AlertCircle v-if="kpiSummary.errorSiteCount > 0" class="size-4" />
            <CheckCircle2 v-else class="size-4" />
          </span>
        </div>
        <div :class="['transition-[filter] duration-150', isPrivacyBlurred && 'ptd-privacy-blur']">
          <div class="mt-2 text-2xl font-bold tracking-tight tabular-nums text-foreground">
            {{ t("MyData.kpi.healthRatio", { success: kpiSummary.successSiteCount, total: tableData.length }) }}
          </div>
          <div class="mt-1 flex flex-wrap items-center gap-1.5">
            <button
              v-if="kpiSummary.unreadMessageSiteCount > 0"
              type="button"
              class="cursor-pointer transition-opacity hover:opacity-80"
              @click="filterUnreadSites"
            >
              <Badge variant="info" class="px-1.5 py-0 text-[11px]">
                {{ t("MyData.kpi.unreadSites", { count: kpiSummary.unreadMessageSiteCount }) }}
              </Badge>
            </button>
            <button
              v-if="kpiSummary.errorSiteCount > 0"
              type="button"
              class="cursor-pointer transition-opacity hover:opacity-80"
              @click="filterErrorSites"
            >
              <Badge variant="destructive" class="px-1.5 py-0 text-[11px]">
                {{ t("MyData.kpi.errorSites", { count: kpiSummary.errorSiteCount }) }}
              </Badge>
            </button>
            <span
              v-if="kpiSummary.unreadMessageSiteCount === 0 && kpiSummary.errorSiteCount === 0"
              class="text-xs text-muted-foreground"
            >
              {{ t("MyData.kpi.allHealthy") }}
            </span>
          </div>
        </div>
      </Card>
    </div>

    <!-- 空状态引导 -->
    <Card v-if="!hasAddedSites" class="p-10 text-center">
      <CardContent class="flex flex-col items-center justify-center gap-3 p-0">
        <span class="inline-flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Globe class="size-7" />
        </span>
        <div class="space-y-1">
          <h2 class="text-base font-semibold text-foreground">{{ t("MyData.empty.title") }}</h2>
          <p class="text-sm text-muted-foreground">{{ t("MyData.empty.subtitle") }}</p>
        </div>
        <Button class="mt-2" @click="router.push({ name: 'SetSite' })">
          <Plus />
          {{ t("MyData.empty.addSiteBtn") }}
        </Button>
      </CardContent>
    </Card>

    <!-- 主数据表格 -->
    <Card v-else>
      <div class="flex flex-wrap items-center justify-between gap-2.5 border-b border-border px-4 py-3">
        <!-- 左侧：搜索、快捷筛选、分组快编 -->
        <div class="flex flex-wrap items-center gap-2">
          <div class="relative w-56 sm:w-64">
            <Search
              class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input v-model="tableWaitFilterRef" :placeholder="t('common.search')" class="h-8 pl-8 pr-7 text-xs" />
            <button
              v-if="tableWaitFilterRef"
              type="button"
              class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              @click="clearSearchFilter"
            >
              <X class="size-3.5" />
            </button>
          </div>

          <!-- 快捷筛选 Popover -->
          <Popover>
            <PopoverTrigger as-child>
              <Button variant="outline" size="sm" class="relative">
                <Filter />
                <span>{{ t("MyData.index.siteStatus") }}</span>
                <span v-if="tableFiltered" class="size-1.5 rounded-full bg-primary" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" class="w-68 p-0">
              <div class="flex items-center justify-between border-b border-border px-3 py-2">
                <span class="text-xs font-semibold text-foreground">{{ t("MyData.index.siteStatus") }}</span>
                <Button v-if="tableWaitFilterRef" variant="ghost" size="xs" @click="clearSearchFilter">
                  {{ t("common.dialog.reset") }}
                </Button>
              </div>
              <div class="space-y-1 p-1.5">
                <button
                  type="button"
                  class="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent"
                  @click="filterTodayNotUpdated"
                >
                  {{ t("MyData.index.filter.todayNotUpdated") }}
                </button>
                <button
                  type="button"
                  class="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent"
                  @click="filterErrorSites"
                >
                  {{ t("MyData.index.filter.lastUpdateError") }}
                </button>
                <button
                  type="button"
                  class="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent"
                  @click="filterUnreadSites"
                >
                  {{ t("MyData.index.filter.unreadMessage") }}
                </button>
              </div>

              <template v-if="Object.keys(metadataStore.getSitesGroupData).length > 0">
                <Separator />
                <div class="px-3 pt-2 pb-1 text-xs font-semibold text-muted-foreground">
                  {{ t("MyData.index.siteCategory") }}
                </div>
                <div class="max-h-48 space-y-0.5 overflow-y-auto p-1.5 pt-0">
                  <button
                    v-for="(sites, groupName) in metadataStore.getSitesGroupData"
                    :key="groupName"
                    type="button"
                    class="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-accent"
                    @click="cycleGroupFilterState(String(groupName))"
                  >
                    <span class="flex items-center gap-2">
                      <Checkbox :model-value="getGroupFilterState(String(groupName))" class="pointer-events-none" />
                      <span class="text-foreground">{{ groupName }}</span>
                    </span>
                    <Badge variant="secondary" class="px-1.5 py-0 text-[10px] tabular-nums">{{ sites.length }}</Badge>
                  </button>
                </div>
              </template>
            </PopoverContent>
          </Popover>

          <!-- 站点分组快速编辑 Popover（选中行存在时显示） -->
          <Popover
            v-if="tableSelected.length > 0"
            v-model:open="showGroupEditPopover"
            @update:open="onOpenGroupEditPopover"
          >
            <PopoverTrigger as-child>
              <Button variant="secondary" size="sm">
                <FolderEdit />
                <span>{{ t("SetSite.common.groups") }}</span>
                <Badge variant="default" class="ml-0.5 px-1.5 py-0 text-[10px] tabular-nums">
                  {{ tableSelected.length }}
                </Badge>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" class="w-80 space-y-3 p-3.5">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-foreground">{{ t("SetSite.common.groups") }}</span>
                <span class="text-[11px] text-muted-foreground tabular-nums">{{ tableSelected.length }}</span>
              </div>
              <TagsInput
                v-model="batchEditGroups"
                :suggestions="allExistingGroups"
                :placeholder="t('SetSite.common.groups')"
              />
              <div v-if="allExistingGroups.length > 0" class="flex flex-wrap gap-1">
                <button
                  v-for="group in allExistingGroups"
                  :key="group"
                  type="button"
                  @click="
                    batchEditGroups.includes(group)
                      ? (batchEditGroups = batchEditGroups.filter((g) => g !== group))
                      : (batchEditGroups = [...batchEditGroups, group])
                  "
                >
                  <Badge
                    :variant="batchEditGroups.includes(group) ? 'default' : 'outline'"
                    class="cursor-pointer text-[11px]"
                  >
                    {{ group }}
                  </Badge>
                </button>
              </div>
              <div class="flex justify-end gap-2 pt-1">
                <Button variant="ghost" size="xs" @click="showGroupEditPopover = false">
                  {{ t("common.dialog.cancel") }}
                </Button>
                <Button size="xs" @click="applyBatchGroups">
                  {{ t("common.save") }}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <!-- 右侧：显示偏好 Popover + 列显隐 DropdownMenu -->
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            :class="
              configStore.myDataTableControl.privacyBlur
                ? 'border-primary/45 bg-primary/12 text-primary hover:bg-primary/18 hover:text-primary'
                : ''
            "
            @click="togglePrivacyBlur"
          >
            <EyeOff v-if="configStore.myDataTableControl.privacyBlur" />
            <Eye v-else />
            <span>
              {{
                configStore.myDataTableControl.privacyBlur
                  ? t("MyData.index.privacyBlurred")
                  : t("MyData.index.privacyBlur")
              }}
            </span>
          </Button>

          <Popover>
            <PopoverTrigger as-child>
              <Button variant="outline" size="sm">
                <SlidersHorizontal />
                {{ t("MyData.index.setting") }}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" class="w-80 p-0">
              <div class="border-b border-border px-3.5 py-2.5 text-xs font-semibold text-foreground">
                {{ t("MyData.index.setting") }}
              </div>
              <div class="space-y-3 p-3.5">
                <div class="space-y-1.5">
                  <span class="text-xs font-medium text-muted-foreground">{{ t("MyData.index.joinTimeFormat") }}</span>
                  <div class="grid grid-cols-3 gap-1 rounded-md border border-border bg-muted/40 p-0.5">
                    <button
                      v-for="type in ['alive', 'aliveWeek', 'added'] as const"
                      :key="type"
                      type="button"
                      :class="[
                        'rounded px-2 py-1 text-[11px] font-medium transition-colors',
                        configStore.myDataTableControl.joinTimeFormat === type
                          ? 'bg-background text-foreground shadow-2xs'
                          : 'text-muted-foreground hover:text-foreground',
                      ]"
                      @click="
                        () => {
                          configStore.myDataTableControl.joinTimeFormat = type;
                          configStore.$save();
                        }
                      "
                    >
                      {{ t(`MyData.index.joinTimeFormatOptions.${type}`) }}
                    </button>
                  </div>
                </div>

                <Separator />

                <div class="-mx-1 max-h-64 space-y-2.5 overflow-y-auto px-1 py-0.5">
                  <label
                    v-for="key in filteredTableBooleanControlKeys"
                    :key="key"
                    class="flex cursor-pointer items-center justify-between gap-3 text-xs select-none"
                  >
                    <span class="text-foreground">{{ t(`MyData.index.${key}`) }}</span>
                    <Switch
                      :model-value="Boolean(configStore.myDataTableControl[key])"
                      @update:model-value="
                        (v) => {
                          (configStore.myDataTableControl as any)[key] = v;
                          configStore.$save();
                        }
                      "
                    />
                  </label>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="outline" size="sm">
                <Columns3 />
                <Badge variant="secondary" class="px-1.5 py-0 text-[10px] tabular-nums">
                  {{ visibleColumns.length }}
                </Badge>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="max-h-80 w-52 overflow-y-auto">
              <DropdownMenuExtra>{{ t("MyData.index.setting") }}</DropdownMenuExtra>
              <DropdownMenuExtra type="separator" />
              <DropdownMenuCheckboxItem
                v-for="col in toggleableColumns"
                :key="col.key"
                :model-value="isColumnVisible(col.key)"
                @update:model-value="(v) => toggleColumnVisibility(col.key, v)"
              >
                {{ col.title }}
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <DataTable
        v-model:selected="tableSelected"
        :columns="visibleColumns"
        :items="tableData"
        row-key="site"
        selectable
        :is-row-selectable="(row) => (row as any).selectable !== false"
        :search="tableFilterRef"
        :filter-keys="['site']"
        :custom-filter="tableFilterFn"
        :sort-by="configStore.tableBehavior.MyData.sortBy as any"
        :items-per-page="configStore.tableBehavior.MyData.itemsPerPage"
        :multi-sort="configStore.enableTableMultiSort"
        :sticky-action-column="configStore.tableActionColumnFixed"
        :action-position="configStore.tableActionColumnPosition"
        @update:items-per-page="(v) => configStore.updateTableBehavior('MyData', 'itemsPerPage', v)"
        @update:sort-by="(v) => configStore.updateTableBehavior('MyData', 'sortBy', v)"
      >
        <!-- 站点信息 -->
        <template #cell-siteUserConfig.sortIndex="{ item }">
          <div
            :class="[
              'flex items-center gap-2 transition-[filter] duration-150',
              isPrivacyBlurred && 'ptd-privacy-blur',
            ]"
          >
            <button
              type="button"
              class="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-full p-1 transition-colors hover:bg-accent"
              :title="isPrivacyBlurred ? undefined : t('MyData.table.action.flushData')"
              @click="() => flushSiteLastUserInfo([item.site])"
            >
              <SiteFavicon :site-id="item.site" :size="20" />
            </button>
            <a
              v-if="configStore.myDataTableControl.showSiteName"
              :href="getSiteUrlSync(item.site)"
              target="_blank"
              rel="noopener noreferrer"
              class="whitespace-nowrap text-xs font-medium text-foreground transition-colors hover:text-primary hover:underline underline-offset-4"
            >
              <SiteName :site-id="item.site" tag="span" />
            </a>
            <Badge
              v-if="configStore.myDataTableControl.showUnreadMessage && (item.messageCount ?? 0) > 0"
              variant="destructive"
              class="h-4 min-w-4 justify-center rounded-full px-1 py-0 text-[10px] tabular-nums"
            >
              {{ (item.messageCount ?? 0) > 99 ? "99+" : item.messageCount }}
            </Badge>
          </div>
        </template>

        <!-- 用户名 -->
        <template #cell-name="{ item }">
          <span
            :title="isPrivacyBlurred ? undefined : String(item.id ?? '')"
            :class="[
              'inline-block whitespace-nowrap text-xs text-foreground transition-[filter] duration-150',
              isPrivacyBlurred && 'ptd-privacy-blur',
            ]"
          >
            {{ configStore.myDataTableControl.showUserName ? (item.name ?? "-") : "******" }}
          </span>
        </template>

        <!-- 等级与升级进度 -->
        <template #cell-levelName="{ item }">
          <div :class="['transition-[filter] duration-150', isPrivacyBlurred && 'ptd-privacy-blur']">
            <UserLevelRequirementsTd :user-info="item" :limit-level-name-td-width="limitLevelNameTdWidth" />
          </div>
        </template>

        <!-- 上传、下载 -->
        <template #cell-uploaded="{ item }">
          <div
            :class="[
              'flex flex-col items-end tabular-nums transition-[filter] duration-150',
              isPrivacyBlurred && 'ptd-privacy-blur',
            ]"
          >
            <span class="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-success">
              <span>{{ typeof item.uploaded !== "undefined" ? formatSize(item.uploaded) : "-" }}</span>
              <ArrowUp class="size-3.5 shrink-0" />
            </span>
            <span class="inline-flex items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground">
              <span>{{ typeof item.downloaded !== "undefined" ? formatSize(item.downloaded) : "-" }}</span>
              <ArrowDown class="size-3 shrink-0" />
            </span>
          </div>
        </template>

        <!-- 真实上传、下载 -->
        <template #cell-trueUploaded="{ item }">
          <div
            :class="[
              'flex flex-col items-end tabular-nums transition-[filter] duration-150',
              isPrivacyBlurred && 'ptd-privacy-blur',
            ]"
          >
            <span class="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-success">
              <span>{{ typeof item.trueUploaded !== "undefined" ? formatSize(item.trueUploaded) : "-" }}</span>
              <ArrowUp class="size-3.5 shrink-0" />
            </span>
            <span class="inline-flex items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground">
              <span>{{ typeof item.trueDownloaded !== "undefined" ? formatSize(item.trueDownloaded) : "-" }}</span>
              <ArrowDown class="size-3 shrink-0" />
            </span>
          </div>
        </template>

        <!-- 分享率 -->
        <template #cell-ratio="{ item }">
          <span
            :class="[
              'inline-block whitespace-nowrap text-xs tabular-nums transition-[filter] duration-150',
              typeof item.ratio === 'number' && item.ratio >= 0 && item.ratio < 1
                ? 'font-semibold text-destructive'
                : 'text-foreground',
              isPrivacyBlurred && 'ptd-privacy-blur',
            ]"
          >
            {{ formatRatio(item) }}
          </span>
        </template>

        <!-- 真实分享率 -->
        <template #cell-trueRatio="{ item }">
          <span
            :class="[
              'inline-block whitespace-nowrap text-xs tabular-nums transition-[filter] duration-150',
              typeof item.trueRatio === 'number' && item.trueRatio >= 0 && item.trueRatio < 1
                ? 'font-semibold text-destructive'
                : 'text-foreground',
              isPrivacyBlurred && 'ptd-privacy-blur',
            ]"
          >
            {{ formatRatio(item, "trueRatio") }}
          </span>
        </template>

        <!-- 发布数 -->
        <template #cell-uploads="{ item }">
          <span
            :class="[
              'inline-block whitespace-nowrap text-xs tabular-nums transition-[filter] duration-150',
              isPrivacyBlurred && 'ptd-privacy-blur',
            ]"
          >
            {{ item.uploads ?? "-" }}
          </span>
        </template>

        <!-- 做种数 & H&R 预警 -->
        <template #cell-seeding="{ item }">
          <div
            :class="[
              'flex flex-col items-end gap-0.5 tabular-nums transition-[filter] duration-150',
              isPrivacyBlurred && 'ptd-privacy-blur',
            ]"
          >
            <span class="whitespace-nowrap text-xs">{{ item.seeding ?? "-" }}</span>
            <div
              v-if="
                configStore.myDataTableControl.showHnR &&
                ((item.hnrPreWarning ?? 0) > 0 || (item.hnrUnsatisfied ?? 0) > 0)
              "
              class="inline-flex items-center gap-1"
            >
              <Badge
                v-if="(item.hnrPreWarning ?? 0) > 0"
                variant="warning"
                class="px-1 py-0 text-[10px]"
                :title="isPrivacyBlurred ? undefined : t('levelRequirement.hnrPreWarning')"
              >
                <AlertTriangle class="size-2.5" />
                {{ item.hnrPreWarning }}
              </Badge>
              <Badge
                v-if="(item.hnrUnsatisfied ?? 0) > 0"
                variant="destructive"
                class="px-1 py-0 text-[10px]"
                :title="isPrivacyBlurred ? undefined : t('levelRequirement.hnrUnsatisfied')"
              >
                <AlertCircle class="size-2.5" />
                {{ item.hnrUnsatisfied }}
              </Badge>
            </div>
          </div>
        </template>

        <!-- 做种量 -->
        <template #cell-seedingSize="{ item }">
          <span
            :class="[
              'inline-block whitespace-nowrap text-xs tabular-nums transition-[filter] duration-150',
              isPrivacyBlurred && 'ptd-privacy-blur',
            ]"
          >
            {{ typeof item.seedingSize !== "undefined" ? formatSize(item.seedingSize) : "-" }}
          </span>
        </template>

        <!-- 魔力/积分 -->
        <template #cell-bonus="{ item }">
          <div
            :class="[
              'flex flex-col items-end gap-0.5 text-xs tabular-nums transition-[filter] duration-150',
              isPrivacyBlurred && 'ptd-privacy-blur',
            ]"
          >
            <span class="inline-flex items-center gap-1 whitespace-nowrap">
              <Coins
                class="size-3.5 shrink-0 text-warning"
                :title="isPrivacyBlurred ? undefined : t('levelRequirement.bonus')"
              />
              <BonusFormatSpan :num="item.bonus" />
            </span>
            <span
              v-if="
                configStore.myDataTableControl.showSeedingBonus &&
                item.seedingBonus !== '' &&
                !isUndefined(item.seedingBonus)
              "
              class="inline-flex items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground"
            >
              <Zap
                class="size-3 shrink-0 text-success"
                :title="isPrivacyBlurred ? undefined : t('levelRequirement.seedingBonus')"
              />
              <BonusFormatSpan :num="item.seedingBonus" />
            </span>
          </div>
        </template>

        <!-- 时魔 -->
        <template #cell-bonusPerHour="{ item }">
          <span :class="['inline-block transition-[filter] duration-150', isPrivacyBlurred && 'ptd-privacy-blur']">
            <BonusFormatSpan :num="item.bonusPerHour" class="text-xs" />
          </span>
        </template>

        <!-- 邀请数 -->
        <template #cell-invites="{ item }">
          <span
            :class="[
              'inline-block whitespace-nowrap text-xs tabular-nums transition-[filter] duration-150',
              isPrivacyBlurred && 'ptd-privacy-blur',
            ]"
          >
            {{ typeof item.invites !== "undefined" ? item.invites : "-" }}
          </span>
        </template>

        <!-- 入站时间 -->
        <template #cell-joinTime="{ item }">
          <span
            :class="[
              'inline-block whitespace-nowrap text-xs tabular-nums text-muted-foreground transition-[filter] duration-150',
              isPrivacyBlurred && 'ptd-privacy-blur',
            ]"
            :title="isPrivacyBlurred ? undefined : item.joinTime ? String(formatDate(item.joinTime)) : '-'"
          >
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
        <template #cell-lastAccessAt="{ item }">
          <span
            :class="[
              'inline-flex items-center gap-1 whitespace-nowrap text-xs tabular-nums text-muted-foreground transition-[filter] duration-150',
              isPrivacyBlurred && 'ptd-privacy-blur',
            ]"
            :title="isPrivacyBlurred ? undefined : item.lastAccessAt ? String(formatDate(item.lastAccessAt)) : '-'"
          >
            <template v-if="typeof item.lastAccessAt !== 'undefined'">
              <span>{{ formatDate(item.lastAccessAt) }}</span>
              <Tooltip
                v-if="(item as any).lastAccessDuration >= 5"
                :content="t('MyData.table.lastAccessDurationNote', [(item as any).lastAccessDuration])"
              >
                <AlertTriangle
                  :class="[
                    'size-3.5 shrink-0',
                    (item as any).lastAccessDuration >= 15 ? 'text-destructive' : 'text-warning',
                  ]"
                />
              </Tooltip>
            </template>
            <template v-else>-</template>
          </span>
        </template>

        <!-- 更新时间 / 状态 -->
        <template #cell-updateAt="{ item }">
          <div :class="['inline-block transition-[filter] duration-150', isPrivacyBlurred && 'ptd-privacy-blur']">
            <template v-if="item.status === EResultParseStatus.success">
              <span
                class="whitespace-nowrap text-xs tabular-nums text-muted-foreground"
                :title="isPrivacyBlurred ? undefined : item.updateAt ? String(formatDate(item.updateAt)) : '-'"
              >
                {{
                  item.updateAt
                    ? configStore.myDataTableControl.updateAtFormatAsAlive
                      ? formatTimeAgo(item.updateAt)
                      : formatDate(item.updateAt)
                    : "-"
                }}
              </span>
            </template>
            <ResultParseStatus v-else :status="item.status" />
          </div>
        </template>

        <!-- 操作 -->
        <template #cell-action="{ item }">
          <div class="inline-flex items-center justify-center gap-1">
            <Tooltip :content="t('MyData.table.action.viewHistoryData')">
              <Button variant="ghost" size="icon-xs" @click="() => viewHistoryData(item.site)">
                <History class="size-3.5" />
              </Button>
            </Tooltip>
            <Tooltip :content="t('MyData.table.action.flushData')">
              <Button
                variant="ghost"
                size="icon-xs"
                class="text-primary hover:bg-primary/10 hover:text-primary"
                :disabled="runtimeStore.userInfo.flushPlan[item.site]"
                @click="() => flushSiteLastUserInfo([item.site])"
              >
                <RefreshCw :class="['size-3.5', runtimeStore.userInfo.flushPlan[item.site] ? 'animate-spin' : '']" />
              </Button>
            </Tooltip>
          </div>
        </template>
      </DataTable>
    </Card>

    <HistoryDataViewDialog v-model="showHistoryDataViewDialog" :site-id="historyDataViewDialogSiteId!" />
    <ExportUserInfoDialog v-model="showExportDialog" :selected-site-ids="tableSelected" />
  </div>
</template>
