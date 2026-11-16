<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Globe,
  Layers,
  Loader2,
  Monitor,
  Moon,
  PanelLeft,
  Search,
  Sun,
  X,
} from "lucide-vue-next";

import { useConfigStore } from "@/options/stores/config.ts";
import { useMetadataStore } from "@/options/stores/metadata.ts";
import { useRuntimeStore } from "@/options/stores/runtime.ts";
import { siteMetadataIndex } from "@ptd/site/metadataIndex";
import SiteFavicon from "@/options/components/SiteFavicon/Index.vue";
import SiteName from "@/options/components/SiteName.vue";
import { Button, Input, Popover, PopoverContent, PopoverTrigger, Separator, Tooltip } from "~/components/ui";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const configStore = useConfigStore();
const metadataStore = useMetadataStore();
const runtimeStore = useRuntimeStore();

const searchKey = ref<string>("");
const searchPlanKey = ref<string>("default");
const searchInputEl = ref<HTMLInputElement | null>(null);
const planPopoverOpen = ref(false);
const singleSiteFilter = ref("");
const showSingleSiteList = ref(false);

const searchPlans = computed(() =>
  metadataStore.getSearchSolutions
    .filter((x) => !!x.enabled)
    .sort((a, b) => b.sort - a.sort)
    .map((x) => ({
      id: x.id,
      name: x.name,
    })),
);

const singleSearchSites = computed(() => {
  const q = singleSiteFilter.value.trim().toLowerCase();
  return metadataStore.getSortedAddedSites
    .filter((s) => (s.allowSearch ?? false) && !s.isOffline && !siteMetadataIndex[s.id]?.isDead)
    .filter((s) => {
      if (!q) return true;
      const name = (metadataStore.siteNameMap?.[s.id] ?? s.id).toLowerCase();
      return s.id.toLowerCase().includes(q) || name.includes(q);
    });
});

const currentPlanLabel = computed(() => {
  if (searchPlanKey.value === "default") return t("layout.header.searchPlan.default");
  if (searchPlanKey.value === "all") return t("layout.header.searchPlan.all");
  if (searchPlanKey.value.startsWith("site:")) {
    const siteId = searchPlanKey.value.slice(5);
    return metadataStore.siteNameMap?.[siteId] || siteId;
  }
  return metadataStore.getSearchSolutionName(searchPlanKey.value);
});

const currentPageTitle = computed(() => {
  const name = String(route.name ?? "");
  if (name.startsWith("SetBase")) return t("route.Settings.SetBase");
  if (name === "UserDataStatistic") return t("MyData.index.viewStatistic");
  if (name === "UserDataTimeline") return t("MyData.index.viewTimeline");
  const matchedGroup = route.matched[0]?.name ? String(route.matched[0].name) : "";
  if (matchedGroup && name) {
    const key = `route.${matchedGroup}.${name}`;
    const translated = t(key);
    if (translated !== key) return translated;
  }
  return "PT Depiler";
});

function selectPlan(key: string) {
  searchPlanKey.value = key;
  planPopoverOpen.value = false;
  showSingleSiteList.value = false;
}

function startSearchEntity() {
  router.push({
    name: "SearchEntity",
    query: {
      search: searchKey.value,
      plan: searchPlanKey.value,
      flush: 1,
    },
  });
}

watch(
  () => route.query,
  (newQuery) => {
    if (newQuery?.search !== undefined && (newQuery.search as string) !== searchKey.value) {
      searchKey.value = newQuery.search as string;
    }
    if (newQuery?.plan && (newQuery.plan as string) !== searchPlanKey.value) {
      searchPlanKey.value = newQuery.plan as string;
    }
  },
  { immediate: true },
);

function toggleSidebar() {
  configStore.isNavBarOpen = !configStore.isNavBarOpen;
  configStore.$save();
}

const themeOrder = ["light", "dark", "auto"] as const;
const currentThemeTooltip = computed(() =>
  t("layout.header.themeSwitchTip", { mode: t(`SetBase.ui.theme.${configStore.theme}`) }),
);

function cycleTheme() {
  const idx = themeOrder.indexOf(configStore.theme);
  configStore.theme = themeOrder[(idx + 1) % themeOrder.length];
  configStore.$save();
}

function handleGlobalKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    searchInputEl.value?.focus();
    searchInputEl.value?.select();
  }
}

onMounted(() => {
  window.addEventListener("keydown", handleGlobalKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleGlobalKeydown);
});
</script>

<template>
  <header
    id="ptd-topbar"
    class="sticky top-0 z-30 flex h-15 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md md:px-6"
  >
    <!-- 左侧：侧边栏开关 + 当前视图标题 -->
    <div class="flex min-w-0 items-center gap-2.5 md:flex-1">
      <Tooltip :content="t('layout.header.navBarTip')" side="bottom">
        <Button variant="ghost" size="icon-sm" class="-ml-1 text-muted-foreground" @click="toggleSidebar">
          <PanelLeft class="size-4" />
        </Button>
      </Tooltip>
      <Separator orientation="vertical" class="h-4" />
      <h1 class="truncate text-sm font-semibold tracking-tight text-foreground">
        {{ currentPageTitle }}
      </h1>
    </div>

    <!-- 中间：Command Bar 全局聚合搜索舱 -->
    <div class="flex min-w-0 flex-1 items-center justify-center md:flex-none md:w-full md:max-w-2xl lg:max-w-3xl">
      <div
        class="flex h-10 w-full items-center rounded-xl border border-input bg-card p-1 shadow-2xs transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25"
      >
        <!-- 搜索方案选择 Popover -->
        <Popover v-model:open="planPopoverOpen">
          <PopoverTrigger as-child>
            <button
              type="button"
              class="inline-flex h-8 max-w-[160px] shrink-0 items-center gap-1.5 rounded-lg bg-muted/70 px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              <SiteFavicon v-if="searchPlanKey.startsWith('site:')" :site-id="searchPlanKey.slice(5)" :size="14" />
              <Layers v-else class="size-3.5 shrink-0 text-primary" />
              <span class="truncate">{{ currentPlanLabel }}</span>
              <ChevronDown class="size-3 shrink-0 text-muted-foreground" />
            </button>
          </PopoverTrigger>

          <PopoverContent align="start" class="w-64 p-1.5">
            <template v-if="!showSingleSiteList">
              <div class="px-2 py-1 text-[11px] font-medium text-muted-foreground">
                {{ t("route.Settings.SetSearchSolution") }}
              </div>
              <button
                type="button"
                class="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs hover:bg-accent"
                @click="selectPlan('default')"
              >
                <div>
                  <div class="font-medium text-foreground">{{ t("layout.header.searchPlan.default") }}</div>
                  <div class="text-[11px] text-muted-foreground">
                    {{
                      metadataStore.defaultSolutionId !== "default"
                        ? metadataStore.getSearchSolutionName(metadataStore.defaultSolutionId)
                        : t("layout.header.searchPlan.all")
                    }}
                  </div>
                </div>
                <Check v-if="searchPlanKey === 'default'" class="size-3.5 text-primary" />
              </button>

              <button
                v-if="metadataStore.defaultSolutionId !== 'default'"
                type="button"
                class="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs hover:bg-accent"
                @click="selectPlan('all')"
              >
                <span class="flex items-center gap-2">
                  <Globe class="size-3.5 text-muted-foreground" />
                  {{ t("layout.header.searchPlan.all") }}
                </span>
                <Check v-if="searchPlanKey === 'all'" class="size-3.5 text-primary" />
              </button>

              <button
                v-if="configStore.searchEntity.allowSingleSiteSearch && singleSearchSites.length > 0"
                type="button"
                class="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs hover:bg-accent"
                @click="showSingleSiteList = true"
              >
                <span>{{ t("layout.header.searchPlan.singleSite") }}</span>
                <ChevronRight class="size-3.5 text-muted-foreground" />
              </button>

              <template v-if="searchPlans.length > 0">
                <Separator class="my-1" />
                <div class="max-h-48 overflow-y-auto">
                  <button
                    v-for="plan in searchPlans"
                    :key="plan.id"
                    type="button"
                    class="flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs hover:bg-accent"
                    @click="selectPlan(plan.id)"
                  >
                    <span class="truncate">{{ plan.name }}</span>
                    <Check v-if="searchPlanKey === plan.id" class="size-3.5 shrink-0 text-primary" />
                  </button>
                </div>
              </template>
            </template>

            <!-- 单站点快速选择子面板 -->
            <template v-else>
              <div class="mb-1.5 flex items-center gap-1">
                <Button variant="ghost" size="xs" @click="showSingleSiteList = false">←</Button>
                <Input v-model="singleSiteFilter" :placeholder="t('common.search')" class="h-7 text-xs" />
              </div>
              <div class="max-h-56 overflow-y-auto space-y-0.5">
                <button
                  v-for="site in singleSearchSites"
                  :key="site.id"
                  type="button"
                  class="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent"
                  @click="selectPlan(`site:${site.id}`)"
                >
                  <span class="flex min-w-0 items-center gap-2">
                    <SiteFavicon :site-id="site.id" :size="15" />
                    <SiteName :site-id="site.id" tag="span" class="truncate text-xs font-medium text-foreground" />
                  </span>
                  <Check v-if="searchPlanKey === `site:${site.id}`" class="size-3.5 shrink-0 text-primary" />
                </button>
              </div>
            </template>
          </PopoverContent>
        </Popover>

        <!-- 搜索输入框 -->
        <div class="relative flex min-w-0 flex-1 items-center">
          <input
            ref="searchInputEl"
            v-model="searchKey"
            type="text"
            :placeholder="t('layout.header.searchTip')"
            enterkeyhint="search"
            class="h-full w-full bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            @keyup.enter="startSearchEntity"
          />
          <button
            v-if="searchKey"
            type="button"
            class="mr-1 rounded p-0.5 text-muted-foreground hover:text-foreground"
            @click="searchKey = ''"
          >
            <X class="size-3.5" />
          </button>
          <kbd
            v-else
            class="pointer-events-none mr-2 hidden select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex"
          >
            ⌘K
          </kbd>
        </div>

        <!-- 搜索触发钮 -->
        <Button
          variant="ghost"
          size="icon-sm"
          class="size-8 shrink-0 rounded-lg border border-primary/25 bg-primary/12 text-primary hover:bg-primary hover:text-primary-foreground"
          :disabled="runtimeStore.search.isSearching"
          :title="t('common.search')"
          @click="startSearchEntity"
        >
          <Loader2 v-if="runtimeStore.search.isSearching" class="size-4 animate-spin" />
          <Search v-else class="size-4" />
        </Button>
      </div>
    </div>

    <!-- 右侧：主题切换 -->
    <div class="flex shrink-0 items-center justify-end md:flex-1">
      <Tooltip :content="currentThemeTooltip" side="bottom">
        <Button variant="outline" size="icon-sm" class="shrink-0" @click="cycleTheme">
          <Sun v-if="configStore.theme === 'light'" class="size-4" />
          <Moon v-else-if="configStore.theme === 'dark'" class="size-4" />
          <Monitor v-else class="size-4" />
        </Button>
      </Tooltip>
    </div>
  </header>
</template>
