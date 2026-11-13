<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { Download, Loader2 } from "lucide-vue-next";

import { BackupFields, type TBackupFields } from "@/shared/types.ts";
import { sendMessage } from "@/messages.ts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Switch,
} from "~/components/ui";

const showDialog = defineModel<boolean>({ default: false });
const { t } = useI18n();

const backupFields = ref<TBackupFields[]>([]);
const isExporting = ref(false);

function toggleField(field: TBackupFields, checked: boolean) {
  if (checked) {
    if (!backupFields.value.includes(field)) {
      backupFields.value = [...backupFields.value, field];
    }
  } else {
    backupFields.value = backupFields.value.filter((f) => f !== field);
  }
}

async function doLocalExport() {
  isExporting.value = true;
  try {
    await sendMessage("exportBackupData", { backupFields: backupFields.value, backupServerId: "local" });
    showDialog.value = false;
  } finally {
    isExporting.value = false;
  }
}

function dialogEnter() {
  backupFields.value = [...BackupFields];
}
</script>

<template>
  <Dialog v-model="showDialog" @after-open="dialogEnter">
    <DialogContent class="max-w-lg" :prevent-outside-close="isExporting" :hide-close="isExporting">
      <DialogHeader>
        <DialogTitle>
          <Download class="size-4 text-primary" />
          <span>{{ t("SetBackup.LocalExportConfirmDialog.title") }}</span>
        </DialogTitle>
        <DialogDescription>
          {{ t("SetBackup.localExport") }}
        </DialogDescription>
      </DialogHeader>

      <div class="grid grid-cols-1 gap-2.5 px-5 py-4 sm:grid-cols-2">
        <label
          v-for="field in BackupFields"
          :key="field"
          class="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/55"
        >
          <span class="truncate">{{ t(`SetBackup.fields.${field}`) }}</span>
          <Switch :model-value="backupFields.includes(field)" @update:model-value="(v) => toggleField(field, v)" />
        </label>
      </div>

      <DialogFooter>
        <Button variant="outline" :disabled="isExporting" @click="showDialog = false">
          {{ t("common.dialog.cancel") }}
        </Button>
        <Button :disabled="backupFields.length === 0 || isExporting" @click="doLocalExport">
          <Loader2 v-if="isExporting" class="size-4 animate-spin" />
          <Download v-else class="size-4" />
          {{ t("common.export") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
