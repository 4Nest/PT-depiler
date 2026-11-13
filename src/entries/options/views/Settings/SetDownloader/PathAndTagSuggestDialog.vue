<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { getDownloader, getDownloaderMetaData, type TorrentClientMetaData } from "@ptd/downloader";
import { PATH_TEMPLATE_VARIABLES } from "@ptd/downloader/utils/pathTemplate.ts";
import { Check, Download, Eraser, FolderCog, Info, Loader2, Tag, X } from "lucide-vue-next";

import { useRuntimeStore } from "@/options/stores/runtime.ts";
import { useMetadataStore } from "@/options/stores/metadata.ts";
import type { IDownloaderMetadata } from "@/shared/types.ts";
import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
} from "~/components/ui";

const showDialog = defineModel<boolean>({ default: false });
const { clientId } = defineProps<{
  clientId: string;
}>();

const { t } = useI18n();
const runtimeStore = useRuntimeStore();
const metadataStore = useMetadataStore();

const clientConfig = ref<IDownloaderMetadata>();
const clientMetadata = ref<TorrentClientMetaData>();
const activeTab = ref<"path" | "tag" | "note">("path");

const PATH_TEMPLATE_DOCS: Record<(typeof PATH_TEMPLATE_VARIABLES)[number], [string, string]> = {
  "torrent.title": ["torrentTitle", "/volume1/$torrent.title$ -> /volume1/TorrentTitle"],
  "torrent.subTitle": ["torrentSubTitle", "/volume1/$torrent.subTitle$ -> /volume1/TorrentSubTitle"],
  "torrent.category": ["torrentCategory", "/volume1/$torrent.category$/music -> /volume1/Movie/music"],
  "torrent.site": ["torrentSite", "/volume1/$torrent.site$/music -> /volume1/opencd/music"],
  "torrent.siteName": ["torrentSiteName", "/volume1/$torrent.siteName$/music -> /volume1/OpenCD/music"],
  "search:keyword": ["searchKeyword", "/volume1/$search:keyword$/music -> /volume1/keyword/music"],
  "search:plan": ["searchPlan", "/volume1/$search:plan$/music -> /volume1/all/music"],
  "date:YYYY": ["dateYear", "/volume1/$date:YYYY$/music -> /volume1/2019/music"],
  "date:MM": ["dateMonth", "/volume1/$date:MM$/music -> /volume1/10/music"],
  "date:DD": ["dateDay", "/volume1/$date:DD$/music -> /volume1/01/music"],
};
const pathReplaceMap: [string, string, string][] = [
  ...PATH_TEMPLATE_VARIABLES.map((variable) => {
    const [key, example] = PATH_TEMPLATE_DOCS[variable];
    return [key, `$${variable}$`, example] as [string, string, string];
  }),
  ["custom", "<...>", "/volume1/<...>/music -> prompt for input 'test' -> /volume1/test/music"],
];

async function initClientData() {
  if (!clientId) return;
  const raw = metadataStore.downloaders[clientId];
  clientConfig.value = {
    ...raw,
    suggestFolders: [...(raw?.suggestFolders ?? [])],
    suggestTags: [...(raw?.suggestTags ?? [])],
  };
  clientMetadata.value = await getDownloaderMetaData(clientConfig.value.type);
  if (clientMetadata.value?.feature?.CustomPath?.allowed === false) {
    activeTab.value = "tag";
  } else {
    activeTab.value = "path";
  }
}

watch(
  () => clientId,
  () => {
    initClientData();
  },
  { immediate: true },
);

const suggestFolderInput = computed({
  get: () => (clientConfig.value?.suggestFolders ?? []).join("\n"),
  set: (value: string) => {
    if (!clientConfig.value) return;
    clientConfig.value.suggestFolders = value
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean);
  },
});

function removeFolder(folder: string) {
  if (!clientConfig.value) return;
  clientConfig.value.suggestFolders = (clientConfig.value.suggestFolders ?? []).filter((f) => f !== folder);
}

const isLoadingClientFolders = ref<boolean>(false);
async function loadClientFolders() {
  if (!clientConfig.value) return;
  isLoadingClientFolders.value = true;
  try {
    const client = await getDownloader(clientConfig.value);
    const clientPaths = await client.getClientPaths();
    const current = new Set(clientConfig.value.suggestFolders ?? []);
    const added: string[] = [];
    for (const path of clientPaths) {
      if (!current.has(path)) {
        current.add(path);
        added.push(path);
      }
    }
    if (added.length > 0) {
      clientConfig.value.suggestFolders = [...(clientConfig.value.suggestFolders ?? []), ...added];
    }
  } catch {
    runtimeStore.showSnackbar(t("SetDownloader.PathAndTag.downloadPath.autoImportFail"), { color: "error" });
  } finally {
    isLoadingClientFolders.value = false;
  }
}

const suggestTagInput = computed({
  get: () => (clientConfig.value?.suggestTags ?? []).join("\n"),
  set: (value: string) => {
    if (!clientConfig.value) return;
    clientConfig.value.suggestTags = value
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean);
  },
});

function removeTag(tag: string) {
  if (!clientConfig.value) return;
  clientConfig.value.suggestTags = (clientConfig.value.suggestTags ?? []).filter((x) => x !== tag);
}

const isLoadingClientLabels = ref<boolean>(false);
async function loadClientLabels() {
  if (!clientConfig.value) return;
  isLoadingClientLabels.value = true;
  try {
    const client = await getDownloader(clientConfig.value);
    const clientLabels = await client.getClientLabels();
    const current = new Set(clientConfig.value.suggestTags ?? []);
    const added: string[] = [];
    for (const label of clientLabels) {
      if (!current.has(label)) {
        current.add(label);
        added.push(label);
      }
    }
    if (added.length > 0) {
      clientConfig.value.suggestTags = [...(clientConfig.value.suggestTags ?? []), ...added];
    }
  } catch {
    runtimeStore.showSnackbar(t("SetDownloader.PathAndTag.tags.autoImportFail"), { color: "error" });
  } finally {
    isLoadingClientLabels.value = false;
  }
}

function appendFolderVariable(token: string) {
  suggestFolderInput.value = suggestFolderInput.value ? `${suggestFolderInput.value}/${token}` : `/${token}`;
}

function appendTagVariable(token: string) {
  suggestTagInput.value = suggestTagInput.value ? `${suggestTagInput.value}${token}` : token;
}

function saveClientConfig() {
  if (!clientConfig.value) return;
  metadataStore.addDownloader(clientConfig.value);
  showDialog.value = false;
}
</script>

<template>
  <Dialog v-model="showDialog" @after-open="initClientData">
    <DialogContent class="max-w-4xl">
      <DialogHeader>
        <DialogTitle>
          <FolderCog class="size-4 text-primary" />
          <span>{{ t("SetDownloader.PathAndTag.title", [clientConfig?.name ?? clientId]) }}</span>
        </DialogTitle>
      </DialogHeader>

      <div class="flex min-h-0 flex-1 flex-col px-5 py-4">
        <Tabs v-model="activeTab" class="flex min-h-0 flex-1 flex-col">
          <TabsList class="w-fit">
            <TabsTrigger
              value="path"
              :disabled="clientMetadata?.feature?.CustomPath?.allowed === false"
              class="gap-1.5"
            >
              <FolderCog class="size-3.5" />
              <span>{{ t("SetDownloader.PathAndTag.downloadPath.title") }}</span>
              <Badge
                :variant="(clientConfig?.suggestFolders?.length ?? 0) > 0 ? 'info' : 'secondary'"
                class="px-1.5 py-0 text-[10px] tabular-nums"
              >
                +{{ clientConfig?.suggestFolders?.length ?? 0 }}
              </Badge>
            </TabsTrigger>

            <TabsTrigger value="tag" class="gap-1.5">
              <Tag class="size-3.5" />
              <span>{{ t("SetDownloader.PathAndTag.tags.title") }}</span>
              <Badge
                :variant="(clientConfig?.suggestTags?.length ?? 0) > 0 ? 'info' : 'secondary'"
                class="px-1.5 py-0 text-[10px] tabular-nums"
              >
                +{{ clientConfig?.suggestTags?.length ?? 0 }}
              </Badge>
            </TabsTrigger>

            <TabsTrigger value="note" class="gap-1.5">
              <Info class="size-3.5" />
              <span>{{ t("SetDownloader.PathAndTag.note.title") }}</span>
            </TabsTrigger>
          </TabsList>

          <!-- 下载路径 Tab -->
          <TabsContent value="path" class="-mx-1 mt-3 flex-1 space-y-3 overflow-y-auto px-1 py-1">
            <Alert v-if="clientMetadata?.feature?.CustomPath.description" variant="info" closable>
              {{ clientMetadata?.feature?.CustomPath.description }}
            </Alert>

            <div class="flex flex-wrap items-center justify-between gap-2">
              <Label class="text-xs font-medium text-muted-foreground">
                {{ t("SetDownloader.PathAndTag.downloadPath.addInputLabel") }}
              </Label>
              <div class="flex items-center gap-1.5">
                <Button variant="outline" size="xs" :disabled="isLoadingClientFolders" @click="loadClientFolders">
                  <Loader2 v-if="isLoadingClientFolders" class="size-3.5 animate-spin" />
                  <Download v-else class="size-3.5" />
                  {{ t("SetDownloader.PathAndTag.downloadPath.autoImport") }}
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  class="text-destructive hover:text-destructive"
                  :disabled="!clientConfig?.suggestFolders?.length"
                  @click="suggestFolderInput = ''"
                >
                  <Eraser class="size-3.5" />
                  {{ t("SetDownloader.PathAndTag.downloadPath.clear") }}
                </Button>
              </div>
            </div>

            <div
              v-if="clientConfig?.suggestFolders?.length"
              class="flex flex-wrap gap-1.5 rounded-lg border border-border bg-muted/25 p-2.5"
            >
              <Badge
                v-for="(folder, idx) in clientConfig.suggestFolders"
                :key="`${folder}-${idx}`"
                variant="secondary"
                class="gap-1 py-0.5 pl-2 pr-1 font-mono text-[11px] font-normal"
              >
                <span>{{ folder }}</span>
                <button
                  type="button"
                  class="rounded-xs p-0.5 text-muted-foreground hover:bg-background hover:text-destructive"
                  @click="removeFolder(folder)"
                >
                  <X class="size-3" />
                </button>
              </Badge>
            </div>

            <Textarea
              v-model="suggestFolderInput"
              :rows="5"
              :placeholder="t('SetDownloader.PathAndTag.downloadPath.addInputLabel')"
              class="font-mono text-xs"
            />

            <div class="space-y-1.5">
              <div class="text-[11px] font-medium text-muted-foreground">
                {{ t("SetDownloader.PathAndTag.note.index") }}
              </div>
              <div class="flex flex-wrap gap-1.5">
                <Tooltip v-for="pathReplace in pathReplaceMap" :key="pathReplace[1]" :content="pathReplace[2]">
                  <button
                    type="button"
                    class="rounded-md border border-border bg-muted/40 px-2 py-0.5 font-mono text-[11px] text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                    @click="appendFolderVariable(pathReplace[1])"
                  >
                    {{ pathReplace[1] }}
                  </button>
                </Tooltip>
              </div>
            </div>
          </TabsContent>

          <!-- 标签 Tab -->
          <TabsContent value="tag" class="-mx-1 mt-3 flex-1 space-y-3 overflow-y-auto px-1 py-1">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <Label class="text-xs font-medium text-muted-foreground">
                {{ t("SetDownloader.PathAndTag.tags.addInputLabel") }}
              </Label>
              <div class="flex items-center gap-1.5">
                <Button variant="outline" size="xs" :disabled="isLoadingClientLabels" @click="loadClientLabels">
                  <Loader2 v-if="isLoadingClientLabels" class="size-3.5 animate-spin" />
                  <Download v-else class="size-3.5" />
                  {{ t("SetDownloader.PathAndTag.tags.autoImport") }}
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  class="text-destructive hover:text-destructive"
                  :disabled="!clientConfig?.suggestTags?.length"
                  @click="suggestTagInput = ''"
                >
                  <Eraser class="size-3.5" />
                  {{ t("SetDownloader.PathAndTag.tags.clear") }}
                </Button>
              </div>
            </div>

            <div
              v-if="clientConfig?.suggestTags?.length"
              class="flex flex-wrap gap-1.5 rounded-lg border border-border bg-muted/25 p-2.5"
            >
              <Badge
                v-for="(tag, idx) in clientConfig.suggestTags"
                :key="`${tag}-${idx}`"
                variant="secondary"
                class="gap-1 py-0.5 pl-2 pr-1 text-[11px] font-normal"
              >
                <span>{{ tag }}</span>
                <button
                  type="button"
                  class="rounded-xs p-0.5 text-muted-foreground hover:bg-background hover:text-destructive"
                  @click="removeTag(tag)"
                >
                  <X class="size-3" />
                </button>
              </Badge>
            </div>

            <Textarea
              v-model="suggestTagInput"
              :rows="5"
              :placeholder="t('SetDownloader.PathAndTag.tags.addInputLabel')"
              class="font-mono text-xs"
            />

            <div class="space-y-1.5">
              <div class="text-[11px] font-medium text-muted-foreground">
                {{ t("SetDownloader.PathAndTag.note.index") }}
              </div>
              <div class="flex flex-wrap gap-1.5">
                <Tooltip v-for="pathReplace in pathReplaceMap" :key="pathReplace[1]" :content="pathReplace[2]">
                  <button
                    type="button"
                    class="rounded-md border border-border bg-muted/40 px-2 py-0.5 font-mono text-[11px] text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                    @click="appendTagVariable(pathReplace[1])"
                  >
                    {{ pathReplace[1] }}
                  </button>
                </Tooltip>
              </div>
            </div>
          </TabsContent>

          <!-- 模板变量速查表 Tab -->
          <TabsContent value="note" class="-mx-1 mt-3 flex-1 space-y-3 overflow-y-auto px-1 py-1">
            <Alert variant="info">
              {{ t("SetDownloader.PathAndTag.note.index") }}
            </Alert>

            <div class="overflow-hidden rounded-lg border border-border">
              <table class="w-full border-collapse text-xs">
                <thead class="border-b border-border bg-muted/40 text-muted-foreground">
                  <tr>
                    <th class="px-3 py-2 text-left font-medium">
                      {{ t("SetDownloader.PathAndTag.note.table.keywords") }}
                    </th>
                    <th class="px-3 py-2 text-left font-medium">
                      {{ t("SetDownloader.PathAndTag.note.table.note") }}
                    </th>
                    <th class="px-3 py-2 text-left font-medium">
                      {{ t("SetDownloader.PathAndTag.note.table.example") }}
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border/70">
                  <tr v-for="pathReplace in pathReplaceMap" :key="pathReplace[1]" class="hover:bg-muted/30">
                    <td class="px-3 py-2 font-mono font-medium text-primary tabular-nums">
                      {{ pathReplace[1] }}
                    </td>
                    <td class="px-3 py-2 text-foreground">
                      {{ t(`SetDownloader.PathAndTag.note.replaceNote.${pathReplace[0]}`) }}
                    </td>
                    <td class="px-3 py-2">
                      <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                        {{ pathReplace[2] }}
                      </code>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="showDialog = false">
          {{ t("common.dialog.cancel") }}
        </Button>
        <Button @click="saveClientConfig">
          <Check class="size-4" />
          {{ t("common.dialog.ok") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
