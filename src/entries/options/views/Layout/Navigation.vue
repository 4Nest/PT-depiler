<script lang="ts" setup>
import { watch } from "vue";
import { useI18n } from "vue-i18n";
import { useDisplay } from "vuetify";

import { routes } from "@/options/plugins/router";
import { useConfigStore } from "@/options/stores/config.ts";

import { isDebug, REPO_URL } from "~/helper.ts";

const git = __GIT_VERSION__;
const ext_version = __EXT_VERSION__;

const { t } = useI18n();
const configStore = useConfigStore();

const display = useDisplay();
watch(display.mdAndUp, () => {
  if (configStore.autoToggleNavBarOnDisplayChange) {
    configStore.isNavBarOpen = display.mdAndUp.value;
  }
});

const menuOptions = routes
  .filter((route) => route.meta?.isMainMenu)
  .map((route) => {
    return {
      title: `route.${String(route.name)}.default`,
      name: route.name,
      icon: route.meta?.icon,
      children: route
        .children!.filter((childrenRoute) => !(childrenRoute.meta?.show === false))
        .map((childrenRoute) => {
          return {
            title: `route.${String(route.name)}.${String(childrenRoute.name)}`,
            name: childrenRoute.name,
            icon: childrenRoute.meta?.icon,
          };
        }),
    };
  });
</script>

<template>
  <v-navigation-drawer
    id="ptd-navigation"
    v-model="configStore.isNavBarOpen"
    :width="216"
    color="surface"
    border="e"
    :temporary="display.smAndDown.value"
  >
    <v-list density="compact" nav class="pa-2">
      <template v-for="(group, groupIndex) in menuOptions" :key="groupIndex">
        <v-list-subheader class="text-caption font-weight-semibold text-medium-emphasis mt-1">
          {{ t(group.title) }}
        </v-list-subheader>
        <v-list-item
          v-for="(nav, navIndex) in group.children"
          :key="`${groupIndex}-${navIndex}`"
          :prepend-icon="nav.icon! as string"
          :to="{ name: nav.name }"
          :value="nav"
          color="primary"
          rounded="lg"
          class="list-item-half-spacer mb-1"
        >
          {{ t(nav.title) }}
        </v-list-item>
      </template>
    </v-list>

    <template #append>
      <div class="pa-3 border-t d-flex align-center justify-space-between text-caption text-medium-emphasis">
        <div class="d-flex align-center ga-1">
          <a :href="`${REPO_URL}${git.long ? `/commit/${git.long}` : ''}`" target="_blank" class="text-medium-emphasis">
            {{ ext_version }}
          </a>
          <v-chip v-if="isDebug" color="warning" variant="tonal" label size="x-small">
            {{ t("common.test") }}
          </v-chip>
        </div>
        <v-btn
          :to="{ name: 'Logger' }"
          icon="mdi-text-box-search-outline"
          size="x-small"
          variant="text"
          :title="t('route.About.Logger')"
        />
      </div>
    </template>
  </v-navigation-drawer>
</template>

<style lang="scss" scoped></style>
