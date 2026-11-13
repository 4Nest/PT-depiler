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
  Alert,
  Button,
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
  <div class="space-y-5">
    <!-- 用户数据刷新 -->
    <Card>
      <CardHeader>
        <CardTitle>{{ t("SetBase.userInfo.userDataRefresh") }}</CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Label for="userinfo-concurrency">{{ t("userInfo.queueConcurrency") }}</Label>
          <Input
            id="userinfo-concurrency"
            v-model.number="configStore.userInfo.queueConcurrency"
            type="number"
            :min="1"
            :max="25"
            class="w-full tabular-nums sm:w-32"
          />
        </div>

        <Separator />

        <label class="flex cursor-pointer items-center justify-between gap-4">
          <span class="text-sm font-medium text-foreground">{{ t("userInfo.alwaysPickLastUserInfo") }}</span>
          <Switch v-model="configStore.userInfo.alwaysPickLastUserInfo" />
        </label>

        <Separator />

        <!-- 自动刷新 -->
        <div class="space-y-3">
          <label class="flex cursor-pointer items-center justify-between gap-4">
            <span class="text-sm font-medium text-foreground">{{ t("userInfo.enableAutoRefresh") }}</span>
            <Switch v-model="configStore.userInfo.autoReflush.enabled" />
          </label>

          <Alert v-if="configStore.userInfo.autoReflush.enabled" variant="info" class="space-y-2.5">
            <div class="flex flex-wrap items-center gap-2 text-xs text-foreground">
              <span>• {{ t("SetBase.userInfo.afterTime") }}</span>
              <Input
                v-model="configStore.userInfo.autoReflush.afterTime"
                type="time"
                class="h-7 w-28 px-2 text-xs tabular-nums"
              />
              <span>{{ t("userInfo.autoRefresh.every") }}</span>
              <Select
                :model-value="String(configStore.userInfo.autoReflush.interval)"
                @update:model-value="(v) => (configStore.userInfo.autoReflush.interval = Number(v))"
              >
                <SelectTrigger class="h-7 w-20 text-xs tabular-nums">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="n in range(1, 24)" :key="n" :value="String(n)">{{ n }}</SelectItem>
                </SelectContent>
              </Select>
              <span>{{ t("userInfo.autoRefresh.hoursLabel") }}</span>
              <strong class="font-semibold">{{ t("userInfo.autoRefresh.unrefreshedSite") }}</strong>
              <span>{{ t("userInfo.autoRefresh.ofSites") }}</span>
            </div>

            <div class="flex flex-wrap items-center gap-2 text-xs text-foreground">
              <span>• {{ t("userInfo.autoRefresh.retryOnFail") }}</span>
              <Select
                :model-value="String(configStore.userInfo.autoReflush.retry.max)"
                @update:model-value="(v) => (configStore.userInfo.autoReflush.retry.max = Number(v))"
              >
                <SelectTrigger class="h-7 w-18 text-xs tabular-nums">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="n in range(0, 6)" :key="n" :value="String(n)">{{ n }}</SelectItem>
                </SelectContent>
              </Select>
              <span>{{ t("userInfo.autoRefresh.times") }}</span>
              <Select
                :model-value="String(configStore.userInfo.autoReflush.retry.interval)"
                @update:model-value="(v) => (configStore.userInfo.autoReflush.retry.interval = Number(v))"
              >
                <SelectTrigger class="h-7 w-18 text-xs tabular-nums">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="n in range(1, 11)" :key="n" :value="String(n)">{{ n }}</SelectItem>
                </SelectContent>
              </Select>
              <span>{{ t("userInfo.autoRefresh.minutes") }}</span>
            </div>

            <div
              class="flex flex-wrap items-center justify-end gap-3 pt-1 text-[11px] text-muted-foreground tabular-nums"
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
          </Alert>
        </div>

        <Separator />

        <!-- 自动延长 Cookies -->
        <div class="space-y-3">
          <label class="flex cursor-pointer items-center justify-between gap-4">
            <span class="text-sm font-medium text-foreground">{{ t("userInfo.autoExtendCookies.enabled") }}</span>
            <Switch v-model="configStore.autoExtendCookies.enabled" />
          </label>

          <Alert v-if="configStore.autoExtendCookies.enabled" variant="info">
            <div class="flex flex-wrap items-center gap-2 text-xs text-foreground">
              <span>{{ t("userInfo.autoExtendCookies.triggerThreshold") }}:</span>
              <Select
                :model-value="String(configStore.autoExtendCookies.triggerThreshold)"
                @update:model-value="(v) => (configStore.autoExtendCookies.triggerThreshold = Number(v))"
              >
                <SelectTrigger class="h-7 w-18 text-xs tabular-nums">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="n in range(1, 4)" :key="n" :value="String(n)">{{ n }}</SelectItem>
                </SelectContent>
              </Select>
              <span>{{ t("userInfo.autoExtendCookies.weeks") }}</span>
              <span>{{ t("userInfo.autoExtendCookies.extensionDuration") }}:</span>
              <Select
                :model-value="String(configStore.autoExtendCookies.extensionDuration)"
                @update:model-value="(v) => (configStore.autoExtendCookies.extensionDuration = Number(v))"
              >
                <SelectTrigger class="h-7 w-18 text-xs tabular-nums">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="n in range(1, 13)" :key="n" :value="String(n)">{{ n }}</SelectItem>
                </SelectContent>
              </Select>
              <span>{{ t("userInfo.autoExtendCookies.months") }}</span>
            </div>
          </Alert>
        </div>
      </CardContent>
    </Card>

    <!-- 用户信息展示 -->
    <Card>
      <CardHeader>
        <CardTitle>{{ t("SetBase.userInfo.userInfoDisplay") }}</CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
        <label class="flex cursor-pointer items-center justify-between gap-4">
          <span class="text-sm font-medium text-foreground">{{ t("userInfo.showDeadSite") }}</span>
          <Switch v-model="configStore.userInfo.showDeadSiteInOverview" />
        </label>

        <Separator />

        <label class="flex cursor-pointer items-center justify-between gap-4">
          <span class="text-sm font-medium text-foreground">{{ t("userInfo.showPassedSite") }}</span>
          <Switch v-model="configStore.userInfo.showPassedSiteInOverview" />
        </label>
      </CardContent>
    </Card>
  </div>
</template>
