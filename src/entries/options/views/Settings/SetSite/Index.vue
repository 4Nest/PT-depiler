<script setup lang="ts">
import { computed, ref } from "vue";
import { vOnLongPress } from "@vueuse/components";
import type { OnLongPressOptions } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import type { TSiteID } from "@ptd/site";
import {
  ArrowDown,
  ArrowUp,
  Crosshair,
  ExternalLink,
  Globe,
  Loader2,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  Wrench,
  X,
} from "lucide-vue-next";

import { sendMessage } from "@/messages.ts";
import { useConfigStore } from "@/options/stores/config.ts";
import { useMetadataStore } from "@/options/stores/metadata.ts";
import { useRuntimeStore } from "@/options/stores/runtime.ts";
import { useTableCustomFilter } from "@/options/directives/useAdvanceFilter.ts";

import AddDialog from "./AddDialog.vue";
import EditDialog from "./EditDialog.vue";
import EditSearchEntryList from "./EditSearchEntryList.vue";
import OneClickImportDialog from "./OneClickImportDialog.vue";
import RebuildMapDialog from "./RebuildMapDialog.vue";
import SiteFavicon from "@/options/components/SiteFavicon/Index.vue";
import DeleteDialog from "@/options/components/DeleteDialog.vue";
import { allAddedSiteInfo, type ISiteTableItem } from "./utils.ts";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  DataTable,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
  Switch,
  Tooltip,
  type DataTableColumn,
  type DataTableSortItem,
} from "~/components/ui";

const { t } = useI18n();

const configStore = useConfigStore();
const runtimeStore = useRuntimeStore();
const metadataStore = useMetadataStore();

const showAddDialog = ref<boolean>(false);
const showEditDialog = ref<boolean>(false);
const showDeleteDialog = ref<boolean>(false);
const showOneClickImportDialog = ref<boolean>(false);
const showRebuildMapDialog = ref<boolean>(false);

const tableColumns = computed<DataTableColumn<ISiteTableItem>[]>(() => {
  const cols: DataTableColumn<ISiteTableItem>[] = [
    {
      title: "№",
      key: "userConfig.sortIndex",
      align: "center",
      width: 68,
      sortable: true,
    },
    {
      title: t("SetSite.common.name"),
      key: "name",
      align: "start",
      sortable: false,
      minWidth: 150,
    },
    {
      title: t("SetSite.common.groups"),
      key: "groups",
      align: "start",
      sortable: false,
      minWidth: 120,
    },
    {
      title: t("SetSite.common.url"),
      key: "url",
      align: "start",
      sortable: false,
      minWidth: 180,
    },
    {
      title: t("SetSite.common.isOffline"),
      key: "userConfig.isOffline",
      align: "center",
      width: 84,
    },
    {
      title: t("SetSite.common.allowSearch"),
      key: "userConfig.allowSearch",
      align: "center",
      width: 88,
    },
    {
      title: t("SetSite.common.allowQueryUserInfo"),
      key: "userConfig.allowQueryUserInfo",
      align: "center",
      width: 100,
    },
  ];

  if (configStore.contentScript.enabled && configStore.contentScript.allowExceptionSites) {
    cols.push({
      title: t("SetSite.common.allowContentScript"),
      key: "userConfig.allowContentScript",
      align: "center",
      width: 96,
    });
  }

  cols.push({
    title: t("common.action"),
    key: "action",
    align: "end",
    sortable: false,
    width: 188,
  });

  return cols;
});

const booleanUserConfigKeywords = ["isOffline", "allowSearch", "allowQueryUserInfo"] as const;

const {
  tableWaitFilterRef,
  tableFilterRef,
  tableFilterFn,
  advanceFilterDictRef,
  buildFilterDictFn,
  updateTableFilterValueFn,
} = useTableCustomFilter<ISiteTableItem>({
  parseOptions: {
    keywords: ["id", ...booleanUserConfigKeywords.map((x) => `userConfig.${x}`), "userConfig.groups"],
  },
  titleFields: ["metadata.name", "metadata.urls", "userConfig.merge.name", "userConfig.url"],
  format: {
    ...Object.fromEntries(booleanUserConfigKeywords.map((x) => [`userConfig.${x}`, "boolean"])),
  },
});

function getBooleanFilterState(field: string): boolean | "indeterminate" {
  const entry = advanceFilterDictRef.value[field];
  if (!entry) return false;
  if (entry.required?.includes("1")) return true;
  if (entry.exclude?.includes("1")) return "indeterminate";
  return false;
}

function cycleBooleanFilterState(field: string) {
  const entry = advanceFilterDictRef.value[field] ?? { required: [], exclude: [] };
  if (entry.required?.includes("1")) {
    entry.required = [];
    entry.exclude = ["1"];
  } else if (entry.exclude?.includes("1")) {
    entry.required = [];
    entry.exclude = [];
  } else {
    entry.required = ["1"];
    entry.exclude = [];
  }
  advanceFilterDictRef.value[field] = entry;
  updateTableFilterValueFn();
}

function getGroupFilterState(group: string): boolean | "indeterminate" {
  const entry = advanceFilterDictRef.value["userConfig.groups"];
  if (!entry) return false;
  if (entry.required?.includes(group)) return true;
  if (entry.exclude?.includes(group)) return "indeterminate";
  return false;
}

function cycleGroupFilterState(group: string) {
  const entry = advanceFilterDictRef.value["userConfig.groups"] ?? { required: [], exclude: [] };
  if (entry.required?.includes(group)) {
    entry.required = entry.required.filter((x: string) => x !== group);
    entry.exclude = [...(entry.exclude ?? []), group];
  } else if (entry.exclude?.includes(group)) {
    entry.exclude = entry.exclude.filter((x: string) => x !== group);
  } else {
    entry.required = [...(entry.required ?? []), group];
  }
  advanceFilterDictRef.value["userConfig.groups"] = entry;
  updateTableFilterValueFn();
}

const activeFilterCount = computed(() => {
  let count = 0;
  for (const kw of booleanUserConfigKeywords) {
    if (getBooleanFilterState(`userConfig.${kw}`) !== false) count++;
  }
  const groupEntry = advanceFilterDictRef.value["userConfig.groups"];
  if (groupEntry) {
    count += (groupEntry.required?.length ?? 0) + (groupEntry.exclude?.length ?? 0);
  }
  return count;
});

function clearSearchAndFilter() {
  tableWaitFilterRef.value = "";
  buildFilterDictFn("");
}

const tableSelected = ref<TSiteID[]>([]);

const toEditId = ref<TSiteID | null>("");
function editSite(siteId: TSiteID) {
  toEditId.value = siteId;
  showEditDialog.value = true;
}

const toDeleteIds = ref<TSiteID[]>([]);
function deleteSite(siteId: TSiteID[]) {
  toDeleteIds.value = siteId;
  showDeleteDialog.value = true;
}

async function confirmDeleteSite(siteId: TSiteID) {
  return await metadataStore.removeSite(siteId);
}

const isFaviconFlushing = ref(false);
async function flushSiteFavicon(siteId: TSiteID | TSiteID[]) {
  const siteIds = Array.isArray(siteId) ? siteId : [siteId];
  isFaviconFlushing.value = true;
  try {
    for (const id of siteIds) {
      await sendMessage("getSiteFavicon", { site: id, flush: true });
    }
    runtimeStore.showSnackbar(t("SetSite.index.flushFaviconFinish"), { color: "success" });
  } finally {
    isFaviconFlushing.value = false;
  }
}

const orderedSiteIds = computed(() => metadataStore.getSortedAddedSites.map((x) => x.id));

const sortIndexSortBy = computed(() =>
  (configStore.tableBehavior.SetSite.sortBy ?? []).find((sortBy) => sortBy.key === "userConfig.sortIndex"),
);
const isSortBySortIndex = computed(() => sortIndexSortBy.value !== undefined);
const isSortIndexAsc = computed(() => sortIndexSortBy.value?.order === "asc");

function resolveSortIndexPosition(position: "up" | "down" | "top" | "bottom"): "up" | "down" | "top" | "bottom" {
  if (!isSortIndexAsc.value) return position;
  switch (position) {
    case "up":
      return "down";
    case "down":
      return "up";
    case "top":
      return "bottom";
    default:
      return "top";
  }
}

function canMoveSiteSortIndex(siteId: TSiteID, direction: "up" | "down") {
  if (!isSortBySortIndex.value) return false;
  const index = orderedSiteIds.value.indexOf(siteId);
  const position = resolveSortIndexPosition(direction);
  return position === "up" ? index > 0 : index !== -1 && index < orderedSiteIds.value.length - 1;
}

async function moveSiteSortIndex(siteId: TSiteID, position: "up" | "down" | "top" | "bottom") {
  const isRedistributed = await metadataStore.moveSiteSortIndex(siteId, resolveSortIndexPosition(position));
  if (isRedistributed) {
    runtimeStore.showSnackbar(t("SetSite.index.sortIndexRedistributed"), { color: "info" });
  }
}

const SORT_INDEX_LONG_PRESS_DELAY = 600;
function sortIndexLongPressBinding(siteId: TSiteID, position: "up" | "down"): [() => void, OnLongPressOptions] {
  const edgePosition = position === "up" ? "top" : "bottom";
  return [
    () => void moveSiteSortIndex(siteId, edgePosition),
    {
      delay: SORT_INDEX_LONG_PRESS_DELAY,
      modifiers: { prevent: true },
      onMouseUp: (_duration, _distance, isLongPress) => {
        if (!isLongPress) void moveSiteSortIndex(siteId, position);
      },
    },
  ];
}

function formatSiteDescription(desc: string | string[] | undefined): string {
  if (!desc) return "";
  return Array.isArray(desc) ? desc.join("\n") : desc;
}
</script>

<template>
  <Card class="overflow-hidden">
    <!-- 顶部工具栏 -->
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
      <div class="flex flex-wrap items-center gap-2">
        <Button size="sm" @click="showAddDialog = true">
          <Plus class="size-4" />
          {{ t("common.btn.add") }}
        </Button>

        <Button variant="outline" size="sm" @click="showOneClickImportDialog = true">
          <Crosshair class="size-4" />
          {{ t("SetSite.index.oneClickImport") }}
        </Button>

        <Separator orientation="vertical" class="mx-0.5 hidden h-5 sm:block" />

        <Button
          variant="outline"
          size="sm"
          :disabled="tableSelected.length === 0 || isFaviconFlushing"
          @click="flushSiteFavicon(tableSelected)"
        >
          <Loader2 v-if="isFaviconFlushing" class="size-4 animate-spin" />
          <RefreshCw v-else class="size-4" />
          {{ t("SetSite.index.table.flushFavicon") }}
        </Button>

        <Button
          variant="destructive"
          size="sm"
          :disabled="tableSelected.length === 0"
          @click="deleteSite(tableSelected)"
        >
          <Trash2 class="size-4" />
          {{ t("common.remove") }}
        </Button>
      </div>

      <div class="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        <Button variant="ghost" size="sm" @click="showRebuildMapDialog = true">
          <Wrench class="size-4" />
          {{ t("SetSite.index.reBuildMap") }}
        </Button>

        <div class="flex min-w-0 flex-1 items-center gap-1.5 sm:flex-none">
          <Popover @update:open="(open) => open && buildFilterDictFn(tableWaitFilterRef)">
            <PopoverTrigger as-child>
              <Button variant="outline" size="sm" class="relative gap-1.5 px-2.5">
                <SlidersHorizontal class="size-3.5" />
                <Badge v-if="activeFilterCount > 0" variant="default" class="h-4 px-1 text-[10px] tabular-nums">
                  {{ activeFilterCount }}
                </Badge>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" class="w-72 p-3">
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-semibold text-foreground">{{ t("common.advancedSettings") }}</span>
                  <button
                    v-if="activeFilterCount > 0"
                    type="button"
                    class="text-[11px] text-primary hover:underline"
                    @click="clearSearchAndFilter"
                  >
                    {{ t("common.dialog.reset") }}
                  </button>
                </div>

                <div class="space-y-1.5">
                  <div
                    v-for="keyword in booleanUserConfigKeywords"
                    :key="keyword"
                    class="flex cursor-pointer items-center justify-between rounded-md px-1.5 py-1 hover:bg-muted/50"
                    @click="cycleBooleanFilterState(`userConfig.${keyword}`)"
                  >
                    <div class="flex items-center gap-2">
                      <Checkbox
                        :model-value="getBooleanFilterState(`userConfig.${keyword}`)"
                        @click.stop
                        @update:model-value="cycleBooleanFilterState(`userConfig.${keyword}`)"
                      />
                      <Label class="cursor-pointer text-xs font-normal">
                        {{ t(`SetSite.common.${keyword}`) }}
                      </Label>
                    </div>
                    <span class="text-[10px] text-muted-foreground">
                      {{
                        getBooleanFilterState(`userConfig.${keyword}`) === true
                          ? "✓"
                          : getBooleanFilterState(`userConfig.${keyword}`) === "indeterminate"
                            ? "−"
                            : ""
                      }}
                    </span>
                  </div>
                </div>

                <template v-if="Object.keys(metadataStore.getSitesGroupData).length > 0">
                  <Separator />
                  <div class="space-y-1.5">
                    <div class="text-xs font-medium text-muted-foreground">
                      {{ t("SetSite.common.groups") }}
                    </div>
                    <div class="max-h-48 space-y-1 overflow-y-auto pr-1">
                      <div
                        v-for="(item, groupName) in metadataStore.getSitesGroupData"
                        :key="groupName"
                        class="flex cursor-pointer items-center justify-between rounded-md px-1.5 py-1 hover:bg-muted/50"
                        @click="cycleGroupFilterState(String(groupName))"
                      >
                        <div class="flex min-w-0 items-center gap-2">
                          <Checkbox
                            :model-value="getGroupFilterState(String(groupName))"
                            @click.stop
                            @update:model-value="cycleGroupFilterState(String(groupName))"
                          />
                          <span class="truncate text-xs text-foreground">{{ groupName }}</span>
                        </div>
                        <span class="text-[11px] text-muted-foreground tabular-nums">({{ item.length }})</span>
                      </div>
                    </div>
                  </div>
                </template>
              </div>
            </PopoverContent>
          </Popover>

          <div class="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
            <Search
              class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input v-model="tableWaitFilterRef" :placeholder="t('common.search')" class="h-8 pl-8 pr-7 text-xs" />
            <button
              v-if="tableWaitFilterRef"
              type="button"
              class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              @click="clearSearchAndFilter"
            >
              <X class="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 站点表格 -->
    <DataTable
      v-model:selected="tableSelected"
      :columns="tableColumns"
      :items="allAddedSiteInfo ?? []"
      row-key="id"
      selectable
      :search="tableFilterRef"
      :filter-keys="['id']"
      :custom-filter="tableFilterFn"
      :sort-by="configStore.tableBehavior.SetSite.sortBy ?? []"
      :items-per-page="configStore.tableBehavior.SetSite.itemsPerPage ?? -1"
      :multi-sort="configStore.enableTableMultiSort"
      :sticky-action-column="configStore.tableActionColumnFixed"
      :action-position="configStore.tableActionColumnPosition"
      @update:items-per-page="(v: number) => configStore.updateTableBehavior('SetSite', 'itemsPerPage', v)"
      @update:sort-by="(v: DataTableSortItem[]) => configStore.updateTableBehavior('SetSite', 'sortBy', v)"
    >
      <template #cell-userConfig.sortIndex="{ item }">
        <div class="flex flex-col items-center justify-center gap-0.5">
          <SiteFavicon :site-id="item.id" :size="20" />
          <span class="text-[10px] leading-none text-muted-foreground tabular-nums">
            {{ item.userConfig.sortIndex ?? 0 }}
          </span>
        </div>
      </template>

      <template #cell-name="{ item }">
        <div class="flex items-center gap-1.5">
          <Tooltip
            :content="
              t(item.metadata.type === 'private' ? 'SetSite.common.siteTypePrivate' : 'SetSite.common.siteTypePublic')
            "
          >
            <Lock v-if="item.metadata.type === 'private'" class="size-3.5 shrink-0 text-primary" />
            <Globe v-else class="size-3.5 shrink-0 text-muted-foreground" />
          </Tooltip>

          <Tooltip :content="formatSiteDescription(item.metadata.description)" :disabled="!item.metadata.description">
            <span class="font-medium text-foreground">
              {{ item.userConfig?.merge?.name ?? item.metadata?.name }}
            </span>
          </Tooltip>

          <Badge v-if="item.metadata.isDead" variant="destructive" class="px-1.5 py-0 text-[10px]">
            {{ t("SetSite.common.isOffline") }}
          </Badge>
        </div>
      </template>

      <template #cell-groups="{ item }">
        <div class="flex flex-wrap gap-1">
          <Badge
            v-for="group in item.userConfig.groups ?? []"
            :key="group"
            variant="secondary"
            class="px-1.5 py-0 text-[11px] font-normal"
          >
            {{ group }}
          </Badge>
          <span v-if="!item.userConfig.groups?.length" class="text-xs text-muted-foreground/60">—</span>
        </div>
      </template>

      <template #cell-url="{ item }">
        <a
          :href="item.userConfig?.url ?? item.metadata?.urls?.[0]"
          target="_blank"
          rel="noopener noreferrer nofollow"
          class="inline-flex max-w-[240px] items-center gap-1 text-xs font-medium text-primary hover:underline underline-offset-4"
        >
          <span class="truncate font-mono">{{ item.userConfig?.url ?? item.metadata?.urls?.[0] }}</span>
          <ExternalLink class="size-3 shrink-0" />
        </a>
      </template>

      <template #cell-userConfig.isOffline="{ item }">
        <div class="flex justify-center">
          <Switch
            :model-value="Boolean(item.userConfig.isOffline)"
            :disabled="Boolean(item.metadata.isDead)"
            @update:model-value="(v) => metadataStore.simplePatch('sites', item.id, 'isOffline', v)"
          />
        </div>
      </template>

      <template #cell-userConfig.allowSearch="{ item }">
        <div class="flex justify-center">
          <Switch
            :model-value="Boolean(item.userConfig.allowSearch)"
            :disabled="Boolean(item.metadata.isDead || item.userConfig.isOffline || !item.metadata.hasSearch)"
            @update:model-value="(v) => metadataStore.simplePatch('sites', item.id, 'allowSearch', v)"
          />
        </div>
      </template>

      <template #cell-userConfig.allowQueryUserInfo="{ item }">
        <div class="flex justify-center">
          <Switch
            :model-value="Boolean(item.userConfig.allowQueryUserInfo)"
            :disabled="Boolean(item.metadata.isDead || item.userConfig.isOffline || !item.metadata.hasUserInfo)"
            @update:model-value="(v) => metadataStore.simplePatch('sites', item.id, 'allowQueryUserInfo', v)"
          />
        </div>
      </template>

      <template #cell-userConfig.allowContentScript="{ item }">
        <div class="flex justify-center">
          <Switch
            :model-value="Boolean(item.userConfig.allowContentScript)"
            :disabled="Boolean(item.metadata.isDead || item.userConfig.isOffline)"
            @update:model-value="(v) => metadataStore.simplePatch('sites', item.id, 'allowContentScript', v)"
          />
        </div>
      </template>

      <template #cell-action="{ item }">
        <div class="inline-flex items-center justify-end gap-0.5">
          <Tooltip :content="t('common.edit')">
            <Button variant="ghost" size="icon-xs" :disabled="Boolean(item.metadata.isDead)" @click="editSite(item.id)">
              <Pencil class="size-3.5 text-info" />
            </Button>
          </Tooltip>

          <Popover>
            <Tooltip :content="t('SetSite.index.table.searchEntries')">
              <PopoverTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  :disabled="Boolean(item.metadata.isDead || !item.metadata.searchEntries)"
                >
                  <Search class="size-3.5 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
            </Tooltip>
            <PopoverContent align="end" class="w-64 p-3">
              <EditSearchEntryList :item="item" />
            </PopoverContent>
          </Popover>

          <Separator orientation="vertical" class="mx-0.5 h-3.5" />

          <Tooltip
            :content="isSortBySortIndex ? t('SetSite.index.table.moveUp') : t('SetSite.index.table.moveNeedSortIndex')"
          >
            <Button
              v-on-long-press="sortIndexLongPressBinding(item.id, 'up')"
              variant="ghost"
              size="icon-xs"
              :disabled="!canMoveSiteSortIndex(item.id, 'up')"
            >
              <ArrowUp class="size-3.5 text-warning" />
            </Button>
          </Tooltip>

          <Tooltip
            :content="
              isSortBySortIndex ? t('SetSite.index.table.moveDown') : t('SetSite.index.table.moveNeedSortIndex')
            "
          >
            <Button
              v-on-long-press="sortIndexLongPressBinding(item.id, 'down')"
              variant="ghost"
              size="icon-xs"
              :disabled="!canMoveSiteSortIndex(item.id, 'down')"
            >
              <ArrowDown class="size-3.5 text-warning" />
            </Button>
          </Tooltip>

          <Tooltip :content="t('SetSite.index.table.flushFavicon')">
            <Button
              variant="ghost"
              size="icon-xs"
              :disabled="Boolean(item.metadata.isDead) || isFaviconFlushing"
              @click="flushSiteFavicon(item.id)"
            >
              <RefreshCw class="size-3.5 text-primary" />
            </Button>
          </Tooltip>

          <Separator orientation="vertical" class="mx-0.5 h-3.5" />

          <Tooltip :content="t('common.remove')">
            <Button variant="ghost" size="icon-xs" @click="deleteSite([item.id])">
              <Trash2 class="size-3.5 text-destructive" />
            </Button>
          </Tooltip>
        </div>
      </template>

      <!-- 移动端站点配置卡片 -->
      <template #mobile-card="{ item, selected, canSelect, toggle }">
        <div class="px-3.5 py-3">
          <div class="flex items-center justify-between gap-2">
            <div class="flex min-w-0 items-center gap-2">
              <Checkbox :model-value="selected" :disabled="!canSelect" @update:model-value="toggle" />
              <SiteFavicon :site-id="item.id" :size="20" class="shrink-0" />
              <Lock v-if="item.metadata.type === 'private'" class="size-3.5 shrink-0 text-primary" />
              <Globe v-else class="size-3.5 shrink-0 text-muted-foreground" />
              <span class="truncate text-sm font-semibold text-foreground">
                {{ item.userConfig?.merge?.name ?? item.metadata?.name }}
              </span>
              <Badge v-if="item.metadata.isDead" variant="destructive" class="shrink-0 px-1.5 py-0 text-[10px]">
                {{ t("SetSite.common.isOffline") }}
              </Badge>
            </div>

            <div class="inline-flex shrink-0 items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon-xs"
                class="size-7"
                :disabled="Boolean(item.metadata.isDead)"
                @click="editSite(item.id)"
              >
                <Pencil class="size-3.5 text-info" />
              </Button>
              <Popover>
                <PopoverTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    class="size-7"
                    :disabled="Boolean(item.metadata.isDead || !item.metadata.searchEntries)"
                  >
                    <Search class="size-3.5 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" class="w-64 p-3">
                  <EditSearchEntryList :item="item" />
                </PopoverContent>
              </Popover>
              <Button
                v-on-long-press="sortIndexLongPressBinding(item.id, 'up')"
                variant="ghost"
                size="icon-xs"
                class="size-7"
                :disabled="!canMoveSiteSortIndex(item.id, 'up')"
              >
                <ArrowUp class="size-3.5 text-warning" />
              </Button>
              <Button
                v-on-long-press="sortIndexLongPressBinding(item.id, 'down')"
                variant="ghost"
                size="icon-xs"
                class="size-7"
                :disabled="!canMoveSiteSortIndex(item.id, 'down')"
              >
                <ArrowDown class="size-3.5 text-warning" />
              </Button>
              <Button variant="ghost" size="icon-xs" class="size-7" @click="deleteSite([item.id])">
                <Trash2 class="size-3.5 text-destructive" />
              </Button>
            </div>
          </div>

          <div class="mt-1.5 flex flex-wrap items-center gap-1.5 pl-6">
            <a
              :href="item.userConfig?.url ?? item.metadata?.urls?.[0]"
              target="_blank"
              rel="noopener noreferrer nofollow"
              class="inline-flex max-w-full items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <span class="truncate font-mono">{{ item.userConfig?.url ?? item.metadata?.urls?.[0] }}</span>
              <ExternalLink class="size-3 shrink-0" />
            </a>
            <Badge
              v-for="group in item.userConfig.groups ?? []"
              :key="group"
              variant="secondary"
              class="px-1.5 py-0 text-[10px] font-normal"
            >
              {{ group }}
            </Badge>
          </div>

          <div class="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 pl-6 text-xs">
            <label class="flex items-center justify-between gap-2 text-muted-foreground">
              <span class="truncate">{{ t("SetSite.common.allowSearch") }}</span>
              <Switch
                :model-value="Boolean(item.userConfig.allowSearch)"
                :disabled="Boolean(item.metadata.isDead || item.userConfig.isOffline || !item.metadata.hasSearch)"
                @update:model-value="(v) => metadataStore.simplePatch('sites', item.id, 'allowSearch', v)"
              />
            </label>
            <label class="flex items-center justify-between gap-2 text-muted-foreground">
              <span class="truncate">{{ t("SetSite.common.allowQueryUserInfo") }}</span>
              <Switch
                :model-value="Boolean(item.userConfig.allowQueryUserInfo)"
                :disabled="Boolean(item.metadata.isDead || item.userConfig.isOffline || !item.metadata.hasUserInfo)"
                @update:model-value="(v) => metadataStore.simplePatch('sites', item.id, 'allowQueryUserInfo', v)"
              />
            </label>
            <label class="flex items-center justify-between gap-2 text-muted-foreground">
              <span class="truncate">{{ t("SetSite.common.allowContentScript") }}</span>
              <Switch
                :model-value="Boolean(item.userConfig.allowContentScript)"
                :disabled="Boolean(item.metadata.isDead || item.userConfig.isOffline)"
                @update:model-value="(v) => metadataStore.simplePatch('sites', item.id, 'allowContentScript', v)"
              />
            </label>
            <label class="flex items-center justify-between gap-2 text-muted-foreground">
              <span class="truncate">{{ t("SetSite.common.isOffline") }}</span>
              <Switch
                :model-value="Boolean(item.userConfig.isOffline)"
                :disabled="Boolean(item.metadata.isDead)"
                @update:model-value="(v) => metadataStore.simplePatch('sites', item.id, 'isOffline', v)"
              />
            </label>
          </div>
        </div>
      </template>
    </DataTable>
  </Card>

  <AddDialog v-model="showAddDialog" />
  <DeleteDialog v-model="showDeleteDialog" :to-delete-ids="toDeleteIds" :confirm-delete="confirmDeleteSite" />
  <EditDialog v-model="showEditDialog" :site-id="toEditId!" />
  <OneClickImportDialog v-model="showOneClickImportDialog" />
  <RebuildMapDialog v-model="showRebuildMapDialog" />
</template>
