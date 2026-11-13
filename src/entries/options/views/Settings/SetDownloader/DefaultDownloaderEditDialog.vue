<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Check, Download, Folder, Tag } from "lucide-vue-next";
import { getDownloaderIcon } from "@ptd/downloader";

import { useMetadataStore } from "@/options/stores/metadata.ts";
import type { IDefaultDownloaderConfig, TDownloaderKey } from "@/shared/types/storages/metadata.ts";
import { useResetableRef } from "@/options/directives/useResetableRef.ts";
import { cn } from "~/lib/utils";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui";

const showDialog = defineModel<boolean>({ default: false });

const { t } = useI18n();
const metadataStore = useMetadataStore();

const { ref: defaultDownloaderConfig, reset: resetDefaultDownloaderConfig } = useResetableRef<
  Required<IDefaultDownloaderConfig>
>(() => ({
  id: "",
  folder: "",
  tags: "",
}));

const { ref: suggests, reset: resetSuggestions } = useResetableRef<{ folder: string[]; tags: string[] }>(
  () => ({ folder: [], tags: [] }),
  { shallow: true },
);

function updateDefaultDownloaderInput(downloaderId: TDownloaderKey, clean: boolean = true) {
  if (clean) {
    defaultDownloaderConfig.value.folder = "";
    defaultDownloaderConfig.value.tags = "";
  }

  suggests.value = {
    folder: metadataStore.downloaders?.[downloaderId]?.suggestFolders ?? [],
    tags: metadataStore.downloaders?.[downloaderId]?.suggestTags ?? [],
  };
}

function saveDefaultDownloader() {
  metadataStore.defaultDownloader = defaultDownloaderConfig.value;
  metadataStore.$save();
  showDialog.value = false;
}

function enterDialog() {
  resetDefaultDownloaderConfig();
  resetSuggestions();

  if (metadataStore.defaultDownloader?.id) {
    defaultDownloaderConfig.value = { ...metadataStore.defaultDownloader } as Required<IDefaultDownloaderConfig>;
    updateDefaultDownloaderInput(defaultDownloaderConfig.value.id!, false);
  }
}
</script>

<template>
  <Dialog v-model="showDialog" @after-open="enterDialog">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>
          <Download class="size-4 text-primary" />
          {{ t("SetDownloader.index.editDefaultDownloaderBtn") }}
        </DialogTitle>
      </DialogHeader>

      <div class="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <div class="space-y-1.5">
          <Label>{{ t("SetDownloader.index.editDefaultDownloaderBtn") }}</Label>
          <Select
            :model-value="defaultDownloaderConfig.id || undefined"
            @update:model-value="
              (val) => {
                if (val) {
                  defaultDownloaderConfig.id = String(val);
                  updateDefaultDownloaderInput(String(val), true);
                }
              }
            "
          >
            <SelectTrigger>
              <SelectValue :placeholder="t('SetDownloader.add.NoneSelectNotice')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="downloader in metadataStore.getEnabledDownloaders"
                :key="downloader.id"
                :value="downloader.id"
              >
                <div class="flex items-center gap-2">
                  <img
                    :src="getDownloaderIcon(downloader.type)"
                    :alt="downloader.type"
                    class="size-4 rounded-xs object-contain"
                  />
                  <span class="font-medium">{{ downloader.name }}</span>
                  <span class="font-mono text-xs text-muted-foreground">{{ downloader.address }}</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="space-y-1.5">
          <Label for="default-dl-folder" class="flex items-center gap-1.5">
            <Folder class="size-3.5 text-muted-foreground" />
            {{ t("SetDownloader.PathAndTag.downloadPath.title") }}
          </Label>
          <Input
            id="default-dl-folder"
            v-model="defaultDownloaderConfig.folder"
            :placeholder="t('SetDownloader.PathAndTag.downloadPath.title')"
            class="font-mono text-xs"
          />
          <div v-if="suggests.folder.length > 0" class="flex flex-wrap gap-1.5 pt-1">
            <button
              v-for="folder in suggests.folder"
              :key="folder"
              type="button"
              :class="
                cn(
                  'rounded-md border px-2 py-0.5 font-mono text-[11px] transition-colors',
                  defaultDownloaderConfig.folder === folder
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground',
                )
              "
              @click="defaultDownloaderConfig.folder = folder"
            >
              {{ folder }}
            </button>
          </div>
        </div>

        <div class="space-y-1.5">
          <Label for="default-dl-tags" class="flex items-center gap-1.5">
            <Tag class="size-3.5 text-muted-foreground" />
            {{ t("SetDownloader.PathAndTag.tags.title") }}
          </Label>
          <Input
            id="default-dl-tags"
            v-model="defaultDownloaderConfig.tags"
            :placeholder="t('SetDownloader.PathAndTag.tags.title')"
          />
          <div v-if="suggests.tags.length > 0" class="flex flex-wrap gap-1.5 pt-1">
            <button
              v-for="tag in suggests.tags"
              :key="tag"
              type="button"
              :class="
                cn(
                  'rounded-md border px-2 py-0.5 text-[11px] transition-colors',
                  defaultDownloaderConfig.tags === tag
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground',
                )
              "
              @click="defaultDownloaderConfig.tags = tag"
            >
              {{ tag }}
            </button>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="showDialog = false">
          {{ t("common.dialog.cancel") }}
        </Button>
        <Button @click="saveDefaultDownloader">
          <Check class="size-4" />
          {{ t("common.dialog.ok") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
