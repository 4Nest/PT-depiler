<script setup lang="ts">
import { ref, computed, inject } from "vue";
import { useI18n } from "vue-i18n";
import { ETorrentStatus, type ITorrent } from "@ptd/site";
import {
  ArrowUpCircle,
  CloudDownload,
  Copy,
  Download,
  DownloadCloud,
  ListChecks,
  Loader2,
  Save,
} from "lucide-vue-next";

import { formatDate, formatSize } from "@/options/utils.ts";
import { sendMessage } from "@/messages.ts";
import { useRuntimeStore } from "@/options/stores/runtime.ts";
import { useMetadataStore } from "@/options/stores/metadata.ts";
import {
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  type DataTableColumn,
} from "~/components/ui";

import type { IRemoteDownloadDialogData } from "../types.ts";
import TorrentTitleTd from "@/options/components/TorrentTitleTd.vue";

const { t } = useI18n();
const showDialog = defineModel<boolean>({ default: false });

const { torrentItems } = defineProps<{
  torrentItems: ITorrent[];
}>();

const runtimeStore = useRuntimeStore();
const metadataStore = useMetadataStore();

const tableColumns = computed<DataTableColumn<ITorrent>[]>(() => [
  { title: t("SearchEntity.index.table.category"), key: "category", align: "center", width: 80 },
  { title: t("SearchEntity.index.table.title"), key: "title", align: "start", minWidth: 320 },
  { title: t("SearchEntity.index.table.size"), key: "size", align: "end", width: 96 },
  { title: t("SearchEntity.index.table.seeders"), key: "seeders", align: "end", width: 72 },
  { title: t("SearchEntity.index.table.leechers"), key: "leechers", align: "end", width: 72 },
  { title: t("SearchEntity.index.table.completed"), key: "completed", align: "end", width: 72 },
  { title: t("SearchEntity.index.table.time"), key: "time", align: "center", width: 150 },
]);

const selectedTorrentIds = ref<ITorrent["id"][]>([]);
const selectedTorrents = computed(() => torrentItems.filter((x) => selectedTorrentIds.value.includes(x.id)));
const hasSelectedTorrent = computed(() => selectedTorrentIds.value.length > 0);
const selectedTorrentsCount = computed(() => selectedTorrentIds.value.length);
const selectedTorrentsSize = computed(() =>
  selectedTorrents.value.reduce((acc, torrent) => acc + (torrent.size ?? 0), 0),
);

const localDownloadMultiStatus = ref<boolean>(false);
async function handleLocalDownloadMulti() {
  localDownloadMultiStatus.value = true;
  try {
    for (const torrent of selectedTorrents.value) {
      await sendMessage("downloadTorrent", { torrent, downloaderId: "local" });
    }
  } finally {
    localDownloadMultiStatus.value = false;
  }
}

const linkCopyMultiStatus = ref<boolean>(false);
async function handleLinkCopyMulti() {
  linkCopyMultiStatus.value = true;
  const downloadUrls = [] as string[];

  try {
    for (const torrent of selectedTorrents.value) {
      const downloadUrl = await sendMessage("getTorrentDownloadLink", torrent);
      downloadUrls.push(downloadUrl);
    }

    await navigator.clipboard.writeText(downloadUrls.join("\n").trim());
    runtimeStore.showSnackbar(t("contentScript.copyLinkSuccess"), { color: "success" });
  } catch {
    runtimeStore.showSnackbar(t("contentScript.copyLinkFailed"), { color: "error" });
  } finally {
    linkCopyMultiStatus.value = false;
  }
}

const remoteDownloadDialogData = inject<IRemoteDownloadDialogData>("remoteDownloadDialogData")!;

function handleRemoteDownloadMulti(isDefaultSend = false) {
  remoteDownloadDialogData.torrents = selectedTorrents.value;
  remoteDownloadDialogData.isDefaultSend = isDefaultSend;
  remoteDownloadDialogData.show = true;
}

function handleSelectSeeders() {
  selectedTorrentIds.value = torrentItems.filter((item) => item.seeders).map((x) => x.id);
}

function handleSelectNotSeeding() {
  selectedTorrentIds.value = torrentItems
    .filter(
      (item) =>
        item.status !== undefined && ![ETorrentStatus.seeding, ETorrentStatus.downloading].includes(item.status!),
    )
    .map((x) => x.id);
}

function enterDialog() {
  selectedTorrentIds.value = torrentItems.map((x) => x.id);
}
</script>

<template>
  <Dialog v-model="showDialog" @after-open="enterDialog">
    <DialogContent class="h-[86vh] max-w-6xl">
      <DialogHeader>
        <DialogTitle>
          <ListChecks class="size-4 text-primary" />
          <span>{{ t("contentScript.AdvanceListModuleDialog.title", [torrentItems.length]) }}</span>
        </DialogTitle>
        <DialogDescription v-if="hasSelectedTorrent" class="tabular-nums">
          {{
            t("contentScript.AdvanceListModuleDialog.selectedInfo", [
              selectedTorrentsCount,
              formatSize(selectedTorrentsSize),
            ])
          }}
        </DialogDescription>
      </DialogHeader>

      <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-2.5">
          <div class="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" @click="handleSelectSeeders">
              <ArrowUpCircle class="size-3.5" />
              {{ t("contentScript.AdvanceListModuleDialog.selectSeeders") }}
            </Button>
            <Button variant="secondary" size="sm" @click="handleSelectNotSeeding">
              <DownloadCloud class="size-3.5" />
              {{ t("contentScript.AdvanceListModuleDialog.selectNotSeeding") }}
            </Button>
          </div>
          <span v-show="hasSelectedTorrent" class="text-xs font-medium text-muted-foreground tabular-nums">
            {{
              t("contentScript.AdvanceListModuleDialog.selectedInfo", [
                selectedTorrentsCount,
                formatSize(selectedTorrentsSize),
              ])
            }}
          </span>
        </div>

        <div class="flex-1 overflow-y-auto">
          <DataTable
            v-model:selected="selectedTorrentIds"
            :columns="tableColumns"
            :items="torrentItems"
            :items-per-page="-1"
            hide-pagination
            row-key="id"
            selectable
          >
            <template #cell-title="{ item }">
              <TorrentTitleTd :item="item" />
            </template>

            <template #cell-size="{ item }">
              <span class="whitespace-nowrap text-xs font-medium text-foreground tabular-nums">
                {{ formatSize(item.size ?? 0) }}
              </span>
            </template>

            <template #cell-seeders="{ item }">
              <span
                class="text-xs font-medium tabular-nums"
                :class="(item.seeders ?? 0) > 0 ? 'text-success' : 'text-muted-foreground'"
              >
                {{ item.seeders ?? 0 }}
              </span>
            </template>

            <template #cell-leechers="{ item }">
              <span class="text-xs text-muted-foreground tabular-nums">{{ item.leechers ?? 0 }}</span>
            </template>

            <template #cell-completed="{ item }">
              <span class="text-xs text-muted-foreground tabular-nums">{{ item.completed ?? 0 }}</span>
            </template>

            <template #cell-time="{ item }">
              <span class="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                {{ item.time ? formatDate(item.time) : "-" }}
              </span>
            </template>
          </DataTable>
        </div>
      </div>

      <DialogFooter class="flex-wrap sm:justify-between">
        <span v-show="hasSelectedTorrent" class="text-xs text-muted-foreground tabular-nums">
          {{
            t("contentScript.AdvanceListModuleDialog.selectedInfo", [
              selectedTorrentsCount,
              formatSize(selectedTorrentsSize),
            ])
          }}
        </span>

        <div class="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            :disabled="!hasSelectedTorrent || localDownloadMultiStatus"
            @click="handleLocalDownloadMulti"
          >
            <Loader2 v-if="localDownloadMultiStatus" class="size-3.5 animate-spin" />
            <Save v-else class="size-3.5" />
            {{ t("downloaderLabel.localDownload") }}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            :disabled="!hasSelectedTorrent || linkCopyMultiStatus"
            @click="handleLinkCopyMulti"
          >
            <Loader2 v-if="linkCopyMultiStatus" class="size-3.5 animate-spin" />
            <Copy v-else class="size-3.5" />
            {{ t("contentScript.copyLink") }}
          </Button>

          <Button variant="outline" size="sm" :disabled="!hasSelectedTorrent" @click="handleRemoteDownloadMulti()">
            <CloudDownload class="size-3.5" />
            {{ t("contentScript.pushTo") }}
          </Button>

          <Button
            v-if="metadataStore.defaultDownloader?.id"
            size="sm"
            :disabled="!hasSelectedTorrent"
            @click="handleRemoteDownloadMulti(true)"
          >
            <Download class="size-3.5" />
            {{ t("contentScript.pushToDefault") }}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
