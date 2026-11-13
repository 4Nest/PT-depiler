<script setup lang="ts">
import { ref, shallowRef, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { isEmpty } from "es-toolkit/compat";
import { zipBlobToBackupData } from "@ptd/backupServer/utils.ts";
import type { IBackupData } from "@ptd/backupServer";
import {
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FileArchive,
  Loader2,
  RotateCw,
  Upload,
} from "lucide-vue-next";

import { useConfigStore } from "@/options/stores/config.ts";
import { useRuntimeStore } from "@/options/stores/runtime.ts";
import { sendMessage } from "@/messages.ts";
import { formatSize } from "@/options/utils.ts";
import { BackupFields, type TBackupFields, type IRestoreOptions } from "@/shared/types.ts";
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch,
} from "~/components/ui";

const showDialog = defineModel<boolean>({ default: false });
const { t } = useI18n();
const router = useRouter();

type TRestoreMetaData = { type: "file" } | { type: "remote"; server: string; path: string };

const { restoreMetadata = { type: "file" } } = defineProps<{
  restoreMetadata?: TRestoreMetaData;
}>();

const currentStep = ref<TRestoreMetaData["type"] | "restore">("file");
const decryptKey = ref<string>("");
const showDecryptKey = ref<boolean>(false);
const isDecryptKeyValid = ref<boolean>(true);

const restoreData = shallowRef<IBackupData>();
const restoreOptions = ref<IRestoreOptions>({
  fields: [],
  expandCookieMinutes: 0,
  keepExistUserInfo: true,
});

const configStore = useConfigStore();
const runtimeStore = useRuntimeStore();

const fileInputRef = useTemplateRef<HTMLInputElement>("fileInput");

function buildBackupOptions() {
  restoreOptions.value = {
    fields: [...Object.keys(restoreData.value?.manifest?.files ?? {})] as TBackupFields[],
    expandCookieMinutes: 0,
    keepExistUserInfo: true,
  };
  currentStep.value = "restore";
}

const backupFile = shallowRef<File>();
function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    backupFile.value = file;
    loadLocalBackupFile();
  }
}

function loadLocalBackupFile() {
  if (!backupFile.value) return;
  zipBlobToBackupData(backupFile.value as Blob, decryptKey.value)
    .then((data) => {
      restoreData.value = data;
      isDecryptKeyValid.value = true;
      buildBackupOptions();
    })
    .catch((err) => {
      console.error(err);
      restoreData.value = undefined;
      isDecryptKeyValid.value = false;
      runtimeStore.showSnackbar(t("SetBackup.RestoreDialog.loadFailure", { error: err }), { color: "error" });
    });
}

const isLoadingRemoteBackupFile = ref<boolean>(false);
function loadRemoteBackupFile() {
  if (restoreMetadata.type === "remote") {
    isLoadingRemoteBackupFile.value = true;
    sendMessage("getRemoteBackupData", {
      backupServerId: restoreMetadata.server,
      path: restoreMetadata.path,
      decryptKey: decryptKey.value,
    })
      .then((data) => {
        restoreData.value = data;
        isDecryptKeyValid.value = true;
        buildBackupOptions();
      })
      .catch((err) => {
        runtimeStore.showSnackbar(t("SetBackup.RestoreDialog.loadFailure", { error: err }), { color: "error" });
        console.error(err);
        isDecryptKeyValid.value = false;
      })
      .finally(() => {
        isLoadingRemoteBackupFile.value = false;
      });
  }
}

function extractVersion(str: string = "") {
  const regex = /v(\d+\.\d+\.\d+\.\d+)/;
  const match = str.match(regex);
  return match ? match[1] : null;
}

function compareVersion(inputV1?: string, inputV2?: string) {
  const v1 = extractVersion(inputV1);
  const v2 = extractVersion(inputV2);

  if (!v1 || !v2) return null;

  const parts1 = v1.split(".").map(Number);
  const parts2 = v2.split(".").map(Number);
  const maxLength = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLength; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;

    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }

  return 0;
}

const isDoingRestore = ref<boolean>(false);
function doRestore() {
  isDoingRestore.value = true;

  if (!restoreData.value?.manifest?.version) {
    runtimeStore.showSnackbar(t("SetBackup.RestoreDialog.missingVersion"), { color: "error" });
    isDoingRestore.value = false;
    return;
  }

  const warnRestore = compareVersion(restoreData.value.manifest.version, __EXT_VERSION__) == 1;
  if (!warnRestore || confirm(t("SetBackup.RestoreDialog.versionWarning"))) {
    sendMessage("restoreBackupData", { restoreData: restoreData.value!, restoreOptions: restoreOptions.value })
      .then(() => {
        runtimeStore.showSnackbar(t("SetBackup.RestoreDialog.success"), { color: "success" });
        showDialog.value = false;
      })
      .catch((err) => {
        runtimeStore.showSnackbar(t("SetBackup.RestoreDialog.failure", { error: err }), { color: "error" });
        console.error(err);
      })
      .finally(() => {
        isDoingRestore.value = false;
      });
  } else {
    isDoingRestore.value = false;
  }
}

function convertIsoDurationToMinutes(duration: string): number {
  const regex = /P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/;
  const match = duration.match(regex);
  if (!match) {
    throw new Error(`Invalid ISO 8601 duration format: ${duration}`);
  }
  const [, years, months, weeks, days, hours, minutes, seconds] = match;
  const minutesFromYears = years ? parseInt(years, 10) * 365 * 24 * 60 : 0;
  const minutesFromMonths = months ? parseInt(months, 10) * 30 * 24 * 60 : 0;
  const minutesFromWeeks = weeks ? parseInt(weeks, 10) * 7 * 24 * 60 : 0;
  const minutesFromDays = days ? parseInt(days, 10) * 24 * 60 : 0;
  const minutesFromHours = hours ? parseInt(hours, 10) * 60 : 0;
  const minutesFromMinutes = minutes ? parseInt(minutes, 10) : 0;
  const minutesFromSeconds = seconds ? parseInt(seconds, 10) / 60 : 0;
  return (
    minutesFromYears +
    minutesFromMonths +
    minutesFromWeeks +
    minutesFromDays +
    minutesFromHours +
    minutesFromMinutes +
    minutesFromSeconds
  );
}

function toggleRestoreField(field: TBackupFields, checked: boolean) {
  const current = restoreOptions.value.fields ?? [];
  if (checked) {
    if (!current.includes(field)) {
      restoreOptions.value.fields = [...current, field];
    }
  } else {
    restoreOptions.value.fields = current.filter((f) => f !== field);
  }
}

function resetDialog() {
  currentStep.value = restoreMetadata.type;
  decryptKey.value = configStore.backup.encryptionKey ?? "";
  isDecryptKeyValid.value = true;
  restoreData.value = undefined;
  if (fileInputRef.value) fileInputRef.value.value = "";

  if (restoreMetadata.type === "file") {
    backupFile.value = undefined;
  } else if (restoreMetadata.type === "remote") {
    loadRemoteBackupFile();
  }
}

function goToPtppImport() {
  router.push({ name: "SetBaseBackup" });
  showDialog.value = false;
}
</script>

<template>
  <Dialog v-model="showDialog" @after-open="resetDialog">
    <DialogContent class="max-w-2xl" :prevent-outside-close="isDoingRestore" :hide-close="isDoingRestore">
      <DialogHeader>
        <DialogTitle>
          <ArchiveRestore class="size-4 text-primary" />
          <span>{{ t("SetBackup.RestoreDialog.title") }}</span>
        </DialogTitle>
        <DialogDescription>
          {{ restoreMetadata.type === "remote" ? restoreMetadata.path : t("SetBackup.RestoreDialog.selectFile") }}
        </DialogDescription>
      </DialogHeader>

      <div class="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <Alert variant="info">
          <span>{{ t("SetBackup.RestoreDialog.ptppPrompt") }}</span>
          <template #action>
            <Button variant="outline" size="xs" @click="goToPtppImport">
              <Upload class="size-3.5" />
              {{ t("SetBackup.RestoreDialog.ptppImport") }}
            </Button>
          </template>
        </Alert>

        <!-- Step: 本地文件选择与解密 -->
        <div v-if="currentStep === 'file'" class="space-y-4">
          <div class="space-y-1.5">
            <Label>{{ t("SetBackup.RestoreDialog.selectFile") }}</Label>
            <input ref="fileInput" type="file" accept="application/zip" class="hidden" @change="onFileChange" />
            <button
              type="button"
              class="flex w-full items-center justify-between gap-3 rounded-lg border border-dashed border-input bg-muted/25 px-4 py-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/45"
              @click="() => fileInputRef?.click()"
            >
              <div class="flex min-w-0 items-center gap-3">
                <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileArchive class="size-4" />
                </div>
                <div class="min-w-0">
                  <div class="truncate text-sm font-medium text-foreground">
                    {{ backupFile ? backupFile.name : t("SetBackup.RestoreDialog.selectFile") }}
                  </div>
                  <div class="text-xs text-muted-foreground tabular-nums">
                    {{ backupFile ? formatSize(backupFile.size) : ".zip" }}
                  </div>
                </div>
              </div>
              <Button type="button" variant="secondary" size="sm" class="shrink-0">
                <Upload class="size-3.5" />
                {{ t("common.import") }}
              </Button>
            </button>
          </div>

          <div class="space-y-1.5">
            <Label for="local-decrypt-key">{{ t("SetBackup.RestoreDialog.decryptKey") }}</Label>
            <div class="relative">
              <Input
                id="local-decrypt-key"
                v-model="decryptKey"
                :type="showDecryptKey ? 'text' : 'password'"
                :placeholder="t('SetBackup.RestoreDialog.decryptKey')"
                class="pr-9"
              />
              <button
                type="button"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                @click="showDecryptKey = !showDecryptKey"
              >
                <Eye v-if="showDecryptKey" class="size-4" />
                <EyeOff v-else class="size-4" />
              </button>
            </div>
          </div>

          <Button
            v-if="!isDecryptKeyValid"
            variant="secondary"
            class="w-full"
            :disabled="!backupFile"
            @click="loadLocalBackupFile"
          >
            <RotateCw class="size-4" />
            {{ t("SetBackup.RestoreDialog.retry") }}
          </Button>
        </div>

        <!-- Step: 远程文件解密 -->
        <div v-else-if="currentStep === 'remote'" class="space-y-4">
          <div class="space-y-1.5">
            <Label for="remote-decrypt-key">{{ t("SetBackup.RestoreDialog.decryptKey") }}</Label>
            <div class="relative">
              <Input
                id="remote-decrypt-key"
                v-model="decryptKey"
                :type="showDecryptKey ? 'text' : 'password'"
                :placeholder="t('SetBackup.RestoreDialog.decryptKey')"
                class="pr-9"
              />
              <button
                type="button"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                @click="showDecryptKey = !showDecryptKey"
              >
                <Eye v-if="showDecryptKey" class="size-4" />
                <EyeOff v-else class="size-4" />
              </button>
            </div>
          </div>

          <Button
            v-if="!isDecryptKeyValid || isLoadingRemoteBackupFile"
            variant="secondary"
            class="w-full"
            :disabled="isLoadingRemoteBackupFile"
            @click="loadRemoteBackupFile"
          >
            <Loader2 v-if="isLoadingRemoteBackupFile" class="size-4 animate-spin" />
            <RotateCw v-else class="size-4" />
            {{ t("SetBackup.RestoreDialog.retry") }}
          </Button>
        </div>

        <!-- Step: 选择恢复模块 -->
        <div v-else-if="currentStep === 'restore'" class="space-y-4">
          <div class="space-y-2">
            <Label>{{ t("SetBackup.RestoreDialog.restoreOptions") }}</Label>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label
                v-for="field in BackupFields"
                :key="field"
                class="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-muted/25 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted/50"
                :class="{ 'cursor-not-allowed opacity-50': !restoreData?.manifest?.files?.[field] }"
              >
                <span class="truncate">{{ t(`SetBackup.fields.${field}`) }}</span>
                <Switch
                  :model-value="(restoreOptions.fields ?? []).includes(field)"
                  :disabled="!restoreData?.manifest?.files?.[field]"
                  @update:model-value="(v) => toggleRestoreField(field, v)"
                />
              </label>
            </div>
          </div>

          <div class="space-y-2">
            <Label for="expand-cookie-minutes">{{ t("SetBackup.RestoreDialog.expandCookieMinutes") }}</Label>
            <Input
              id="expand-cookie-minutes"
              v-model.number="restoreOptions.expandCookieMinutes"
              type="number"
              :min="0"
              :step="1"
              :disabled="!restoreOptions.fields?.includes('cookies')"
              class="tabular-nums"
            />
            <div class="flex flex-wrap gap-1.5 pt-0.5">
              <Button
                v-for="minutes in ['PT30M', 'PT1H', 'PT12H', 'P1D', 'P1W', 'P1M', 'P6M', 'P1Y']"
                :key="minutes"
                type="button"
                variant="outline"
                size="xs"
                class="font-mono text-[11px]"
                :disabled="!restoreOptions.fields?.includes('cookies')"
                @click="restoreOptions.expandCookieMinutes = convertIsoDurationToMinutes(minutes)"
              >
                {{ minutes }}
              </Button>
            </div>
          </div>

          <label
            class="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-muted/25 px-3 py-2.5 text-xs font-medium text-foreground"
          >
            <span>{{ t("SetBackup.RestoreDialog.keepExistUserInfo") }}</span>
            <Switch v-model="restoreOptions.keepExistUserInfo" />
          </label>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" :disabled="isDoingRestore" @click="showDialog = false">
          {{ t("common.dialog.cancel") }}
        </Button>
        <Button
          v-if="currentStep === 'restore'"
          variant="secondary"
          :disabled="isDoingRestore"
          @click="currentStep = restoreMetadata.type"
        >
          <ChevronLeft class="size-4" />
          {{ t("common.dialog.prev") }}
        </Button>
        <Button v-if="currentStep !== 'restore'" :disabled="isEmpty(restoreData)" @click="currentStep = 'restore'">
          {{ t("common.dialog.next") }}
          <ChevronRight class="size-4" />
        </Button>
        <Button
          v-if="currentStep === 'restore'"
          :disabled="isDoingRestore || (restoreOptions.fields ?? []).length === 0"
          @click="doRestore"
        >
          <Loader2 v-if="isDoingRestore" class="size-4 animate-spin" />
          <Upload v-else class="size-4" />
          {{ t("common.dialog.ok") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
