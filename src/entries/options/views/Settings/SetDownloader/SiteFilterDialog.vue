<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Check, Eye, EyeOff, Filter, Search, X } from "lucide-vue-next";

import { useMetadataStore } from "@/options/stores/metadata.ts";
import { useConfigStore } from "@/options/stores/config.ts";
import type { IDownloaderMetadata, TDownloaderKey } from "@/shared/types.ts";
import { cn } from "~/lib/utils";

import SiteFavicon from "@/options/components/SiteFavicon/Index.vue";
import CheckSwitchButton from "@/options/components/CheckSwitchButton.vue";
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
} from "~/components/ui";

const showDialog = defineModel<boolean>({ default: false });
const { clientId } = defineProps<{
  clientId: TDownloaderKey;
}>();

const { t } = useI18n();
const metadataStore = useMetadataStore();
const configStore = useConfigStore();

const clientConfig = ref<IDownloaderMetadata>();
const excludedSites = ref<string[]>([]);
const siteSearch = ref<string>("");

const addedSites = computed(() =>
  Object.entries(metadataStore.sites)
    .filter(([, site]) => (configStore.contentScript.allowExceptionSites ? (site.allowContentScript ?? true) : true))
    .map(([id]) => ({ id, name: metadataStore.siteNameMap[id] ?? id }))
    .sort((a, b) => a.name.localeCompare(b.name)),
);

const filteredSites = computed(() => {
  const q = siteSearch.value.trim().toLowerCase();
  if (!q) return addedSites.value;
  return addedSites.value.filter((site) => site.id.toLowerCase().includes(q) || site.name.toLowerCase().includes(q));
});

const allSiteIds = computed(() => filteredSites.value.map((s) => s.id));

function toggleSite(siteId: string) {
  if (excludedSites.value.includes(siteId)) {
    excludedSites.value = excludedSites.value.filter((x) => x !== siteId);
  } else {
    excludedSites.value = [...excludedSites.value, siteId];
  }
}

function onEnter() {
  siteSearch.value = "";
  if (clientId) {
    clientConfig.value = { excludedSites: [], ...metadataStore.downloaders[clientId] };
    excludedSites.value = [...(clientConfig.value.excludedSites ?? [])];
  }
}

function save() {
  metadataStore.simplePatch("downloaders", clientId, "excludedSites", excludedSites.value);
  showDialog.value = false;
}
</script>

<template>
  <Dialog v-model="showDialog" @after-open="onEnter">
    <DialogContent class="max-w-4xl">
      <DialogHeader>
        <DialogTitle>
          <Filter class="size-4 text-primary" />
          {{ t("SetDownloader.siteFilter.title", [clientConfig?.name ?? clientId]) }}
        </DialogTitle>
      </DialogHeader>

      <div class="flex min-h-0 flex-1 flex-col gap-3 px-5 py-4">
        <Alert variant="info">
          {{ t("SetDownloader.siteFilter.excludedSitesHint") }}
          <template #action>
            <CheckSwitchButton v-model="excludedSites" :all="allSiteIds" />
          </template>
        </Alert>

        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="relative w-64">
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

          <Badge variant="secondary" class="tabular-nums text-xs">
            {{ t("SetDownloader.siteFilter.excludedSites") }}: {{ excludedSites.length }} / {{ addedSites.length }}
          </Badge>
        </div>

        <div class="-mx-1 min-h-[220px] flex-1 overflow-y-auto px-1 py-0.5">
          <div
            v-if="addedSites.length === 0"
            class="flex h-44 items-center justify-center text-xs text-muted-foreground"
          >
            {{ t("SetDownloader.siteFilter.noSites") }}
          </div>

          <div
            v-else-if="filteredSites.length === 0"
            class="flex h-44 items-center justify-center text-xs text-muted-foreground"
          >
            {{ t("common.noData") }}
          </div>

          <div v-else class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <button
              v-for="site in filteredSites"
              :key="site.id"
              type="button"
              :class="
                cn(
                  'flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors',
                  excludedSites.includes(site.id)
                    ? 'border-destructive/45 bg-destructive/[0.06]'
                    : 'border-border bg-card hover:bg-muted/45',
                )
              "
              @click="toggleSite(site.id)"
            >
              <SiteFavicon :site-id="site.id" :size="20" flush-on-click />

              <div class="min-w-0 flex-1 space-y-0.5">
                <div class="truncate text-xs font-semibold text-foreground">
                  {{ site.name }}
                </div>
                <div>
                  <Badge variant="outline" class="px-1.5 py-0 font-mono text-[10px] font-normal text-muted-foreground">
                    {{ site.id }}
                  </Badge>
                </div>
              </div>

              <span
                :class="
                  cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-md',
                    excludedSites.includes(site.id)
                      ? 'bg-destructive/15 text-destructive'
                      : 'bg-success/15 text-success',
                  )
                "
              >
                <EyeOff v-if="excludedSites.includes(site.id)" class="size-3.5" />
                <Eye v-else class="size-3.5" />
              </span>
            </button>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="showDialog = false">
          {{ t("common.dialog.cancel") }}
        </Button>
        <Button @click="save">
          <Check class="size-4" />
          {{ t("common.dialog.ok") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
