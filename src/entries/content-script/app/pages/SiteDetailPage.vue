<script setup lang="ts">
import { computed, inject } from "vue";
import { useI18n } from "vue-i18n";
import { CloudDownload, Copy, Download, Search } from "lucide-vue-next";

import { sendMessage } from "@/messages.ts";
import { useRuntimeStore } from "@/options/stores/runtime.ts";
import { useMetadataStore } from "@/options/stores/metadata.ts";

import type { IRemoteDownloadDialogData } from "../types.ts";
import { copyTextToClipboard, doKeywordSearch, siteInstance, type IPtdData } from "../utils.ts";
import SpeedDialBtn from "../components/SpeedDialBtn.vue";

const metadataStore = useMetadataStore();
const runtimeStore = useRuntimeStore();
const { t } = useI18n();

const ptdData = inject<IPtdData>("ptd_data", {});
const enabledDownloadersBySite = computed(() => {
  return metadataStore.getEnabledDownloadersBySite(ptdData.siteId ?? "");
});

async function parseDetailPage() {
  const parsedResult = await siteInstance.value?.transformDetailPage(document);

  if (typeof parsedResult?.link === "undefined") {
    runtimeStore.showSnackbar(t("contentScript.cannotParseDetailLink"), { color: "error" });
    throw new Error("无法解析当前页面种子链接");
  }

  runtimeStore.search.searchPlanKey = "all";
  runtimeStore.search.searchKey = parsedResult?.title ?? "";

  return parsedResult!;
}

const remoteDownloadDialogData = inject<IRemoteDownloadDialogData>("remoteDownloadDialogData")!;

function handleLinkCopy() {
  parseDetailPage().then(async (torrent) => {
    const downloadUrl = await sendMessage("getTorrentDownloadLink", torrent);
    const copied = await copyTextToClipboard(downloadUrl);
    runtimeStore.showSnackbar(copied ? t("contentScript.copyLinkSuccess") : t("contentScript.copyLinkFailed"), {
      color: copied ? "success" : "error",
    });
  });
}

function handleRemoteDownload(isDefaultSend = false) {
  parseDetailPage().then((torrent) => {
    remoteDownloadDialogData.torrents = [torrent];
    remoteDownloadDialogData.isDefaultSend = isDefaultSend;
    remoteDownloadDialogData.show = true;
  });
}

function handleSearch() {
  parseDetailPage().then((torrent) => {
    doKeywordSearch(torrent.title || "");
  });
}
</script>

<template>
  <SpeedDialBtn
    v-if="metadataStore.defaultDownloader?.id"
    key="download_default"
    :disabled="enabledDownloadersBySite.length === 0"
    emphasis="primary"
    :icon="Download"
    :title="t('contentScript.pushToDefault')"
    @click="handleRemoteDownload(true)"
  />
  <SpeedDialBtn
    key="download"
    :disabled="enabledDownloadersBySite.length === 0"
    :icon="CloudDownload"
    :title="t('contentScript.pushTo')"
    @click="() => handleRemoteDownload()"
  />
  <SpeedDialBtn key="copy" :icon="Copy" :title="t('contentScript.copyLink')" @click="handleLinkCopy" />
  <SpeedDialBtn key="search" :icon="Search" :title="t('contentScript.quickSearch')" @click="handleSearch" />
</template>
