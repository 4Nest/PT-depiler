<script setup lang="ts">
import { strFromU8, unzipSync } from "fflate";
import { nanoid } from "nanoid";
import { computed, ref, shallowRef, useTemplateRef, watch } from "vue";
import { useThrottledRefHistory } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import { Eye, EyeOff, FileArchive, HelpCircle, KeyRound, Undo2, Upload } from "lucide-vue-next";

import { useConfigStore } from "@/options/stores/config.ts";
import type { IPtppDumpUserInfo } from "@/shared/types.ts";
import { REPO_NAME } from "~/helper.ts";
import { Badge, Button, Input, Label, Tooltip } from "~/components/ui";

import RestorePtppUserDataDialog from "./RestorePtppUserDataDialog.vue";

const { t } = useI18n();
const configStore = useConfigStore();

const showEncryptionKey = ref<boolean>(false);
const encryptionKey = shallowRef<string>(configStore.backup.encryptionKey);
const { history, undo: undoEncryptionKey } = useThrottledRefHistory(encryptionKey, { throttle: 50 });
watch(encryptionKey, (newValue) => {
  configStore.backup.encryptionKey = newValue;
});

const fileInputRef = useTemplateRef<HTMLInputElement>("ptppFileInput");
const showRestorePtppUserDataDialog = ref<boolean>(false);
const ptppUserDataFile = shallowRef<File>();
const parsedPtppUserData = shallowRef<IPtppDumpUserInfo>();

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    ptppUserDataFile.value = file;
    void loadPTPPBackupFile();
  }
  input.value = "";
}

async function loadPTPPBackupFile() {
  if (ptppUserDataFile.value instanceof File) {
    let ptppUserDataFileRawContent;
    if (ptppUserDataFile.value.name.match(/^PT-Plugin-Plus-Backup-.+\.zip$/)) {
      const bytes = new Uint8Array(await ptppUserDataFile.value.arrayBuffer());
      const userDatasEntry = unzipSync(bytes, { filter: (file) => file.name === "userdatas.json" })["userdatas.json"];
      ptppUserDataFileRawContent = userDatasEntry ? strFromU8(userDatasEntry) : undefined;
    } else if (ptppUserDataFile.value.name === "userdatas.json") {
      ptppUserDataFileRawContent = await ptppUserDataFile.value.text();
    }

    try {
      if (!ptppUserDataFileRawContent || !ptppUserDataFileRawContent.startsWith("{")) {
        throw new Error("Invalid file format");
      }
      parsedPtppUserData.value = JSON.parse(ptppUserDataFileRawContent);
      showRestorePtppUserDataDialog.value = true;
    } catch {
      alert(t("ptppSettings.invalidFileFormat"));
    } finally {
      ptppUserDataFile.value = undefined;
    }
  }
}

function randomEncryptionKey() {
  encryptionKey.value = nanoid();
}

const ptppImportTooltip = computed(() =>
  [
    t("ptppSettings.importConfigInfoLine1", { repoName: REPO_NAME }),
    `1. ${t("ptppSettings.importStep1", { repoName: REPO_NAME })}`,
    `2. ${t("ptppSettings.importStep2", { repoName: REPO_NAME })}`,
    `3. ${t("ptppSettings.importStep3").replace(/<[^>]+>/g, "")}`,
    `4. ${t("ptppSettings.importStep4")}`,
  ].join("\n"),
);
</script>

<template>
  <div class="space-y-6">
    <!-- 备份加密密钥 -->
    <section class="space-y-2">
      <h2 class="px-1 text-xs font-medium text-muted-foreground">{{ t("ptppSettings.basicConfig") }}</h2>
      <div class="overflow-hidden rounded-xl border border-border/80 bg-card p-4 shadow-2xs">
        <div class="space-y-2">
          <div class="flex items-center gap-1.5">
            <Label for="backup-encryption-key" class="text-sm font-medium text-foreground">
              {{ t("ptppSettings.encryptionKeyLabel") }}
            </Label>
            <Tooltip :content="t('ptppSettings.saveKeyNotice')" side="top">
              <HelpCircle class="size-3.5 shrink-0 text-muted-foreground/75" />
            </Tooltip>
          </div>
          <div class="flex items-center gap-2">
            <div class="relative flex-1">
              <Input
                id="backup-encryption-key"
                v-model="encryptionKey"
                :type="showEncryptionKey ? 'text' : 'password'"
                class="pr-9 font-mono"
              />
              <button
                type="button"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                @click="showEncryptionKey = !showEncryptionKey"
              >
                <Eye v-if="showEncryptionKey" class="size-4" />
                <EyeOff v-else class="size-4" />
              </button>
            </div>

            <Tooltip :content="t('ptppSettings.undoKeyTitle')" side="top">
              <Button
                type="button"
                variant="outline"
                size="icon"
                class="relative"
                :disabled="history.length <= 1"
                @click="undoEncryptionKey"
              >
                <Undo2 class="size-4 text-success" />
                <Badge
                  v-if="history.length > 1"
                  variant="secondary"
                  class="absolute -right-1.5 -top-1.5 h-4 min-w-4 justify-center px-1 text-[10px] tabular-nums"
                >
                  {{ history.length > 10 ? "9+" : history.length - 1 }}
                </Badge>
              </Button>
            </Tooltip>

            <Tooltip :content="t('ptppSettings.randomGenTitle')" side="top">
              <Button type="button" variant="outline" size="icon" @click="randomEncryptionKey">
                <KeyRound class="size-4 text-warning" />
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>
    </section>

    <!-- PT-Plugin-Plus 数据迁移导入 -->
    <section class="space-y-2">
      <div class="flex items-center gap-1.5 px-1">
        <h2 class="text-xs font-medium text-muted-foreground">{{ t("ptppSettings.importConfigTitle") }}</h2>
        <Tooltip :content="ptppImportTooltip" side="top">
          <HelpCircle class="size-3.5 shrink-0 text-muted-foreground/75" />
        </Tooltip>
      </div>
      <div class="overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xs">
        <input
          ref="ptppFileInput"
          type="file"
          accept="application/zip, application/json"
          class="hidden"
          @change="onFileChange"
        />
        <button
          type="button"
          class="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/30"
          @click="() => fileInputRef?.click()"
        >
          <div class="flex min-w-0 items-center gap-3">
            <div class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileArchive class="size-4" />
            </div>
            <div class="min-w-0">
              <div class="truncate text-sm font-medium text-foreground">{{ t("ptppSettings.selectBackupFile") }}</div>
              <div class="truncate text-xs text-muted-foreground">PT-Plugin-Plus-Backup-*.zip / userdatas.json</div>
            </div>
          </div>
          <span
            class="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-secondary/70 px-3 text-xs font-medium text-secondary-foreground"
          >
            <Upload class="size-3.5" />
            {{ t("common.import") }}
          </span>
        </button>
      </div>
    </section>
  </div>

  <RestorePtppUserDataDialog v-model="showRestorePtppUserDataDialog" :ptpp-user-data="parsedPtppUserData!" />
</template>
