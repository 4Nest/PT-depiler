<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { CloudDownload, Copy, Download, Loader2, Save } from "lucide-vue-next";
import type { ITorrent } from "@ptd/site";

import { cn } from "~/lib/utils";
import { Button, Tooltip } from "~/components/ui";
import { sendMessage } from "@/messages.ts";
import { useRuntimeStore } from "@/options/stores/runtime.ts";
import { useMetadataStore } from "@/options/stores/metadata.ts";

import SentToDownloaderDialog from "@/options/components/SentToDownloaderDialog/Index.vue";

const { torrentItems, density = "default" } = defineProps<{
  torrentItems: ITorrent[];
  density?: "compact" | "default";
}>();

const { t } = useI18n();
const metadataStore = useMetadataStore();
const runtimeStore = useRuntimeStore();

async function getTorrentDownloadLinks() {
  const downloadUrls = [];

  for (const torrent of torrentItems) {
    const downloadUrl = await sendMessage("getTorrentDownloadLink", torrent);
    sendMessage("logger", { msg: `torrent ${torrent} download link: ${downloadUrl}` }).catch();
    downloadUrls.push({ torrent, downloadUrl });
  }

  return downloadUrls;
}

const copyTorrentDownloadLinkBtnStatus = ref(false);
async function copyTorrentDownloadLink() {
  copyTorrentDownloadLinkBtnStatus.value = true;
  const downloadUrls = await getTorrentDownloadLinks();
  try {
    await navigator.clipboard.writeText(
      downloadUrls
        .map((x) => x.downloadUrl)
        .join("\n")
        .trim(),
    );
    runtimeStore.showSnackbar(t("SearchEntity.ActionTd.copyLinkSuccess"), { color: "success" });
  } catch (e) {
    runtimeStore.showSnackbar(t("SearchEntity.ActionTd.copyLinkFailed"), { color: "error" });
  }

  copyTorrentDownloadLinkBtnStatus.value = false;
}

const localDlTorrentDownloadLinkBtnStatus = ref(false);
async function localDlTorrentDownloadLink() {
  localDlTorrentDownloadLinkBtnStatus.value = true;
  await Promise.allSettled(
    torrentItems.map((torrent) => sendMessage("downloadTorrent", { torrent, downloaderId: "local" })),
  );
  localDlTorrentDownloadLinkBtnStatus.value = false;
}

const showDownloadClientDialog = ref(false);
const isDefaultSend = ref(false);

function sendToDownloader(defaultDownload = false) {
  isDefaultSend.value = defaultDownload;
  showDownloadClientDialog.value = true;
}
</script>

<template>
  <div
    :class="
      cn(
        density === 'compact'
          ? 'inline-flex items-center gap-0.5'
          : 'inline-flex items-center divide-x divide-border overflow-hidden rounded-md border border-border bg-background shadow-2xs',
      )
    "
  >
    <!-- 推送到默认下载器 -->
    <Tooltip v-if="metadataStore.defaultDownloader?.id" :content="t('SearchEntity.ActionTd.sendToDefault')">
      <Button
        :variant="density === 'compact' ? 'ghost' : 'ghost'"
        :size="density === 'compact' ? 'icon-xs' : 'sm'"
        :disabled="torrentItems.length === 0"
        :class="
          cn(
            density === 'compact'
              ? 'text-primary hover:bg-primary/10 hover:text-primary'
              : 'h-8 rounded-none px-2.5 text-primary hover:bg-primary/10 hover:text-primary',
          )
        "
        @click="() => sendToDownloader(true)"
      >
        <Download class="size-3.5" />
      </Button>
    </Tooltip>

    <!-- 选择下载器推送 -->
    <Tooltip :content="t('SearchEntity.ActionTd.sendToDownloader')">
      <Button
        variant="ghost"
        :size="density === 'compact' ? 'icon-xs' : 'sm'"
        :disabled="torrentItems.length === 0"
        :class="
          cn(
            density === 'compact'
              ? 'text-muted-foreground hover:text-foreground'
              : 'h-8 rounded-none px-2.5 text-muted-foreground hover:text-foreground',
          )
        "
        @click="() => sendToDownloader(false)"
      >
        <CloudDownload class="size-3.5" />
      </Button>
    </Tooltip>

    <!-- 复制下载链接 -->
    <Tooltip :content="t('SearchEntity.ActionTd.copyLink')">
      <Button
        variant="ghost"
        :size="density === 'compact' ? 'icon-xs' : 'sm'"
        :disabled="torrentItems.length === 0 || copyTorrentDownloadLinkBtnStatus"
        :class="
          cn(
            density === 'compact'
              ? 'text-muted-foreground hover:text-foreground'
              : 'h-8 rounded-none px-2.5 text-muted-foreground hover:text-foreground',
          )
        "
        @click="() => copyTorrentDownloadLink()"
      >
        <Loader2 v-if="copyTorrentDownloadLinkBtnStatus" class="size-3.5 animate-spin" />
        <Copy v-else class="size-3.5" />
      </Button>
    </Tooltip>

    <!-- 下载种子文件到本地 -->
    <Tooltip :content="t('SearchEntity.ActionTd.localDownload')">
      <Button
        variant="ghost"
        :size="density === 'compact' ? 'icon-xs' : 'sm'"
        :disabled="torrentItems.length === 0 || localDlTorrentDownloadLinkBtnStatus"
        :class="
          cn(
            density === 'compact'
              ? 'text-muted-foreground hover:text-foreground'
              : 'h-8 rounded-none px-2.5 text-muted-foreground hover:text-foreground',
          )
        "
        @click="() => localDlTorrentDownloadLink()"
      >
        <Loader2 v-if="localDlTorrentDownloadLinkBtnStatus" class="size-3.5 animate-spin" />
        <Save v-else class="size-3.5" />
      </Button>
    </Tooltip>

    <slot name="append" />
  </div>

  <!-- 在点击发送到远程服务器时，弹出选择下载器及其他自定义选项 -->
  <SentToDownloaderDialog
    v-model="showDownloadClientDialog"
    :torrent-items="torrentItems"
    :is-default-send="isDefaultSend"
  />
</template>
