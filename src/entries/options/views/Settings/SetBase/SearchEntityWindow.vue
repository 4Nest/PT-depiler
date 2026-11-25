<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { isEmpty } from "es-toolkit/compat";
import { HelpCircle } from "lucide-vue-next";

import { useConfigStore } from "@/options/stores/config.ts";
import { useMetadataStore } from "@/options/stores/metadata.ts";
import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
  Tooltip,
} from "~/components/ui";

const { t } = useI18n();
const configStore = useConfigStore();
const metadataStore = useMetadataStore();

async function clearLastFilter(v: boolean) {
  if (!v) {
    await metadataStore.setLastSearchFilter("");
  }
}

const hiddenTagNamesText = computed({
  get: () => configStore.searchEntifyControl.hiddenTagNames.join("\n"),
  set: (val: string) => {
    configStore.searchEntifyControl.hiddenTagNames = val
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  },
});

const promotionDisplayOptions = computed(() => [
  { title: t("SetBase.searchEntity.promotionDisplayOptions.none"), value: "none" },
  { title: t("SetBase.searchEntity.promotionDisplayOptions.tags"), value: "tags" },
  { title: t("SetBase.searchEntity.promotionDisplayOptions.factor"), value: "factor" },
  { title: t("SetBase.searchEntity.promotionDisplayOptions.both"), value: "both" },
]);
</script>

<template>
  <div class="space-y-6">
    <!-- 站点搜索配置 -->
    <section class="space-y-2">
      <h2 class="px-1 text-xs font-medium text-muted-foreground">{{ t("SetBase.searchEntity.siteSearchConfig") }}</h2>
      <div class="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xs">
        <div class="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <Label for="search-concurrency" class="text-sm font-medium text-foreground">
            {{ t("SetBase.searchEntity.siteQueueConcurrency") }}
          </Label>
          <Input
            id="search-concurrency"
            v-model.number="configStore.searchEntity.queueConcurrency"
            type="number"
            :min="1"
            :max="25"
            class="w-full tabular-nums sm:w-28"
          />
        </div>

        <label
          class="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/25"
          :class="{ 'cursor-not-allowed opacity-55 hover:bg-transparent': isEmpty(metadataStore.sites) }"
        >
          <span class="text-sm font-medium text-foreground">{{ t("SetBase.searchEntity.allowSingleSiteSearch") }}</span>
          <Switch v-model="configStore.searchEntity.allowSingleSiteSearch" :disabled="isEmpty(metadataStore.sites)" />
        </label>

        <div class="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/25">
          <div class="flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground">
            <span>{{ t("SetBase.searchEntity.treatTTQueryAsImdbSearch") }}</span>
            <Tooltip :content="t('SetBase.searchEntity.imdbTip')" side="top">
              <HelpCircle class="size-3.5 shrink-0 text-muted-foreground/75" />
            </Tooltip>
          </div>
          <Switch v-model="configStore.searchEntity.treatTTQueryAsImdbSearch" />
        </div>
      </div>
    </section>

    <!-- 结果筛选 -->
    <section class="space-y-2">
      <h2 class="px-1 text-xs font-medium text-muted-foreground">{{ t("SetBase.searchEntity.filterLabel") }}</h2>
      <div class="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xs">
        <label
          class="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/25"
        >
          <span class="text-sm font-medium text-foreground">{{ t("SetBase.searchEntity.saveLastSearchFilter") }}</span>
          <Switch v-model="configStore.searchEntity.saveLastFilter" @update:model-value="(v) => clearLastFilter(v)" />
        </label>

        <label
          class="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/25"
        >
          <span class="text-sm font-medium text-foreground">{{
            t("SetBase.searchEntity.forceImdbIdMatchFilter")
          }}</span>
          <Switch v-model="configStore.searchEntity.forceImdbIdMatchFilter" />
        </label>

        <label
          class="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/25"
        >
          <span class="text-sm font-medium text-foreground">{{ t("SetBase.searchEntity.quickSiteFilter") }}</span>
          <Switch v-model="configStore.searchEntity.quickSiteFilter" />
        </label>
      </div>
    </section>

    <!-- 标签与优惠展示 -->
    <section class="space-y-2">
      <h2 class="px-1 text-xs font-medium text-muted-foreground">{{ t("SetBase.searchEntity.tagLabel") }}</h2>
      <div class="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xs">
        <div class="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex min-w-0 items-center gap-1.5">
            <span class="text-sm font-medium text-foreground">{{ t("SetBase.searchEntity.promotionDisplay") }}</span>
            <Tooltip :content="t('SetBase.searchEntity.promotionDisplayMessage')" side="top">
              <HelpCircle class="size-3.5 shrink-0 text-muted-foreground/75" />
            </Tooltip>
          </div>
          <Select v-model="configStore.searchEntifyControl.promotionDisplay">
            <SelectTrigger class="w-full sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="opt in promotionDisplayOptions" :key="opt.value" :value="opt.value">
                {{ opt.title }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <label
          class="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/25"
        >
          <span class="text-sm font-medium text-foreground">{{
            t("SetBase.searchEntity.autoDetectOfficialGroupFromTitle")
          }}</span>
          <Switch v-model="configStore.searchEntity.autoDetectOfficialGroupFromTitle" />
        </label>

        <div class="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <Label for="max-tag-count" class="text-sm font-medium text-foreground">
            {{ t("SetBase.searchEntity.maxTagCountBeforeGroup") }}
          </Label>
          <Input
            id="max-tag-count"
            v-model.number="configStore.searchEntifyControl.maxTagCountBeforeGroup"
            type="number"
            :min="0"
            :max="50"
            class="w-full tabular-nums sm:w-28"
          />
        </div>

        <div class="space-y-2 px-4 py-3.5">
          <div class="flex items-center gap-1.5">
            <Label for="hidden-tag-names" class="text-sm font-medium text-foreground">
              {{ t("SetBase.searchEntity.hiddenTagNames") }}
            </Label>
            <Tooltip :content="t('SetBase.searchEntity.hiddenTagNamesMessage')" side="top">
              <HelpCircle class="size-3.5 shrink-0 text-muted-foreground/75" />
            </Tooltip>
          </div>
          <Textarea id="hidden-tag-names" v-model="hiddenTagNamesText" :rows="4" class="font-mono text-xs" />
        </div>
      </div>
    </section>
  </div>
</template>
