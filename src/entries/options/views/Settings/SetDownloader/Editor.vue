<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { computedAsync } from "@vueuse/core";
import { Eye, EyeOff, RotateCcw } from "lucide-vue-next";

import { type IDownloaderMetadata } from "@/shared/types.ts";
import { getDownloader, getDownloaderIcon, getDownloaderMetaData, type TorrentClientMetaData } from "@ptd/downloader";
import { formatDate } from "@/options/utils.ts";
import { cn, isValidUrl } from "~/lib/utils";

import ConnectCheckButton from "@/options/components/ConnectCheckButton.vue";
import { Accordion, Alert, Button, Input, Label, Separator, Slider, Switch } from "~/components/ui";

const { t } = useI18n();

const clientConfig = defineModel<IDownloaderMetadata>();
const emits = defineEmits<{
  (e: "update:configValid", value: boolean): void;
}>();

const clientMeta = computedAsync<TorrentClientMetaData>(
  async () =>
    clientConfig.value?.type ? await getDownloaderMetaData(clientConfig.value.type) : ({} as TorrentClientMetaData),
  {} as TorrentClientMetaData,
);

watch(
  clientConfig,
  (cfg) => {
    if (cfg) {
      cfg.feature ??= {};
      cfg.advanceAddTorrentOptions ??= {};
    }
  },
  { immediate: true },
);

const showPassword = ref<boolean>(false);

const isNameValid = computed(() => Boolean(clientConfig.value?.name?.trim()));
const isAddressValid = computed(() => isValidUrl(clientConfig.value?.address));
const isSortIndexValid = computed(() => {
  const v = clientConfig.value?.sortIndex;
  return v !== undefined && v !== null && !Number.isNaN(Number(v));
});

const formValid = computed<boolean>(
  () => Boolean(clientConfig.value) && isNameValid.value && isAddressValid.value && isSortIndexValid.value,
);

watch(
  formValid,
  (val) => {
    emits("update:configValid", val);
  },
  { immediate: true },
);

const sortIndexModel = computed({
  get: () => clientConfig.value?.sortIndex ?? 100,
  set: (v: string | number) => {
    if (!clientConfig.value) return;
    const num = Number(v);
    clientConfig.value.sortIndex = Number.isFinite(num) ? num : 0;
  },
});

const timeoutModel = computed<number>({
  get: () => clientConfig.value?.timeout ?? 60e3,
  set: (v: number) => {
    if (!clientConfig.value) return;
    clientConfig.value.timeout = v;
  },
});

const advanceAccordionItems = computed(() => {
  const opts = clientMeta.value?.advanceAddTorrentOptions;
  if (!opts?.length) return [];
  return [
    {
      value: "advanced",
      title: t("common.advancedSettings"),
      badge: opts.length,
    },
  ];
});

async function checkConnect() {
  if (formValid.value && clientConfig.value) {
    const client = await getDownloader(clientConfig.value);
    return await client.ping();
  }
  return false;
}
</script>

<template>
  <div v-if="clientConfig" class="space-y-4">
    <!-- 基本信息 -->
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-12">
      <div class="space-y-1.5 sm:col-span-3">
        <Label>{{ t("common.type") }}</Label>
        <div
          class="flex h-8.5 items-center gap-2 rounded-md border border-input bg-muted/40 px-2.5 text-sm text-muted-foreground"
        >
          <img
            :src="getDownloaderIcon(clientConfig.type)"
            :alt="clientConfig.type"
            class="size-4 rounded-xs object-contain"
          />
          <span class="truncate font-medium text-foreground">{{ clientConfig.type }}</span>
        </div>
      </div>

      <div class="space-y-1.5 sm:col-span-4">
        <Label for="dl-name">
          {{ t("SetDownloader.common.name") }}
          <span class="text-destructive">*</span>
        </Label>
        <Input
          id="dl-name"
          v-model="clientConfig.name"
          :placeholder="t('SetDownloader.common.name')"
          :class="!isNameValid ? 'border-destructive focus-visible:ring-destructive/30' : ''"
        />
        <p v-if="!isNameValid" class="text-[11px] text-destructive">
          {{ t("SetDownloader.editor.nameTip") }}
        </p>
      </div>

      <div class="space-y-1.5 sm:col-span-3">
        <Label for="dl-uid">{{ t("SetDownloader.common.uid") }}</Label>
        <Input
          id="dl-uid"
          :model-value="clientConfig.id"
          disabled
          :placeholder="t('SetDownloader.editor.uidPlaceholder')"
          class="font-mono text-xs"
        />
      </div>

      <div class="space-y-1.5 sm:col-span-2">
        <Label for="dl-sort-index">{{ t("common.sortIndex") }}</Label>
        <Input id="dl-sort-index" v-model="sortIndexModel" type="number" class="tabular-nums" />
      </div>
    </div>

    <Separator />

    <!-- 连接与认证 -->
    <div class="space-y-3">
      <div class="space-y-1.5">
        <Label for="dl-address">
          {{ t("SetDownloader.common.address") }}
          <span class="text-destructive">*</span>
        </Label>
        <Input
          id="dl-address"
          v-model="clientConfig.address"
          :placeholder="t('SetDownloader.editor.addressTip')"
          :class="
            cn('font-mono text-xs', !isAddressValid ? 'border-destructive focus-visible:ring-destructive/30' : '')
          "
        />
        <p v-if="!isAddressValid" class="text-[11px] text-destructive">
          {{ t("SetDownloader.editor.addressTip") }}
        </p>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div v-if="typeof clientConfig.username !== 'undefined'" class="space-y-1.5">
          <Label for="dl-username">{{ t("common.username") }}</Label>
          <Input id="dl-username" v-model="clientConfig.username" autocomplete="off" />
        </div>

        <div :class="typeof clientConfig.username !== 'undefined' ? 'space-y-1.5' : 'space-y-1.5 sm:col-span-2'">
          <Label for="dl-password">{{ t("SetDownloader.editor.password") }}</Label>
          <div class="relative">
            <Input
              id="dl-password"
              v-model="clientConfig.password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="new-password"
              class="pr-9"
            />
            <button
              type="button"
              tabindex="-1"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              @click="showPassword = !showPassword"
            >
              <Eye v-if="showPassword" class="size-3.5" />
              <EyeOff v-else class="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div class="space-y-1.5 rounded-lg border border-border bg-muted/20 p-3">
        <div class="flex items-center justify-between gap-2">
          <Label class="text-xs font-medium">{{ t("SetDownloader.editor.timeout") }}</Label>
          <Button
            type="button"
            variant="outline"
            size="xs"
            class="h-6 gap-1 px-2 font-mono text-[11px] tabular-nums"
            @click="clientConfig.timeout = 60e3"
          >
            <RotateCcw class="size-2.5 text-muted-foreground" />
            {{ formatDate(timeoutModel, "mm:ss") }}
          </Button>
        </div>
        <Slider v-model="timeoutModel" :min="0" :max="10 * 60e3" :step="1e3" />
      </div>
    </div>

    <!-- 行为开关 -->
    <div
      v-if="clientMeta?.feature?.DefaultAutoStart?.allowed || clientMeta?.feature?.BypassCSRF?.allowed"
      class="space-y-2"
    >
      <div
        v-if="clientMeta?.feature?.DefaultAutoStart?.allowed"
        class="flex items-center justify-between gap-3 rounded-lg border border-border px-3.5 py-2.5"
      >
        <Label for="dl-auto-start" class="cursor-pointer text-xs font-medium">
          {{ t("SetDownloader.editor.autoStart") }}
        </Label>
        <Switch id="dl-auto-start" v-model="clientConfig.feature!.DefaultAutoStart" />
      </div>

      <div
        v-if="clientMeta?.feature?.BypassCSRF?.allowed"
        class="flex items-start justify-between gap-3 rounded-lg border border-border px-3.5 py-2.5"
      >
        <div class="space-y-0.5">
          <Label for="dl-bypass-csrf" class="cursor-pointer text-xs font-medium"> 绕过 CSRF 保护 </Label>
          <p class="text-[11px] leading-relaxed text-muted-foreground">
            移除请求的 Origin 头以绕过 qBittorrent 的跨站请求伪造(CSRF)校验，开启后无需在 qBittorrent 中关闭 CSRF 保护
          </p>
        </div>
        <Switch id="dl-bypass-csrf" v-model="clientConfig.feature!.BypassCSRF" class="mt-0.5" />
      </div>
    </div>

    <!-- 高级添加选项 -->
    <Accordion v-if="advanceAccordionItems.length > 0" :items="advanceAccordionItems">
      <template #advanced>
        <div class="space-y-2.5">
          <div
            v-for="opt in clientMeta.advanceAddTorrentOptions"
            :key="opt.key"
            class="rounded-md border border-border/70 bg-muted/20 px-3 py-2"
          >
            <div v-if="opt.type === 'boolean'" class="flex items-start justify-between gap-3">
              <div class="space-y-0.5">
                <Label :for="`adv-${opt.key}`" class="cursor-pointer text-xs font-medium">{{ opt.name }}</Label>
                <p v-if="opt.description" class="text-[11px] text-muted-foreground">{{ opt.description }}</p>
              </div>
              <Switch :id="`adv-${opt.key}`" v-model="clientConfig.advanceAddTorrentOptions![opt.key]" />
            </div>
            <div v-else class="space-y-1.5">
              <Label :for="`adv-${opt.key}`" class="text-xs font-medium">{{ opt.name }}</Label>
              <Input
                :id="`adv-${opt.key}`"
                v-model="clientConfig.advanceAddTorrentOptions![opt.key]"
                :type="opt.type === 'number' ? 'number' : 'text'"
              />
              <p v-if="opt.description" class="text-[11px] text-muted-foreground">{{ opt.description }}</p>
            </div>
          </div>
        </div>
      </template>
    </Accordion>

    <!-- 连接测试 -->
    <ConnectCheckButton
      :check-fn="checkConnect"
      :reset-timeout="3000"
      @after:check-connect="() => emits('update:configValid', formValid)"
    />

    <!-- 客户端注意事项 -->
    <Alert v-if="clientMeta?.warning?.length" variant="warning">
      <ul class="list-disc space-y-1 pl-4">
        <li v-for="(data, index) in clientMeta.warning" :key="index">{{ data }}</li>
      </ul>
    </Alert>
  </div>
</template>
