<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { getBackupServerIcon } from "@ptd/backupServer";
import { hasBackupRetentionToApply } from "@ptd/backupServer/utils.ts";
import {
  ArchiveRestore,
  CloudUpload,
  Download,
  Filter,
  FilterX,
  History,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-vue-next";

import { useMetadataStore } from "@/options/stores/metadata.ts";
import { useRuntimeStore } from "@/options/stores/runtime.ts";
import { formatDate } from "@/options/utils.ts";
import { BackupFields, type IBackupServerMetadata, type TBackupServerKey } from "@/shared/types.ts";
import { sendMessage } from "@/messages.ts";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  Input,
  Switch,
  Tooltip,
  type DataTableColumn,
} from "~/components/ui";

import DeleteDialog from "@/options/components/DeleteDialog.vue";
import AddDialog from "./AddDialog.vue";
import EditDialog from "./EditDialog.vue";
import LocalExportConfirmDialog from "./LocalExportConfirmDialog.vue";
import HistoryDialog from "./HistoryDialog.vue";
import RestoreDialog from "./RestoreDialog.vue";

const { t } = useI18n();
const runtimeStore = useRuntimeStore();
const metadataStore = useMetadataStore();

const showAddDialog = ref<boolean>(false);
const showLocalExportConfirmDialog = ref<boolean>(false);
const showHistoryDialog = ref<boolean>(false);
const showEditDialog = ref<boolean>(false);
const showRestoreDialog = ref<boolean>(false);
const showDeleteDialog = ref<boolean>(false);

const tableColumns = computed<DataTableColumn<IBackupServerMetadata>[]>(() => [
  { title: t("common.type"), key: "type", align: "center", width: 72 },
  { title: t("common.name"), key: "name", align: "start", minWidth: 150 },
  { title: t("SetBackup.table.backupFields"), key: "backupFields", align: "start", minWidth: 220, sortable: false },
  { title: t("SetBackup.table.backupInterval"), key: "backupInterval", align: "center", width: 120 },
  { title: t("SetBackup.table.retention"), key: "retention", align: "center", width: 88 },
  { title: t("SetBackup.table.lastBackupAt"), key: "lastBackupAt", align: "end", width: 165 },
  { title: t("common.enable"), key: "enabled", align: "center", width: 88 },
  { title: t("common.action"), key: "action", align: "end", width: 150, sortable: false },
]);
const tableSelected = ref<TBackupServerKey[]>([]);
const tableFilter = ref<string>("");

function formatBackupInterval(serverConfig: IBackupServerMetadata): string {
  const interval = serverConfig.backupInterval ?? 0;
  if (!(interval > 0)) return "";
  return t("SetBackup.table.everyNHour", { n: Number(interval.toFixed(2)) });
}

const localBackup = Symbol("localBackup");
const doBackupStatus = ref<Record<TBackupServerKey | symbol, boolean>>({});
async function doBackup(backupServerId: TBackupServerKey | symbol) {
  doBackupStatus.value[backupServerId] = true;
  try {
    if (typeof backupServerId === "string") {
      const serverConfig = metadataStore.backupServers[backupServerId];
      const backupFields = serverConfig.backupFields ?? [...BackupFields];
      const backupStatus = await sendMessage("exportBackupData", { backupFields, backupServerId });
      if (backupStatus) {
        const hasRetention = hasBackupRetentionToApply(serverConfig?.retention);
        runtimeStore.showSnackbar(
          t(hasRetention ? "SetBackup.snackbar.successWithRetention" : "SetBackup.snackbar.success"),
          { color: "success" },
        );
      } else {
        runtimeStore.showSnackbar(t("SetBackup.snackbar.failure"), { color: "error" });
      }
    } else if (backupServerId === localBackup) {
      showLocalExportConfirmDialog.value = true;
    }
  } finally {
    doBackupStatus.value[backupServerId] = false;
  }
}

const toEditBackupServerId = ref<TBackupServerKey | null>(null);
function editBackupServer(id: TBackupServerKey) {
  toEditBackupServerId.value = id;
  showEditDialog.value = true;
}

const toShowHistoryBackupServerId = ref<TBackupServerKey | null>(null);
function showHistory(id: TBackupServerKey) {
  toShowHistoryBackupServerId.value = id;
  showHistoryDialog.value = true;
}

const toDeleteIds = ref<TBackupServerKey[]>([]);
function deleteBackupServer(ids: TBackupServerKey[]) {
  toDeleteIds.value = ids;
  showDeleteDialog.value = true;
}

async function confirmDeleteBackupServer(id: TBackupServerKey) {
  return await metadataStore.removeBackupServer(id);
}
</script>

<template>
  <div class="space-y-4">
    <!-- 顶部 2 张本地备份与恢复快捷操作卡 -->
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card>
        <CardContent class="flex items-center justify-between gap-4 p-4">
          <div class="flex min-w-0 items-start gap-3">
            <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Download class="size-5" />
            </div>
            <div class="min-w-0 space-y-0.5">
              <h3 class="text-sm font-semibold text-foreground">{{ t("SetBackup.localExport") }}</h3>
              <p class="text-xs text-muted-foreground">
                {{ t("SetBackup.LocalExportConfirmDialog.title") }}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            class="shrink-0"
            :disabled="doBackupStatus[localBackup]"
            @click="doBackup(localBackup)"
          >
            <Loader2 v-if="doBackupStatus[localBackup]" class="size-4 animate-spin" />
            <Download v-else class="size-4" />
            {{ t("common.export") }}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent class="flex items-center justify-between gap-4 p-4">
          <div class="flex min-w-0 items-start gap-3">
            <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info">
              <ArchiveRestore class="size-5" />
            </div>
            <div class="min-w-0 space-y-0.5">
              <h3 class="text-sm font-semibold text-foreground">{{ t("SetBackup.localImport") }}</h3>
              <p class="text-xs text-muted-foreground">
                {{ t("SetBackup.RestoreDialog.title") }}
              </p>
            </div>
          </div>
          <Button size="sm" variant="secondary" class="shrink-0" @click="showRestoreDialog = true">
            <Upload class="size-4" />
            {{ t("common.import") }}
          </Button>
        </CardContent>
      </Card>
    </div>

    <!-- 远程备份服务器管理表格 -->
    <Card>
      <CardHeader class="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <div class="flex flex-wrap items-center gap-2">
          <Button size="sm" @click="showAddDialog = true">
            <Plus class="size-4" />
            {{ t("common.btn.add") }}
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="text-destructive hover:bg-destructive/10 hover:text-destructive"
            :disabled="tableSelected.length === 0"
            @click="deleteBackupServer(tableSelected)"
          >
            <Trash2 class="size-4" />
            {{ t("common.remove") }}
          </Button>
        </div>

        <div class="relative w-full sm:w-72">
          <Search
            class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
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
        :columns="tableColumns"
        :items="metadataStore.getBackupServers"
        :filter-keys="['name', 'type']"
        :search="tableFilter"
        row-key="id"
        selectable
      >
        <template #cell-type="{ item }">
          <div class="inline-flex items-center justify-center">
            <Tooltip :content="item.type" side="top">
              <img
                :src="getBackupServerIcon(item.type)"
                :alt="item.type"
                class="size-7 rounded-md border border-border bg-background p-1 object-contain"
              />
            </Tooltip>
          </div>
        </template>

        <template #cell-name="{ item }">
          <span class="font-medium text-foreground">{{ item.name }}</span>
        </template>

        <template #cell-backupFields="{ item }">
          <div class="flex flex-wrap gap-1">
            <Badge v-for="field in item.backupFields" :key="field" variant="secondary">
              {{ t(`SetBackup.fields.${field}`) }}
            </Badge>
          </div>
        </template>

        <template #cell-backupInterval="{ item }">
          <span v-if="item.backupInterval && item.backupInterval > 0" class="whitespace-nowrap text-xs tabular-nums">
            {{ formatBackupInterval(item) }}
          </span>
          <span v-else class="text-xs text-muted-foreground">—</span>
        </template>

        <template #cell-retention="{ item }">
          <div class="inline-flex justify-center">
            <Tooltip
              :content="
                hasBackupRetentionToApply(item.retention)
                  ? t('SetBackup.table.retentionEnabled')
                  : t('SetBackup.table.retentionDisabled')
              "
              side="top"
            >
              <span class="inline-flex items-center justify-center">
                <Filter v-if="hasBackupRetentionToApply(item.retention)" class="size-4 text-success" />
                <FilterX v-else class="size-4 text-muted-foreground/50" />
              </span>
            </Tooltip>
          </div>
        </template>

        <template #cell-lastBackupAt="{ item }">
          <span v-if="item.lastBackupAt" class="whitespace-nowrap text-xs text-foreground tabular-nums">
            {{ formatDate(item.lastBackupAt) }}
          </span>
          <span v-else class="text-xs text-muted-foreground">{{ t("SetBackup.table.notBackup") }}</span>
        </template>

        <template #cell-enabled="{ item }">
          <div class="inline-flex justify-center">
            <Switch
              :model-value="item.enabled"
              @update:model-value="(v) => metadataStore.simplePatch('backupServers', item.id, 'enabled', v)"
            />
          </div>
        </template>

        <template #cell-action="{ item }">
          <div class="inline-flex items-center justify-end gap-0.5">
            <Tooltip :content="t('SetBackup.table.action.backupNow')" side="top">
              <Button variant="ghost" size="icon-xs" :disabled="doBackupStatus[item.id]" @click="doBackup(item.id)">
                <Loader2 v-if="doBackupStatus[item.id]" class="size-3.5 animate-spin text-success" />
                <CloudUpload v-else class="size-3.5 text-success" />
              </Button>
            </Tooltip>
            <Tooltip :content="t('SetBackup.table.action.viewHistoryBackup')" side="top">
              <Button variant="ghost" size="icon-xs" @click="showHistory(item.id)">
                <History class="size-3.5 text-muted-foreground" />
              </Button>
            </Tooltip>
            <Tooltip :content="t('common.edit')" side="top">
              <Button variant="ghost" size="icon-xs" @click="editBackupServer(item.id)">
                <Pencil class="size-3.5 text-info" />
              </Button>
            </Tooltip>
            <Tooltip :content="t('common.remove')" side="top">
              <Button
                variant="ghost"
                size="icon-xs"
                class="text-destructive hover:bg-destructive/10 hover:text-destructive"
                @click="deleteBackupServer([item.id])"
              >
                <Trash2 class="size-3.5" />
              </Button>
            </Tooltip>
          </div>
        </template>
      </DataTable>
    </Card>
  </div>

  <AddDialog v-model="showAddDialog" />
  <EditDialog v-model="showEditDialog" :client-id="toEditBackupServerId!" />
  <DeleteDialog v-model="showDeleteDialog" :to-delete-ids="toDeleteIds" :confirm-delete="confirmDeleteBackupServer" />
  <HistoryDialog v-model="showHistoryDialog" :backup-server-id="toShowHistoryBackupServerId!" />
  <LocalExportConfirmDialog v-model="showLocalExportConfirmDialog" />
  <RestoreDialog v-model="showRestoreDialog" :restore-metadata="{ type: 'file' }" />
</template>
