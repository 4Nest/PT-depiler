<script setup lang="ts">
import { nanoid } from "nanoid";
import { ref, computed, shallowRef } from "vue";
import { useI18n } from "vue-i18n";
import { cloneDeep, isEqual } from "es-toolkit";
import { find, isEmpty } from "es-toolkit/compat";
import { refDebounced } from "@vueuse/core";
import {
  ArrowDownWideNarrow,
  ArrowUpDown,
  ArrowUpNarrowWide,
  CheckCircle2,
  ChevronDown,
  Globe,
  ListChecks,
  Search,
  X,
} from "lucide-vue-next";

import { useRuntimeStore } from "@/options/stores/runtime.ts";
import { useMetadataStore } from "@/options/stores/metadata.ts";
import type { ISearchSolution, ISearchSolutionMetadata, TSolutionKey } from "@/shared/types.ts";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Tooltip,
} from "~/components/ui";
import { cn } from "~/lib/utils";

import SolutionLabel from "./SolutionLabel.vue";
import SiteCategoryPanel from "./SiteCategoryPanel.vue";
import SiteName from "@/options/components/SiteName.vue";
import SiteFavicon from "@/options/components/SiteFavicon/Index.vue";

const showDialog = defineModel<boolean>({ default: false });
const solutionId = defineModel<TSolutionKey>("solutionId");

const { t } = useI18n();

const initSolution = () =>
  ({
    id: nanoid(),
    name: "",
    sort: 1,
    enabled: true,
    isDefault: false,
    createdAt: Date.now(),
    solutions: [],
  }) as ISearchSolutionMetadata;

const metadataStore = useMetadataStore();
const runtimeStore = useRuntimeStore();

const solution = ref<ISearchSolutionMetadata>(initSolution());
const formValid = computed(() => Boolean(solution.value.name?.trim()));

const siteWaitFilter = ref("");
const siteFilter = refDebounced(siteWaitFilter, 300);

const addedSiteInfo = shallowRef<Array<{ siteId: string; isDead: boolean; siteName: string; siteUrl: string }>>([]);

const addedCountBySite = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = {};
  for (const s of solution.value.solutions) {
    counts[s.siteId] = (counts[s.siteId] ?? 0) + 1;
  }
  return counts;
});

type TAddedCountSort = "asc" | "desc" | null;
const addedCountSort = ref<TAddedCountSort>(null);
const openSitePanels = ref<string[]>([]);

function cycleAddedCountSort() {
  addedCountSort.value = addedCountSort.value === null ? "asc" : addedCountSort.value === "asc" ? "desc" : null;
}

function toggleSitePanel(siteId: string) {
  if (metadataStore.sites[siteId]?.isOffline) return;
  if (openSitePanels.value.includes(siteId)) {
    openSitePanels.value = openSitePanels.value.filter((s) => s !== siteId);
  } else {
    openSitePanels.value = [...openSitePanels.value, siteId];
  }
}

const filteredSite = computed(() => {
  const filter = (siteFilter.value ?? "").toLowerCase();

  const sites = addedSiteInfo.value
    .filter((item) => {
      const siteKey = [item.siteId, item.siteName, item.siteUrl]
        .filter(Boolean)
        .map((x: string) => x.toLowerCase())
        .join("|");
      return siteKey.includes(filter);
    })
    .map((item) => item.siteId);

  if (addedCountSort.value) {
    const dir = addedCountSort.value === "asc" ? 1 : -1;
    sites.sort((a, b) => ((addedCountBySite.value[a] ?? 0) - (addedCountBySite.value[b] ?? 0)) * dir);
  }
  return sites;
});

const filteredSolutions = computed(() => {
  const filter = (siteFilter.value ?? "").toLowerCase();
  if (!filter) return solution.value.solutions;
  return solution.value.solutions.filter((item) => {
    const meta = metadataStore.sites[item.siteId];
    const siteKey = [item.siteId, meta?.name, meta?.url]
      .filter(Boolean)
      .map((x: string) => x.toLowerCase())
      .join("|");
    return siteKey.includes(filter);
  });
});

function addSolution(toAdd: ISearchSolution) {
  if (
    find(solution.value.solutions, (item) => {
      return (
        item.siteId === toAdd.siteId &&
        ((!isEmpty(item.selectedCategories) && isEqual(item.selectedCategories, toAdd.selectedCategories)) ||
          (typeof item.name !== "undefined" && item.name === toAdd.name))
      );
    })
  ) {
    runtimeStore.showSnackbar(t("SetSearchSolution.edit.cantAddByDuplicateNote"), { color: "error" });
    return;
  }

  solution.value.solutions.push(toAdd);
}

function removeSolution(toRemove: ISearchSolution) {
  solution.value.solutions = solution.value.solutions.filter(
    (x) => !(x.id == toRemove.id && x.siteId == toRemove.siteId),
  );
}

function saveSolutionState() {
  if (!formValid.value || solution.value.solutions.length === 0) return;
  metadataStore.addSearchSolution(solution.value);
  showDialog.value = false;
}

function dialogEnter() {
  siteWaitFilter.value = "";
  Promise.all(
    metadataStore.getAddedSiteIds
      .sort((a, b) => Number(metadataStore.sites[b].allowSearch) - Number(metadataStore.sites[a].allowSearch))
      .map(async (siteId) => ({
        siteId,
        isDead: (await metadataStore.getSiteMergedMetadata(siteId, "isDead")) ?? false,
        siteName: await metadataStore.getSiteName(siteId),
        siteUrl: await metadataStore.getSiteUrl(siteId),
      })),
  ).then((siteInfos) => {
    addedSiteInfo.value = siteInfos.filter((site) => !site.isDead);
  });

  let storedSolution = metadataStore.solutions[solutionId.value!];
  if (!storedSolution) {
    storedSolution = initSolution();
  }

  solution.value = cloneDeep(storedSolution);
}

function dialogLeave() {
  solution.value = initSolution();
  openSitePanels.value = [];
}
</script>

<template>
  <Dialog v-model="showDialog" @after-open="dialogEnter" @after-close="dialogLeave">
    <DialogContent class="h-[88vh] max-w-6xl">
      <DialogHeader>
        <DialogTitle>
          <ListChecks class="size-4 text-primary" />
          <span>{{ t("SetSearchSolution.edit.title") }}</span>
        </DialogTitle>
        <DialogDescription>
          {{ t("SetSearchSolution.edit.addCount", [solution.solutions.length]) }}
        </DialogDescription>
      </DialogHeader>

      <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-5 py-4">
        <!-- 顶部基础属性行 -->
        <div class="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-12">
          <div class="space-y-1 sm:col-span-6">
            <Label for="solution-name">{{ t("common.name") }}</Label>
            <Input id="solution-name" v-model="solution.name" :placeholder="t('common.name')" />
          </div>
          <div class="space-y-1 sm:col-span-4">
            <Label for="solution-id">ID</Label>
            <Input id="solution-id" v-model="solution.id" disabled class="font-mono text-xs" />
          </div>
          <div class="space-y-1 sm:col-span-2">
            <Label for="solution-sort">{{ t("common.sortIndex") }}</Label>
            <Input
              id="solution-sort"
              v-model.number="solution.sort"
              type="number"
              :min="0"
              :max="100"
              class="tabular-nums"
            />
          </div>
        </div>

        <!-- 宽幅双栏构建器 -->
        <div class="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-12">
          <!-- 左栏：已添加站点与分类选择器 -->
          <div class="flex min-h-0 flex-col gap-2.5 lg:col-span-8">
            <div class="flex shrink-0 items-center gap-2">
              <div class="relative flex-1">
                <Search
                  class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  v-model="siteWaitFilter"
                  :placeholder="t('SetSearchSolution.edit.filterPlaceholder')"
                  class="pl-8 pr-8"
                />
                <button
                  v-if="siteWaitFilter"
                  type="button"
                  class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  @click="siteWaitFilter = ''"
                >
                  <X class="size-3.5" />
                </button>
              </div>
              <Tooltip :content="t('SetSearchSolution.edit.sortByAddedCount')" side="top">
                <Button
                  :variant="addedCountSort ? 'secondary' : 'outline'"
                  size="icon"
                  :class="addedCountSort ? 'border-primary/40 text-primary' : ''"
                  @click="cycleAddedCountSort"
                >
                  <ArrowUpNarrowWide v-if="addedCountSort === 'asc'" class="size-4" />
                  <ArrowDownWideNarrow v-else-if="addedCountSort === 'desc'" class="size-4" />
                  <ArrowUpDown v-else class="size-4" />
                </Button>
              </Tooltip>
            </div>

            <div class="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-card">
              <div
                v-if="filteredSite.length === 0"
                class="flex h-40 flex-col items-center justify-center gap-2 text-xs text-muted-foreground"
              >
                <Globe class="size-5 opacity-40" />
                <span>{{ t("common.noData") }}</span>
              </div>
              <div v-else class="divide-y divide-border">
                <div v-for="site in filteredSite" :key="site">
                  <button
                    type="button"
                    :disabled="!!metadataStore.sites[site]?.isOffline"
                    :class="
                      cn(
                        'flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left transition-colors',
                        metadataStore.sites[site]?.isOffline ? 'cursor-not-allowed opacity-50' : 'hover:bg-muted/45',
                        openSitePanels.includes(site) && 'bg-muted/35',
                      )
                    "
                    @click="toggleSitePanel(site)"
                  >
                    <div class="flex min-w-0 items-center gap-2.5">
                      <SiteFavicon :site-id="site" :size="18" />
                      <Badge :variant="addedCountBySite[site] ? 'success' : 'secondary'" class="max-w-full">
                        <SiteName :site-id="site" tag="span" class="truncate" />
                      </Badge>
                    </div>

                    <div class="flex shrink-0 items-center gap-2">
                      <Tooltip
                        v-if="addedCountBySite[site]"
                        :content="t('SetSearchSolution.edit.siteAddedCount', [addedCountBySite[site]])"
                        side="left"
                      >
                        <Badge :variant="addedCountBySite[site] === 1 ? 'success' : 'warning'" class="tabular-nums">
                          ×{{ addedCountBySite[site] }}
                        </Badge>
                      </Tooltip>
                      <ChevronDown
                        :class="
                          cn(
                            'size-4 text-muted-foreground transition-transform duration-150',
                            openSitePanels.includes(site) && 'rotate-180',
                          )
                        "
                      />
                    </div>
                  </button>

                  <div v-if="openSitePanels.includes(site)" class="border-t border-border/70 bg-muted/15 px-3.5 py-3">
                    <SiteCategoryPanel :site-id="site" @update:solution="addSolution" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 右栏：当前方案已加入的搜索入口胶囊清单 -->
          <div class="flex min-h-0 flex-col gap-2.5 lg:col-span-4">
            <div
              class="flex h-9 shrink-0 items-center justify-between rounded-lg border border-success/25 bg-success/8 px-3"
            >
              <span class="text-xs font-medium text-foreground">
                {{ t("SetSearchSolution.edit.addCount", [solution.solutions.length]) }}
              </span>
              <Badge variant="success" class="tabular-nums">{{ solution.solutions.length }}</Badge>
            </div>

            <div class="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-card p-3">
              <div
                v-if="siteFilter && filteredSolutions.length === 0 && solution.solutions.length > 0"
                class="py-6 text-center text-xs text-muted-foreground"
              >
                {{ t("SetSearchSolution.edit.noMatchInFilteredSolutions") }}
              </div>
              <div
                v-else-if="solution.solutions.length === 0"
                class="flex h-40 flex-col items-center justify-center gap-1.5 text-center text-xs text-muted-foreground"
              >
                <ListChecks class="size-5 opacity-40" />
                <span>从左侧站点选择分类并添加到此处</span>
              </div>
              <SolutionLabel v-else column :solutions="filteredSolutions" closable @remove:solution="removeSolution" />
            </div>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="showDialog = false">
          {{ t("common.dialog.cancel") }}
        </Button>
        <Button :disabled="!formValid || solution.solutions.length === 0" @click="saveSolutionState">
          <CheckCircle2 class="size-4" />
          {{ t("common.dialog.ok") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
