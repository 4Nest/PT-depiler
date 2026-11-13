<script setup lang="ts">
import { nanoid } from "nanoid";
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { computedAsync } from "@vueuse/core";
import {
  entityList,
  getDownloaderDefaultConfig,
  getDownloaderIcon,
  getDownloaderMetaData,
  type TorrentClientMetaData,
} from "@ptd/downloader";
import { Check, ChevronLeft, ChevronRight, ExternalLink, HelpCircle, PlusCircle } from "lucide-vue-next";

import type { IDownloaderMetadata } from "@/shared/types.ts";
import { useMetadataStore } from "@/options/stores/metadata.ts";
import { cn } from "~/lib/utils";
import { REPO_URL } from "~/helper.ts";

import Editor from "./Editor.vue";
import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Tooltip,
} from "~/components/ui";

const showDialog = defineModel<boolean>({ default: false });

const { t } = useI18n();
const metadataStore = useMetadataStore();

const currentStep = ref<0 | 1>(0);
const selectedClientType = ref<string | null>(null);
const storedDownloaderConfig = ref<Partial<IDownloaderMetadata>>({});
const isDownloaderConfigValid = ref<boolean>(false);

function resetDialog() {
  currentStep.value = 0;
  selectedClientType.value = null;
  storedDownloaderConfig.value = {};
  isDownloaderConfigValid.value = false;
}

const allTorrentClientMetaData = computedAsync(async () => {
  const clientMetaData: Record<string, TorrentClientMetaData & { type: string }> = {};
  for (const type of entityList) {
    clientMetaData[type] = { type, ...(await getDownloaderMetaData(type)) };
  }
  return clientMetaData;
}, {});

async function updateStoredDownloaderConfigByDefault(type: string) {
  selectedClientType.value = type;
  storedDownloaderConfig.value = {
    valid: false,
    ...(await getDownloaderDefaultConfig(type)),
    enabled: true,
    id: nanoid(),
    advanceAddTorrentOptions: {},
    sortIndex: 100,
  };
}

async function selectAndNext(type: string) {
  await updateStoredDownloaderConfigByDefault(type);
  currentStep.value = 1;
}

async function saveStoredDownloaderConfig() {
  await metadataStore.addDownloader(storedDownloaderConfig.value as IDownloaderMetadata);

  // 如果只有一个下载器，则将这个下载器设为默认下载器
  if (metadataStore.getDownloaders.length === 1) {
    metadataStore.defaultDownloader = { id: storedDownloaderConfig.value.id!, folder: "", tags: "" };
    metadataStore.$save();
  }

  showDialog.value = false;
}
</script>

<template>
  <Dialog v-model="showDialog" @after-close="resetDialog">
    <DialogContent class="max-w-3xl">
      <DialogHeader>
        <DialogTitle>
          <PlusCircle class="size-4 text-primary" />
          <span>{{ t("SetDownloader.add.title") }}</span>
          <Badge variant="secondary" class="ml-1 font-mono text-[11px] tabular-nums"> {{ currentStep + 1 }} / 2 </Badge>
          <Badge v-if="currentStep === 1 && selectedClientType" variant="outline" class="font-normal">
            {{ selectedClientType }}
          </Badge>
          <Tooltip :content="t('common.howToUse')">
            <a
              :href="`${REPO_URL}/wiki/config-download-client`"
              target="_blank"
              rel="noopener noreferrer nofollow"
              class="ml-1 inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <HelpCircle class="size-3.5" />
            </a>
          </Tooltip>
        </DialogTitle>
      </DialogHeader>

      <!-- Step 1: 客户端类型卡片网格 -->
      <div v-if="currentStep === 0" class="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
          <button
            v-for="client in Object.values(allTorrentClientMetaData)"
            :key="client.type"
            type="button"
            :class="
              cn(
                'group relative flex flex-col gap-2 rounded-lg border p-3 text-left transition-all',
                selectedClientType === client.type
                  ? 'border-primary bg-primary/[0.06] ring-1 ring-primary/30'
                  : 'border-border bg-card hover:border-border/80 hover:bg-muted/45',
              )
            "
            @click="updateStoredDownloaderConfigByDefault(client.type)"
            @dblclick="selectAndNext(client.type)"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="flex min-w-0 items-center gap-2.5">
                <img
                  :src="getDownloaderIcon(client.type)"
                  :alt="client.type"
                  class="size-8 shrink-0 rounded-md object-contain"
                />
                <span class="truncate text-sm font-semibold text-foreground">
                  {{ client.type }}
                </span>
              </div>
              <span
                :class="
                  cn(
                    'flex size-4.5 shrink-0 items-center justify-center rounded-full border transition-colors',
                    selectedClientType === client.type
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-transparent',
                  )
                "
              >
                <Check class="size-2.5" />
              </span>
            </div>

            <p v-if="client.description" class="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {{ client.description }}
            </p>
          </button>
        </div>

        <Alert variant="info">
          {{ allTorrentClientMetaData[selectedClientType!]?.description ?? t("SetDownloader.add.NoneSelectNotice") }}
        </Alert>
      </div>

      <!-- Step 2: 详细配置 -->
      <div v-else class="flex-1 overflow-y-auto px-5 py-4">
        <Editor
          v-if="storedDownloaderConfig.type"
          v-model="storedDownloaderConfig as IDownloaderMetadata"
          @update:config-valid="(v) => (isDownloaderConfigValid = v)"
        />
      </div>

      <DialogFooter class="sm:justify-between">
        <div>
          <Button
            v-if="currentStep === 0"
            as="a"
            :href="`${REPO_URL}/tree/master/src/packages/downloader`"
            target="_blank"
            rel="noopener noreferrer nofollow"
            variant="ghost"
            size="sm"
            class="text-xs text-muted-foreground"
          >
            <ExternalLink class="size-3.5" />
            {{ t("SetDownloader.add.newType") }}
          </Button>
        </div>

        <div class="flex items-center gap-2">
          <Button variant="outline" @click="showDialog = false">
            {{ t("common.dialog.cancel") }}
          </Button>
          <Button v-if="currentStep === 1" variant="secondary" @click="currentStep = 0">
            <ChevronLeft class="size-4" />
            {{ t("common.dialog.prev") }}
          </Button>
          <Button v-if="currentStep === 0" :disabled="selectedClientType == null" @click="currentStep = 1">
            {{ t("common.dialog.next") }}
            <ChevronRight class="size-4" />
          </Button>
          <Button v-if="currentStep === 1" :disabled="!isDownloaderConfigValid" @click="saveStoredDownloaderConfig">
            <Check class="size-4" />
            {{ t("common.dialog.ok") }}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
