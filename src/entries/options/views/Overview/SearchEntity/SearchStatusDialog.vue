<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { EResultParseStatus } from "@ptd/site";
import { ArrowRight, ArrowUpToLine, Loader2, Radar, RotateCw } from "lucide-vue-next";

import { cn } from "~/lib/utils";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Tooltip,
} from "~/components/ui";
import { useRuntimeStore } from "@/options/stores/runtime.ts";
import { useMetadataStore } from "@/options/stores/metadata.ts";
import type { ISearchPlanStatus, TSearchSolutionKey } from "@/shared/types.ts";

import SiteFavicon from "@/options/components/SiteFavicon/Index.vue";
import SiteName from "@/options/components/SiteName.vue";
import SolutionDetail from "@/options/components/SolutionDetail.vue";
import ResultParseStatus from "@/options/components/ResultParseStatus.vue";

import { doSearchEntity, raiseSearchPriority } from "./utils/search.ts";

const showDialog = defineModel<boolean>();

const { t } = useI18n();
const runtimeStore = useRuntimeStore();
const metadataStore = useMetadataStore();

function getSearchSolution(planKey: string, entryName: string) {
  return metadataStore.solutions[planKey]?.solutions.find((x) => x.id === entryName)!;
}

const statusFilterRef = ref<EResultParseStatus[]>([]);

// costTime 以毫秒存储，展示时换算为秒并统一保留 1~2 位小数
function formatCostTime(costTime?: number) {
  return ((costTime ?? 0) / 1000).toFixed(2).replace(/0$/, "");
}

const statusChips = computed(() => {
  const countMap = new Map<EResultParseStatus, number>();
  for (const plan of Object.values(runtimeStore.search.searchPlan ?? {})) {
    countMap.set(plan.status, (countMap.get(plan.status) ?? 0) + 1);
  }
  return [...countMap.entries()].map(([status, count]) => ({ status, count }));
});

const totalPlanCount = computed(() => Object.keys(runtimeStore.search.searchPlan ?? {}).length);

const filteredSearchPlan = computed(() => {
  const entries = Object.entries(runtimeStore.search.searchPlan ?? {}) as [TSearchSolutionKey, ISearchPlanStatus][];
  if (statusFilterRef.value.length === 0) return entries;
  return entries.filter(([, plan]) => statusFilterRef.value.includes(plan.status));
});

function toggleStatusFilter(status: EResultParseStatus) {
  if (statusFilterRef.value.includes(status)) {
    statusFilterRef.value = statusFilterRef.value.filter((s) => s !== status);
  } else {
    statusFilterRef.value = [...statusFilterRef.value, status];
  }
}
</script>

<template>
  <Dialog v-model="showDialog">
    <DialogContent class="max-w-3xl">
      <DialogHeader>
        <div class="flex items-center gap-2.5">
          <div class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Radar class="size-4" />
          </div>
          <div class="min-w-0">
            <DialogTitle class="truncate text-sm font-semibold">
              {{
                t("SearchEntity.SearchStatusDialog.title", [
                  metadataStore.getSearchSolutionName(runtimeStore.search.searchPlanKey),
                ])
              }}
            </DialogTitle>
            <DialogDescription class="truncate text-xs text-muted-foreground">
              &lt;{{ runtimeStore.search.searchPlanKey }}&gt;
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div class="flex-1 overflow-y-auto px-5 py-4">
        <!-- 状态过滤胶囊栏 -->
        <div class="mb-3 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            :class="
              cn(
                'inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors',
                statusFilterRef.length === 0
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
              )
            "
            @click="statusFilterRef = []"
          >
            <span>{{ t("SearchEntity.siteFilter.all") }}</span>
            <span class="tabular-nums opacity-80">{{ totalPlanCount }}</span>
          </button>

          <button
            v-for="{ status, count } in statusChips"
            :key="status"
            type="button"
            :class="
              cn(
                'inline-flex h-7 items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs transition-colors',
                statusFilterRef.includes(status)
                  ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                  : 'border-border bg-background hover:bg-accent/60',
              )
            "
            @click="toggleStatusFilter(status)"
          >
            <ResultParseStatus :status="status" />
            <span class="font-semibold text-foreground tabular-nums">{{ count }}</span>
          </button>
        </div>

        <!-- 站点执行队列列表 -->
        <div class="flex flex-col gap-1.5">
          <div
            v-for="[solutionKey, searchPlan] in filteredSearchPlan"
            :key="solutionKey"
            class="flex items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-2.5 transition-colors hover:bg-muted/35"
          >
            <SiteFavicon :site-id="searchPlan.siteId" :size="20" class="shrink-0" />

            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-1.5 text-sm">
                <SiteName :site-id="searchPlan.siteId" class="font-semibold text-foreground" />
                <ArrowRight class="size-3.5 shrink-0 text-muted-foreground" />
                <span v-if="searchPlan.searchEntry.name" class="text-xs font-medium text-foreground">
                  {{ searchPlan.searchEntry.name }}
                </span>
                <span
                  v-else-if="
                    runtimeStore.search.searchPlanKey === 'all' || runtimeStore.search.searchPlanKey.startsWith('site:')
                  "
                  class="text-xs font-medium text-foreground"
                >
                  {{ searchPlan.searchEntry.name ?? searchPlan.searchEntryName }}
                </span>
                <SolutionDetail
                  v-else
                  :solution="getSearchSolution(runtimeStore.search.searchPlanKey, searchPlan.searchEntryName)"
                />
              </div>
              <div class="mt-0.5 text-[11px] text-muted-foreground">&lt;{{ searchPlan.searchEntryName }}&gt;</div>
            </div>

            <div class="flex shrink-0 flex-col items-end gap-0.5 text-right">
              <ResultParseStatus :status="searchPlan.status" />
              <span
                v-if="searchPlan.status === EResultParseStatus.success"
                class="text-[11px] text-muted-foreground tabular-nums"
              >
                {{
                  t("SearchEntity.SearchStatusDialog.successMsg", [
                    searchPlan.count,
                    formatCostTime(searchPlan.costTime),
                  ])
                }}
              </span>
              <span
                v-else-if="searchPlan.statusMsg"
                class="max-w-[220px] truncate text-[11px] text-muted-foreground"
                :title="
                  searchPlan.statusMsg.startsWith('i18n.')
                    ? t('SearchEntity.SearchStatusDialog.statusMsg' + searchPlan.statusMsg.replace('i18n.', '.'))
                    : searchPlan.statusMsg
                "
              >
                {{
                  searchPlan.statusMsg.startsWith("i18n.")
                    ? t("SearchEntity.SearchStatusDialog.statusMsg" + searchPlan.statusMsg.replace("i18n.", "."))
                    : searchPlan.statusMsg
                }}
              </span>
            </div>

            <div class="h-6 w-px shrink-0 bg-border" />

            <div class="shrink-0">
              <Tooltip
                v-if="searchPlan.status === EResultParseStatus.waiting"
                :content="t('SearchEntity.SearchStatusDialog.moveUp')"
              >
                <Button
                  variant="ghost"
                  size="icon-xs"
                  class="text-warning hover:bg-warning/10 hover:text-warning"
                  @click="() => raiseSearchPriority(solutionKey)"
                >
                  <ArrowUpToLine class="size-3.5" />
                </Button>
              </Tooltip>

              <Tooltip v-else :content="t('SearchEntity.SearchStatusDialog.searchAgain')">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  :disabled="searchPlan.status === EResultParseStatus.working"
                  class="text-muted-foreground hover:text-primary"
                  @click="
                    () => doSearchEntity(searchPlan.siteId, searchPlan.searchEntryName, searchPlan.searchEntry, true)
                  "
                >
                  <Loader2 v-if="searchPlan.status === EResultParseStatus.working" class="size-3.5 animate-spin" />
                  <RotateCw v-else class="size-3.5" />
                </Button>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" size="sm" @click="showDialog = false">
          {{ t("common.dialog.close") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
