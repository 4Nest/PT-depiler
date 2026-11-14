<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useDevicePixelRatio, useMediaQuery } from "@vueuse/core";
import { Toaster } from "vue-sonner";
import { AlertTriangle, X } from "lucide-vue-next";

import { useConfigStore } from "@/options/stores/config.ts";
import Navigation from "./views/Layout/Navigation.vue";
import Topbar from "./views/Layout/Topbar.vue";
import ReleaseNoteDialog from "./views/Layout/ReleaseNoteDialog.vue";

const { locale: currentVueI18nLocal, t } = useI18n({ useScope: "global" });
const configStore = useConfigStore();

watch(
  () => configStore.lang,
  (newLang) => {
    currentVueI18nLocal.value = newLang;
    document.documentElement.lang = newLang === "zh_CN" ? "zh-CN" : "en";
  },
  { immediate: true },
);

watch(
  () => configStore.uiTheme,
  (theme) => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme === "dark" ? "dark" : "light";
  },
  { immediate: true },
);

const isDesktop = useMediaQuery("(min-width: 1024px)");
watch(isDesktop, (desktop) => {
  if (configStore.autoToggleNavBarOnDisplayChange) {
    configStore.isNavBarOpen = desktop;
  }
});

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
  <div id="ptd" class="flex min-h-screen w-full bg-background text-foreground">
    <Navigation @open-release-note="showReleaseNoteDialog = true" />

    <div class="flex min-w-0 flex-1 flex-col">
      <!-- 浏览器非标准缩放比温和提醒 -->
      <div
        v-if="(pixelRatio > 1.1 || pixelRatio < 0.8) && !configStore.ignoreWrongPixelRatio"
        class="flex items-center justify-center gap-2 border-b border-warning/25 bg-warning/10 px-4 py-1.5 text-xs text-foreground"
      >
        <AlertTriangle class="size-3.5 shrink-0 text-warning" />
        <span>{{ t("layout.header.wrongPixelRatioNotice") }}</span>
        <button
          type="button"
          class="ml-1 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          @click="setIgnoreWrongPixelRatio"
        >
          <X class="size-3.5" />
        </button>
      </div>

      <Topbar />

      <main id="ptd-main" class="flex-1 px-3 py-4 md:px-4 md:py-4">
        <div class="w-full">
          <router-view v-slot="{ Component }">
            <component :is="Component" />
          </router-view>
        </div>
      </main>
    </div>

    <ReleaseNoteDialog v-model="showReleaseNoteDialog" />

    <Toaster
      position="bottom-right"
      :theme="configStore.uiTheme"
      rich-colors
      close-button
      :toast-options="{
        class: 'font-sans text-xs',
      }"
    />
  </div>
</template>
