<script setup lang="ts">
import { ref, computed, shallowRef, toRaw, watch } from "vue";
import { useI18n } from "vue-i18n";
import { cloneDeep, toMerged } from "es-toolkit";
import { ArrowRight, Check, CloudDownload, Folder, Loader2, Send, SlidersHorizontal, Tag, Zap } from "lucide-vue-next";

import { type ITorrent } from "@ptd/site";
import {
  type CAddTorrentOptions,
  getDownloaderIcon as getDownloaderIconRaw,
  getDownloaderMetaData,
} from "@ptd/downloader";

import { cn } from "~/lib/utils";
import {
  Accordion,
  Alert,
  Badge,
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
  Switch,
  Tabs,
  TabsList,
  TabsTrigger,
  TagsInput,
} from "~/components/ui";
import { useRuntimeStore } from "@/options/stores/runtime.ts";
import { useMetadataStore } from "@/options/stores/metadata.ts";
import { useConfigStore } from "@/options/stores/config.ts";
import type { IDownloaderMetadata } from "@/shared/types.ts";

import { sendTorrentToDownloader } from "./utils.ts";

const showDialog = defineModel<boolean>();
const { torrentItems, isDefaultSend } = defineProps<{
  torrentItems: ITorrent[];
  isDefaultSend?: boolean;
}>();
const emit = defineEmits<{
  (e: "cancel"): void;
  (e: "done"): void;
}>();

const { t } = useI18n();
const configStore = useConfigStore();
const runtimeStore = useRuntimeStore();
const metadataStore = useMetadataStore();

const isSending = ref(false);
const quickSendToClient = ref<boolean>(false);
const selectedDownloader = ref<IDownloaderMetadata | null>(null);
const selectedDownloaderMetadata = shallowRef<any>(null);
const addTorrentOptions = ref<Required<Omit<CAddTorrentOptions, "localDownloadOption">>>({
  localDownload: true,
  addAtPaused: false,
  savePath: "",
  label: "",
  uploadSpeedLimit: 0,
  advanceAddTorrentOptions: {},
});

const modeTab = computed<"quick" | "custom">({
  get: () => (quickSendToClient.value ? "quick" : "custom"),
  set: (val) => {
    quickSendToClient.value = val === "quick";
  },
});

const selectedDownloaderId = computed<string>({
  get: () => selectedDownloader.value?.id ?? "",
  set: (id: string) => {
    const found = sortedEnabledDownloadersBySite.value.find((d) => d.id === id) ?? null;
    selectedDownloader.value = found;
    restoreAddTorrentOptions(found ?? undefined);
  },
});

const labelTags = computed<string[]>({
  get: () =>
    addTorrentOptions.value.label
      ? addTorrentOptions.value.label
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
  set: (tags: string[]) => {
    addTorrentOptions.value.label = tags.join(",");
  },
});

const suggestFolders = computed(() => selectedDownloader.value?.suggestFolders ?? []);
const suggestTags = computed(() => selectedDownloader.value?.suggestTags ?? []);

const currentSiteIds = computed(() => [...new Set(torrentItems.map((t) => t.site).filter(Boolean))]);
const enabledDownloadersBySite = computed(() => {
  const ids = currentSiteIds.value;
  if (ids.length === 0) return metadataStore.getEnabledDownloaders;
  const sets = ids.map((id) => new Set(metadataStore.getEnabledDownloadersBySite(id).map((d) => d.id)));
  const intersection = sets.reduce((acc, s) => new Set([...acc].filter((x) => s.has(x))));
  return metadataStore.getEnabledDownloaders.filter((d) => intersection.has(d.id));
});
const sortedEnabledDownloadersBySite = computed(() =>
  [...enabledDownloadersBySite.value].sort((a, b) => (b.sortIndex ?? 0) - (a.sortIndex ?? 0)),
);

const getDownloaderIcon = (x: string) => chrome.runtime.getURL(getDownloaderIconRaw(x));

const noDownloaderMessage = computed(() =>
  currentSiteIds.value.length > 0 && configStore.download.allowDownloaderFilterForSite
    ? t("SentToDownloaderDialog.noDownloaderForSite")
    : t("SentToDownloaderDialog.noDownloader"),
);

const advancedAccordionItems = computed(() => [
  {
    value: "advanced",
    title: t("common.advancedSettings"),
    badge: selectedDownloaderMetadata.value?.advanceAddTorrentOptions?.length ?? 0,
  },
]);

function restoreAddTorrentOptions(downloader?: IDownloaderMetadata) {
  addTorrentOptions.value.localDownload = true;
  addTorrentOptions.value.addAtPaused = !(downloader?.feature?.DefaultAutoStart ?? true);
  addTorrentOptions.value.savePath = "";
  addTorrentOptions.value.label = "";
  addTorrentOptions.value.advanceAddTorrentOptions = downloader?.advanceAddTorrentOptions ?? {};
}

watch(selectedDownloader, (value) => {
  if (value?.type) {
    getDownloaderMetaData(value.type).then((v) => (selectedDownloaderMetadata.value = v));
  } else {
    selectedDownloaderMetadata.value = null;
  }
});

async function sendToDownloader() {
  if (!selectedDownloader.value?.id) {
    runtimeStore.showSnackbar(t("SentToDownloaderDialog.selectDownloaderFirst"), { color: "error" });
    return;
  }

  const plainOptions = JSON.parse(JSON.stringify(toRaw(addTorrentOptions.value)));
  const plainTorrents = torrentItems.map((item) => JSON.parse(JSON.stringify(toRaw(item))) as ITorrent);

  // 保存此次选择记录（默认推送不保存）
  if (!isDefaultSend && configStore.download.saveLastDownloader) {
    // noinspection ES6MissingAwait
    metadataStore.setLastDownloader({
      id: selectedDownloader.value.id,
      options: plainOptions,
    });
  }

  isSending.value = true;

  sendTorrentToDownloader(plainTorrents, selectedDownloader.value.id, plainOptions).finally(() => {
    isSending.value = false;
    showDialog.value = false;
    emit("done");
  });
}

function quickSendToDownloader(downloader: IDownloaderMetadata, path: string = "", label?: string) {
  selectedDownloader.value = downloader;

  // 设置下载推送选项
  addTorrentOptions.value.localDownload = true;
  addTorrentOptions.value.addAtPaused = !(downloader.feature?.DefaultAutoStart ?? true);
  addTorrentOptions.value.advanceAddTorrentOptions = downloader.advanceAddTorrentOptions ?? {};
  addTorrentOptions.value.savePath = path || "";
  addTorrentOptions.value.label = label || "";

  return sendToDownloader();
}

function dialogEnter() {
  // 如果是默认下载发送，则直接设置为快速发送到客户端模式
  if (isDefaultSend) {
    const downloader = metadataStore.downloaders[metadataStore.defaultDownloader.id!];
    restoreAddTorrentOptions(downloader);
    quickSendToClient.value = true;

    // 加载默认下载器设置中的 folder, tags 信息
    selectedDownloader.value = downloader;
    addTorrentOptions.value.savePath = metadataStore.defaultDownloader.folder ?? "";
    addTorrentOptions.value.label = metadataStore.defaultDownloader.tags ?? "";

    // 直接调用发送函数
    sendToDownloader();
  } else {
    restoreAddTorrentOptions(); // 先重置所有选项，然后如果需要则从store中获取历史情况
    quickSendToClient.value = configStore.download.useQuickSendToClient;

    // 如果不是快速发送到客户端模式，则尝试设置默认下载器
    if (!quickSendToClient.value) {
      const lastDownloaderId = metadataStore.lastDownloader?.id;
      const matchedLast = lastDownloaderId
        ? (sortedEnabledDownloadersBySite.value.find((d) => d.id === lastDownloaderId) ?? null)
        : null;
      selectedDownloader.value = matchedLast ?? sortedEnabledDownloadersBySite.value[0] ?? null;

      if (selectedDownloader.value) {
        restoreAddTorrentOptions(selectedDownloader.value);
      }

      // 将上一次的下载器选项通过 toMerged 合并到当前选项中
      if (matchedLast && metadataStore.lastDownloader?.options) {
        addTorrentOptions.value = cloneDeep(
          toMerged(toRaw(addTorrentOptions.value), toRaw(metadataStore.lastDownloader.options)),
        ) as Required<Omit<CAddTorrentOptions, "localDownloadOption">>;
      }
    }
  }
}

function dialogLeave() {
  restoreAddTorrentOptions();
  emit("cancel");
}
</script>

<template>
  <Dialog v-model="showDialog" @after-open="dialogEnter" @after-close="dialogLeave">
    <DialogContent class="max-w-2xl" :prevent-outside-close="isSending" :hide-close="isSending">
      <DialogHeader class="flex-row items-center justify-between gap-3">
        <div class="flex min-w-0 items-center gap-2.5">
          <div class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CloudDownload class="size-4" />
          </div>
          <DialogTitle class="truncate text-sm font-semibold">
            {{ t("SentToDownloaderDialog.title", [torrentItems.length]) }}
          </DialogTitle>
        </div>

        <Tabs v-if="!isSending" v-model="modeTab" class="shrink-0">
          <TabsList class="h-8">
            <TabsTrigger value="quick" class="h-6 px-2.5 text-xs">
              <Zap class="size-3" />
              <span>快捷直推</span>
            </TabsTrigger>
            <TabsTrigger value="custom" class="h-6 px-2.5 text-xs">
              <SlidersHorizontal class="size-3" />
              <span>自定义参数</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </DialogHeader>

      <div class="flex-1 overflow-y-auto px-5 py-4">
        <!-- 发送中遮罩进度状态 -->
        <div
          v-if="isSending"
          class="flex flex-col items-center justify-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-6 py-10 text-center"
        >
          <div class="flex size-11 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Loader2 class="size-5 animate-spin" />
          </div>
          <div class="text-sm font-medium text-foreground">
            {{
              t("SentToDownloaderDialog.isSending", {
                name: selectedDownloader?.name,
                address: selectedDownloader?.address,
              })
            }}
          </div>
        </div>

        <!-- 快捷直推模式 -->
        <template v-else-if="quickSendToClient">
          <div v-if="sortedEnabledDownloadersBySite.length > 0" class="flex flex-col gap-2">
            <template v-for="downloader in sortedEnabledDownloadersBySite" :key="downloader.id">
              <div
                v-for="path in ['', ...(downloader.suggestFolders ?? [])]"
                :key="`${downloader.id}_${path}`"
                role="button"
                tabindex="0"
                class="group flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-2.5 transition-all hover:border-primary/40 hover:bg-accent/50"
                @click="() => quickSendToDownloader(downloader, path)"
                @keydown.enter.prevent="() => quickSendToDownloader(downloader, path)"
              >
                <div
                  class="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 p-1.5"
                >
                  <img
                    :src="getDownloaderIcon(downloader.type)"
                    :alt="downloader.type"
                    class="size-full object-contain"
                  />
                </div>

                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="truncate text-sm font-medium text-foreground">{{ downloader.name }}</span>
                    <Badge variant="outline" class="shrink-0 font-normal text-muted-foreground">
                      {{ downloader.type }}
                    </Badge>
                    <span class="hidden truncate text-xs text-muted-foreground sm:inline tabular-nums">
                      {{ downloader.address }}
                    </span>
                  </div>

                  <div class="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span class="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px]">
                      <Folder class="size-3 text-muted-foreground" />
                      <span class="max-w-[260px] truncate">{{ path || "默认目录" }}</span>
                    </span>

                    <template v-if="downloader.suggestTags?.length">
                      <button
                        v-for="tag in downloader.suggestTags"
                        :key="tag"
                        type="button"
                        class="inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary"
                        @click.stop="() => quickSendToDownloader(downloader, path, tag)"
                      >
                        <Tag class="size-2.5 opacity-60" />
                        <span>{{ tag }}</span>
                      </button>
                    </template>
                  </div>
                </div>

                <ArrowRight
                  class="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                />
              </div>
            </template>
          </div>

          <Alert v-else variant="warning">
            {{ noDownloaderMessage }}
          </Alert>
        </template>

        <!-- 自定义参数模式 -->
        <template v-else>
          <Alert v-if="sortedEnabledDownloadersBySite.length === 0" variant="warning" class="mb-4">
            {{ noDownloaderMessage }}
          </Alert>

          <div class="flex flex-col gap-4">
            <!-- 下载器选择 -->
            <div class="flex flex-col gap-1.5">
              <Label>{{ t("SentToDownloaderDialog.selectDownloader") }}</Label>
              <Select v-model="selectedDownloaderId">
                <SelectTrigger>
                  <SelectValue :placeholder="t('SentToDownloaderDialog.selectDownloader')">
                    <span v-if="selectedDownloader" class="flex items-center gap-2">
                      <img
                        :src="getDownloaderIcon(selectedDownloader.type)"
                        :alt="selectedDownloader.type"
                        class="size-4 shrink-0 object-contain"
                      />
                      <span class="truncate font-medium">{{ selectedDownloader.name }}</span>
                      <span class="truncate text-xs text-muted-foreground">[{{ selectedDownloader.address }}]</span>
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="downloader in sortedEnabledDownloadersBySite"
                    :key="downloader.id"
                    :value="downloader.id"
                  >
                    <div class="flex items-center gap-2">
                      <img
                        :src="getDownloaderIcon(downloader.type)"
                        :alt="downloader.type"
                        class="size-4 shrink-0 object-contain"
                      />
                      <span class="font-medium">{{ downloader.name }}</span>
                      <span class="text-xs text-muted-foreground">[{{ downloader.address }}]</span>
                      <Badge variant="secondary" class="ml-1 text-[10px]">{{ downloader.type }}</Badge>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <!-- 保存路径与分类标签 -->
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="flex flex-col gap-1.5">
                <Label>{{ t("SentToDownloaderDialog.savePath") }}</Label>
                <Input v-model="addTorrentOptions.savePath" :placeholder="t('SentToDownloaderDialog.savePathHint')" />
                <div v-if="suggestFolders.length > 0" class="flex flex-wrap gap-1 pt-0.5">
                  <button
                    v-for="folder in suggestFolders"
                    :key="folder"
                    type="button"
                    :class="
                      cn(
                        'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] transition-colors',
                        addTorrentOptions.savePath === folder
                          ? 'border-primary bg-primary/10 text-primary font-medium'
                          : 'border-border bg-muted/40 text-muted-foreground hover:text-foreground',
                      )
                    "
                    @click="addTorrentOptions.savePath = folder"
                  >
                    <Check v-if="addTorrentOptions.savePath === folder" class="size-2.5" />
                    <Folder v-else class="size-2.5" />
                    <span class="max-w-[180px] truncate">{{ folder }}</span>
                  </button>
                </div>
              </div>

              <div class="flex flex-col gap-1.5">
                <Label>{{ t("SentToDownloaderDialog.label") }}</Label>
                <TagsInput
                  v-model="labelTags"
                  :suggestions="suggestTags"
                  :placeholder="t('SentToDownloaderDialog.labelHint')"
                />
              </div>
            </div>

            <!-- 开关选项行 -->
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div
                class="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/25 px-3.5 py-2.5"
              >
                <div class="min-w-0">
                  <div class="text-sm font-medium text-foreground">{{ t("SentToDownloaderDialog.localRelay") }}</div>
                  <div class="text-[11px] text-muted-foreground">本地下载种子文件后推送至客户端</div>
                </div>
                <Switch
                  v-model="addTorrentOptions.localDownload"
                  :disabled="!configStore.download.allowDirectSendToClient"
                />
              </div>

              <div
                class="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/25 px-3.5 py-2.5"
              >
                <div class="min-w-0">
                  <div class="text-sm font-medium text-foreground">{{ t("SentToDownloaderDialog.pauseOnAdd") }}</div>
                  <div class="text-[11px] text-muted-foreground">添加到客户端后保持暂停状态</div>
                </div>
                <Switch v-model="addTorrentOptions.addAtPaused" />
              </div>
            </div>

            <!-- 高级选项 -->
            <Accordion
              v-if="(selectedDownloaderMetadata?.advanceAddTorrentOptions ?? []).length > 0"
              :items="advancedAccordionItems"
              type="single"
            >
              <template #advanced>
                <div class="flex flex-col gap-2.5 pt-1">
                  <div
                    v-for="opt in selectedDownloaderMetadata.advanceAddTorrentOptions"
                    :key="opt.key"
                    class="flex items-center justify-between gap-3 rounded-md border border-border/70 bg-muted/20 px-3 py-2"
                  >
                    <div class="min-w-0">
                      <div class="text-xs font-medium text-foreground">{{ opt.name }}</div>
                      <div v-if="opt.description" class="text-[11px] text-muted-foreground">{{ opt.description }}</div>
                    </div>
                    <Switch v-model="addTorrentOptions.advanceAddTorrentOptions![opt.key]" />
                  </div>
                </div>
              </template>
            </Accordion>
          </div>
        </template>
      </div>

      <DialogFooter>
        <Button variant="outline" size="sm" :disabled="isSending" @click="showDialog = false">
          {{ quickSendToClient ? t("common.dialog.close") : t("common.dialog.cancel") }}
        </Button>
        <Button
          v-if="!quickSendToClient"
          variant="default"
          size="sm"
          :disabled="!selectedDownloader || isSending"
          @click="sendToDownloader"
        >
          <Loader2 v-if="isSending" class="size-3.5 animate-spin" />
          <Send v-else class="size-3.5" />
          <span>{{ t("common.dialog.ok") }}</span>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
