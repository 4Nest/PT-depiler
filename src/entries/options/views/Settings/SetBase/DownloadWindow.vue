<script setup lang="ts">
import { useI18n } from "vue-i18n";

import { useConfigStore } from "@/options/stores/config.ts";
import { useMetadataStore } from "@/options/stores/metadata.ts";
import { LocalDownloadMethod } from "@/shared/types.ts";
import {
  Alert,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Switch,
} from "~/components/ui";

const { t } = useI18n();
const configStore = useConfigStore();
const metadataStore = useMetadataStore();

async function clearLastDownloader(v: boolean) {
  if (!v) {
    await metadataStore.setLastDownloader({});
  }
}
</script>

<template>
  <div class="space-y-5">
    <!-- 本地下载 -->
    <Card>
      <CardHeader>
        <CardTitle>{{ t("SetBase.download.localDownloadTitle") }}</CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-1.5">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span class="text-sm font-medium text-foreground">{{ t("SetBase.download.localDownloadMethod") }}</span>
            <Select v-model="configStore.download.localDownloadMethod">
              <SelectTrigger class="w-full sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="item in LocalDownloadMethod" :key="item" :value="item">
                  {{ t(`SetBase.download.localDownloadMethodOptions.${item}`) }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p class="text-xs text-muted-foreground">
            {{ t(`SetBase.download.localDownloadMethodOptions.${configStore.download.localDownloadMethod}Tip`) }}
          </p>
        </div>

        <Separator />

        <label class="flex cursor-pointer items-center justify-between gap-4">
          <span class="text-sm font-medium text-foreground">{{
            t("SetBase.download.localDownloadIgnoreInterval")
          }}</span>
          <Switch v-model="configStore.download.ignoreSiteDownloadIntervalWhenLocalDownload" />
        </label>
      </CardContent>
    </Card>

    <!-- 下载服务器推送 -->
    <Card>
      <CardHeader>
        <CardTitle>{{ t("SetBase.download.pushDownloadServerTitle") }}</CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-2.5">
          <label class="flex cursor-pointer items-center justify-between gap-4">
            <span class="text-sm font-medium text-foreground">{{ t("SetBase.download.useQuickSendToClient") }}</span>
            <Switch v-model="configStore.download.useQuickSendToClient" />
          </label>
          <Alert variant="info">
            <div v-html="t('SetBase.download.quickSendToClientNote')" />
          </Alert>
        </div>

        <Separator />

        <label class="flex cursor-pointer items-center justify-between gap-4">
          <span class="text-sm font-medium text-foreground">{{ t("SetBase.download.enableSiteFilter") }}</span>
          <Switch v-model="configStore.download.allowDownloaderFilterForSite" />
        </label>

        <Separator />

        <label class="flex cursor-pointer items-center justify-between gap-4">
          <span class="text-sm font-medium text-foreground">{{ t("SetBase.download.saveLastDownloader") }}</span>
          <Switch
            v-model="configStore.download.saveLastDownloader"
            @update:model-value="(v) => clearLastDownloader(v)"
          />
        </label>

        <Separator />

        <label class="flex cursor-pointer items-center justify-between gap-4">
          <span class="text-sm font-medium text-foreground">{{ t("SetBase.download.allowDirectSendToClient") }}</span>
          <Switch v-model="configStore.download.allowDirectSendToClient" />
        </label>
      </CardContent>
    </Card>
  </div>
</template>
