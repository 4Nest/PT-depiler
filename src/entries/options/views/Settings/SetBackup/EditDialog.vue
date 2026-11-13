<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { CheckCircle2, SlidersHorizontal } from "lucide-vue-next";

import { useMetadataStore } from "@/options/stores/metadata.ts";
import type { IBackupServerMetadata, TBackupServerKey } from "@/shared/types.ts";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui";

import Editor from "./Editor.vue";

const showDialog = defineModel<boolean>({ default: false });
const { clientId } = defineProps<{
  clientId: TBackupServerKey;
}>();
const clientConfig = ref<IBackupServerMetadata>();

const { t } = useI18n();
const metadataStore = useMetadataStore();

function dialogEnter() {
  if (clientId) {
    clientConfig.value = { ...metadataStore.backupServers[clientId] };
  }
}

function editClientConfig() {
  metadataStore.addBackupServer(clientConfig.value as IBackupServerMetadata);
  showDialog.value = false;
}
</script>

<template>
  <Dialog v-model="showDialog" @after-open="dialogEnter">
    <DialogContent class="max-w-3xl">
      <DialogHeader>
        <DialogTitle>
          <SlidersHorizontal class="size-4 text-primary" />
          <span>{{ t("SetBackup.EditDialog.title") }}</span>
        </DialogTitle>
      </DialogHeader>

      <div class="flex-1 overflow-y-auto px-5 py-4">
        <Editor v-if="clientConfig" v-model="clientConfig" />
      </div>

      <DialogFooter>
        <Button variant="outline" @click="showDialog = false">
          {{ t("common.dialog.cancel") }}
        </Button>
        <Button :disabled="!clientConfig?.name?.trim()" @click="editClientConfig">
          <CheckCircle2 class="size-4" />
          {{ t("common.dialog.ok") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
