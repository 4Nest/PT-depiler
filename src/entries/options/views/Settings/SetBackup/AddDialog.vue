<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { computedAsync } from "@vueuse/core";
import { nanoid } from "nanoid";
import { Check, CheckCircle2, ChevronLeft, ChevronRight, CloudUpload, ExternalLink, Search } from "lucide-vue-next";

import { BackupFields, type IBackupServerMetadata } from "@/shared/types.ts";
import { useMetadataStore } from "@/options/stores/metadata.ts";
import {
  entityList,
  getBackupServerDefaultConfig,
  getBackupServerIcon,
  getBackupServerMetaData,
  type IBackupMetadata,
} from "@ptd/backupServer";
import { REPO_URL } from "~/helper.ts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Tooltip,
} from "~/components/ui";
import { cn } from "~/lib/utils";

import Editor from "./Editor.vue";

const showDialog = defineModel<boolean>({ default: false });

const { t } = useI18n();
const metadataStore = useMetadataStore();

const currentStep = ref<0 | 1>(0);
const selectedBackupServerType = ref<IBackupServerMetadata["type"] | null>(null);
const storedBackupServerConfig = ref<IBackupServerMetadata>({} as IBackupServerMetadata);
const isBackupServerConfigValid = ref<boolean>(false);
const typeFilter = ref<string>("");

const allBackupServerMetaData = computedAsync(async () => {
  const clientMetaData: Record<string, IBackupMetadata<any> & { type: string }> = {};
  for (const type of entityList) {
    clientMetaData[type] = { type, ...(await getBackupServerMetaData(type)) };
  }
  return clientMetaData;
}, {});

const filteredServerList = computed(() => {
  const q = typeFilter.value.trim().toLowerCase();
  const list = Object.values(allBackupServerMetaData.value);
  if (!q) return list;
  return list.filter(
    (item) => item.type.toLowerCase().includes(q) || (item.description ?? "").toLowerCase().includes(q),
  );
});

async function selectBackupServerType(type: IBackupServerMetadata["type"]) {
  selectedBackupServerType.value = type;
  storedBackupServerConfig.value = {
    ...(await getBackupServerDefaultConfig(type)),
    enabled: true,
    id: nanoid(),
    backupFields: [...BackupFields],
  } as IBackupServerMetadata;
}

async function saveStoredBackupServerConfig() {
  await metadataStore.addBackupServer(storedBackupServerConfig.value as IBackupServerMetadata);
  showDialog.value = false;
}

function resetDialog() {
  currentStep.value = 0;
  selectedBackupServerType.value = null;
  storedBackupServerConfig.value = {} as IBackupServerMetadata;
  isBackupServerConfigValid.value = false;
  typeFilter.value = "";
}
</script>

<template>
  <Dialog v-model="showDialog" @after-close="resetDialog">
    <DialogContent class="max-w-3xl">
      <DialogHeader>
        <div class="flex items-center justify-between gap-2 pr-7">
          <DialogTitle>
            <CloudUpload class="size-4 text-primary" />
            <span>{{ t("SetBackup.AddDialog.title") }}</span>
          </DialogTitle>
          <Tooltip :content="t('common.howToUse')" side="left">
            <Button
              as="a"
              :href="`${REPO_URL}/wiki/config-backup-server`"
              target="_blank"
              rel="noopener noreferrer"
              variant="ghost"
              size="icon-xs"
            >
              <ExternalLink class="size-3.5" />
            </Button>
          </Tooltip>
        </div>
        <DialogDescription>
          {{
            currentStep === 0
              ? selectedBackupServerType
                ? allBackupServerMetaData[selectedBackupServerType]?.description || selectedBackupServerType
                : t("SetDownloader.add.NoneSelectNotice")
              : storedBackupServerConfig.type
          }}
        </DialogDescription>
      </DialogHeader>

      <div class="flex-1 overflow-y-auto px-5 py-4">
        <div v-if="currentStep === 0" class="space-y-3">
          <div class="relative">
            <Search
              class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input v-model="typeFilter" :placeholder="t('SetDownloader.add.selectPlaceholder')" class="pl-8" />
          </div>

          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              v-for="server in filteredServerList"
              :key="server.type"
              type="button"
              :class="
                cn(
                  'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                  selectedBackupServerType === server.type
                    ? 'border-primary bg-primary/8'
                    : 'border-border bg-card hover:bg-muted/45',
                )
              "
              @click="selectBackupServerType(server.type)"
            >
              <img
                :src="getBackupServerIcon(server.type)"
                :alt="server.type"
                class="size-8 shrink-0 rounded-md border border-border bg-background p-1 object-contain"
              />
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-2">
                  <span class="truncate text-sm font-medium text-foreground">{{ server.type }}</span>
                  <Check v-if="selectedBackupServerType === server.type" class="size-4 shrink-0 text-primary" />
                </div>
                <p v-if="server.description" class="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {{ server.description }}
                </p>
              </div>
            </button>
          </div>
        </div>

        <Editor
          v-else-if="currentStep === 1 && storedBackupServerConfig.type"
          v-model="storedBackupServerConfig"
          @update:config-valid="(v) => (isBackupServerConfigValid = v)"
        />
      </div>

      <DialogFooter>
        <Button variant="outline" @click="showDialog = false">
          {{ t("common.dialog.cancel") }}
        </Button>
        <Button v-if="currentStep === 1" variant="secondary" @click="currentStep = 0">
          <ChevronLeft class="size-4" />
          {{ t("common.dialog.prev") }}
        </Button>
        <Button v-if="currentStep === 0" :disabled="selectedBackupServerType == null" @click="currentStep = 1">
          {{ t("common.dialog.next") }}
          <ChevronRight class="size-4" />
        </Button>
        <Button v-if="currentStep === 1" :disabled="!isBackupServerConfigValid" @click="saveStoredBackupServerConfig">
          <CheckCircle2 class="size-4" />
          {{ t("common.dialog.ok") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
