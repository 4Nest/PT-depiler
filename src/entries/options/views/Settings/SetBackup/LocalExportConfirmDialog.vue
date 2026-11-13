<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";

import { BackupFields, TBackupFields } from "@/shared/types.ts";
import { sendMessage } from "@/messages.ts";

const showDialog = defineModel<boolean>();
const { t } = useI18n();

const backupFields = ref<TBackupFields[]>([]);

async function doLocalExport() {
  await sendMessage("exportBackupData", { backupFields: backupFields.value, backupServerId: "local" });
}

function dialogEnter() {
  backupFields.value = [...BackupFields];
}
</script>

<template>
  <v-dialog v-model="showDialog" max-width="600" @after-enter="dialogEnter">
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between px-4 py-3 border-b">
        <span class="text-subtitle-1 font-weight-bold">{{ t("SetBackup.LocalExportConfirmDialog.title") }}</span>
        <v-btn
          icon="mdi-close"
          size="small"
          variant="text"
          :title="t('common.dialog.close')"
          @click="showDialog = false"
        />
      </v-card-title>
      <v-divider />
      <v-card-text>
        <v-row no-gutters>
          <v-col v-for="backupField in BackupFields" :key="backupField" cols="12" md="6">
            <v-switch
              v-model="backupFields"
              :label="t(`SetBackup.fields.${backupField}`)"
              :value="backupField"
              color="success"
              hide-details
            />
          </v-col>
        </v-row>
      </v-card-text>
      <v-divider />
      <v-card-actions class="pa-4">
        <v-spacer />
        <v-btn variant="text" @click="showDialog = false">
          {{ t("common.dialog.cancel") }}
        </v-btn>
        <v-btn color="primary" prepend-icon="mdi-export" variant="flat" @click="() => doLocalExport()">
          {{ t("common.export") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped lang="scss"></style>
