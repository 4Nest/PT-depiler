<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { CheckSquare, Download, FileJson, FileSpreadsheet, Loader2 } from "lucide-vue-next";
import type { IUserInfo, TSiteID } from "@ptd/site";

import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
} from "~/components/ui";
import { downloadBlob, formatDate } from "@/options/utils.ts";
import { useRuntimeStore } from "@/options/stores/runtime.ts";
import { useMetadataStore } from "@/options/stores/metadata.ts";
import { sendMessage } from "@/messages.ts";

import { fixUserInfo } from "./utils/format.ts";

interface IHistoryUserInfo extends IUserInfo {
  date: string;
  site: TSiteID;
  siteName: string;
}

interface IExportField {
  key: string;
  label: string;
  required?: boolean;
}

const props = defineProps<{
  selectedSiteIds: TSiteID[];
}>();

const showDialog = defineModel<boolean>({ default: false });
const { t } = useI18n();
const runtimeStore = useRuntimeStore();
const metadataStore = useMetadataStore();

const isLoading = ref(false);

const allExportFields: IExportField[] = [
  { key: "site", label: "common.site", required: true },
  { key: "siteName", label: "MyData.exportDialog.fields.siteName", required: false },
  { key: "date", label: "common.date", required: true },
  { key: "name", label: "common.username", required: false },
  { key: "id", label: "MyData.exportDialog.fields.id", required: false },
  { key: "levelName", label: "MyData.exportDialog.fields.levelName", required: false },
  { key: "uploaded", label: "levelRequirement.uploaded", required: false },
  { key: "downloaded", label: "levelRequirement.downloaded", required: false },
  { key: "ratio", label: "levelRequirement.ratio", required: false },
  { key: "trueUploaded", label: "levelRequirement.trueUploaded", required: false },
  { key: "trueDownloaded", label: "levelRequirement.trueDownloaded", required: false },
  { key: "trueRatio", label: "levelRequirement.trueRatio", required: false },
  { key: "seeding", label: "levelRequirement.seeding", required: false },
  { key: "seedingSize", label: "levelRequirement.seedingSize", required: false },
  { key: "bonus", label: "levelRequirement.bonus", required: false },
  { key: "seedingBonus", label: "levelRequirement.seedingBonus", required: false },
  { key: "bonusPerHour", label: "levelRequirement.bonusPerHour", required: false },
  { key: "seedingBonusPerHour", label: "levelRequirement.seedingBonusPerHour", required: false },
  { key: "uploads", label: "levelRequirement.uploads", required: false },
  { key: "leeching", label: "levelRequirement.leeching", required: false },
  { key: "snatches", label: "levelRequirement.snatches", required: false },
  { key: "messageCount", label: "MyData.exportDialog.fields.messageCount", required: false },
  { key: "hnrUnsatisfied", label: "levelRequirement.hnrUnsatisfied", required: false },
  { key: "hnrPreWarning", label: "levelRequirement.hnrPreWarning", required: false },
  { key: "joinTime", label: "MyData.exportDialog.fields.joinTime", required: false },
  { key: "lastAccessAt", label: "MyData.exportDialog.fields.lastAccessAt", required: false },
  { key: "updateAt", label: "MyData.exportDialog.fields.updateAt", required: false },
];

const defaultKeys = allExportFields.map((f) => f.key);
const selectedKeys = ref<string[]>([...defaultKeys]);
const exportFormat = ref<"csv" | "json">("csv");

const querySiteIds = computed<TSiteID[]>(() => {
  if (props.selectedSiteIds.length > 0) {
    return props.selectedSiteIds;
  }
  return Object.keys(metadataStore.sites) as TSiteID[];
});

const isExportSelected = computed(() => props.selectedSiteIds.length > 0);

function toggleField(key: string, checked: boolean | "indeterminate") {
  if (checked === true) {
    if (!selectedKeys.value.includes(key)) {
      selectedKeys.value = [...selectedKeys.value, key];
    }
  } else {
    selectedKeys.value = selectedKeys.value.filter((k) => k !== key);
  }
}

function selectAllFields() {
  selectedKeys.value = [...defaultKeys];
}

function resetRequiredFields() {
  selectedKeys.value = allExportFields.filter((f) => f.required).map((f) => f.key);
}

async function doExport() {
  isLoading.value = true;

  try {
    const tasks = querySiteIds.value.map(async (siteId) => {
      try {
        const history = (await sendMessage("getSiteUserInfo", siteId)) as Record<string, IUserInfo> | undefined;
        if (!history) return [];

        const siteName = metadataStore.siteNameMap[siteId] ?? siteId;
        const items: IHistoryUserInfo[] = [];
        for (const [date, item] of Object.entries(history)) {
          items.push({
            ...fixUserInfo(item),
            site: siteId,
            siteName,
            date,
          });
        }
        return items;
      } catch (e) {
        console.error(`加载站点 ${siteId} 历史数据失败`, e);
        return [];
      }
    });

    const results = await Promise.allSettled(tasks);
    const merged: IHistoryUserInfo[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        merged.push(...result.value);
      }
    }

    merged.sort((a, b) => b.date.localeCompare(a.date));

    if (merged.length === 0) {
      runtimeStore.showSnackbar(t("common.noData"), { color: "warning" });
      return;
    }

    const timestamp = formatDate(new Date(), "yyyyMMdd_HHmmss");
    const ext = exportFormat.value;
    const mime = exportFormat.value === "csv" ? "text/csv;charset=utf-8" : "application/json;charset=utf-8";
    const content = exportFormat.value === "csv" ? convertToCSV(merged) : convertToJSON(merged);
    const blob = new Blob(exportFormat.value === "csv" ? ["\ufeff", content] : [content], { type: mime });
    await downloadBlob(blob, `userinfo-${timestamp}.${ext}`);
    showDialog.value = false;
  } finally {
    isLoading.value = false;
  }
}

function getSortedExportFields(): IExportField[] {
  const site = allExportFields.find((f) => f.key === "site")!;
  const date = allExportFields.find((f) => f.key === "date")!;
  const others = allExportFields.filter((f) => f.key !== "site" && f.key !== "date");
  return [site, date, ...others];
}

function getActiveFields(): IExportField[] {
  return getSortedExportFields().filter((f) => selectedKeys.value.includes(f.key));
}

function convertToCSV(items: IHistoryUserInfo[]): string {
  const activeFields = getActiveFields();
  const headers = activeFields.map((f) => f.key);
  const rows = items.map((item) =>
    headers
      .map((key) => {
        const raw = (item as any)[key];
        const val =
          raw === Infinity || raw === -Infinity || (typeof raw === "number" && isNaN(raw)) ? "" : String(raw ?? "");
        if (/[",\n\r]/.test(val)) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      })
      .join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}

function convertToJSON(items: IHistoryUserInfo[]): string {
  const activeFields = getActiveFields();
  return JSON.stringify(
    items.map((item) => {
      const obj: Record<string, any> = {};
      for (const f of activeFields) {
        const raw = (item as any)[f.key];
        obj[f.key] =
          raw === Infinity || raw === -Infinity || (typeof raw === "number" && isNaN(raw)) ? null : (raw ?? null);
      }
      return obj;
    }),
    null,
    2,
  );
}
</script>

<template>
  <Dialog v-model="showDialog">
    <DialogContent class="max-w-2xl" :prevent-outside-close="isLoading" :hide-close="isLoading">
      <DialogHeader class="pr-8">
        <DialogTitle class="flex items-center gap-2">
          <Download class="size-4 text-primary" />
          <span>
            {{
              isExportSelected
                ? t("MyData.exportDialog.exportSelected", { count: querySiteIds.length })
                : t("MyData.exportDialog.exportAll", { count: querySiteIds.length })
            }}
          </span>
        </DialogTitle>
        <DialogDescription class="sr-only">{{ t("MyData.exportDialog.title") }}</DialogDescription>
      </DialogHeader>

      <div class="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <div class="space-y-2">
          <Label class="text-xs font-semibold text-foreground">{{ t("MyData.exportDialog.formatLabel") }}</Label>
          <div class="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              :class="[
                'flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left text-sm transition-colors',
                exportFormat === 'csv'
                  ? 'border-primary bg-primary/[0.06] text-primary'
                  : 'border-border bg-background text-foreground hover:bg-muted/50',
              ]"
              @click="exportFormat = 'csv'"
            >
              <FileSpreadsheet class="size-4 shrink-0" />
              <div class="min-w-0 flex-1">
                <div class="font-medium">{{ t("MyData.exportDialog.formatCSV") }}</div>
                <div class="text-[11px] text-muted-foreground">UTF-8 BOM · Excel</div>
              </div>
            </button>

            <button
              type="button"
              :class="[
                'flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left text-sm transition-colors',
                exportFormat === 'json'
                  ? 'border-primary bg-primary/[0.06] text-primary'
                  : 'border-border bg-background text-foreground hover:bg-muted/50',
              ]"
              @click="exportFormat = 'json'"
            >
              <FileJson class="size-4 shrink-0" />
              <div class="min-w-0 flex-1">
                <div class="font-medium">{{ t("MyData.exportDialog.formatJSON") }}</div>
                <div class="text-[11px] text-muted-foreground">Pretty JSON</div>
              </div>
            </button>
          </div>
        </div>

        <div class="space-y-2.5">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <Label class="text-xs font-semibold text-foreground">{{ t("MyData.exportDialog.fieldsLabel") }}</Label>
              <Badge variant="secondary" class="text-[11px] tabular-nums">
                {{ selectedKeys.length }} / {{ allExportFields.length }}
              </Badge>
            </div>
            <div class="flex items-center gap-1">
              <Button variant="ghost" size="xs" @click="selectAllFields">
                <CheckSquare class="size-3" />
                {{ t("common.checkbox.all") }}
              </Button>
              <Button variant="ghost" size="xs" @click="resetRequiredFields">
                {{ t("common.checkbox.none") }}
              </Button>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <label
              v-for="field in allExportFields"
              :key="field.key"
              :class="[
                'flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-xs transition-colors select-none',
                selectedKeys.includes(field.key)
                  ? 'border-primary/40 bg-primary/[0.04] text-foreground'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted/40',
                field.required ? 'cursor-not-allowed opacity-80' : '',
              ]"
            >
              <Checkbox
                :model-value="selectedKeys.includes(field.key)"
                :disabled="field.required"
                @update:model-value="(v) => toggleField(field.key, v)"
              />
              <span class="truncate">{{ t(field.label) }}</span>
            </label>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="ghost" :disabled="isLoading" @click="showDialog = false">
          {{ t("common.dialog.cancel") }}
        </Button>
        <Button :disabled="isLoading" @click="doExport">
          <Loader2 v-if="isLoading" class="animate-spin" />
          <Download v-else />
          {{ t("common.export") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
