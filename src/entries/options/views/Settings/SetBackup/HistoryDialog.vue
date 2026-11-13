<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { computed, ref, shallowRef } from "vue";
import type { IBackupFileInfo } from "@ptd/backupServer";
import { CloudDownload, History, RefreshCw, Trash2 } from "lucide-vue-next";

import { sendMessage } from "@/messages.ts";
import { formatDate, formatSize } from "@/options/utils.ts";
import { useRuntimeStore } from "@/options/stores/runtime.ts";
import { useMetadataStore } from "@/options/stores/metadata.ts";
import {
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Tooltip,
  type DataTableColumn,
  type DataTableSortItem,
} from "~/components/ui";

import DeleteDialog from "@/options/components/DeleteDialog.vue";
import RestoreDialog from "./RestoreDialog.vue";

const showDialog = defineModel<boolean>({ default: false });
const { backupServerId } = defineProps<{
  backupServerId: string;
}>();

const { t } = useI18n();
const metadataStore = useMetadataStore();
const runtimeStore = useRuntimeStore();

const isLoading = ref<boolean>(false);
const backupHistory = shallowRef<IBackupFileInfo[]>([]);

const tableColumns = computed<DataTableColumn<IBackupFileInfo>[]>(() => [
  { title: t("SetBackup.HistoryDialog.table.filename"), key: "filename", align: "start", minWidth: 220 },
  { title: t("SetBackup.HistoryDialog.table.size"), key: "size", align: "end", width: 110 },
  { title: t("SetBackup.HistoryDialog.table.time"), key: "time", align: "start", width: 170 },
  { title: t("common.action"), key: "action", align: "end", width: 96, sortable: false },
]);
const sortBy = ref<DataTableSortItem[]>([{ key: "time", order: "desc" }]);
const tableSelected = ref<string[]>([]);

const showRestoreDialog = ref<boolean>(false);
const restoreMetadata = ref<{ type: "remote"; server: string; path: string }>({ type: "remote", server: "", path: "" });
function restoreBackup(path: string) {
  restoreMetadata.value = { type: "remote", server: backupServerId, path };
  showRestoreDialog.value = true;
}

const showDeleteDialog = ref<boolean>(false);
const toDeleteBackupHistory = ref<string[]>([]);
function deleteBackupHistory(paths: string[]) {
  toDeleteBackupHistory.value = paths;
  showDeleteDialog.value = true;
}

async function confirmDeleteBackupHistory(toDeleteId: string) {
  const toDeleteName = backupHistory.value.find((item) => item.path === toDeleteId)?.filename ?? toDeleteId;
  const deleteStatus = await sendMessage("deleteBackupHistory", { path: toDeleteId, backupServerId });
  if (!deleteStatus) {
    runtimeStore.showSnackbar(t("SetBackup.HistoryDialog.deleteFailure", { name: toDeleteName }), { color: "error" });
  } else {
    runtimeStore.showSnackbar(t("SetBackup.HistoryDialog.deleteSuccess", { name: toDeleteName }), { color: "success" });
    backupHistory.value = backupHistory.value.filter((item) => item.path !== toDeleteId);
  }
}

async function loadBackupHistory() {
  isLoading.value = true;
  try {
    backupHistory.value = await sendMessage("getBackupHistory", backupServerId);
  } catch (e) {
    console.error("获取备份历史失败", e);
  } finally {
    isLoading.value = false;
  }
}

function dialogEnter() {
  void loadBackupHistory();
}

function dialogLeave() {
  backupHistory.value = [];
  tableSelected.value = [];
}
</script>

<template>
  <Dialog v-model="showDialog" @after-open="dialogEnter" @after-close="dialogLeave">
    <DialogContent class="max-w-4xl">
      <DialogHeader>
        <DialogTitle>
          <History class="size-4 text-primary" />
          <span>
            {{
              t("SetBackup.HistoryDialog.title", {
                name: metadataStore.backupServers[backupServerId]?.name ?? backupServerId,
              })
            }}
          </span>
        </DialogTitle>
        <DialogDescription> {{ backupHistory.length }} 条远端历史记录 </DialogDescription>
      </DialogHeader>

      <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div class="flex items-center justify-between gap-2 border-b border-border px-5 py-2.5">
          <Button
            variant="outline"
            size="sm"
            class="text-destructive hover:bg-destructive/10 hover:text-destructive"
            :disabled="tableSelected.length === 0"
            @click="deleteBackupHistory(tableSelected)"
          >
            <Trash2 class="size-3.5" />
            {{ t("common.remove") }}
          </Button>
          <Button variant="ghost" size="sm" :disabled="isLoading" @click="loadBackupHistory">
            <RefreshCw class="size-3.5" :class="{ 'animate-spin': isLoading }" />
          </Button>
        </div>

        <div class="flex-1 overflow-y-auto">
          <DataTable
            v-model:selected="tableSelected"
            v-model:sort-by="sortBy"
            :columns="tableColumns"
            :items="backupHistory"
            :loading="isLoading"
            row-key="path"
            selectable
          >
            <template #cell-filename="{ item }">
              <span class="font-mono text-xs text-foreground">{{ item.filename }}</span>
            </template>

            <template #cell-size="{ item }">
              <span class="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                {{ item.size !== "N/A" ? formatSize(item.size) : item.size }}
              </span>
            </template>

            <template #cell-time="{ item }">
              <span class="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                {{ formatDate(item.time) }}
              </span>
            </template>

            <template #cell-action="{ item }">
              <div class="inline-flex items-center justify-end gap-0.5">
                <Tooltip :content="t('SetBackup.HistoryDialog.restore')" side="top">
                  <Button variant="ghost" size="icon-xs" @click="restoreBackup(item.path)">
                    <CloudDownload class="size-3.5 text-info" />
                  </Button>
                </Tooltip>
                <Tooltip :content="t('common.remove')" side="top">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    class="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    @click="deleteBackupHistory([item.path])"
                  >
                    <Trash2 class="size-3.5" />
                  </Button>
                </Tooltip>
              </div>
            </template>
          </DataTable>
        </div>
      </div>
    </DialogContent>
  </Dialog>

  <RestoreDialog v-model="showRestoreDialog" :restore-metadata="restoreMetadata" />
  <DeleteDialog
    v-model="showDeleteDialog"
    :confirm-delete="confirmDeleteBackupHistory"
    :to-delete-ids="toDeleteBackupHistory"
    @all-delete="loadBackupHistory"
  />
</template>
