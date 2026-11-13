<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ETorrentStatus, getTorrentVolumeFactors, preDefinedTorrentTagNameSet, sortTorrentTags } from "@ptd/site";
import { ArrowDown, ArrowUp, Check, Filter, HelpCircle, Pin, RotateCcw, WifiOff, X } from "lucide-vue-next";

import { cn } from "~/lib/utils";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Slider,
  TagsInput,
} from "~/components/ui";
import { formatDate, formatSize } from "@/options/utils.ts";
import { useConfigStore } from "@/options/stores/config.ts";
import { useRuntimeStore } from "@/options/stores/runtime.ts";
import { tableCustomFilter } from "@/options/views/Overview/SearchEntity/utils/filter.ts";
import { getThisDateUnitRange, type ITextValue } from "@/options/directives/useAdvanceFilter.ts";

import SiteName from "@/options/components/SiteName.vue";
import SiteFavicon from "@/options/components/SiteFavicon/Index.vue";

const showDialog = defineModel<boolean>();

const { t } = useI18n();
const configStore = useConfigStore();
const runtimeStore = useRuntimeStore();

const {
  advanceItemPropsRef,
  advanceFilterDictRef,
  reBuildFilterCountRef,
  reBuildAdvanceFilter,
  updateTableFilterValueFn,
} = tableCustomFilter;

const statusOptions = computed(() => [
  {
    value: ETorrentStatus.unknown,
    label: t("torrent.status.unknown"),
    icon: HelpCircle,
    tone: "text-muted-foreground",
  },
  { value: ETorrentStatus.downloading, label: t("torrent.status.downloading"), icon: ArrowDown, tone: "text-info" },
  { value: ETorrentStatus.seeding, label: t("torrent.status.seeding"), icon: ArrowUp, tone: "text-success" },
  { value: ETorrentStatus.inactive, label: t("torrent.status.inactive"), icon: WifiOff, tone: "text-muted-foreground" },
  { value: ETorrentStatus.completed, label: t("torrent.status.completed"), icon: Check, tone: "text-muted-foreground" },
]);

const torrentTags = computed(() => sortTorrentTags(advanceItemPropsRef.value.tags ?? []));
const showHiddenTags = ref(false);

const filteredTorrentTags = computed(() => {
  const hiddenNames = configStore.searchEntifyControl.hiddenTagNames || [];
  return torrentTags.value.filter((tag) => showHiddenTags.value || !hiddenNames.includes(tag.name));
});

const MAX_SITE_OPTIONS = 60;
const MAX_TAG_OPTIONS = 80;

const showAllSites = ref(false);
const showAllTags = ref(false);

const siteOptions = computed<string[]>(() => advanceItemPropsRef.value.site ?? []);
const displayedSites = computed(() =>
  showAllSites.value ? siteOptions.value : siteOptions.value.slice(0, MAX_SITE_OPTIONS),
);
const displayedTorrentTags = computed(() =>
  showAllTags.value ? filteredTorrentTags.value : filteredTorrentTags.value.slice(0, MAX_TAG_OPTIONS),
);

const hasPromoData = ref(false);
const hasUploadData = ref(false);
const showPromoFilters = computed(() => ["factor", "both"].includes(configStore.searchEntifyControl.promotionDisplay));

type TriState = "unset" | "required" | "exclude";

function getTriState(field: string, value: any): TriState {
  const dict = advanceFilterDictRef.value[field] as ITextValue | undefined;
  if (!dict) return "unset";
  if (dict.required?.includes(value)) return "required";
  if (dict.exclude?.includes(value)) return "exclude";
  return "unset";
}

function cycleTriState(field: string, value: any) {
  const dict = advanceFilterDictRef.value[field] as ITextValue;
  if (!dict) return;
  const req = dict.required ?? [];
  const exc = dict.exclude ?? [];
  if (req.includes(value)) {
    dict.required = req.filter((v) => v !== value);
    dict.exclude = [...exc, value];
  } else if (exc.includes(value)) {
    dict.exclude = exc.filter((v) => v !== value);
  } else {
    dict.required = [...req, value];
  }
}

function triStateClass(state: TriState) {
  switch (state) {
    case "required":
      return "border-success/50 bg-success/12 text-success font-medium";
    case "exclude":
      return "border-destructive/50 bg-destructive/12 text-destructive line-through";
    default:
      return "border-border bg-background text-foreground hover:bg-accent";
  }
}

function safeRange(key: string, fallback: [number, number] = [0, 100]): [number, number] {
  const r = advanceItemPropsRef.value[key]?.range;
  if (!Array.isArray(r) || r.length < 2) return fallback;
  const min = Number.isFinite(r[0]) ? r[0] : fallback[0];
  const max = Number.isFinite(r[1]) && r[1] > min ? r[1] : min + 1;
  return [min, max];
}

function useClampedSlider(key: string, fixedRange?: [number, number]) {
  return computed<number[]>({
    get(): number[] {
      const [min, max] = fixedRange ?? safeRange(key);
      const cur = advanceFilterDictRef.value[key] as [number, number] | undefined;
      if (!cur) return [min, max];
      const lo = Number.isFinite(cur[0]) ? Math.max(min, Math.min(max, cur[0])) : min;
      const hi = Number.isFinite(cur[1]) ? Math.max(lo, Math.min(max, cur[1])) : max;
      return [lo, hi];
    },
    set(val: number[]) {
      advanceFilterDictRef.value[key] = [val[0], val[1] ?? val[0]];
    },
  });
}

const timeRange = useClampedSlider("time");
const sizeRange = useClampedSlider("size");
const seedersRange = useClampedSlider("seeders");
const leechersRange = useClampedSlider("leechers");
const completedRange = useClampedSlider("completed");
const uploadFactorRange = useClampedSlider("uploadVolumeFactor", [0, 3]);
const downloadFactorRange = useClampedSlider("downloadVolumeFactor", [0, 1]);

const customDateStart = computed<string>({
  get: () => formatDate(timeRange.value[0], "yyyy-MM-dd") as string,
  set: (val: string) => {
    if (!val) return;
    const ts = new Date(`${val}T00:00:00`).getTime();
    if (Number.isFinite(ts)) {
      const [, hi] = timeRange.value;
      timeRange.value = [Math.min(ts, hi), hi];
    }
  },
});

const customDateEnd = computed<string>({
  get: () => formatDate(timeRange.value[1], "yyyy-MM-dd") as string,
  set: (val: string) => {
    if (!val) return;
    const ts = new Date(`${val}T23:59:59`).getTime();
    if (Number.isFinite(ts)) {
      const [lo] = timeRange.value;
      timeRange.value = [lo, Math.max(lo, ts)];
    }
  },
});

function updateTableFilter() {
  updateTableFilterValueFn();
  showDialog.value = false;
}

function enterDialog() {
  reBuildAdvanceFilter();
  showAllSites.value = false;
  showAllTags.value = false;

  let hasDownloadPromo = false;
  let hasUploadPromo = false;
  for (const item of runtimeStore.search.searchResult) {
    const { downloadVolumeFactor: download, uploadVolumeFactor: upload } = getTorrentVolumeFactors(item);
    if (Number.isFinite(download) && (download as number) < 1) hasDownloadPromo = true;
    if (Number.isFinite(upload) && upload !== 1) hasUploadPromo = true;
    if (hasDownloadPromo && hasUploadPromo) break;
  }

  hasPromoData.value = hasDownloadPromo;
  hasUploadData.value = hasUploadPromo;
}
</script>

<template>
  <Dialog v-model="showDialog" @after-open="enterDialog">
    <DialogContent class="max-w-4xl">
      <DialogHeader>
        <div class="flex items-center gap-2.5">
          <div class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Filter class="size-4" />
          </div>
          <DialogTitle class="text-sm font-semibold">
            {{ t("common.AdvanceFilterGenerateDialog.title") }}
          </DialogTitle>
        </div>
      </DialogHeader>

      <div class="flex-1 overflow-y-auto px-5 py-4">
        <div class="flex flex-col gap-4">
          <!-- 1. 关键词过滤 -->
          <div class="rounded-lg border border-border bg-muted/20 p-3.5">
            <div class="mb-2.5 text-xs font-semibold text-foreground">
              {{ t("common.AdvanceFilterGenerateDialog.keywords") }}
            </div>
            <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs text-success">{{ t("common.AdvanceFilterGenerateDialog.required") }}</Label>
                <TagsInput
                  v-model="advanceFilterDictRef.text.required"
                  :placeholder="t('common.AdvanceFilterGenerateDialog.required')"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs text-destructive">{{ t("common.AdvanceFilterGenerateDialog.exclude") }}</Label>
                <TagsInput
                  v-model="advanceFilterDictRef.text.exclude"
                  :placeholder="t('common.AdvanceFilterGenerateDialog.exclude')"
                />
              </div>
            </div>
          </div>

          <!-- 2. 站点三态筛选胶囊 -->
          <div v-if="siteOptions.length > 0" class="rounded-lg border border-border bg-muted/20 p-3.5">
            <div class="mb-2.5 flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="text-xs font-semibold text-foreground">
                  {{ t("common.AdvanceFilterGenerateDialog.site") }}
                </span>
                <span class="text-[11px] text-muted-foreground"> （点击切换：默认 → 必选 / 排除） </span>
              </div>
              <Button
                v-if="siteOptions.length > MAX_SITE_OPTIONS"
                variant="ghost"
                size="xs"
                class="text-primary"
                @click="showAllSites = !showAllSites"
              >
                {{
                  showAllSites
                    ? t("common.AdvanceFilterGenerateDialog.collapse")
                    : t("common.AdvanceFilterGenerateDialog.showAll", [siteOptions.length])
                }}
              </Button>
            </div>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="site in displayedSites"
                :key="`${reBuildFilterCountRef}_${site}`"
                type="button"
                :class="
                  cn(
                    'inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs transition-colors',
                    triStateClass(getTriState('site', site)),
                  )
                "
                @click="cycleTriState('site', site)"
              >
                <Check v-if="getTriState('site', site) === 'required'" class="size-3 shrink-0" />
                <X v-else-if="getTriState('site', site) === 'exclude'" class="size-3 shrink-0" />
                <SiteFavicon :site-id="site" :size="14" />
                <SiteName :site-id="site" tag="span" />
              </button>
            </div>
          </div>

          <!-- 3. 标签三态筛选胶囊 -->
          <div
            v-if="configStore.searchEntifyControl.showTorrentTag && filteredTorrentTags.length > 0"
            class="rounded-lg border border-border bg-muted/20 p-3.5"
          >
            <div class="mb-2.5 flex flex-wrap items-center justify-between gap-2">
              <span class="text-xs font-semibold text-foreground">
                {{ t("SearchEntity.AdvanceFilterGenerateDialog.tags") }}
              </span>
              <div class="flex items-center gap-1">
                <Button
                  v-if="filteredTorrentTags.length > MAX_TAG_OPTIONS"
                  variant="ghost"
                  size="xs"
                  class="text-primary"
                  @click="showAllTags = !showAllTags"
                >
                  {{
                    showAllTags
                      ? t("common.AdvanceFilterGenerateDialog.collapse")
                      : t("common.AdvanceFilterGenerateDialog.showAll", [filteredTorrentTags.length])
                  }}
                </Button>
                <Button
                  v-if="configStore.searchEntifyControl.hiddenTagNames?.length"
                  variant="ghost"
                  size="xs"
                  class="text-primary"
                  @click="showHiddenTags = !showHiddenTags"
                >
                  {{
                    showHiddenTags
                      ? t("SearchEntity.AdvanceFilterGenerateDialog.hideHiddenTags")
                      : t("SearchEntity.AdvanceFilterGenerateDialog.showHiddenTags")
                  }}
                </Button>
              </div>
            </div>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="tag in displayedTorrentTags"
                :key="`${reBuildFilterCountRef}_${tag.name}`"
                type="button"
                :class="
                  cn(
                    'inline-flex h-6 items-center gap-1 rounded border px-2 text-xs transition-colors',
                    triStateClass(getTriState('tags', tag.name)),
                  )
                "
                @click="cycleTriState('tags', tag.name)"
              >
                <Check v-if="getTriState('tags', tag.name) === 'required'" class="size-3 shrink-0" />
                <X v-else-if="getTriState('tags', tag.name) === 'exclude'" class="size-3 shrink-0" />
                <Pin v-else-if="preDefinedTorrentTagNameSet.includes(tag.name)" class="size-2.5 rotate-45 opacity-60" />
                <span>{{ tag.name }}</span>
              </button>
            </div>
          </div>

          <!-- 4. 种子状态三态筛选胶囊 -->
          <div class="rounded-lg border border-border bg-muted/20 p-3.5">
            <div class="mb-2.5 text-xs font-semibold text-foreground">
              {{ t("SearchEntity.AdvanceFilterGenerateDialog.status") }}
            </div>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="status in statusOptions"
                :key="`${reBuildFilterCountRef}_${status.value}`"
                type="button"
                :class="
                  cn(
                    'inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors',
                    triStateClass(getTriState('status', status.value)),
                  )
                "
                @click="cycleTriState('status', status.value)"
              >
                <component
                  :is="status.icon"
                  :class="cn('size-3.5', getTriState('status', status.value) === 'unset' && status.tone)"
                />
                <span>{{ status.label }}</span>
              </button>
            </div>
          </div>

          <!-- 5. 发布日期与种子体积双滑块 -->
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div class="flex flex-col gap-2.5 rounded-lg border border-border bg-muted/20 p-3.5">
              <div class="flex flex-wrap items-center justify-between gap-1.5">
                <span class="text-xs font-semibold text-foreground">
                  {{ t("common.AdvanceFilterGenerateDialog.date") }}
                </span>
                <div class="flex flex-wrap gap-1">
                  <button
                    v-for="dateUnit in ['day', 'week', 'month', 'quarter', 'year'] as const"
                    :key="dateUnit"
                    type="button"
                    class="rounded border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                    @click="
                      () => (advanceFilterDictRef.time = getThisDateUnitRange(dateUnit, advanceItemPropsRef.time.range))
                    "
                  >
                    {{ t(`common.AdvanceFilterGenerateDialog.dateUnit.${dateUnit}`) }}
                  </button>
                </div>
              </div>

              <Slider v-model="timeRange" :min="safeRange('time')[0]" :max="safeRange('time')[1]" :step="60 * 1000" />

              <div class="grid grid-cols-2 gap-2">
                <Input v-model="customDateStart" type="date" class="h-7 text-xs tabular-nums" />
                <Input v-model="customDateEnd" type="date" class="h-7 text-xs tabular-nums" />
              </div>
            </div>

            <div class="flex flex-col justify-between gap-2.5 rounded-lg border border-border bg-muted/20 p-3.5">
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-semibold text-foreground">
                  {{ t("SearchEntity.AdvanceFilterGenerateDialog.size") }}
                </span>
                <span class="text-xs text-muted-foreground tabular-nums">
                  {{ formatSize(sizeRange[0]) }} ~ {{ formatSize(sizeRange[1]) }}
                </span>
              </div>
              <Slider v-model="sizeRange" :min="safeRange('size')[0]" :max="safeRange('size')[1]" :step="1024 ** 3" />
              <div class="flex justify-between text-[11px] text-muted-foreground tabular-nums">
                <span>{{ formatSize(safeRange("size")[0]) }}</span>
                <span>{{ formatSize(safeRange("size")[1]) }}</span>
              </div>
            </div>
          </div>

          <!-- 6. 做种数 / 下载数 / 完成数双滑块 -->
          <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div class="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3.5">
              <div class="flex items-center justify-between text-xs">
                <span class="font-semibold text-foreground">
                  {{ t("SearchEntity.AdvanceFilterGenerateDialog.seeders") }}
                </span>
                <span class="text-muted-foreground tabular-nums">{{ seedersRange[0] }} ~ {{ seedersRange[1] }}</span>
              </div>
              <Slider v-model="seedersRange" :min="safeRange('seeders')[0]" :max="safeRange('seeders')[1]" :step="1" />
            </div>

            <div class="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3.5">
              <div class="flex items-center justify-between text-xs">
                <span class="font-semibold text-foreground">
                  {{ t("SearchEntity.AdvanceFilterGenerateDialog.leechers") }}
                </span>
                <span class="text-muted-foreground tabular-nums">{{ leechersRange[0] }} ~ {{ leechersRange[1] }}</span>
              </div>
              <Slider
                v-model="leechersRange"
                :min="safeRange('leechers')[0]"
                :max="safeRange('leechers')[1]"
                :step="1"
              />
            </div>

            <div class="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3.5">
              <div class="flex items-center justify-between text-xs">
                <span class="font-semibold text-foreground">
                  {{ t("SearchEntity.AdvanceFilterGenerateDialog.completed") }}
                </span>
                <span class="text-muted-foreground tabular-nums">
                  {{ completedRange[0] }} ~ {{ completedRange[1] }}
                </span>
              </div>
              <Slider
                v-model="completedRange"
                :min="safeRange('completed')[0]"
                :max="safeRange('completed')[1]"
                :step="1"
              />
            </div>
          </div>

          <!-- 7. 优惠倍率双滑块 -->
          <div v-if="showPromoFilters && (hasPromoData || hasUploadData)" class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div v-if="hasUploadData" class="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3.5">
              <div class="flex items-center justify-between text-xs">
                <span class="font-semibold text-foreground">
                  {{ t("common.AdvanceFilterGenerateDialog.promoUpload") }}
                </span>
                <span class="text-muted-foreground tabular-nums">
                  ×{{ uploadFactorRange[0] }} ~ ×{{ uploadFactorRange[1] }}
                </span>
              </div>
              <Slider v-model="uploadFactorRange" :min="0" :max="3" :step="0.5" />
            </div>

            <div v-if="hasPromoData" class="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3.5">
              <div class="flex items-center justify-between text-xs">
                <span class="font-semibold text-foreground">
                  {{ t("common.AdvanceFilterGenerateDialog.promo") }}
                </span>
                <span class="text-muted-foreground tabular-nums">
                  {{ Math.round(downloadFactorRange[0] * 100) }}% ~ {{ Math.round(downloadFactorRange[1] * 100) }}%
                </span>
              </div>
              <Slider v-model="downloadFactorRange" :min="0" :max="1" :step="0.05" />
            </div>
          </div>
        </div>
      </div>

      <DialogFooter class="justify-between">
        <Button variant="ghost" size="sm" @click="() => reBuildAdvanceFilter(true)">
          <RotateCcw class="size-3.5" />
          <span>{{ t("common.AdvanceFilterGenerateDialog.reset") }}</span>
        </Button>

        <div class="flex items-center gap-2">
          <Button variant="outline" size="sm" @click="showDialog = false">
            {{ t("common.dialog.cancel") }}
          </Button>
          <Button variant="default" size="sm" @click="updateTableFilter">
            <Check class="size-3.5" />
            <span>{{ t("common.AdvanceFilterGenerateDialog.generate") }}</span>
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
