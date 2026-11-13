<script setup lang="ts">
import { computed, ref } from "vue";
import { computedAsync } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import { countBy } from "es-toolkit";
import {
  Download,
  ExternalLink,
  Filter,
  FolderCog,
  Loader2,
  Pencil,
  Plus,
  Radio,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-vue-next";

import { useMetadataStore } from "@/options/stores/metadata.ts";
import { useConfigStore } from "@/options/stores/config.ts";
import { useRuntimeStore } from "@/options/stores/runtime.ts";
import type { IDownloaderMetadata, TDownloaderKey } from "@/shared/types.ts";
import { getDownloader, getDownloaderIcon, getDownloaderMetaData, type TorrentClientMetaData } from "@ptd/downloader";
import { useTableCustomFilter } from "@/options/directives/useAdvanceFilter.ts";
import { cn } from "~/lib/utils";

import AddDialog from "./AddDialog.vue";
import EditDialog from "./EditDialog.vue";
import PathAndTagSuggestDialog from "./PathAndTagSuggestDialog.vue";
import SiteFilterDialog from "./SiteFilterDialog.vue";
import DefaultDownloaderEditDialog from "./DefaultDownloaderEditDialog.vue";
import DeleteDialog from "@/options/components/DeleteDialog.vue";
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
const metadataStore = useMetadataStore();
const configStore = useConfigStore();
const runtimeStore = useRuntimeStore();

const showAddDialog = ref<boolean>(false);
const showEditDialog = ref<boolean>(false);
const showDefaultDownloaderEditDialog = ref<boolean>(false);
const showSiteFilterDialog = ref<boolean>(false);
const showPathAndTagSuggestDialog = ref<boolean>(false);
const showDeleteDialog = ref<boolean>(false);

const downloaderTypeCount = computed(() => countBy(metadataStore.getDownloaders, (x) => x.type));

const downloaderMetadata = computedAsync(async () => {
  const downloaderMetaData: Record<string, TorrentClientMetaData> = {};
  for (const type of new Set(metadataStore.getDownloaders.map((x) => x.type))) {
    downloaderMetaData[type] = await getDownloaderMetaData(type);
  }
  return downloaderMetaData;
}, {});

const tableColumns = computed<DataTableColumn<IDownloaderMetadata>[]>(() => [
  { title: "№", key: "sortIndex", align: "end", width: 72 },
  { title: t("common.type"), key: "type", align: "center", width: 72 },
  { title: t("SetDownloader.common.name"), key: "name", align: "start", minWidth: 150 },
  { title: t("SetDownloader.common.address"), key: "address", align: "start", minWidth: 180 },
  { title: t("common.username"), key: "username", align: "start", minWidth: 100 },
  { title: t("SetDownloader.index.table.enabled"), key: "enabled", align: "center", width: 88 },
  {
    title: t("SetDownloader.index.table.autodl"),
    key: "feature.DefaultAutoStart",
    align: "center",
    width: 100,
  },
  { title: t("common.action"), key: "action", align: "end", sortable: false, width: 176 },
]);

const tableSelected = ref<TDownloaderKey[]>([]);

const booleanField = {
  "feature.DefaultAutoStart": "SetDownloader.index.table.autodl",
  enabled: "SetDownloader.index.table.enabled",
} as const;

const {
  tableWaitFilterRef,
  tableFilterRef,
  tableFilterFn,
  advanceFilterDictRef,
  updateTableFilterValueFn,
  buildFilterDictFn,
} = useTableCustomFilter<IDownloaderMetadata>({
  parseOptions: {
    keywords: ["type", ...Object.keys(booleanField)],
  },
  titleFields: ["name", "address"],
  format: {
    enabled: "boolean",
    "feature.DefaultAutoStart": "boolean",
  },
  initialItems: metadataStore.getDownloaders,
  watchItems: true,
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

function getTypeFilterState(type: string): boolean | "indeterminate" {
  const entry = advanceFilterDictRef.value.type;
  if (!entry) return false;
  if (entry.required?.includes(type)) return true;
  if (entry.exclude?.includes(type)) return "indeterminate";
  return false;
}

function cycleTypeFilterState(type: string) {
  const entry = advanceFilterDictRef.value.type ?? { required: [], exclude: [] };
  if (entry.required?.includes(type)) {
    entry.required = entry.required.filter((x: string) => x !== type);
    entry.exclude = [...(entry.exclude ?? []), type];
  } else if (entry.exclude?.includes(type)) {
    entry.exclude = entry.exclude.filter((x: string) => x !== type);
  } else {
    entry.required = [...(entry.required ?? []), type];
  }
  advanceFilterDictRef.value.type = entry;
  updateTableFilterValueFn();
}

const activeFilterCount = computed(() => {
  let count = 0;
  for (const field of Object.keys(booleanField)) {
    if (getBooleanFilterState(field) !== false) count++;
  }
  const typeEntry = advanceFilterDictRef.value.type;
  if (typeEntry) {
    count += (typeEntry.required?.length ?? 0) + (typeEntry.exclude?.length ?? 0);
  }
  return count;
});

function clearSearchAndFilter() {
  tableWaitFilterRef.value = "";
  buildFilterDictFn("");
}

const toEditDownloaderId = ref<TDownloaderKey | null>(null);
function editDownloader(downloaderId: TDownloaderKey) {
  toEditDownloaderId.value = downloaderId;
  showEditDialog.value = true;
}

const testingDownloaderId = ref<TDownloaderKey | null>(null);
async function testDownloaderConnection(downloaderId: TDownloaderKey) {
  const config = metadataStore.downloaders[downloaderId];
  if (!config || testingDownloaderId.value === downloaderId) return;
  testingDownloaderId.value = downloaderId;
  try {
    const client = await getDownloader(config);
    const ok = await client.ping();
    if (ok) {
      const version = await client.getClientVersion().catch(() => "");
      const detail = version && version !== "unknown" ? version : t("connectCheck.success");
      runtimeStore.showSnackbar(`${config.name}: ${detail}`, { color: "success" });
    } else {
      runtimeStore.showSnackbar(`${config.name}: ${t("connectCheck.error")}`, { color: "error" });
    }
  } catch {
    runtimeStore.showSnackbar(`${config.name}: ${t("connectCheck.error")}`, { color: "error" });
  } finally {
    testingDownloaderId.value = null;
  }
}

function editDownloaderPathAndTag(downloaderId: TDownloaderKey) {
  toEditDownloaderId.value = downloaderId;
  showPathAndTagSuggestDialog.value = true;
}

function editDownloaderSiteFilter(downloaderId: TDownloaderKey) {
  toEditDownloaderId.value = downloaderId;
  showSiteFilterDialog.value = true;
}

const toDeleteIds = ref<TDownloaderKey[]>([]);
function deleteDownloader(downloaderId: TDownloaderKey[]) {
  const defaultDownloaderId = metadataStore.defaultDownloader?.id;
  toDeleteIds.value = downloaderId.filter((i) => i !== defaultDownloaderId);

  if (toDeleteIds.value.length !== downloaderId.length) {
    const skippedName = metadataStore.downloaders?.[defaultDownloaderId!]?.name ?? defaultDownloaderId!;
    runtimeStore.showSnackbar(t("SetDownloader.index.remove.defaultNotDeleted", [skippedName]), { color: "warning" });
  }

  if (toDeleteIds.value.length > 0) {
    showDeleteDialog.value = true;
  }
}

async function confirmDeleteDownloader(downloaderId: TDownloaderKey) {
  return await metadataStore.removeDownloader(downloaderId);
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

        <Button
          variant="outline"
          size="sm"
          :disabled="metadataStore.getDownloaders.length === 0"
          @click="showDefaultDownloaderEditDialog = true"
        >
          <Download class="size-4" />
          {{ t("SetDownloader.index.editDefaultDownloaderBtn") }}
        </Button>

        <Separator orientation="vertical" class="mx-0.5 h-5" />

        <Button
          variant="destructive"
          size="sm"
          :disabled="tableSelected.length === 0"
          @click="deleteDownloader(tableSelected)"
        >
          <Trash2 class="size-4" />
          {{ t("common.remove") }}
        </Button>
      </div>

      <div class="flex items-center gap-1.5">
        <Popover @update:open="(open) => open && buildFilterDictFn(tableWaitFilterRef)">
          <PopoverTrigger as-child>
            <Button variant="outline" size="sm" class="relative gap-1.5 px-2.5">
              <SlidersHorizontal class="size-3.5" />
              <Badge v-if="activeFilterCount > 0" variant="default" class="h-4 px-1 text-[10px] tabular-nums">
                {{ activeFilterCount }}
              </Badge>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" class="w-68 p-3">
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
                  v-for="(transKey, filterKey) in booleanField"
                  :key="filterKey"
                  class="flex cursor-pointer items-center justify-between rounded-md px-1.5 py-1 hover:bg-muted/50"
                  @click="cycleBooleanFilterState(filterKey)"
                >
                  <div class="flex items-center gap-2">
                    <Checkbox
                      :model-value="getBooleanFilterState(filterKey)"
                      @click.stop
                      @update:model-value="cycleBooleanFilterState(filterKey)"
                    />
                    <Label class="cursor-pointer text-xs font-normal">{{ t(transKey) }}</Label>
                  </div>
                  <span class="text-[10px] text-muted-foreground">
                    {{
                      getBooleanFilterState(filterKey) === true
                        ? "✓"
                        : getBooleanFilterState(filterKey) === "indeterminate"
                          ? "−"
                          : ""
                    }}
                  </span>
                </div>
              </div>

              <template v-if="Object.keys(downloaderTypeCount).length > 0">
                <Separator />
                <div class="space-y-1.5">
                  <div class="text-xs font-medium text-muted-foreground">
                    {{ t("SetDownloader.index.table.downloaderCategory") }}
                  </div>
                  <div class="space-y-1">
                    <div
                      v-for="(count, type) in downloaderTypeCount"
                      :key="type"
                      class="flex cursor-pointer items-center justify-between rounded-md px-1.5 py-1 hover:bg-muted/50"
                      @click="cycleTypeFilterState(String(type))"
                    >
                      <div class="flex items-center gap-2">
                        <Checkbox
                          :model-value="getTypeFilterState(String(type))"
                          @click.stop
                          @update:model-value="cycleTypeFilterState(String(type))"
                        />
                        <span class="text-xs text-foreground">{{ type }}</span>
                      </div>
                      <span class="text-[11px] text-muted-foreground tabular-nums">({{ count }})</span>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </PopoverContent>
        </Popover>

        <div class="relative w-56 sm:w-64">
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

    <!-- 下载器列表 -->
    <DataTable
      v-model:selected="tableSelected"
      :columns="tableColumns"
      :items="metadataStore.getDownloaders"
      row-key="id"
      selectable
      :search="tableFilterRef"
      :filter-keys="['id']"
      :custom-filter="tableFilterFn"
      :sort-by="configStore.tableBehavior.SetDownloader.sortBy ?? []"
      :items-per-page="configStore.tableBehavior.SetDownloader.itemsPerPage ?? 10"
      :multi-sort="configStore.enableTableMultiSort"
      :sticky-action-column="configStore.tableActionColumnFixed"
      :action-position="configStore.tableActionColumnPosition"
      :empty-text="t('SetDownloader.index.emptyNotice')"
      @update:items-per-page="(v: number) => configStore.updateTableBehavior('SetDownloader', 'itemsPerPage', v)"
      @update:sort-by="(v: DataTableSortItem[]) => configStore.updateTableBehavior('SetDownloader', 'sortBy', v)"
    >
      <template #cell-sortIndex="{ item }">
        <span class="text-xs text-muted-foreground tabular-nums">
          {{ item.sortIndex ?? 100 }}
        </span>
      </template>

      <template #cell-type="{ item }">
        <div class="flex justify-center">
          <Tooltip :content="item.type">
            <img :src="getDownloaderIcon(item.type)" :alt="item.type" class="size-7 rounded-md object-contain" />
          </Tooltip>
        </div>
      </template>

      <template #cell-name="{ item }">
        <div class="flex items-center gap-2">
          <span
            :class="
              cn(
                'font-medium',
                item.id === metadataStore.defaultDownloader?.id ? 'text-primary font-semibold' : 'text-foreground',
              )
            "
          >
            {{ item.name }}
          </span>
          <Badge
            v-if="item.id === metadataStore.defaultDownloader?.id"
            variant="default"
            class="px-1.5 py-0 text-[10px]"
          >
            {{ t("SetDownloader.index.defaultBadge") }}
          </Badge>
        </div>
      </template>

      <template #cell-address="{ item }">
        <a
          :href="item.address"
          target="_blank"
          rel="noopener noreferrer nofollow"
          class="inline-flex max-w-[260px] items-center gap-1 text-xs font-medium text-primary hover:underline underline-offset-4"
        >
          <span class="truncate font-mono">{{ item.address }}</span>
          <ExternalLink class="size-3 shrink-0" />
        </a>
      </template>

      <template #cell-username="{ item }">
        <span class="text-xs text-muted-foreground">
          {{ item.username || "—" }}
        </span>
      </template>

      <template #cell-enabled="{ item }">
        <div class="flex justify-center">
          <Switch
            :model-value="Boolean(item.enabled)"
            :disabled="item.id === metadataStore.defaultDownloader?.id"
            @update:model-value="(v) => metadataStore.simplePatch('downloaders', item.id, 'enabled', v)"
          />
        </div>
      </template>

      <template #cell-feature.DefaultAutoStart="{ item }">
        <div class="flex justify-center">
          <Switch
            :model-value="Boolean(item.feature?.DefaultAutoStart)"
            :disabled="!item.enabled || downloaderMetadata?.[item.type]?.feature?.DefaultAutoStart?.allowed === false"
            @update:model-value="
              (v) => metadataStore.simplePatch('downloaders', item.id, 'feature.DefaultAutoStart', v)
            "
          />
        </div>
      </template>

      <template #cell-action="{ item }">
        <div class="inline-flex items-center justify-end gap-0.5">
          <Tooltip :content="t('SetDownloader.index.table.action.testConnection')">
            <Button
              variant="ghost"
              size="icon-xs"
              :disabled="!item.enabled || testingDownloaderId === item.id"
              @click="testDownloaderConnection(item.id)"
            >
              <Loader2 v-if="testingDownloaderId === item.id" class="size-3.5 animate-spin text-primary" />
              <Radio v-else class="size-3.5 text-success" />
            </Button>
          </Tooltip>

          <Tooltip :content="t('common.edit')">
            <Button variant="ghost" size="icon-xs" @click="editDownloader(item.id)">
              <Pencil class="size-3.5 text-info" />
            </Button>
          </Tooltip>

          <Tooltip :content="t('SetDownloader.index.table.action.setPathAndTag')">
            <Button variant="ghost" size="icon-xs" @click="editDownloaderPathAndTag(item.id)">
              <FolderCog class="size-3.5 text-warning" />
            </Button>
          </Tooltip>

          <Tooltip
            v-if="configStore.download.allowDownloaderFilterForSite"
            :content="t('SetDownloader.index.table.action.setSiteFilter')"
          >
            <Button variant="ghost" size="icon-xs" :disabled="!item.enabled" @click="editDownloaderSiteFilter(item.id)">
              <Filter class="size-3.5 text-primary" />
            </Button>
          </Tooltip>

          <Tooltip
            v-if="item.id === metadataStore.defaultDownloader?.id"
            :content="t('SetDownloader.index.table.action.deleteDefaultDownloader')"
          >
            <span class="inline-flex">
              <Button variant="ghost" size="icon-xs" disabled>
                <Trash2 class="size-3.5 text-destructive/40" />
              </Button>
            </span>
          </Tooltip>
          <Tooltip v-else :content="t('common.remove')">
            <Button variant="ghost" size="icon-xs" @click="deleteDownloader([item.id])">
              <Trash2 class="size-3.5 text-destructive" />
            </Button>
          </Tooltip>
        </div>
      </template>
    </DataTable>
  </Card>

  <AddDialog v-model="showAddDialog" />
  <EditDialog v-model="showEditDialog" :client-id="toEditDownloaderId!" />
  <DefaultDownloaderEditDialog v-model="showDefaultDownloaderEditDialog" />
  <SiteFilterDialog v-model="showSiteFilterDialog" :client-id="toEditDownloaderId!" />
  <PathAndTagSuggestDialog v-model="showPathAndTagSuggestDialog" :client-id="toEditDownloaderId!" />
  <DeleteDialog v-model="showDeleteDialog" :to-delete-ids="toDeleteIds" :confirm-delete="confirmDeleteDownloader" />
</template>
