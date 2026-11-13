<script setup lang="ts">
import { computed, ref, shallowRef } from "vue";
import { useI18n } from "vue-i18n";
import { ArrowDown, ArrowUp, Code2, Download, Eye, EyeOff, History, Trash2 } from "lucide-vue-next";
import { EResultParseStatus, type IUserInfo, type TSiteID } from "@ptd/site";

import {
  Badge,
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
import { sendMessage } from "@/messages.ts";
import { useConfigStore } from "@/options/stores/config.ts";
import { downloadBlob, formatDate, formatSize } from "@/options/utils.ts";
import { formatRatio } from "./utils/format.ts";
import { loadSiteHistoryData } from "./utils/lastUserData.ts";

import BonusFormatSpan from "./BonusFormatSpan.vue";
import SiteName from "@/options/components/SiteName.vue";

const showDialog = defineModel<boolean>({ default: false });
const { siteId } = defineProps<{
  siteId: TSiteID | null;
}>();
const { t } = useI18n();
const configStore = useConfigStore();
const isPrivacyBlurred = computed(() => Boolean(configStore.myDataTableControl.privacyBlur));
function togglePrivacyBlur() {
  configStore.myDataTableControl.privacyBlur = !configStore.myDataTableControl.privacyBlur;
  configStore.$save();
}

const currentDate = formatDate(+new Date(), "yyyy-MM-dd");
const jsonData = ref<any>({});
const isLoading = ref(false);

interface IShowUserInfo extends IUserInfo {
  date: string;
}

const siteHistoryData = shallowRef<IShowUserInfo[]>([]);
const sortBy = ref<DataTableSortItem[]>([{ key: "date", order: "desc" }]);
const itemsPerPage = ref<number>(10);
const tableSelected = ref<string[]>([]);

const tableColumns = computed<DataTableColumn<IShowUserInfo>[]>(() => [
  { title: t("common.date"), key: "date", align: "center" },
  { title: t("common.username"), key: "name", align: "center", sortable: false },
  { title: t("MyData.table.levelName"), key: "levelName", align: "start", sortable: false },
  { title: t("MyData.table.userData"), key: "uploaded", align: "end", sortable: false },
  { title: t("levelRequirement.ratio"), key: "ratio", align: "end", sortable: false },
  { title: t("levelRequirement.seeding"), key: "seeding", align: "end", sortable: false },
  { title: t("levelRequirement.seedingSize"), key: "seedingSize", align: "end", sortable: false },
  { title: t("levelRequirement.bonus"), key: "bonus", align: "end", sortable: false },
  { title: t("common.action"), key: "action", align: "center", width: 92, sortable: false },
]);

function isRowSelectable(row: IShowUserInfo) {
  return row.date !== currentDate;
}

async function fetchHistoryData() {
  if (!siteId) return;
  isLoading.value = true;
  try {
    siteHistoryData.value = await loadSiteHistoryData(siteId);
    tableSelected.value = [];
  } finally {
    isLoading.value = false;
  }
}

function deleteSiteUserInfo(dates: string[]) {
  if (!siteId) return;
  if (confirm(t("MyData.HistoryDataView.deleteConfirm"))) {
    sendMessage("removeSiteUserInfo", {
      siteId,
      date: dates.filter((d) => d !== currentDate), // 不允许移除当天的数据
    }).then(() => {
      void fetchHistoryData();
    });
  }
}

const showStoreDataDialog = ref<boolean>(false);
function viewStoreData(data: IShowUserInfo) {
  jsonData.value = data;
  showStoreDataDialog.value = true;
}

function exportSiteHistoryData() {
  let exportData = siteHistoryData.value;
  if (tableSelected.value.length > 0) {
    exportData = siteHistoryData.value.filter((item) => tableSelected.value.includes(item.date));
  }

  const exportedSolutionBlob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  void downloadBlob(exportedSolutionBlob, `site-history-data-${siteId}.json`);
}
</script>

<template>
  <Dialog v-model="showDialog" @after-open="fetchHistoryData" @after-close="() => (siteHistoryData = [])">
    <DialogContent class="max-w-5xl">
      <DialogHeader class="flex-row items-center justify-between gap-3 pr-8">
        <DialogTitle class="flex items-center gap-2">
          <History class="size-4 text-primary" />
          <span>{{ t("MyData.HistoryDataView.title") }}</span>
          <Badge
            v-if="siteId"
            variant="secondary"
            :class="['ml-1 transition-[filter] duration-150', isPrivacyBlurred && 'ptd-privacy-blur']"
          >
            <SiteName :site-id="siteId" tag="span" />
          </Badge>
        </DialogTitle>
        <DialogDescription class="sr-only">{{ t("MyData.HistoryDataView.title") }}</DialogDescription>
        <Button
          variant="outline"
          size="xs"
          :class="isPrivacyBlurred ? 'border-primary/45 bg-primary/12 text-primary' : ''"
          @click="togglePrivacyBlur"
        >
          <EyeOff v-if="isPrivacyBlurred" class="size-3.5" />
          <Eye v-else class="size-3.5" />
          <span>{{ isPrivacyBlurred ? t("MyData.index.privacyBlurred") : t("MyData.index.privacyBlur") }}</span>
        </Button>
      </DialogHeader>

      <div class="flex-1 overflow-y-auto">
        <DataTable
          v-model:selected="tableSelected"
          v-model:sort-by="sortBy"
          v-model:items-per-page="itemsPerPage"
          :columns="tableColumns"
          :items="siteHistoryData"
          row-key="date"
          selectable
          :is-row-selectable="isRowSelectable"
          :loading="isLoading"
        >
          <template #cell-date="{ item }">
            <span
              :class="[
                'inline-block whitespace-nowrap font-mono text-xs tabular-nums text-foreground transition-[filter] duration-150',
                isPrivacyBlurred && 'ptd-privacy-blur',
              ]"
            >
              {{ item.date }}
            </span>
          </template>

          <template #cell-name="{ item }">
            <span
              :title="isPrivacyBlurred ? undefined : String(item.id ?? '')"
              :class="[
                'inline-block whitespace-nowrap text-xs text-foreground transition-[filter] duration-150',
                isPrivacyBlurred && 'ptd-privacy-blur',
              ]"
            >
              {{ item.name ?? "-" }}
            </span>
          </template>

          <template #cell-levelName="{ item }">
            <span
              :class="[
                'inline-block whitespace-nowrap text-xs text-foreground transition-[filter] duration-150',
                isPrivacyBlurred && 'ptd-privacy-blur',
              ]"
            >
              {{ item.levelName ?? "-" }}
            </span>
          </template>

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

          <template #cell-seeding="{ item }">
            <span
              :class="[
                'inline-block whitespace-nowrap text-xs tabular-nums transition-[filter] duration-150',
                isPrivacyBlurred && 'ptd-privacy-blur',
              ]"
            >
              {{ item.seeding ?? "-" }}
            </span>
          </template>

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

          <template #cell-bonus="{ item }">
            <div
              :class="[
                'flex flex-col items-end text-xs tabular-nums transition-[filter] duration-150',
                isPrivacyBlurred && 'ptd-privacy-blur',
              ]"
            >
              <BonusFormatSpan v-if="item.bonus !== undefined && item.bonus !== ''" :num="item.bonus" />
              <span v-else class="text-muted-foreground">-</span>
              <BonusFormatSpan
                v-if="item.seedingBonus !== undefined && item.seedingBonus !== ''"
                :num="item.seedingBonus"
                class="text-[11px] text-muted-foreground"
              />
            </div>
          </template>

          <template #cell-action="{ item }">
            <div class="inline-flex items-center justify-center gap-1">
              <Tooltip :content="t('MyData.HistoryDataView.action.viewRaw')">
                <Button variant="ghost" size="icon-xs" @click="viewStoreData(item)">
                  <Eye class="size-3.5" />
                </Button>
              </Tooltip>
              <Tooltip :content="t('common.remove')">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  class="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  :disabled="item.status == EResultParseStatus.success && item.date == currentDate"
                  @click="deleteSiteUserInfo([item.date])"
                >
                  <Trash2 class="size-3.5" />
                </Button>
              </Tooltip>
            </div>
          </template>

          <template #footer-prepend>
            <div class="flex items-center gap-2">
              <Button
                variant="destructive"
                size="xs"
                :disabled="tableSelected.length <= 0"
                @click="deleteSiteUserInfo(tableSelected)"
              >
                <Trash2 />
                {{ t("common.remove") }}
              </Button>
              <Button variant="outline" size="xs" @click="exportSiteHistoryData">
                <Download />
                {{ t("common.export") }}
              </Button>
            </div>
          </template>
        </DataTable>
      </div>
    </DialogContent>
  </Dialog>

  <Dialog v-model="showStoreDataDialog">
    <DialogContent class="max-w-3xl">
      <DialogHeader class="pr-8">
        <DialogTitle class="flex items-center gap-2">
          <Code2 class="size-4 text-primary" />
          <span>{{ t("MyData.HistoryDataView.action.viewRaw") }}</span>
          <Badge v-if="jsonData?.date" variant="outline" class="font-mono text-[11px]">{{ jsonData.date }}</Badge>
        </DialogTitle>
        <DialogDescription class="sr-only">{{ t("MyData.HistoryDataView.action.viewRaw") }}</DialogDescription>
      </DialogHeader>
      <div class="flex-1 overflow-y-auto px-5 py-4">
        <pre
          :class="[
            'max-h-[62vh] overflow-auto rounded-lg border border-border bg-muted/40 p-4 font-mono text-xs leading-relaxed text-foreground transition-[filter] duration-150',
            isPrivacyBlurred && 'ptd-privacy-blur',
          ]"
          >{{ JSON.stringify(jsonData, null, 2) }}</pre>
      </div>
    </DialogContent>
  </Dialog>
</template>
