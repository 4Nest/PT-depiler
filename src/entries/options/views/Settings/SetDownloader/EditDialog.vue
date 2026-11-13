<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { Check, SlidersHorizontal } from "lucide-vue-next";

import { useMetadataStore } from "@/options/stores/metadata.ts";
import type { IDownloaderMetadata, TDownloaderKey } from "@/shared/types.ts";

import Editor from "./Editor.vue";
import { Badge, Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui";

const showDialog = defineModel<boolean>({ default: false });
const { clientId } = defineProps<{
  clientId: TDownloaderKey;
}>();

const clientConfig = ref<IDownloaderMetadata>();
const isConfigValid = ref<boolean>(true);

const { t } = useI18n();
const metadataStore = useMetadataStore();

function dialogEnter() {
  if (clientId) {
    const raw = metadataStore.downloaders[clientId];
    clientConfig.value = {
      sortIndex: 100,
      ...raw,
      feature: { ...(raw?.feature ?? {}) },
      advanceAddTorrentOptions: { ...(raw?.advanceAddTorrentOptions ?? {}) },
    };
  }
}

function editClientConfig() {
  if (!clientConfig.value) return;
  metadataStore.addDownloader(clientConfig.value);
  showDialog.value = false;
}
</script>

<template>
  <Dialog v-model="showDialog" @after-open="dialogEnter">
    <DialogContent class="max-w-3xl">
      <DialogHeader>
        <DialogTitle>
          <SlidersHorizontal class="size-4 text-primary" />
          <span>{{ t("SetDownloader.edit.title") }}</span>
          <Badge v-if="clientConfig?.name" variant="secondary" class="ml-1 font-normal">
            {{ clientConfig.name }}
          </Badge>
        </DialogTitle>
      </DialogHeader>

      <div class="flex-1 overflow-y-auto px-5 py-4">
        <Editor v-model="clientConfig" @update:config-valid="(v) => (isConfigValid = v)" />
      </div>

      <DialogFooter>
        <Button variant="outline" @click="showDialog = false">
          {{ t("common.dialog.cancel") }}
        </Button>
        <Button :disabled="!isConfigValid" @click="editClientConfig">
          <Check class="size-4" />
          {{ t("common.dialog.ok") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
