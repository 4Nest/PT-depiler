<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { isEmpty } from "es-toolkit/compat";

import { useConfigStore } from "@/options/stores/config.ts";
import { useMetadataStore } from "@/options/stores/metadata.ts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Switch,
  Textarea,
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
  <div class="space-y-5">
    <!-- 站点搜索配置 -->
    <Card>
      <CardHeader>
        <CardTitle>{{ t("SetBase.searchEntity.siteSearchConfig") }}</CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Label for="search-concurrency">{{ t("SetBase.searchEntity.siteQueueConcurrency") }}</Label>
          <Input
            id="search-concurrency"
            v-model.number="configStore.searchEntity.queueConcurrency"
            type="number"
            :min="1"
            :max="25"
            class="w-full tabular-nums sm:w-32"
          />
        </div>

        <Separator />

        <div class="space-y-3">
          <div class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {{ t("SetBase.searchEntity.searchPlanLabel") }}
          </div>
          <label
            class="flex cursor-pointer items-center justify-between gap-4"
            :class="{ 'cursor-not-allowed opacity-55': isEmpty(metadataStore.sites) }"
          >
            <span class="text-sm font-medium text-foreground">{{
              t("SetBase.searchEntity.allowSingleSiteSearch")
            }}</span>
            <Switch v-model="configStore.searchEntity.allowSingleSiteSearch" :disabled="isEmpty(metadataStore.sites)" />
          </label>
          <div class="flex items-start justify-between gap-4">
            <div class="space-y-0.5">
              <div class="text-sm font-medium text-foreground">
                {{ t("SetBase.searchEntity.treatTTQueryAsImdbSearch") }}
              </div>
              <p class="text-xs text-muted-foreground">{{ t("SetBase.searchEntity.imdbTip") }}</p>
            </div>
            <Switch v-model="configStore.searchEntity.treatTTQueryAsImdbSearch" />
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 结果筛选 -->
    <Card>
      <CardHeader>
        <CardTitle>{{ t("SetBase.searchEntity.filterLabel") }}</CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
        <label class="flex cursor-pointer items-center justify-between gap-4">
          <span class="text-sm font-medium text-foreground">{{ t("SetBase.searchEntity.saveLastSearchFilter") }}</span>
          <Switch v-model="configStore.searchEntity.saveLastFilter" @update:model-value="(v) => clearLastFilter(v)" />
        </label>

        <Separator />

        <label class="flex cursor-pointer items-center justify-between gap-4">
          <span class="text-sm font-medium text-foreground">{{
            t("SetBase.searchEntity.forceImdbIdMatchFilter")
          }}</span>
          <Switch v-model="configStore.searchEntity.forceImdbIdMatchFilter" />
        </label>

        <Separator />

        <label class="flex cursor-pointer items-center justify-between gap-4">
          <span class="text-sm font-medium text-foreground">{{ t("SetBase.searchEntity.quickSiteFilter") }}</span>
          <Switch v-model="configStore.searchEntity.quickSiteFilter" />
        </label>
      </CardContent>
    </Card>

    <!-- 标签与优惠展示 -->
    <Card>
      <CardHeader>
        <CardTitle>{{ t("SetBase.searchEntity.tagLabel") }}</CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-1.5">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span class="text-sm font-medium text-foreground">{{ t("SetBase.searchEntity.promotionDisplay") }}</span>
            <Select v-model="configStore.searchEntifyControl.promotionDisplay">
              <SelectTrigger class="w-full sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="opt in promotionDisplayOptions" :key="opt.value" :value="opt.value">
                  {{ opt.title }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p class="text-xs text-muted-foreground">{{ t("SetBase.searchEntity.promotionDisplayMessage") }}</p>
        </div>

        <Separator />

        <label class="flex cursor-pointer items-center justify-between gap-4">
          <span class="text-sm font-medium text-foreground">{{
            t("SetBase.searchEntity.autoDetectOfficialGroupFromTitle")
          }}</span>
          <Switch v-model="configStore.searchEntity.autoDetectOfficialGroupFromTitle" />
        </label>

        <Separator />

        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Label for="max-tag-count">{{ t("SetBase.searchEntity.maxTagCountBeforeGroup") }}</Label>
          <Input
            id="max-tag-count"
            v-model.number="configStore.searchEntifyControl.maxTagCountBeforeGroup"
            type="number"
            :min="0"
            :max="50"
            class="w-full tabular-nums sm:w-32"
          />
        </div>

        <Separator />

        <div class="space-y-1.5">
          <Label for="hidden-tag-names">{{ t("SetBase.searchEntity.hiddenTagNames") }}</Label>
          <Textarea id="hidden-tag-names" v-model="hiddenTagNamesText" :rows="5" class="font-mono text-xs" />
          <p class="text-xs text-muted-foreground">{{ t("SetBase.searchEntity.hiddenTagNamesMessage") }}</p>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
