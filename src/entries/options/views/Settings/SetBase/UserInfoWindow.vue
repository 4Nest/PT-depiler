<script setup lang="ts">
import { onMounted, ref } from "vue";
import { range } from "es-toolkit";
import { useI18n } from "vue-i18n";
import { RefreshCw } from "lucide-vue-next";

import { EJobType } from "@/background/utils/alarms.ts";
import { useConfigStore } from "@/options/stores/config.ts";
import { useMetadataStore } from "@/options/stores/metadata.ts";
import { formatDate } from "@/options/utils.ts";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Tooltip,
} from "~/components/ui";

const { t } = useI18n();
const configStore = useConfigStore();
const metadataStore = useMetadataStore();

const nextFlushUserInfoAt = ref<number>(0);

async function getNextFlushUserInfoAt() {
  const alarm = await chrome.alarms.get(EJobType.FlushUserInfo);
  if (alarm) {
    nextFlushUserInfoAt.value = alarm.scheduledTime;
  }
}

async function save() {
  if (configStore.userInfo.autoReflush.enabled) {
    void getNextFlushUserInfoAt();
  } else {
    nextFlushUserInfoAt.value = 0;
  }
}

defineExpose({
  afterSave: save,
});

onMounted(async () => {
  void getNextFlushUserInfoAt();
});
</script>

<template>
  <div class="space-y-6">
    <!-- 用户数据刷新 -->
    <section class="space-y-2">
      <h2 class="px-1 text-xs font-medium text-muted-foreground">{{ t("SetBase.userInfo.userDataRefresh") }}</h2>
      <div class="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xs">
        <div class="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <Label for="userinfo-concurrency" class="text-sm font-medium text-foreground">
            {{ t("userInfo.queueConcurrency") }}
          </Label>
          <Input
            id="userinfo-concurrency"
            v-model.number="configStore.userInfo.queueConcurrency"
            type="number"
            :min="1"
            :max="25"
            class="w-full tabular-nums sm:w-28"
          />
        </div>

        <label
          class="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/25"
        >
          <span class="text-sm font-medium text-foreground">{{ t("userInfo.alwaysPickLastUserInfo") }}</span>
          <Switch v-model="configStore.userInfo.alwaysPickLastUserInfo" />
        </label>

        <!-- 自动刷新 -->
        <div>
          <label
            class="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/25"
          >
            <span class="text-sm font-medium text-foreground">{{ t("userInfo.enableAutoRefresh") }}</span>
            <Switch v-model="configStore.userInfo.autoReflush.enabled" />
          </label>

          <div
            v-if="configStore.userInfo.autoReflush.enabled"
            class="space-y-2.5 border-t border-border/50 bg-muted/25 px-4 py-3"
          >
            <div class="flex flex-wrap items-center gap-2 text-xs text-foreground">
              <span class="text-muted-foreground">{{ t("SetBase.userInfo.afterTime") }}</span>
              <Input
                v-model="configStore.userInfo.autoReflush.afterTime"
                type="time"
                class="h-7 w-28 bg-background px-2 text-xs tabular-nums"
              />
              <span class="text-muted-foreground">{{ t("userInfo.autoRefresh.every") }}</span>
              <Select
                :model-value="String(configStore.userInfo.autoReflush.interval)"
                @update:model-value="(v) => (configStore.userInfo.autoReflush.interval = Number(v))"
              >
                <SelectTrigger class="h-7 w-18 bg-background text-xs tabular-nums">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="n in range(1, 24)" :key="n" :value="String(n)">{{ n }}</SelectItem>
                </SelectContent>
              </Select>
              <span class="text-muted-foreground">{{ t("userInfo.autoRefresh.hoursLabel") }}</span>
              <strong class="font-medium text-foreground">{{ t("userInfo.autoRefresh.unrefreshedSite") }}</strong>
              <span class="text-muted-foreground">{{ t("userInfo.autoRefresh.ofSites") }}</span>
            </div>

            <div class="flex flex-wrap items-center gap-2 text-xs text-foreground">
              <span class="text-muted-foreground">{{ t("userInfo.autoRefresh.retryOnFail") }}</span>
              <Select
                :model-value="String(configStore.userInfo.autoReflush.retry.max)"
                @update:model-value="(v) => (configStore.userInfo.autoReflush.retry.max = Number(v))"
              >
                <SelectTrigger class="h-7 w-16 bg-background text-xs tabular-nums">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="n in range(0, 6)" :key="n" :value="String(n)">{{ n }}</SelectItem>
                </SelectContent>
              </Select>
              <span class="text-muted-foreground">{{ t("userInfo.autoRefresh.times") }}</span>
              <Select
                :model-value="String(configStore.userInfo.autoReflush.retry.interval)"
                @update:model-value="(v) => (configStore.userInfo.autoReflush.retry.interval = Number(v))"
              >
                <SelectTrigger class="h-7 w-16 bg-background text-xs tabular-nums">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="n in range(1, 11)" :key="n" :value="String(n)">{{ n }}</SelectItem>
                </SelectContent>
              </Select>
              <span class="text-muted-foreground">{{ t("userInfo.autoRefresh.minutes") }}</span>
            </div>

            <div
              class="flex flex-wrap items-center justify-end gap-3 pt-0.5 text-[11px] text-muted-foreground tabular-nums"
            >
              <span>
                {{ t("userInfo.autoRefresh.lastFlushTime") }}
                {{ formatDate(metadataStore.lastUserInfoAutoFlushAt) }}
              </span>
              <span>
                {{ t("userInfo.autoRefresh.nextFlushTime") }}
                {{ nextFlushUserInfoAt != 0 ? formatDate(nextFlushUserInfoAt) : "-" }}
              </span>
              <Tooltip :content="t('userInfo.autoRefresh.getNextFlushTime')" side="top">
                <Button variant="ghost" size="icon-xs" @click="getNextFlushUserInfoAt">
                  <RefreshCw class="size-3" />
                </Button>
              </Tooltip>
            </div>
          </div>
        </div>

        <!-- 自动延长 Cookies -->
        <div>
          <label
            class="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/25"
          >
            <span class="text-sm font-medium text-foreground">{{ t("userInfo.autoExtendCookies.enabled") }}</span>
            <Switch v-model="configStore.autoExtendCookies.enabled" />
          </label>

          <div v-if="configStore.autoExtendCookies.enabled" class="border-t border-border/50 bg-muted/25 px-4 py-3">
            <div class="flex flex-wrap items-center gap-2 text-xs text-foreground">
              <span class="text-muted-foreground">{{ t("userInfo.autoExtendCookies.triggerThreshold") }}:</span>
              <Select
                :model-value="String(configStore.autoExtendCookies.triggerThreshold)"
                @update:model-value="(v) => (configStore.autoExtendCookies.triggerThreshold = Number(v))"
              >
                <SelectTrigger class="h-7 w-16 bg-background text-xs tabular-nums">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="n in range(1, 4)" :key="n" :value="String(n)">{{ n }}</SelectItem>
                </SelectContent>
              </Select>
              <span class="text-muted-foreground">{{ t("userInfo.autoExtendCookies.weeks") }}</span>
              <span class="text-muted-foreground">{{ t("userInfo.autoExtendCookies.extensionDuration") }}:</span>
              <Select
                :model-value="String(configStore.autoExtendCookies.extensionDuration)"
                @update:model-value="(v) => (configStore.autoExtendCookies.extensionDuration = Number(v))"
              >
                <SelectTrigger class="h-7 w-16 bg-background text-xs tabular-nums">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="n in range(1, 13)" :key="n" :value="String(n)">{{ n }}</SelectItem>
                </SelectContent>
              </Select>
              <span class="text-muted-foreground">{{ t("userInfo.autoExtendCookies.months") }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 用户信息展示 -->
    <section class="space-y-2">
      <h2 class="px-1 text-xs font-medium text-muted-foreground">{{ t("SetBase.userInfo.userInfoDisplay") }}</h2>
      <div class="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xs">
        <label
          class="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/25"
        >
          <span class="text-sm font-medium text-foreground">{{ t("userInfo.showDeadSite") }}</span>
          <Switch v-model="configStore.userInfo.showDeadSiteInOverview" />
        </label>

        <label
          class="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/25"
        >
          <span class="text-sm font-medium text-foreground">{{ t("userInfo.showPassedSite") }}</span>
          <Switch v-model="configStore.userInfo.showPassedSiteInOverview" />
        </label>
      </div>
    </section>
  </div>
</template>
