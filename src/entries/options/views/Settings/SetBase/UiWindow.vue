<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { isEmpty } from "es-toolkit/compat";
import { HelpCircle } from "lucide-vue-next";

import { supportTheme } from "@/shared/types.ts";
import { definedLangMetaData } from "@/options/plugins/i18n.ts";
import { useConfigStore } from "@/options/stores/config.ts";
import { useMetadataStore } from "@/options/stores/metadata.ts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Tooltip } from "~/components/ui";

const { t } = useI18n();
const configStore = useConfigStore();
const metadataStore = useMetadataStore();

const tableActionColumnPositionItems = computed(() => [
  { title: t("SetBase.ui.tableActionColumnPositionStart"), value: "start" as const },
  { title: t("SetBase.ui.tableActionColumnPositionEnd"), value: "end" as const },
]);

function initContentScriptExceptionSites() {
  Object.keys(metadataStore.sites).forEach((site) => {
    if (typeof metadataStore.sites[site].allowContentScript === "undefined") {
      metadataStore.sites[site].allowContentScript = true;
    }
  });
  metadataStore.$save();
}

function beforeSave() {
  if (
    configStore.contentScript.enabled &&
    configStore.contentScript.allowExceptionSites &&
    !isEmpty(metadataStore.sites)
  ) {
    initContentScriptExceptionSites();
  }
}

defineExpose({
  beforeSave,
});
</script>

<template>
  <div class="space-y-6">
    <!-- 外观与常规交互 -->
    <section class="space-y-2">
      <h2 class="px-1 text-xs font-medium text-muted-foreground">{{ t("SetBase.tab.ui") }}</h2>
      <div class="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xs">
        <div class="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <span class="text-sm font-medium text-foreground">{{ t("SetBase.ui.changeLanguage") }}</span>
          <Select v-model="configStore.lang">
            <SelectTrigger class="w-full sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="lang in definedLangMetaData" :key="lang.value" :value="lang.value">
                {{ lang.title }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <span class="text-sm font-medium text-foreground">{{ t("SetBase.ui.displayMode.index") }}</span>
          <Select v-model="configStore.theme">
            <SelectTrigger class="w-full sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="mode in supportTheme" :key="mode" :value="mode">
                {{ t("SetBase.ui.displayMode." + mode) }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <label
          class="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/25"
        >
          <span class="text-sm font-medium text-foreground">{{ t("SetBase.ui.showReleaseNote") }}</span>
          <Switch v-model="configStore.showReleaseNoteOnVersionChange" />
        </label>

        <div class="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/25">
          <div class="flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground">
            <span>{{ t("SetBase.ui.autoToggleNavBarOnDisplayChange") }}</span>
            <Tooltip :content="t('SetBase.ui.autoToggleNavBarOnDisplayChangeNote')" side="top">
              <HelpCircle class="size-3.5 shrink-0 text-muted-foreground/75" />
            </Tooltip>
          </div>
          <Switch v-model="configStore.autoToggleNavBarOnDisplayChange" />
        </div>
      </div>
    </section>

    <!-- 数据表格设置 -->
    <section class="space-y-2">
      <h2 class="px-1 text-xs font-medium text-muted-foreground">{{ t("SetBase.ui.dataTable") }}</h2>
      <div class="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xs">
        <label
          class="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/25"
        >
          <span class="text-sm font-medium text-foreground">{{ t("SetBase.ui.saveTableBehavior") }}</span>
          <Switch v-model="configStore.saveTableBehavior" />
        </label>

        <div class="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/25">
          <div class="flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground">
            <span>{{ t("SetBase.ui.enableTableMultiSort") }}</span>
            <Tooltip :content="t('SetBase.ui.tableMultiSortNote')" side="top">
              <HelpCircle class="size-3.5 shrink-0 text-muted-foreground/75" />
            </Tooltip>
          </div>
          <Switch v-model="configStore.enableTableMultiSort" />
        </div>

        <div class="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <span class="text-sm font-medium text-foreground">{{ t("SetBase.ui.tableActionColumnPosition") }}</span>
          <Select v-model="configStore.tableActionColumnPosition">
            <SelectTrigger class="w-full sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="pos in tableActionColumnPositionItems" :key="pos.value" :value="pos.value">
                {{ pos.title }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/25">
          <div class="flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground">
            <span>{{ t("SetBase.ui.tableActionColumnFixed") }}</span>
            <Tooltip :content="t('SetBase.ui.tableActionColumnFixedNote')" side="top">
              <HelpCircle class="size-3.5 shrink-0 text-muted-foreground/75" />
            </Tooltip>
          </div>
          <Switch v-model="configStore.tableActionColumnFixed" />
        </div>

        <div class="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/25">
          <div class="flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground">
            <span>{{ t("SetBase.ui.tableColumnFit") }}</span>
            <Tooltip :content="t('SetBase.ui.tableColumnFitNote')" side="top">
              <HelpCircle class="size-3.5 shrink-0 text-muted-foreground/75" />
            </Tooltip>
          </div>
          <Switch v-model="configStore.tableColumnFit" />
        </div>
      </div>
    </section>

    <!-- 内容脚本与站点侧边栏 -->
    <section class="space-y-2">
      <div class="flex items-center gap-1.5 px-1">
        <h2 class="text-xs font-medium text-muted-foreground">{{ t("SetBase.ui.contentScript") }}</h2>
        <Tooltip :content="t('SetBase.ui.contentScriptWarning')" side="top">
          <HelpCircle class="size-3.5 shrink-0 text-muted-foreground/75" />
        </Tooltip>
      </div>
      <div class="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xs">
        <label
          class="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/25"
        >
          <span class="text-sm font-medium text-foreground">{{ t("SetBase.ui.contentScript") }}</span>
          <Switch v-model="configStore.contentScript.enabled" />
        </label>

        <template v-if="configStore.contentScript.enabled">
          <div class="bg-muted/30 px-4 py-1.5 text-[11px] font-medium text-muted-foreground">
            {{ t("SetBase.ui.basicSettings") }}
          </div>
          <label
            class="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/25"
          >
            <span class="text-sm font-medium text-foreground">{{ t("SetBase.ui.allowExceptionSites") }}</span>
            <Switch v-model="configStore.contentScript.allowExceptionSites" />
          </label>

          <div class="bg-muted/30 px-4 py-1.5 text-[11px] font-medium text-muted-foreground">
            {{ t("SetBase.ui.sidebarStyle") }}
          </div>
          <label
            class="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/25"
          >
            <span class="text-sm font-medium text-foreground">
              {{ t("SetBase.ui.respondDisplayMode") }}{{ t("SetBase.ui.displayMode.index") }}
            </span>
            <Switch v-model="configStore.contentScript.applyTheme" />
          </label>
          <label
            class="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/25"
          >
            <span class="text-sm font-medium text-foreground">{{ t("SetBase.ui.expandByDefault") }}</span>
            <Switch v-model="configStore.contentScript.defaultOpenSpeedDial" />
          </label>
          <label
            class="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/25"
          >
            <span class="text-sm font-medium text-foreground">{{ t("SetBase.ui.enableFadeEffect") }}</span>
            <Switch v-model="configStore.contentScript.fadeEnterStyle" />
          </label>

          <div class="bg-muted/30 px-4 py-1.5 text-[11px] font-medium text-muted-foreground">
            {{ t("SetBase.ui.sidebarFunctions") }}
          </div>
          <label
            class="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/25"
          >
            <span class="text-sm font-medium text-foreground">{{ t("SetBase.ui.confirmTwoStep") }}</span>
            <Switch v-model="configStore.contentScript.doubleConfirmAction" />
          </label>
          <div class="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/25">
            <div class="flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground">
              <span>{{ t("SetBase.ui.allowDragLink") }}</span>
              <Tooltip :content="t('SetBase.ui.dragNote')" side="top">
                <HelpCircle class="size-3.5 shrink-0 text-muted-foreground/75" />
              </Tooltip>
            </div>
            <Switch v-model="configStore.contentScript.dragLinkOnSpeedDial" />
          </div>
        </template>
      </div>
    </section>
  </div>
</template>
