<script setup lang="ts">
import { ref, computed, shallowRef, toRaw, watch } from "vue";
import { useI18n } from "vue-i18n";
import { cloneDeep, toMerged, uniq } from "es-toolkit";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  CloudDownload,
  Folder,
  Loader2,
  Send,
  SlidersHorizontal,
  Tag,
  Zap,
} from "lucide-vue-next";

import { type ITorrent } from "@ptd/site";
import {
  type CAddTorrentOptions,
  getDownloaderIcon as getDownloaderIconRaw,
  getDownloaderMetaData,
} from "@ptd/downloader";

import { cn } from "~/lib/utils";
import {
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

const DEFAULT_VISIBLE_PATHS = 6;

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
const expandedDownloaderFolders = ref<Record<string, boolean>>({});

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
    const toQuick = val === "quick";
    quickSendToClient.value = toQuick;
    if (!toQuick && !selectedDownloader.value) {
      applyDefaultOrLastDownloader();
    }
  },
});

const selectedDownloaderId = computed<string>({
  get: () => selectedDownloader.value?.id ?? "",
  set: (id: string) => {
    const found = sortedEnabledDownloadersBySite.value.find((d) => d.id === id) ?? null;
    selectedDownloader.value = found;
    restoreAddTorrentOptions(found ?? undefined);
    if (found && metadataStore.defaultDownloader?.id === found.id) {
      if (metadataStore.defaultDownloader.folder) {
        addTorrentOptions.value.savePath = metadataStore.defaultDownloader.folder;
      }
      if (metadataStore.defaultDownloader.tags) {
        addTorrentOptions.value.label = metadataStore.defaultDownloader.tags;
      }
    }
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

const suggestFolders = computed(() => uniq((selectedDownloader.value?.suggestFolders ?? []).filter(Boolean)));
const suggestTags = computed(() => uniq((selectedDownloader.value?.suggestTags ?? []).filter(Boolean)));

const currentSiteIds = computed(() => [...new Set(torrentItems.map((item) => item.site).filter(Boolean))]);
const enabledDownloadersBySite = computed(() => {
  const ids = currentSiteIds.value;
  if (ids.length === 0) return metadataStore.getEnabledDownloaders;
  const sets = ids.map((id) => new Set(metadataStore.getEnabledDownloadersBySite(id).map((d) => d.id)));
  const intersection = sets.reduce((acc, s) => new Set([...acc].filter((x) => s.has(x))));
  return metadataStore.getEnabledDownloaders.filter((d) => intersection.has(d.id));
});
const sortedEnabledDownloadersBySite = computed(() => {
  const defaultId = metadataStore.defaultDownloader?.id;
  return [...enabledDownloadersBySite.value].sort((a, b) => {
    const sortDiff = (b.sortIndex ?? 0) - (a.sortIndex ?? 0);
    if (sortDiff !== 0) return sortDiff;
    if (a.id === defaultId) return -1;
    if (b.id === defaultId) return 1;
    return 0;
  });
});

const getDownloaderIcon = (x: string) => chrome.runtime.getURL(getDownloaderIconRaw(x));

const noDownloaderMessage = computed(() =>
  currentSiteIds.value.length > 0 && configStore.download.allowDownloaderFilterForSite
    ? t("SentToDownloaderDialog.noDownloaderForSite")
    : t("SentToDownloaderDialog.noDownloader"),
);

function getCleanFolders(downloader: IDownloaderMetadata): string[] {
  return uniq((downloader.suggestFolders ?? []).map((f) => f.trim()).filter(Boolean));
}

function getCleanTags(downloader: IDownloaderMetadata): string[] {
  return uniq((downloader.suggestTags ?? []).map((tag) => tag.trim()).filter(Boolean));
}

function getAllQuickPaths(downloader: IDownloaderMetadata): string[] {
  return ["", ...getCleanFolders(downloader)];
}

function getVisibleQuickPaths(downloader: IDownloaderMetadata): string[] {
  const all = getAllQuickPaths(downloader);
  if (expandedDownloaderFolders.value[downloader.id] || all.length <= DEFAULT_VISIBLE_PATHS) {
    return all;
  }
  return all.slice(0, DEFAULT_VISIBLE_PATHS);
}

function formatCompactPath(rawPath: string): string {
  if (!rawPath) return t("SentToDownloaderDialog.defaultFolder");
  if (rawPath.length <= 36) return rawPath;
  const sep = rawPath.includes("\\") ? "\\" : "/";
  const parts = rawPath.split(/[\\/]+/).filter(Boolean);
  if (parts.length <= 2) return rawPath;
  const prefix = rawPath.startsWith(sep) ? sep : "";
  const tail = parts.slice(-2).join(sep);
  return `${prefix}${parts[0]}${sep}…${sep}${tail}`;
}

function getQuickSelectedTags(downloader: IDownloaderMetadata): string[] {
  const validSet = new Set(getCleanTags(downloader));
  const saved = configStore.download.quickSendTags?.[downloader.id] ?? [];
  return saved.filter((tag) => validSet.has(tag));
}

function isQuickTagSelected(downloader: IDownloaderMetadata, tag: string): boolean {
  return getQuickSelectedTags(downloader).includes(tag);
}

function toggleQuickTag(downloader: IDownloaderMetadata, tag: string) {
  const current = getQuickSelectedTags(downloader);
  const next = current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag];
  if (!configStore.download.quickSendTags) {
    configStore.download.quickSendTags = {};
  }
  configStore.download.quickSendTags[downloader.id] = next;
  configStore.$save();
}

function isLastUsedTarget(downloader: IDownloaderMetadata, path: string): boolean {
  if (!configStore.download.saveLastDownloader) return false;
  return (
    metadataStore.lastDownloader?.id === downloader.id &&
    (metadataStore.lastDownloader?.options?.savePath ?? "") === path
  );
}

function openCustomForDownloader(downloader: IDownloaderMetadata) {
  selectedDownloader.value = downloader;
  restoreAddTorrentOptions(downloader);
  const activeTags = getQuickSelectedTags(downloader);
  if (activeTags.length > 0) {
    addTorrentOptions.value.label = activeTags.join(",");
  }
  quickSendToClient.value = false;
}

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

function quickSendToDownloader(downloader: IDownloaderMetadata, path: string = "") {
  selectedDownloader.value = downloader;

  const activeTags = getQuickSelectedTags(downloader);

  addTorrentOptions.value.localDownload = true;
  addTorrentOptions.value.addAtPaused = !(downloader.feature?.DefaultAutoStart ?? true);
  addTorrentOptions.value.advanceAddTorrentOptions = downloader.advanceAddTorrentOptions ?? {};
  addTorrentOptions.value.savePath = path || "";
  addTorrentOptions.value.label = activeTags.join(",");

  return sendToDownloader();
}

function applyDefaultOrLastDownloader() {
  const available = sortedEnabledDownloadersBySite.value;
  const lastId = configStore.download.saveLastDownloader ? metadataStore.lastDownloader?.id : undefined;
  const matchedLast = lastId ? (available.find((d) => d.id === lastId) ?? null) : null;

  const defaultId = metadataStore.defaultDownloader?.id;
  const matchedDefault = defaultId ? (available.find((d) => d.id === defaultId) ?? null) : null;

  const target = matchedLast ?? matchedDefault ?? available[0] ?? null;
  selectedDownloader.value = target;

  if (target) {
    restoreAddTorrentOptions(target);
    if (!matchedLast && matchedDefault && target.id === matchedDefault.id) {
      if (metadataStore.defaultDownloader.folder) {
        addTorrentOptions.value.savePath = metadataStore.defaultDownloader.folder;
      }
      if (metadataStore.defaultDownloader.tags) {
        addTorrentOptions.value.label = metadataStore.defaultDownloader.tags;
      }
    }
  }

  if (matchedLast && metadataStore.lastDownloader?.options) {
    addTorrentOptions.value = cloneDeep(
      toMerged(toRaw(addTorrentOptions.value), toRaw(metadataStore.lastDownloader.options)),
    ) as Required<Omit<CAddTorrentOptions, "localDownloadOption">>;
  }
}

function dialogEnter() {
  expandedDownloaderFolders.value = {};
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
    selectedDownloader.value = null;
    restoreAddTorrentOptions(); // 先重置所有选项，然后如果需要则从store中获取历史情况
    quickSendToClient.value = configStore.download.useQuickSendToClient;

    // 如果不是快速发送到客户端模式，则优先设置上次下载器（若开启记忆）或默认下载器
    if (!quickSendToClient.value) {
      applyDefaultOrLastDownloader();
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
      <DialogHeader
        class="flex-col items-stretch gap-2.5 min-[540px]:flex-row min-[540px]:items-center min-[540px]:justify-between"
      >
        <div class="flex min-w-0 items-center gap-2.5">
          <div class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CloudDownload class="size-4" />
          </div>
          <DialogTitle class="truncate text-sm font-semibold">
            {{ t("SentToDownloaderDialog.title", [torrentItems.length]) }}
          </DialogTitle>
        </div>

        <Tabs v-if="!isSending" v-model="modeTab" class="shrink-0 max-[539px]:-mr-7">
          <TabsList class="grid h-8 w-full grid-cols-2 min-[540px]:inline-flex min-[540px]:w-auto">
            <TabsTrigger value="quick" class="h-6 px-2.5 text-xs">
              <Zap class="size-3" />
              <span>{{ t("SentToDownloaderDialog.quickMode") }}</span>
            </TabsTrigger>
            <TabsTrigger value="custom" class="h-6 px-2.5 text-xs">
              <SlidersHorizontal class="size-3" />
              <span>{{ t("SentToDownloaderDialog.customMode") }}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </DialogHeader>

      <div class="flex-1 overflow-y-auto px-3.5 py-3 min-[641px]:px-5 min-[641px]:py-4">
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

        <!-- 快捷直推模式（按下载器聚合卡片，告别路径×标签重复展开） -->
        <template v-else-if="quickSendToClient">
          <div v-if="sortedEnabledDownloadersBySite.length > 0" class="flex flex-col gap-2.5">
            <div
              v-for="downloader in sortedEnabledDownloadersBySite"
              :key="downloader.id"
              class="overflow-hidden rounded-xl border border-border bg-card shadow-2xs transition-colors"
            >
              <!-- 形态 A：无预设目录 & 无预设标签 -> 单行紧凑整卡一键直推 -->
              <div
                v-if="getCleanFolders(downloader).length === 0 && getCleanTags(downloader).length === 0"
                role="button"
                tabindex="0"
                class="group flex cursor-pointer items-center justify-between gap-3 px-3.5 py-2.5 transition-colors hover:bg-accent/55"
                @click="() => quickSendToDownloader(downloader, '')"
                @keydown.enter.prevent="() => quickSendToDownloader(downloader, '')"
              >
                <div class="flex min-w-0 items-center gap-2.5">
                  <div
                    class="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 p-1"
                  >
                    <img
                      :src="getDownloaderIcon(downloader.type)"
                      :alt="downloader.type"
                      class="size-full object-contain"
                    />
                  </div>
                  <span class="truncate text-sm font-semibold text-foreground">{{ downloader.name }}</span>
                  <Badge
                    v-if="metadataStore.defaultDownloader?.id === downloader.id"
                    variant="default"
                    class="h-4 shrink-0 px-1.5 text-[10px]"
                  >
                    {{ t("SentToDownloaderDialog.defaultBadge") }}
                  </Badge>
                  <Badge variant="outline" class="h-4.5 shrink-0 px-1.5 text-[10px] font-normal text-muted-foreground">
                    {{ downloader.type }}
                  </Badge>
                  <span class="hidden truncate text-xs text-muted-foreground sm:inline tabular-nums">
                    {{ downloader.address }}
                  </span>
                </div>

                <div class="flex shrink-0 items-center gap-1.5">
                  <span
                    class="inline-flex items-center gap-1 rounded-md bg-muted/70 px-2 py-1 text-xs font-medium text-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary"
                  >
                    <Folder class="size-3 opacity-70" />
                    <span>{{ t("SentToDownloaderDialog.defaultFolder") }}</span>
                    <ArrowRight class="size-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                  <button
                    type="button"
                    :title="t('SentToDownloaderDialog.customizeThis')"
                    class="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    @click.stop="openCustomForDownloader(downloader)"
                  >
                    <SlidersHorizontal class="size-3.5" />
                  </button>
                </div>
              </div>

              <!-- 形态 B：配有预设目录或预设标签 -> 聚合顶栏（标签可点选记忆）+ 紧凑双列路径网格 -->
              <template v-else>
                <div class="flex flex-wrap items-center justify-between gap-2 bg-muted/25 px-3.5 py-2">
                  <div class="flex min-w-0 items-center gap-2">
                    <div
                      class="flex size-6.5 shrink-0 items-center justify-center rounded-md border border-border bg-background p-1"
                    >
                      <img
                        :src="getDownloaderIcon(downloader.type)"
                        :alt="downloader.type"
                        class="size-full object-contain"
                      />
                    </div>
                    <span class="truncate text-sm font-semibold text-foreground">{{ downloader.name }}</span>
                    <Badge
                      v-if="metadataStore.defaultDownloader?.id === downloader.id"
                      variant="default"
                      class="h-4 shrink-0 px-1.5 text-[10px]"
                    >
                      {{ t("SentToDownloaderDialog.defaultBadge") }}
                    </Badge>
                    <Badge
                      variant="outline"
                      class="h-4.5 shrink-0 px-1.5 text-[10px] font-normal text-muted-foreground"
                    >
                      {{ downloader.type }}
                    </Badge>
                    <span class="hidden truncate text-xs text-muted-foreground sm:inline tabular-nums">
                      {{ downloader.address }}
                    </span>
                  </div>

                  <div class="flex flex-wrap items-center gap-1.5">
                    <!-- 可多选切换并自动记忆的预设标签胶囊 -->
                    <template v-if="getCleanTags(downloader).length > 0">
                      <button
                        v-for="tag in getCleanTags(downloader)"
                        :key="tag"
                        type="button"
                        :title="`${t('SentToDownloaderDialog.attachTags')}: ${tag}`"
                        :class="
                          cn(
                            'inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[11px] transition-all',
                            isQuickTagSelected(downloader, tag)
                              ? 'border-primary/60 bg-primary/12 font-medium text-primary shadow-2xs'
                              : 'border-border bg-background text-muted-foreground hover:border-primary/35 hover:text-foreground',
                          )
                        "
                        @click.stop="toggleQuickTag(downloader, tag)"
                      >
                        <Check v-if="isQuickTagSelected(downloader, tag)" class="size-2.5 shrink-0" />
                        <Tag v-else class="size-2.5 shrink-0 opacity-65" />
                        <span class="max-w-[140px] truncate">{{ tag }}</span>
                      </button>
                    </template>

                    <!-- 无预设目录但有标签时，直接在顶栏提供一键发送默认目录按钮 -->
                    <button
                      v-if="getCleanFolders(downloader).length === 0"
                      type="button"
                      class="group/def inline-flex h-6 items-center gap-1 rounded-md bg-primary px-2.5 text-[11px] font-medium text-primary-foreground shadow-2xs transition-opacity hover:opacity-90"
                      @click="() => quickSendToDownloader(downloader, '')"
                    >
                      <Folder class="size-3" />
                      <span>{{ t("SentToDownloaderDialog.defaultFolder") }}</span>
                      <ArrowRight class="size-3 transition-transform group-hover/def:translate-x-0.5" />
                    </button>

                    <button
                      type="button"
                      :title="t('SentToDownloaderDialog.customizeThis')"
                      class="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      @click.stop="openCustomForDownloader(downloader)"
                    >
                      <SlidersHorizontal class="size-3.5" />
                    </button>
                  </div>
                </div>

                <!-- 预设路径双列紧凑直推矩阵 -->
                <div v-if="getCleanFolders(downloader).length > 0" class="border-t border-border/60 p-2">
                  <div class="grid grid-cols-1 gap-1.5 min-[540px]:grid-cols-2">
                    <button
                      v-for="path in getVisibleQuickPaths(downloader)"
                      :key="`${downloader.id}_${path || '__default__'}`"
                      type="button"
                      :title="path || t('SentToDownloaderDialog.defaultFolder')"
                      :class="
                        cn(
                          'group/path flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-all hover:border-primary/50 hover:bg-primary/6 active:scale-[0.995] min-[641px]:py-1.5',
                          isLastUsedTarget(downloader, path)
                            ? 'border-primary/40 bg-primary/4'
                            : 'border-border/80 bg-background/60',
                        )
                      "
                      @click="() => quickSendToDownloader(downloader, path)"
                    >
                      <span class="flex min-w-0 items-center gap-1.5">
                        <Folder
                          :class="
                            cn(
                              'size-3.5 shrink-0 transition-colors group-hover/path:text-primary',
                              path ? 'text-primary/75' : 'text-muted-foreground',
                            )
                          "
                        />
                        <span
                          :class="
                            cn(
                              'truncate',
                              path
                                ? 'font-mono text-[11.5px] font-medium text-foreground'
                                : 'text-muted-foreground font-medium',
                            )
                          "
                        >
                          {{ formatCompactPath(path) }}
                        </span>
                      </span>

                      <ArrowRight
                        class="size-3.5 shrink-0 text-muted-foreground/60 transition-all group-hover/path:translate-x-0.5 group-hover/path:text-primary"
                      />
                    </button>
                  </div>

                  <div
                    v-if="getAllQuickPaths(downloader).length > DEFAULT_VISIBLE_PATHS"
                    class="mt-1.5 flex justify-end"
                  >
                    <button
                      type="button"
                      class="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      @click="expandedDownloaderFolders[downloader.id] = !expandedDownloaderFolders[downloader.id]"
                    >
                      <template v-if="expandedDownloaderFolders[downloader.id]">
                        <ChevronUp class="size-3" />
                        <span>{{ t("SentToDownloaderDialog.collapseFolders") }}</span>
                      </template>
                      <template v-else>
                        <ChevronDown class="size-3" />
                        <span>
                          {{
                            t("SentToDownloaderDialog.expandFolders", [
                              getAllQuickPaths(downloader).length - DEFAULT_VISIBLE_PATHS,
                            ])
                          }}
                        </span>
                      </template>
                    </button>
                  </div>
                </div>
              </template>
            </div>
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
                    <span v-if="selectedDownloader" class="flex min-w-0 items-center gap-2">
                      <img
                        :src="getDownloaderIcon(selectedDownloader.type)"
                        :alt="selectedDownloader.type"
                        class="size-4 shrink-0 object-contain"
                      />
                      <span class="truncate font-medium">{{ selectedDownloader.name }}</span>
                      <Badge
                        v-if="metadataStore.defaultDownloader?.id === selectedDownloader.id"
                        variant="default"
                        class="h-4 shrink-0 px-1.5 text-[10px]"
                      >
                        {{ t("SentToDownloaderDialog.defaultBadge") }}
                      </Badge>
                      <span class="hidden truncate text-xs text-muted-foreground min-[460px]:inline">
                        [{{ selectedDownloader.address }}]
                      </span>
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="downloader in sortedEnabledDownloadersBySite"
                    :key="downloader.id"
                    :value="downloader.id"
                  >
                    <div class="flex min-w-0 items-center gap-2">
                      <img
                        :src="getDownloaderIcon(downloader.type)"
                        :alt="downloader.type"
                        class="size-4 shrink-0 object-contain"
                      />
                      <span class="truncate font-medium">{{ downloader.name }}</span>
                      <Badge
                        v-if="metadataStore.defaultDownloader?.id === downloader.id"
                        variant="default"
                        class="h-4 shrink-0 px-1.5 text-[10px]"
                      >
                        {{ t("SentToDownloaderDialog.defaultBadge") }}
                      </Badge>
                      <span class="hidden truncate text-xs text-muted-foreground min-[460px]:inline">
                        [{{ downloader.address }}]
                      </span>
                      <Badge variant="secondary" class="ml-1 shrink-0 text-[10px]">{{ downloader.type }}</Badge>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <!-- 保存路径与分类标签 -->
            <div class="grid grid-cols-1 gap-3.5 min-[641px]:grid-cols-2 min-[641px]:gap-4">
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
            <div class="grid grid-cols-1 gap-2.5 min-[641px]:grid-cols-2 min-[641px]:gap-3">
              <div
                class="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/25 px-3.5 py-2.5"
              >
                <div class="min-w-0">
                  <div class="text-sm font-medium text-foreground">{{ t("SentToDownloaderDialog.localRelay") }}</div>
                  <div class="text-[11px] text-muted-foreground">{{ t("SentToDownloaderDialog.localRelayDesc") }}</div>
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
                  <div class="text-[11px] text-muted-foreground">{{ t("SentToDownloaderDialog.pauseOnAddDesc") }}</div>
                </div>
                <Switch v-model="addTorrentOptions.addAtPaused" />
              </div>
            </div>

            <!-- 高级选项（直接平铺展示，无需折叠展开） -->
            <div
              v-if="(selectedDownloaderMetadata?.advanceAddTorrentOptions ?? []).length > 0"
              class="flex flex-col gap-2"
            >
              <div class="flex items-center gap-2">
                <Label>{{ t("common.advancedSettings") }}</Label>
                <Badge variant="secondary" class="h-4.5 px-1.5 text-[10px] tabular-nums">
                  {{ selectedDownloaderMetadata.advanceAddTorrentOptions.length }}
                </Badge>
              </div>
              <div class="grid grid-cols-1 gap-2.5 min-[641px]:grid-cols-2 min-[641px]:gap-3">
                <div
                  v-for="opt in selectedDownloaderMetadata.advanceAddTorrentOptions"
                  :key="opt.key"
                  class="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/25 px-3.5 py-2.5"
                >
                  <div class="min-w-0">
                    <div class="text-xs font-medium text-foreground">{{ opt.name }}</div>
                    <div v-if="opt.description" class="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                      {{ opt.description }}
                    </div>
                  </div>
                  <Switch v-model="addTorrentOptions.advanceAddTorrentOptions![opt.key]" />
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          size="sm"
          class="max-[640px]:h-9 max-[640px]:flex-1"
          :disabled="isSending"
          @click="showDialog = false"
        >
          {{ quickSendToClient ? t("common.dialog.close") : t("common.dialog.cancel") }}
        </Button>
        <Button
          v-if="!quickSendToClient"
          variant="default"
          size="sm"
          class="max-[640px]:h-9 max-[640px]:flex-1"
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
