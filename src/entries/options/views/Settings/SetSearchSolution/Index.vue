<script setup lang="ts">
import { ref, useTemplateRef, computed } from "vue";
import { useI18n } from "vue-i18n";
import { cloneDeep, omit } from "es-toolkit";
import { nanoid } from "nanoid";
import { Copy, Download, Pencil, Plus, RefreshCw, Search, Trash2, Upload, X } from "lucide-vue-next";

import { useMetadataStore } from "@/options/stores/metadata.ts";
import { useConfigStore } from "@/options/stores/config.ts";
import { useRuntimeStore } from "@/options/stores/runtime.ts";
import { downloadBlob, formatDate } from "@/options/utils.ts";
import type { ISearchSolutionMetadata, TSolutionKey } from "@/shared/types.ts";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  Input,
  Separator,
  Switch,
  Tooltip,
  type DataTableColumn,
  type DataTableSortItem,
} from "~/components/ui";

import EditDialog from "./EditDialog.vue";
import SolutionLabel from "./SolutionLabel.vue";
import DeleteDialog from "@/options/components/DeleteDialog.vue";

const { t } = useI18n();
const configStore = useConfigStore();
const runtimeStore = useRuntimeStore();
const metadataStore = useMetadataStore();

const showEditDialog = ref(false);
const showDeleteDialog = ref(false);
const solutionId = ref<TSolutionKey>("");

const tableSelected = ref<TSolutionKey[]>([]);
const sortBy = ref<DataTableSortItem[]>([
  { key: "enabled", order: "desc" },
  { key: "sort", order: "desc" },
]);

const tableColumns = computed<DataTableColumn<ISearchSolutionMetadata>[]>(() => [
  { title: "№", key: "sort", align: "center", width: 84 },
  { title: t("common.name"), key: "name", align: "start", minWidth: 160 },
  { title: t("SetSearchSolution.solution"), key: "solution", align: "start", minWidth: 360, sortable: false },
  { title: t("SetSearchSolution.table.enable"), key: "enabled", align: "center", width: 96 },
  { title: t("SetSearchSolution.table.default"), key: "isDefault", align: "center", width: 96, sortable: false },
  { title: t("common.action"), key: "action", align: "end", width: 160, sortable: false },
]);

const tableFilter = ref("");
const isActionColumnAtStart = computed(() => configStore.tableActionColumnPosition === "start");

function addSearchSolution() {
  editSearchSolution("");
}

function editSearchSolution(toEditSolutionId: TSolutionKey) {
  solutionId.value = toEditSolutionId;
  showEditDialog.value = true;
}

type IExportedSearchSolution = Omit<ISearchSolutionMetadata, "id" | "enabled" | "createdAt" | "isDefault" | "sort">;

const importFileInputRef = useTemplateRef<HTMLInputElement>("importFile");
function importSearchSolution(e: Event) {
  if (e.target instanceof HTMLInputElement && e.target.files && e.target.files.length > 0) {
    for (const file of e.target.files) {
      const r = new FileReader();
      r.onload = (ev: ProgressEvent<FileReader>) => {
        try {
          if (typeof ev.target?.result !== "string") return;
          const result = JSON.parse(ev.target.result) as IExportedSearchSolution[];
          for (const solution of result) {
            const importSolution = solution as ISearchSolutionMetadata;
            if (importSolution.solutions && importSolution.solutions.length > 0) {
              importSolution.id = nanoid();
              importSolution.enabled = false;
              importSolution.createdAt = +new Date();
              importSolution.isDefault = false;
              importSolution.sort = 1;
              metadataStore.addSearchSolution(importSolution);
            }
          }
        } catch {
          runtimeStore.showSnackbar("Invalid JSON format when import search solution", { color: "error" });
        }
      };
      r.onerror = () => {
        runtimeStore.showSnackbar("Invalid JSON format when load import file", { color: "error" });
      };
      r.readAsText(file);
    }
    e.target.value = "";
  }
}

function exportSearchSolutions(solutionIds: TSolutionKey[]) {
  const exportedSolutions: IExportedSearchSolution[] = [];
  for (const id of solutionIds) {
    exportedSolutions.push(omit(metadataStore.solutions[id], ["id", "enabled", "createdAt", "isDefault", "sort"]));
  }

  if (exportedSolutions.length > 0) {
    const exportedSolutionBlob = new Blob([JSON.stringify(exportedSolutions)], { type: "application/json" });
    void downloadBlob(
      exportedSolutionBlob,
      `search-solutions-export-${formatDate(new Date(), "yyyyMMdd'T'HHmm")}.json`,
    );
  } else {
    runtimeStore.showSnackbar("No solutions to export", { color: "error" });
  }
}

const toDeleteIds = ref<TSolutionKey[]>([]);
function deleteSearchSolutions(solutionIds: TSolutionKey[]) {
  toDeleteIds.value = solutionIds;
  showDeleteDialog.value = true;
}

async function confirmDeleteSearchSolution(id: TSolutionKey) {
  return await metadataStore.removeSearchSolution(id);
}

function simplePatchSearchSolution(id: TSolutionKey, value: boolean) {
  metadataStore.solutions[id].enabled = value;
  metadataStore.$save();
}

function setDefaultSearchSolution(toDefault: boolean, id: TSolutionKey) {
  if (toDefault) {
    metadataStore.defaultSolutionId = id;
    for (const solutionKey of Object.keys(metadataStore.solutions)) {
      metadataStore.solutions[solutionKey].isDefault = solutionKey === id;
    }
  } else {
    metadataStore.defaultSolutionId = "default";
    metadataStore.solutions[id].isDefault = false;
  }

  metadataStore.$save();
}

const isAllSolutionDefault = computed(() => metadataStore.defaultSolutionId === "default");

async function copySearchSolution(id: TSolutionKey) {
  const toCopy = await metadataStore.getSearchSolution(id);
  if (!toCopy) return;

  const copied = cloneDeep(toCopy);
  copied.id = nanoid();
  copied.createdAt = Date.now();
  copied.isDefault = false;
  for (const solution1 of copied.solutions) {
    const oldId = solution1.id;
    if (oldId !== "default") {
      const newId = nanoid();
      solution1.id = newId;
      solution1.searchEntries[newId] = solution1.searchEntries[oldId];
      delete solution1.searchEntries[oldId];
    }
  }

  const newSearchSolutionName = prompt(
    t("SetSearchSolution.newSolutionNamePrompt"),
    `Copy of ${copied.name ?? copied.id}`,
  );
  if (newSearchSolutionName) {
    copied.name = newSearchSolutionName;
    await metadataStore.addSearchSolution(copied);
  }
}
</script>

<template>
  <Card>
    <CardHeader class="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
      <div class="flex flex-wrap items-center gap-2">
        <Button size="sm" @click="addSearchSolution">
          <Plus class="size-4" />
          {{ t("common.btn.add") }}
        </Button>

        <Button
          variant="outline"
          size="sm"
          class="text-destructive hover:bg-destructive/10 hover:text-destructive"
          :disabled="tableSelected.length === 0"
          @click="deleteSearchSolutions(tableSelected)"
        >
          <Trash2 class="size-4" />
          {{ t("common.remove") }}
        </Button>

        <Separator orientation="vertical" class="mx-0.5 h-5" />

        <input
          ref="importFile"
          accept="application/json"
          multiple
          class="hidden"
          type="file"
          @change="importSearchSolution"
        />

        <Button variant="secondary" size="sm" @click="() => importFileInputRef?.click()">
          <Upload class="size-4" />
          {{ t("common.import") }}
        </Button>

        <Button
          variant="secondary"
          size="sm"
          :disabled="tableSelected.length === 0"
          @click="() => exportSearchSolutions(tableSelected)"
        >
          <Download class="size-4" />
          {{ t("common.export") }}
        </Button>
      </div>

      <div class="relative w-full sm:w-72">
        <Search class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="tableFilter" :placeholder="t('common.search')" class="pl-8 pr-8" />
        <button
          v-if="tableFilter"
          type="button"
          class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          @click="tableFilter = ''"
        >
          <X class="size-3.5" />
        </button>
      </div>
    </CardHeader>

    <DataTable
      v-model:selected="tableSelected"
      v-model:sort-by="sortBy"
      :columns="tableColumns"
      :items="metadataStore.getSearchSolutions"
      :items-per-page="configStore.tableBehavior.SetSearchSolution.itemsPerPage"
      :search="tableFilter"
      :filter-keys="['name']"
      row-key="id"
      selectable
      :multi-sort="configStore.enableTableMultiSort"
      :sticky-action-column="configStore.tableActionColumnFixed"
      :action-position="configStore.tableActionColumnPosition"
      @update:items-per-page="(v) => configStore.updateTableBehavior('SetSearchSolution', 'itemsPerPage', v)"
    >
      <!-- 置顶内置默认全站搜索方案行 -->
      <template #body-prepend>
        <tr class="bg-muted/25 transition-colors hover:bg-muted/45">
          <td class="w-10 px-3 py-2.5" />
          <td v-if="isActionColumnAtStart" class="px-3 py-2.5 text-right">
            <div class="inline-flex items-center justify-end gap-1">
              <Tooltip :content="t('SetSearchSolution.copy')" side="top">
                <Button variant="ghost" size="icon-xs" @click="copySearchSolution('default')">
                  <Copy class="size-3.5 text-success" />
                </Button>
              </Tooltip>
            </div>
          </td>
          <td class="px-3 py-2.5 text-center text-xs text-muted-foreground tabular-nums">—</td>
          <td class="px-3 py-2.5 font-medium text-foreground">
            {{ t("layout.header.searchPlan.all") }}
          </td>
          <td class="px-3 py-2.5">
            <Badge variant="info" class="gap-1">
              <RefreshCw class="size-3" />
              {{ t("SetSearchSolution.table.autoGenerate") }}
            </Badge>
          </td>
          <td class="px-3 py-2.5 text-center">
            <div class="inline-flex justify-center">
              <Switch :model-value="false" disabled />
            </div>
          </td>
          <td class="px-3 py-2.5 text-center">
            <div class="inline-flex justify-center">
              <Switch :model-value="isAllSolutionDefault" disabled />
            </div>
          </td>
          <td v-if="!isActionColumnAtStart" class="px-3 py-2.5 text-right">
            <div class="inline-flex items-center justify-end gap-1">
              <Tooltip :content="t('SetSearchSolution.copy')" side="top">
                <Button variant="ghost" size="icon-xs" @click="copySearchSolution('default')">
                  <Copy class="size-3.5 text-success" />
                </Button>
              </Tooltip>
            </div>
          </td>
        </tr>
      </template>

      <template #cell-sort="{ item }">
        <span class="font-mono text-xs text-muted-foreground tabular-nums">{{ item.sort }}</span>
      </template>

      <template #cell-name="{ item }">
        <span class="font-medium text-foreground">{{ item.name }}</span>
      </template>

      <template #cell-solution="{ item }">
        <SolutionLabel :closable="false" column :solutions="item.solutions" />
      </template>

      <template #cell-enabled="{ item }">
        <div class="inline-flex justify-center">
          <Switch :model-value="item.enabled" @update:model-value="(v) => simplePatchSearchSolution(item.id, v)" />
        </div>
      </template>

      <template #cell-isDefault="{ item }">
        <div class="inline-flex justify-center">
          <Switch :model-value="item.isDefault" @update:model-value="(v) => setDefaultSearchSolution(v, item.id)" />
        </div>
      </template>

      <template #cell-action="{ item }">
        <div class="inline-flex items-center justify-end gap-0.5">
          <Tooltip :content="t('SetSearchSolution.copy')" side="top">
            <Button variant="ghost" size="icon-xs" @click="copySearchSolution(item.id)">
              <Copy class="size-3.5 text-success" />
            </Button>
          </Tooltip>
          <Tooltip :content="t('common.edit')" side="top">
            <Button variant="ghost" size="icon-xs" @click="editSearchSolution(item.id)">
              <Pencil class="size-3.5 text-info" />
            </Button>
          </Tooltip>
          <Tooltip :content="t('common.export')" side="top">
            <Button variant="ghost" size="icon-xs" @click="exportSearchSolutions([item.id])">
              <Download class="size-3.5 text-muted-foreground" />
            </Button>
          </Tooltip>
          <Tooltip :content="t('common.remove')" side="top">
            <Button
              variant="ghost"
              size="icon-xs"
              class="text-destructive hover:bg-destructive/10 hover:text-destructive"
              @click="deleteSearchSolutions([item.id])"
            >
              <Trash2 class="size-3.5" />
            </Button>
          </Tooltip>
        </div>
      </template>
    </DataTable>
  </Card>

  <EditDialog v-model="showEditDialog" :solution-id="solutionId" />
  <DeleteDialog v-model="showDeleteDialog" :to-delete-ids="toDeleteIds" :confirm-delete="confirmDeleteSearchSolution" />
</template>
