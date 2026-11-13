<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { isEmpty } from "es-toolkit/compat";
import { HelpCircle } from "lucide-vue-next";

import { supportTheme } from "@/shared/types.ts";
import { definedLangMetaData } from "@/options/plugins/i18n.ts";
import { useConfigStore } from "@/options/stores/config.ts";
import { useMetadataStore } from "@/options/stores/metadata.ts";
import {
  Alert,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Switch,
  Tooltip,
} from "~/components/ui";

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
  <div class="space-y-5">
    <!-- 外观与常规交互 -->
    <Card>
      <CardHeader>
        <CardTitle>{{ t("SetBase.tab.ui") }}</CardTitle>
        <CardDescription>{{ t("SetBase.ui.displayMode.index") }}</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span class="text-sm font-medium text-foreground">{{ t("SetBase.ui.changeLanguage") }}</span>
          <Select v-model="configStore.lang">
            <SelectTrigger class="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="lang in definedLangMetaData" :key="lang.value" :value="lang.value">
                {{ lang.title }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span class="text-sm font-medium text-foreground">{{ t("SetBase.ui.displayMode.index") }}</span>
          <Select v-model="configStore.theme">
            <SelectTrigger class="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="mode in supportTheme" :key="mode" :value="mode">
                {{ t("SetBase.ui.displayMode." + mode) }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <label class="flex cursor-pointer items-center justify-between gap-4">
          <span class="text-sm font-medium text-foreground">{{ t("SetBase.ui.showReleaseNote") }}</span>
          <Switch v-model="configStore.showReleaseNoteOnVersionChange" />
        </label>

        <Separator />

        <div class="flex items-center justify-between gap-4">
          <div class="space-y-0.5">
            <div class="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <span>{{ t("SetBase.ui.autoToggleNavBarOnDisplayChange") }}</span>
              <Tooltip :content="t('SetBase.ui.autoToggleNavBarOnDisplayChangeNote')" side="top">
                <HelpCircle class="size-3.5 text-muted-foreground" />
              </Tooltip>
            </div>
            <p class="text-xs text-muted-foreground">{{ t("SetBase.ui.autoToggleNavBarOnDisplayChangeNote") }}</p>
          </div>
          <Switch v-model="configStore.autoToggleNavBarOnDisplayChange" />
        </div>
      </CardContent>
    </Card>

    <!-- 数据表格设置 -->
    <Card>
      <CardHeader>
        <CardTitle>{{ t("SetBase.ui.dataTable") }}</CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
        <label class="flex cursor-pointer items-center justify-between gap-4">
          <span class="text-sm font-medium text-foreground">{{ t("SetBase.ui.saveTableBehavior") }}</span>
          <Switch v-model="configStore.saveTableBehavior" />
        </label>

        <Separator />

        <div class="flex items-start justify-between gap-4">
          <div class="space-y-0.5">
            <div class="text-sm font-medium text-foreground">{{ t("SetBase.ui.enableTableMultiSort") }}</div>
            <p class="text-xs text-muted-foreground">{{ t("SetBase.ui.tableMultiSortNote") }}</p>
          </div>
          <Switch v-model="configStore.enableTableMultiSort" />
        </div>

        <Separator />

        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span class="text-sm font-medium text-foreground">{{ t("SetBase.ui.tableActionColumnPosition") }}</span>
          <Select v-model="configStore.tableActionColumnPosition">
            <SelectTrigger class="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="pos in tableActionColumnPositionItems" :key="pos.value" :value="pos.value">
                {{ pos.title }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <div class="flex items-start justify-between gap-4">
          <div class="space-y-0.5">
            <div class="text-sm font-medium text-foreground">{{ t("SetBase.ui.tableActionColumnFixed") }}</div>
            <p class="text-xs text-muted-foreground">{{ t("SetBase.ui.tableActionColumnFixedNote") }}</p>
          </div>
          <Switch v-model="configStore.tableActionColumnFixed" />
        </div>

        <Separator />

        <div class="flex items-start justify-between gap-4">
          <div class="space-y-0.5">
            <div class="text-sm font-medium text-foreground">{{ t("SetBase.ui.tableColumnFit") }}</div>
            <p class="text-xs text-muted-foreground">{{ t("SetBase.ui.tableColumnFitNote") }}</p>
          </div>
          <Switch v-model="configStore.tableColumnFit" />
        </div>
      </CardContent>
    </Card>

    <!-- 内容脚本与站点侧边栏 -->
    <Card>
      <CardHeader class="flex-row items-center justify-between gap-4 space-y-0">
        <div class="space-y-1">
          <CardTitle>{{ t("SetBase.ui.contentScript") }}</CardTitle>
          <CardDescription>{{ t("SetBase.ui.contentScriptWarning") }}</CardDescription>
        </div>
        <Switch v-model="configStore.contentScript.enabled" />
      </CardHeader>

      <CardContent v-if="configStore.contentScript.enabled" class="space-y-4">
        <Alert variant="warning">
          {{ t("SetBase.ui.contentScriptWarning") }}
        </Alert>

        <div class="space-y-3">
          <div class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {{ t("SetBase.ui.basicSettings") }}
          </div>
          <label class="flex cursor-pointer items-center justify-between gap-4">
            <span class="text-sm font-medium text-foreground">{{ t("SetBase.ui.allowExceptionSites") }}</span>
            <Switch v-model="configStore.contentScript.allowExceptionSites" />
          </label>
        </div>

        <Separator />

        <div class="space-y-3">
          <div class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {{ t("SetBase.ui.sidebarStyle") }}
          </div>
          <label class="flex cursor-pointer items-center justify-between gap-4">
            <span class="text-sm font-medium text-foreground">
              {{ t("SetBase.ui.respondDisplayMode") }}{{ t("SetBase.ui.displayMode.index") }}
            </span>
            <Switch v-model="configStore.contentScript.applyTheme" />
          </label>
          <label class="flex cursor-pointer items-center justify-between gap-4">
            <span class="text-sm font-medium text-foreground">{{ t("SetBase.ui.expandByDefault") }}</span>
            <Switch v-model="configStore.contentScript.defaultOpenSpeedDial" />
          </label>
          <label class="flex cursor-pointer items-center justify-between gap-4">
            <span class="text-sm font-medium text-foreground">{{ t("SetBase.ui.enableFadeEffect") }}</span>
            <Switch v-model="configStore.contentScript.fadeEnterStyle" />
          </label>
        </div>

        <Separator />

        <div class="space-y-3">
          <div class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {{ t("SetBase.ui.sidebarFunctions") }}
          </div>
          <label class="flex cursor-pointer items-center justify-between gap-4">
            <span class="text-sm font-medium text-foreground">{{ t("SetBase.ui.confirmTwoStep") }}</span>
            <Switch v-model="configStore.contentScript.doubleConfirmAction" />
          </label>
          <div class="flex items-start justify-between gap-4">
            <div class="space-y-0.5">
              <div class="text-sm font-medium text-foreground">{{ t("SetBase.ui.allowDragLink") }}</div>
              <p class="text-xs text-muted-foreground">{{ t("SetBase.ui.dragNote") }}</p>
            </div>
            <Switch v-model="configStore.contentScript.dragLinkOnSpeedDial" />
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
