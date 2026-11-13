<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useDisplay } from "vuetify";
import { useRoute, useRouter } from "vue-router";

import { useConfigStore } from "@/options/stores/config.ts";
import { useMetadataStore } from "@/options/stores/metadata.ts";
import { useRuntimeStore } from "@/options/stores/runtime.ts";

import { siteMetadataIndex } from "@ptd/site/metadataIndex";
import { REPO_URL } from "~/helper";
import SiteFavicon from "@/options/components/SiteFavicon/Index.vue";
import SiteName from "@/options/components/SiteName.vue";

const route = useRoute();
const router = useRouter();
const display = useDisplay();
const { t } = useI18n();

const configStore = useConfigStore();
const metadataStore = useMetadataStore();
const runtimeStore = useRuntimeStore();

const searchKey = ref<string>("");
const searchPlanKey = ref<string>("default");

const searchPlans = computed(() =>
  metadataStore.getSearchSolutions
    .filter((x) => !!x.enabled)
    .sort((a, b) => b.sort - a.sort)
    .map((x) => ({
      id: x.id,
      name: x.name,
    })),
);

const singleSearchSiteIds = ref<string[]>([]);

function refreshSingleSearchSiteIds() {
  singleSearchSiteIds.value = metadataStore.getSortedAddedSites
    .filter((siteUserConfig) => (siteUserConfig.allowSearch ?? false) && !siteUserConfig.isOffline)
    .filter((siteUserConfig) => !siteMetadataIndex[siteUserConfig.id]?.isDead)
    .map((siteUserConfig) => siteUserConfig.id);
}

watch(() => metadataStore.getAddedSites, refreshSingleSearchSiteIds, { immediate: true, deep: true });

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
    if (newQuery?.search && (newQuery.search as string) !== searchKey.value) {
      searchKey.value = newQuery.search as string;
    }
    if (newQuery?.plan && (newQuery.plan as string) !== searchPlanKey.value) {
      searchPlanKey.value = newQuery.plan as string;
    }
  },
);

function updateNavBarOpenStatus() {
  configStore.isNavBarOpen = !configStore.isNavBarOpen;
  configStore.$save();
}

const themeOrder = ["light", "dark", "auto"] as const;
const themeIconMap = {
  light: "mdi-weather-sunny",
  dark: "mdi-weather-night",
  auto: "mdi-theme-light-dark",
} as const;

const currentThemeIcon = computed(() => themeIconMap[configStore.theme] ?? "mdi-weather-sunny");
const currentThemeTooltip = computed(() =>
  t("layout.header.themeSwitchTip", { mode: t(`SetBase.ui.theme.${configStore.theme}`) }),
);

function cycleTheme() {
  const idx = themeOrder.indexOf(configStore.theme);
  configStore.theme = themeOrder[(idx + 1) % themeOrder.length];
  configStore.$save();
}
</script>

<template>
  <v-app-bar id="ptd-topbar" color="surface" elevation="0" border="b" height="60">
    <template #prepend>
      <v-app-bar-nav-icon :title="t('layout.header.navBarTip')" variant="text" @click="updateNavBarOpenStatus" />
      <div class="d-flex align-center ga-2 mr-2 cursor-pointer" @click="router.push({ name: 'MyData' })">
        <v-img src="/icons/logo/64.png" width="24" height="24" />
        <span v-if="display.smAndUp.value" class="text-subtitle-1 font-weight-bold text-no-wrap">PT Depiler</span>
        <v-chip v-if="display.smAndUp.value" size="x-small" color="primary" variant="tonal" label>Lite</v-chip>
      </div>
    </template>

    <!-- 一体化高可读聚合搜索框 -->
    <div class="d-flex justify-center flex-grow-1 px-2">
      <div class="ptd-search-bar" style="max-width: 640px; width: 100%">
        <v-text-field
          v-model="searchKey"
          :placeholder="t('layout.header.searchTip')"
          class="ptd-search-input"
          clearable
          enterkeyhint="search"
          hide-details
          single-line
          type="search"
          bg-color="surface-variant"
          @keyup.enter="startSearchEntity"
        >
          <template #prepend-inner>
            <v-menu>
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  color="primary"
                  variant="tonal"
                  size="small"
                  class="mr-1 text-no-wrap"
                  append-icon="mdi-menu-down"
                >
                  {{
                    searchPlanKey == "default"
                      ? t("layout.header.searchPlan.default")
                      : metadataStore.getSearchSolutionName(searchPlanKey)
                  }}
                </v-btn>
              </template>
              <v-list density="compact">
                <v-list-item
                  :subtitle="
                    '<' +
                    (metadataStore.defaultSolutionId !== 'default'
                      ? metadataStore.getSearchSolutionName(metadataStore.defaultSolutionId)
                      : t('layout.header.searchPlan.all')) +
                    '>'
                  "
                  :title="t('layout.header.searchPlan.default')"
                  @click="() => (searchPlanKey = 'default')"
                />

                <template v-if="metadataStore.defaultSolutionId !== 'default'">
                  <v-list-item :title="t('layout.header.searchPlan.all')" @click="() => (searchPlanKey = 'all')" />
                </template>

                <v-list-item
                  v-if="configStore.searchEntity.allowSingleSiteSearch"
                  :title="t('layout.header.searchPlan.singleSite')"
                >
                  <template #append>
                    <v-icon icon="mdi-menu-right" size="x-small" />
                  </template>

                  <v-menu
                    :open-on-focus="false"
                    open-on-hover
                    :open-on-click="display.mobile.value"
                    activator="parent"
                    submenu
                  >
                    <v-list density="compact">
                      <template v-for="siteMetadata in metadataStore.getSortedAddedSites" :key="siteMetadata.id">
                        <v-list-item
                          v-if="singleSearchSiteIds.includes(siteMetadata.id)"
                          @click="() => (searchPlanKey = `site:${siteMetadata.id}`)"
                        >
                          <template #prepend>
                            <SiteFavicon :site-id="siteMetadata.id" />
                          </template>
                          <SiteName :class="['v-list-item-title', 'ml-2']" :site-id="siteMetadata.id" tag="span" />
                        </v-list-item>
                      </template>
                    </v-list>
                  </v-menu>
                </v-list-item>

                <v-divider v-if="searchPlans.length > 0" class="my-1" />

                <v-list-item
                  v-for="(item, index) in searchPlans"
                  :key="index"
                  :value="index"
                  @click="() => (searchPlanKey = item.id)"
                >
                  <v-list-item-title>{{ metadataStore.getSearchSolutionName(item.id) }}</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
          </template>

          <template #append-inner>
            <v-btn
              :loading="runtimeStore.search.isSearching"
              color="primary"
              variant="flat"
              size="small"
              icon="mdi-magnify"
              :title="t('common.search')"
              @click="startSearchEntity"
            />
          </template>
        </v-text-field>
      </div>
    </div>

    <template #append>
      <div class="d-flex align-center ga-1 pr-2">
        <v-tooltip location="bottom" :text="currentThemeTooltip">
          <template #activator="{ props }">
            <v-btn v-bind="props" :icon="currentThemeIcon" variant="text" @click="cycleTheme" />
          </template>
        </v-tooltip>

        <v-tooltip location="bottom" :text="t('layout.header.home')">
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              :href="REPO_URL"
              icon="mdi-github"
              rel="noopener noreferrer nofollow"
              target="_blank"
              variant="text"
            />
          </template>
        </v-tooltip>
      </div>
    </template>
  </v-app-bar>
</template>

<style scoped lang="scss">
.ptd-search-input :deep(.v-field) {
  padding-inline-start: 6px;
  padding-inline-end: 6px;
  border: 1px solid rgba(var(--v-border-color), 0.14);
}

.ptd-search-input :deep(input) {
  color: rgb(var(--v-theme-on-surface));
}

.ptd-search-input :deep(input::placeholder) {
  color: rgba(var(--v-theme-on-surface), 0.55) !important;
  opacity: 1;
}
</style>
