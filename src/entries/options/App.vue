<script setup lang="ts">
import { watch, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useLocale as useVuetifyLocal, useTheme } from "vuetify";
import { useDevicePixelRatio } from "@vueuse/core";

import { useConfigStore } from "@/options/stores/config.ts";
import { useRuntimeStore } from "@/options/stores/runtime.ts";
import { vuetifyLangMap } from "@/options/plugins/vuetify.ts";

import Navigation from "./views/Layout/Navigation.vue";
import Topbar from "./views/Layout/Topbar.vue";
import ReleaseNoteDialog from "./views/Layout/ReleaseNoteDialog.vue";

const vuetifyTheme = useTheme();
const { current: currentVuetifyLocal } = useVuetifyLocal();
const { locale: currentVueI18nLocal, t } = useI18n({ useScope: "global" });

const configStore = useConfigStore();
const runtimeStore = useRuntimeStore();

watch(
  () => configStore.lang,
  (newLang) => {
    currentVueI18nLocal.value = newLang;
    currentVuetifyLocal.value = vuetifyLangMap[newLang];
  },
  { immediate: true },
);

watch(
  () => configStore.uiTheme,
  (newTheme) => {
    vuetifyTheme.change(newTheme);
  },
  { immediate: true },
);

const { pixelRatio } = useDevicePixelRatio();
function setIgnoreWrongPixelRatio() {
  configStore.ignoreWrongPixelRatio = true;
  configStore.$save();
}

const showReleaseNoteDialog = ref<boolean>(false);

configStore.$onReady(() => {
  if (configStore.showReleaseNoteOnVersionChange && configStore.version !== __EXT_VERSION__) {
    showReleaseNoteDialog.value = true;
  }
});
</script>

<template>
  <v-app id="ptd" :theme="configStore.uiTheme">
    <v-system-bar
      v-if="(pixelRatio > 1.1 || pixelRatio < 0.8) && !configStore.ignoreWrongPixelRatio"
      class="justify-center"
      color="warning"
    >
      {{ t("layout.header.wrongPixelRatioNotice") }}&nbsp;&nbsp;
      <v-icon class="ms-2 cursor-pointer" icon="mdi-close" @click="setIgnoreWrongPixelRatio" />
    </v-system-bar>

    <Topbar />

    <Navigation />

    <v-main id="ptd-main">
      <v-container fluid class="pa-4 pa-md-6" style="max-width: 1920px">
        <router-view v-slot="{ Component }">
          <component :is="Component" />
        </router-view>
      </v-container>
    </v-main>

    <ReleaseNoteDialog v-model="showReleaseNoteDialog" />

    <v-snackbar-queue v-model="runtimeStore.uiGlobalSnackbar" closable />
  </v-app>
</template>

<style scoped></style>
