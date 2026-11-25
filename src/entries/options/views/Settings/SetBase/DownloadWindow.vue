<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { HelpCircle } from "lucide-vue-next";

import { useConfigStore } from "@/options/stores/config.ts";
import { useMetadataStore } from "@/options/stores/metadata.ts";
import { LocalDownloadMethod } from "@/shared/types.ts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Tooltip } from "~/components/ui";

const { t } = useI18n();
const configStore = useConfigStore();
const metadataStore = useMetadataStore();

const quickSendNotePlain = computed(() =>
  t("SetBase.download.quickSendToClientNote")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, ""),
);

async function clearLastDownloader(v: boolean) {
  if (!v) {
    await metadataStore.setLastDownloader({});
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- 本地下载 -->
    <section class="space-y-2">
      <h2 class="px-1 text-xs font-medium text-muted-foreground">{{ t("SetBase.download.localDownloadTitle") }}</h2>
      <div class="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xs">
        <div class="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex min-w-0 items-center gap-1.5">
            <span class="text-sm font-medium text-foreground">{{ t("SetBase.download.localDownloadMethod") }}</span>
            <Tooltip
              :content="t(`SetBase.download.localDownloadMethodOptions.${configStore.download.localDownloadMethod}Tip`)"
              side="top"
            >
              <HelpCircle class="size-3.5 shrink-0 text-muted-foreground/75" />
            </Tooltip>
          </div>
          <Select v-model="configStore.download.localDownloadMethod">
            <SelectTrigger class="w-full sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="item in LocalDownloadMethod" :key="item" :value="item">
                {{ t(`SetBase.download.localDownloadMethodOptions.${item}`) }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <label
          class="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/25"
        >
          <span class="text-sm font-medium text-foreground">{{
            t("SetBase.download.localDownloadIgnoreInterval")
          }}</span>
          <Switch v-model="configStore.download.ignoreSiteDownloadIntervalWhenLocalDownload" />
        </label>
      </div>
    </section>

    <!-- 下载服务器推送 -->
    <section class="space-y-2">
      <h2 class="px-1 text-xs font-medium text-muted-foreground">
        {{ t("SetBase.download.pushDownloadServerTitle") }}
      </h2>
      <div class="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xs">
        <div class="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/25">
          <div class="flex min-w-0 items-center gap-1.5">
            <span class="text-sm font-medium text-foreground">{{ t("SetBase.download.useQuickSendToClient") }}</span>
            <Tooltip :content="quickSendNotePlain" side="top">
              <HelpCircle class="size-3.5 shrink-0 text-muted-foreground/75" />
            </Tooltip>
          </div>
          <Switch v-model="configStore.download.useQuickSendToClient" />
        </div>

        <label
          class="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/25"
        >
          <span class="text-sm font-medium text-foreground">{{ t("SetBase.download.enableSiteFilter") }}</span>
          <Switch v-model="configStore.download.allowDownloaderFilterForSite" />
        </label>

        <label
          class="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/25"
        >
          <span class="text-sm font-medium text-foreground">{{ t("SetBase.download.saveLastDownloader") }}</span>
          <Switch
            v-model="configStore.download.saveLastDownloader"
            @update:model-value="(v) => clearLastDownloader(v)"
          />
        </label>

        <label
          class="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/25"
        >
          <span class="text-sm font-medium text-foreground">{{ t("SetBase.download.allowDirectSendToClient") }}</span>
          <Switch v-model="configStore.download.allowDirectSendToClient" />
        </label>
      </div>
    </section>
  </div>
</template>
