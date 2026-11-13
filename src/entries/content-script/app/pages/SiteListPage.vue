<script setup lang="ts">
import { computed, inject, ref, shallowRef } from "vue";
import { useI18n } from "vue-i18n";
import { type ITorrent } from "@ptd/site";
import { CloudDownload, Copy, Download, ListChecks, Save, Search } from "lucide-vue-next";

import { sendMessage } from "@/messages.ts";
import { useRuntimeStore } from "@/options/stores/runtime.ts";
import { useMetadataStore } from "@/options/stores/metadata.ts";

import type { IRemoteDownloadDialogData } from "../types.ts";
import { copyTextToClipboard, doKeywordSearch, siteInstance, wrapperConfirmFn, type IPtdData } from "../utils.ts";

import AdvanceListModuleDialog from "../components/AdvanceListModuleDialog.vue";
import SpeedDialBtn from "../components/SpeedDialBtn.vue";

const metadataStore = useMetadataStore();
const runtimeStore = useRuntimeStore();
const { t } = useI18n();

const ptdData = inject<IPtdData>("ptd_data", {});
const enabledDownloadersBySite = computed(() => {
  return metadataStore.getEnabledDownloadersBySite(ptdData.siteId ?? "");
});

async function parseListPage(showNoTorrentError = true) {
  const parsedResult = await siteInstance.value?.transformListPage(document.cloneNode(true) as Document);

  let errorMessage = "";
  if ((parsedResult?.torrents ?? []).length === 0) {
    errorMessage = t("contentScript.noTorrentParsed");
  }

  if (showNoTorrentError && errorMessage) {
    runtimeStore.showSnackbar(errorMessage, { color: "error" });
  }

  runtimeStore.search.searchPlanKey = "all";
  runtimeStore.search.searchKey = parsedResult?.keywords ?? "";

  return parsedResult!;
}

const localDownloadMultiStatus = ref<boolean>(false);
function handleLocalDownloadMulti() {
  localDownloadMultiStatus.value = true;
  parseListPage()
    .then(({ torrents }) => {
      for (const torrent of torrents) {
        sendMessage("downloadTorrent", { torrent, downloaderId: "local" });
      }
    })
    .finally(() => {
      localDownloadMultiStatus.value = false;
    });
}

const linkCopyMultiStatus = ref<boolean>(false);
function handleLinkCopyMulti() {
  linkCopyMultiStatus.value = true;
  parseListPage()
    .then(async ({ torrents }) => {
      const downloadUrls = [] as string[];

      try {
        for (const torrent of torrents) {
          const downloadUrl = await sendMessage("getTorrentDownloadLink", torrent);
          downloadUrls.push(downloadUrl);
        }

        const copied = await copyTextToClipboard(downloadUrls.join("\n").trim());
        runtimeStore.showSnackbar(copied ? t("contentScript.copyLinkSuccess") : t("contentScript.copyLinkFailed"), {
          color: copied ? "success" : "error",
        });
      } catch {
        runtimeStore.showSnackbar(t("contentScript.copyLinkFailed"), { color: "error" });
      }
    })
    .finally(() => {
      linkCopyMultiStatus.value = false;
    });
}

const remoteDownloadDialogData = inject<IRemoteDownloadDialogData>("remoteDownloadDialogData")!;

function handleRemoteDownloadMulti(isDefaultSend = false) {
  parseListPage().then(({ torrents }) => {
    if (torrents.length > 0) {
      remoteDownloadDialogData.torrents = torrents;
      remoteDownloadDialogData.isDefaultSend = isDefaultSend;
      remoteDownloadDialogData.show = true;
    }
  });
}

const parsedTorrents = shallowRef<ITorrent[]>([]);
const showAdvanceListModuleDialog = ref<boolean>(false);

function handleAdvanceListModule() {
  parseListPage().then(({ torrents }) => {
    if (torrents.length > 0) {
      parsedTorrents.value = torrents;
      showAdvanceListModuleDialog.value = true;
    }
  });
}

async function handleSearch() {
  const keywords = (await parseListPage()).keywords;
  doKeywordSearch(keywords);
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
    @click="() => handleRemoteDownloadMulti(true)"
  />
  <SpeedDialBtn
    key="download"
    :disabled="enabledDownloadersBySite.length === 0"
    :icon="CloudDownload"
    :title="t('contentScript.pushTo')"
    @click="() => handleRemoteDownloadMulti()"
  />
  <SpeedDialBtn
    key="advance"
    :icon="ListChecks"
    :title="t('contentScript.advanceList')"
    @click="handleAdvanceListModule"
  />
  <SpeedDialBtn
    key="copy"
    :loading="linkCopyMultiStatus"
    :icon="Copy"
    :title="t('contentScript.copyLink')"
    @click="wrapperConfirmFn(handleLinkCopyMulti)"
  />
  <SpeedDialBtn
    key="save"
    :loading="localDownloadMultiStatus"
    :icon="Save"
    :title="t('downloaderLabel.localDownload')"
    @click="wrapperConfirmFn(handleLocalDownloadMulti)"
  />
  <SpeedDialBtn key="search" :icon="Search" :title="t('contentScript.quickSearch')" @click="handleSearch" />

  <AdvanceListModuleDialog v-model="showAdvanceListModuleDialog" :torrent-items="parsedTorrents" />
</template>
