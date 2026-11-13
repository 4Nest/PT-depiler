<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { computed, reactive, ref, shallowRef, watch } from "vue";
import { EResultParseStatus, type ISiteUserConfig, type TSiteID } from "@ptd/site";
import type { TSiteMetadataIndexEntryWithId } from "@ptd/site/metadataIndex";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Clock,
  Crosshair,
  Download,
  Globe,
  HelpCircle,
  Loader2,
  Lock,
  Search,
  X,
} from "lucide-vue-next";

import { sendMessage } from "@/messages.ts";
import { useRuntimeStore } from "@/options/stores/runtime.ts";
import { useMetadataStore } from "@/options/stores/metadata.ts";
import { useResetableRef } from "@/options/directives/useResetableRef.ts";
import { cn } from "~/lib/utils";

import SiteFavicon from "@/options/components/SiteFavicon/Index.vue";
import CheckSwitchButton from "@/options/components/CheckSwitchButton.vue";
import { getCanAddedSiteIndexEntries } from "./utils.ts";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch,
  Tooltip,
} from "~/components/ui";

const showDialog = defineModel<boolean>({ default: false });

interface IImportStatus {
  isWorking: boolean;
  toWork: TSiteID[];
  working: TSiteID;
  success: TSiteID[];
  failed: TSiteID[];
}

const { ref: importStatus, reset: resetImportStatus } = useResetableRef<IImportStatus>(() => ({
  isWorking: false,
  toWork: [],
  working: "",
  success: [],
  failed: [],
}));

const { t } = useI18n();
const runtimeStore = useRuntimeStore();
const metadataStore = useMetadataStore();

const canAddSites = shallowRef<TSiteMetadataIndexEntryWithId[]>([]);

const visibleSiteMap = reactive<Record<TSiteID, boolean>>({});
const vLazyVisible = {
  mounted(el: HTMLElement, binding: { value: TSiteID }) {
    const id = binding.value;
    if (visibleSiteMap[id]) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          visibleSiteMap[id] = true;
          observer.disconnect();
        }
      },
      { rootMargin: "120px" },
    );
    (el as any).__ptdObs = observer;
    observer.observe(el);
  },
  unmounted(el: HTMLElement) {
    (el as any).__ptdObs?.disconnect();
  },
};

const siteMetadataById = computed(
  () => new Map<TSiteID, TSiteMetadataIndexEntryWithId>(canAddSites.value.map((site) => [site.id, site])),
);

const includePublicSite = ref<boolean>(false);
const siteSearch = ref<string>("");

const displayedSites = computed(() => {
  const base = includePublicSite.value
    ? canAddSites.value
    : canAddSites.value.filter((site) => site.type === "private");
  const q = siteSearch.value.trim().toLowerCase();
  if (!q) return base;
  return base.filter(
    (site) =>
      site.id.toLowerCase().includes(q) ||
      (site.name ?? "").toLowerCase().includes(q) ||
      (site.schema ?? "").toLowerCase().includes(q),
  );
});

const publicSiteCount = computed(() => canAddSites.value.filter((site) => site.type === "public").length);

watch(includePublicSite, (include) => {
  if (include) return;
  importStatus.value.toWork = importStatus.value.toWork.filter(
    (siteId) => siteMetadataById.value.get(siteId)?.type !== "public",
  );
});

const toWorkSiteIds = computed(() => new Set(importStatus.value.toWork));
const successSiteIds = computed(() => new Set(importStatus.value.success));
const failedSiteIds = computed(() => new Set(importStatus.value.failed));

const selectableSiteIds = computed(() =>
  displayedSites.value
    .filter((site) => !site.hasUserInputSettingMeta && !successSiteIds.value.has(site.id))
    .map((site) => site.id),
);

function isSiteDisabled(site: TSiteMetadataIndexEntryWithId): boolean {
  return Boolean(site.hasUserInputSettingMeta) || importStatus.value.isWorking || successSiteIds.value.has(site.id);
}

function getSiteCheckboxState(site: TSiteMetadataIndexEntryWithId): boolean | "indeterminate" {
  if (site.hasUserInputSettingMeta || successSiteIds.value.has(site.id)) return "indeterminate";
  return toWorkSiteIds.value.has(site.id);
}

function toggleSiteSelection(site: TSiteMetadataIndexEntryWithId) {
  if (isSiteDisabled(site)) return;
  if (toWorkSiteIds.value.has(site.id)) {
    importStatus.value.toWork = importStatus.value.toWork.filter((id) => id !== site.id);
  } else {
    importStatus.value.toWork = [...importStatus.value.toWork, site.id];
  }
}

function getStatusMeta(site: TSiteMetadataIndexEntryWithId) {
  if (site.hasUserInputSettingMeta) {
    return {
      key: "manual" as const,
      title: t("SetSite.oneClickImportDialog.status.manual"),
      colorClass: "text-muted-foreground",
    };
  }
  if (importStatus.value.working === site.id) {
    return {
      key: "trying" as const,
      title: t("SetSite.oneClickImportDialog.status.trying"),
      colorClass: "text-primary",
    };
  }
  if (successSiteIds.value.has(site.id)) {
    return {
      key: "success" as const,
      title: t("SetSite.oneClickImportDialog.status.success"),
      colorClass: "text-success",
    };
  }
  if (failedSiteIds.value.has(site.id)) {
    return {
      key: "failed" as const,
      title: t("SetSite.oneClickImportDialog.status.failed"),
      colorClass: "text-destructive",
    };
  }
  if (toWorkSiteIds.value.has(site.id)) {
    return {
      key: "selected" as const,
      title: t("SetSite.oneClickImportDialog.status.selected"),
      colorClass: "text-info",
    };
  }
  return {
    key: "idle" as const,
    title: "",
    colorClass: "text-muted-foreground/50",
  };
}

async function doAutoImport() {
  importStatus.value.isWorking = true;
  importStatus.value.failed = [];

  for (const site of importStatus.value.toWork) {
    if (successSiteIds.value.has(site)) {
      continue;
    }

    importStatus.value.working = site;

    try {
      let isThisSiteSuccess = false;
      const siteMetadata = siteMetadataById.value.get(site) as TSiteMetadataIndexEntryWithId;
      const siteUserConfig = (await metadataStore.getSiteUserConfig(site, true)) as ISiteUserConfig;

      if (siteMetadata.type === "public") {
        await metadataStore.addSite(site, siteUserConfig, { reBuildMap: false });
        isThisSiteSuccess = true;
      } else {
        for (const siteUrl of siteMetadata.urls) {
          siteUserConfig.url = siteUrl;
          await metadataStore.addSite(site, siteUserConfig, { reBuildMap: false });
          const { status: testStatus } = await sendMessage("getSiteSearchResult", { siteId: site });
          if (testStatus === EResultParseStatus.success) {
            isThisSiteSuccess = true;
            break;
          }
        }
      }

      if (isThisSiteSuccess) {
        importStatus.value.success.push(site);
      } else {
        importStatus.value.failed.push(site);
        await metadataStore.removeSite(site, { reBuildMap: false });
      }
    } catch {
      importStatus.value.failed.push(site);
    }
  }

  importStatus.value.working = "";
  importStatus.value.isWorking = false;
  importStatus.value.toWork = [];

  await metadataStore.buildSiteMapCache(true);

  runtimeStore.showSnackbar(
    t("SetSite.oneClickImportDialog.importComplete", { count: importStatus.value.success.length }),
    { color: "success" },
  );
}

function dialogEnter() {
  resetImportStatus();
  includePublicSite.value = false;
  siteSearch.value = "";
  canAddSites.value = getCanAddedSiteIndexEntries().filter((site) => !site.isDead);
}
</script>

<template>
  <Dialog v-model="showDialog" @after-open="dialogEnter">
    <DialogContent
      class="max-w-5xl"
      :prevent-outside-close="importStatus.isWorking"
      :hide-close="importStatus.isWorking"
    >
      <DialogHeader>
        <DialogTitle>
          <Crosshair class="size-4 text-primary" />
          <span>{{ t("SetSite.oneClickImportDialog.title") }}</span>
        </DialogTitle>
      </DialogHeader>

      <div class="flex min-h-0 flex-1 flex-col gap-3 px-5 py-4">
        <Alert variant="warning">
          {{ t("SetSite.oneClickImportDialog.alert1") }}
        </Alert>

        <!-- 工具与统计栏 -->
        <div
          class="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-border bg-muted/30 px-3.5 py-2.5"
        >
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs font-medium text-foreground">
              {{ t("SetSite.oneClickImportDialog.alert2") }}
            </span>
            <Badge variant="info" class="tabular-nums">
              {{ t("SetSite.oneClickImportDialog.status.selected") }}: {{ importStatus.toWork.length }}
            </Badge>
            <Badge variant="success" class="tabular-nums">
              {{ t("SetSite.oneClickImportDialog.status.success") }}: {{ importStatus.success.length }}
            </Badge>
            <Badge v-if="importStatus.failed.length > 0" variant="destructive" class="tabular-nums">
              {{ t("SetSite.oneClickImportDialog.status.failed") }}: {{ importStatus.failed.length }}
            </Badge>
            <span
              v-if="importStatus.isWorking"
              class="inline-flex items-center gap-1.5 text-xs font-medium text-primary"
            >
              <Loader2 class="size-3.5 animate-spin" />
              {{
                t("SetSite.oneClickImportDialog.trying", {
                  name: siteMetadataById.get(importStatus.working)?.name,
                })
              }}
            </span>
          </div>

          <div class="flex flex-wrap items-center gap-2.5">
            <div class="relative w-48">
              <Search
                class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              />
              <Input v-model="siteSearch" :placeholder="t('common.search')" class="h-8 pl-8 pr-7 text-xs" />
              <button
                v-if="siteSearch"
                type="button"
                class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                @click="siteSearch = ''"
              >
                <X class="size-3" />
              </button>
            </div>

            <Tooltip :content="t('SetSite.oneClickImportDialog.includePublicSiteHint')">
              <div class="flex items-center gap-1.5">
                <Switch id="import-include-public" v-model="includePublicSite" :disabled="importStatus.isWorking" />
                <Label for="import-include-public" class="cursor-pointer text-xs font-normal text-muted-foreground">
                  {{ t("SetSite.oneClickImportDialog.includePublicSite", { count: publicSiteCount }) }}
                </Label>
              </div>
            </Tooltip>

            <CheckSwitchButton
              v-model="importStatus.toWork"
              :all="selectableSiteIds"
              :disabled="importStatus.isWorking"
            />
          </div>
        </div>

        <!-- 站点卡片网格 -->
        <div class="-mx-1 min-h-[240px] flex-1 overflow-y-auto px-1 py-0.5">
          <div
            v-if="displayedSites.length === 0"
            class="flex h-48 flex-col items-center justify-center gap-1.5 text-xs text-muted-foreground"
          >
            <Search class="size-6 opacity-40" />
            <span>{{ t("common.noData") }}</span>
          </div>

          <div v-else class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <div
              v-for="site in displayedSites"
              :key="site.id"
              v-lazy-visible="site.id"
              :class="
                cn(
                  'flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors',
                  isSiteDisabled(site) ? 'cursor-default opacity-80' : 'cursor-pointer hover:bg-muted/45',
                  successSiteIds.has(site.id)
                    ? 'border-success/40 bg-success/[0.06]'
                    : failedSiteIds.has(site.id)
                      ? 'border-destructive/40 bg-destructive/[0.05]'
                      : toWorkSiteIds.has(site.id)
                        ? 'border-primary/50 bg-primary/[0.05]'
                        : 'border-border bg-card',
                )
              "
              @click="toggleSiteSelection(site)"
            >
              <Checkbox
                :model-value="getSiteCheckboxState(site)"
                :disabled="isSiteDisabled(site)"
                @click.stop
                @update:model-value="toggleSiteSelection(site)"
              />

              <div class="shrink-0" @click.stop>
                <SiteFavicon v-if="visibleSiteMap[site.id]" :site-id="site.id" :size="20" flush-on-click />
                <div v-else class="size-5 rounded-sm bg-muted/60" />
              </div>

              <div class="min-w-0 flex-1 space-y-0.5">
                <div class="flex items-center gap-1.5">
                  <Tooltip
                    :content="
                      t(
                        site.type === 'private'
                          ? 'SetSite.oneClickImportDialog.siteTypePrivateTip'
                          : 'SetSite.oneClickImportDialog.siteTypePublicTip',
                      )
                    "
                  >
                    <Lock v-if="site.type === 'private'" class="size-3 shrink-0 text-primary" />
                    <Globe v-else class="size-3 shrink-0 text-muted-foreground" />
                  </Tooltip>
                  <span class="truncate text-xs font-semibold text-foreground">
                    {{ site.name ?? site.id }}
                  </span>
                </div>
                <div>
                  <Badge
                    :variant="site.type === 'private' ? 'secondary' : 'outline'"
                    class="max-w-full truncate px-1.5 py-0 text-[10px] font-normal"
                  >
                    {{ site.schema ?? (site.type === "private" ? "AbstractPrivateSite" : "AbstractBittorrentSite") }}
                  </Badge>
                </div>
              </div>

              <Tooltip :content="getStatusMeta(site).title" :disabled="!getStatusMeta(site).title">
                <a
                  :href="site.urls[0]"
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  :class="cn('shrink-0 rounded p-1 transition-colors hover:bg-accent', getStatusMeta(site).colorClass)"
                  @click.stop
                >
                  <Ban v-if="getStatusMeta(site).key === 'manual'" class="size-4" />
                  <Loader2 v-else-if="getStatusMeta(site).key === 'trying'" class="size-4 animate-spin" />
                  <CheckCircle2 v-else-if="getStatusMeta(site).key === 'success'" class="size-4" />
                  <AlertCircle v-else-if="getStatusMeta(site).key === 'failed'" class="size-4" />
                  <Clock v-else-if="getStatusMeta(site).key === 'selected'" class="size-4" />
                  <HelpCircle v-else class="size-4" />
                </a>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" :disabled="importStatus.isWorking" @click="showDialog = false">
          {{ t("common.dialog.cancel") }}
        </Button>
        <Button :disabled="importStatus.isWorking || importStatus.toWork.length === 0" @click="doAutoImport">
          <Loader2 v-if="importStatus.isWorking" class="size-4 animate-spin" />
          <Download v-else class="size-4" />
          {{ t("common.import") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
