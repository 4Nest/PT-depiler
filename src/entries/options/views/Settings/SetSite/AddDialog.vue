<script setup lang="ts">
import { provide, reactive, ref, shallowRef, computed } from "vue";
import { useI18n } from "vue-i18n";
import { type ISiteUserConfig, type TSiteID } from "@ptd/site";
import type { TSiteMetadataIndexEntryWithId } from "@ptd/site/metadataIndex";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Globe,
  HelpCircle,
  Lock,
  PlusCircle,
  Search,
  X,
} from "lucide-vue-next";

import { useMetadataStore } from "@/options/stores/metadata.ts";
import { getCanAddedSiteIndexEntries } from "./utils.ts";
import { cn } from "~/lib/utils";
import { REPO_URL } from "~/helper.ts";

import SiteFavicon from "@/options/components/SiteFavicon/Index.vue";
import Editor from "./Editor.vue";
import {
  Badge,
  Button,
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

const { t } = useI18n();
const metadataStore = useMetadataStore();

const currentStep = ref<0 | 1>(0);
const selectedSiteId = ref<TSiteID | null>(null);
const storedSiteUserConfig = ref<ISiteUserConfig>({});
const isFormValid = ref<boolean>(false);
const siteSearch = ref<string>("");
const showDeadSite = ref<boolean>(false);

provide("storedSiteUserConfig", storedSiteUserConfig);

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

function resetDialog() {
  currentStep.value = 0;
  selectedSiteId.value = null;
  storedSiteUserConfig.value = {};
  siteSearch.value = "";
  isFormValid.value = false;
}

const allUnAddedSites = shallowRef<TSiteMetadataIndexEntryWithId[]>([]);

const canAddSites = computed(() =>
  allUnAddedSites.value.filter((site) => (showDeadSite.value && site.isDead) || !site.isDead),
);

const filteredSites = computed(() => {
  const q = siteSearch.value.trim().toLowerCase();
  if (!q) return canAddSites.value;
  return canAddSites.value.filter((site) => {
    const haystacks = [
      site.id,
      site.name,
      site.schema,
      ...(site.urls ?? []),
      ...(site.aka ?? []),
      ...(site.tags ?? []),
    ];
    return haystacks.some((item) => item && item.toLowerCase().includes(q));
  });
});

const selectedSiteEntry = computed(() =>
  selectedSiteId.value ? allUnAddedSites.value.find((s) => s.id === selectedSiteId.value) : undefined,
);

function loadCanAddSites() {
  allUnAddedSites.value = getCanAddedSiteIndexEntries();
}

function selectSiteAndAdvance(siteId: TSiteID) {
  selectedSiteId.value = siteId;
  currentStep.value = 1;
}

async function saveSite() {
  if (!selectedSiteId.value) return;
  await metadataStore.addSite(selectedSiteId.value, storedSiteUserConfig.value);
  showDialog.value = false;
}
</script>

<template>
  <Dialog v-model="showDialog" @after-open="loadCanAddSites" @after-close="resetDialog">
    <DialogContent class="max-w-3xl">
      <DialogHeader>
        <DialogTitle>
          <PlusCircle class="size-4 text-primary" />
          <span>{{ t("SetSite.add.title") }}</span>
          <Badge variant="secondary" class="ml-1 font-mono text-[11px] tabular-nums"> {{ currentStep + 1 }} / 2 </Badge>
          <Badge v-if="currentStep === 1 && selectedSiteEntry" variant="outline" class="font-normal">
            {{ selectedSiteEntry.name }}
          </Badge>
          <Tooltip :content="t('common.howToUse')">
            <a
              :href="`${REPO_URL}/wiki/config-site`"
              target="_blank"
              rel="noopener noreferrer nofollow"
              class="ml-1 inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <HelpCircle class="size-3.5" />
            </a>
          </Tooltip>
        </DialogTitle>
      </DialogHeader>

      <!-- Step 1: 选择站点 -->
      <div v-if="currentStep === 0" class="flex min-h-0 flex-1 flex-col gap-3 px-5 py-4">
        <div class="flex flex-wrap items-center justify-between gap-2.5">
          <div class="relative min-w-[220px] flex-1">
            <Search
              class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              v-model="siteSearch"
              :placeholder="t('SetSite.add.selectSitePlaceholder')"
              class="h-8.5 pl-8 pr-8 text-sm"
            />
            <button
              v-if="siteSearch"
              type="button"
              class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              @click="siteSearch = ''"
            >
              <X class="size-3.5" />
            </button>
          </div>

          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2">
              <Switch id="add-show-dead" v-model="showDeadSite" />
              <Label for="add-show-dead" class="cursor-pointer text-xs font-normal text-muted-foreground">
                {{ t("SetSite.AddDialog.showDeadSite") }}
              </Label>
            </div>
            <Badge variant="secondary" class="tabular-nums text-[11px]">
              {{ filteredSites.length }}
            </Badge>
          </div>
        </div>

        <div class="-mx-1 max-h-[420px] min-h-[260px] flex-1 space-y-1.5 overflow-y-auto px-1 py-0.5">
          <div
            v-if="filteredSites.length === 0"
            class="flex h-48 flex-col items-center justify-center gap-1.5 text-xs text-muted-foreground"
          >
            <Search class="size-6 opacity-40" />
            <span>{{ t("common.noData") }}</span>
          </div>

          <button
            v-for="site in filteredSites"
            :key="site.id"
            v-lazy-visible="site.id"
            type="button"
            :class="
              cn(
                'flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                selectedSiteId === site.id
                  ? 'border-primary bg-primary/[0.06] ring-1 ring-primary/30'
                  : 'border-border bg-card hover:bg-muted/45',
              )
            "
            @click="selectedSiteId = site.id"
            @dblclick="selectSiteAndAdvance(site.id)"
          >
            <div class="mt-0.5 shrink-0">
              <SiteFavicon v-if="visibleSiteMap[site.id]" :site-id="site.id" :size="22" />
              <div v-else class="size-[22px] rounded-sm bg-muted/60" />
            </div>

            <div class="min-w-0 flex-1 space-y-1">
              <div class="flex flex-wrap items-center gap-1.5">
                <Lock v-if="site.type === 'private'" class="size-3.5 shrink-0 text-primary" />
                <Globe v-else class="size-3.5 shrink-0 text-muted-foreground" />
                <span :class="cn('text-sm font-semibold text-foreground', site.isDead && 'line-through opacity-65')">
                  {{ site.name }}
                </span>
                <Badge :variant="site.type === 'private' ? 'default' : 'secondary'" class="px-1.5 py-0 text-[10px]">
                  {{ site.schema ?? (site.type === "private" ? "AbstractPrivateSite" : "AbstractBittorrentSite") }}
                </Badge>
                <Badge v-if="site.version" variant="success" class="px-1.5 py-0 text-[10px] tabular-nums">
                  v{{ site.version }}
                </Badge>
                <Badge v-if="site.isDead" variant="destructive" class="px-1.5 py-0 text-[10px]">
                  {{ t("SetSite.common.isOffline") }}
                </Badge>
              </div>

              <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span class="truncate font-mono text-[11px]">{{ site.urls?.[0] }}</span>
                <span v-if="site.tags?.length" class="truncate text-[11px] text-muted-foreground/80">
                  · {{ site.tags.slice(0, 4).join(" / ") }}
                </span>
              </div>

              <p
                v-if="site.description"
                class="line-clamp-1 text-xs text-muted-foreground"
                :title="Array.isArray(site.description) ? site.description.join(' ') : site.description"
              >
                {{ Array.isArray(site.description) ? site.description.join(" ") : site.description }}
              </p>
            </div>

            <div class="mt-0.5 flex shrink-0 items-center gap-1">
              <a
                v-if="site.urls?.[0]"
                :href="site.urls[0]"
                target="_blank"
                rel="noopener noreferrer nofollow"
                class="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                @click.stop
              >
                <ExternalLink class="size-3.5" />
              </a>
              <span
                :class="
                  cn(
                    'flex size-5 items-center justify-center rounded-full border transition-colors',
                    selectedSiteId === site.id
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-transparent',
                  )
                "
              >
                <Check class="size-3" />
              </span>
            </div>
          </button>
        </div>
      </div>

      <!-- Step 2: 详细配置 -->
      <div v-else class="flex-1 overflow-y-auto px-5 py-4">
        <Editor v-model="selectedSiteId!" @update:form-valid="(v) => (isFormValid = v)" />
      </div>

      <DialogFooter>
        <Button variant="outline" @click="showDialog = false">
          {{ t("common.dialog.cancel") }}
        </Button>
        <Button v-if="currentStep === 1" variant="secondary" @click="currentStep = 0">
          <ChevronLeft class="size-4" />
          {{ t("common.dialog.prev") }}
        </Button>
        <Button v-if="currentStep === 0" :disabled="selectedSiteId == null" @click="currentStep = 1">
          {{ t("common.dialog.next") }}
          <ChevronRight class="size-4" />
        </Button>
        <Button v-if="currentStep === 1" :disabled="!isFormValid" @click="saveSite">
          <Check class="size-4" />
          {{ t("common.dialog.ok") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
