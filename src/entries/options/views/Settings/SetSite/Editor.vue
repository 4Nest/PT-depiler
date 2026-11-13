<script setup lang="ts">
import { watch, ref, reactive, onMounted, inject, computed, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { set } from "es-toolkit/compat";
import { toMerged } from "es-toolkit";
import type { timezoneOffset, ISiteUserConfig, TSiteID, ISiteMetadata, TSiteUrl } from "@ptd/site";
import { ExternalLink, Eye, EyeOff, Info, KeyRound, RotateCcw } from "lucide-vue-next";

import { useMetadataStore } from "@/options/stores/metadata.ts";
import { useConfigStore } from "@/options/stores/config.ts";
import { formatDate } from "@/options/utils.ts";
import { cn, isValidUrl } from "~/lib/utils";
import {
  Alert,
  Badge,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Slider,
  Switch,
  TagsInput,
  Tooltip,
} from "~/components/ui";

const { t } = useI18n();
const metadataStore = useMetadataStore();
const configStore = useConfigStore();

const siteId = defineModel<TSiteID>({ default: "" });
const emit = defineEmits<{
  (e: "update:formValid", v: boolean): void;
}>();

const siteMetaData = ref<ISiteMetadata>({} as unknown as ISiteMetadata);
const siteUserConfig = inject<Ref<ISiteUserConfig>>("storedSiteUserConfig", ref({}));

const urlMode = ref<"preset" | "custom">("preset");
const customSiteUrl = ref<string>("");
const secretVisibleMap = reactive<Record<string, boolean>>({});
const isLoading = ref(false);

const siteName = computed({
  get: () => siteUserConfig.value.merge?.name ?? siteMetaData.value.name ?? "",
  set: (value: string) => set(siteUserConfig.value, "merge.name", value),
});

const sortIndexValue = computed({
  get: () => siteUserConfig.value.sortIndex ?? 100,
  set: (value: string | number) => {
    const num = Number(value);
    siteUserConfig.value.sortIndex = Number.isFinite(num) ? num : 0;
  },
});

const groupsValue = computed<string[]>({
  get: () => siteUserConfig.value.groups ?? [],
  set: (val: string[]) => {
    siteUserConfig.value.groups = val;
  },
});

const siteTimezoneOffset = computed<string>({
  get: () => siteUserConfig.value.merge?.timezoneOffset ?? siteMetaData.value.timezoneOffset ?? "+0000",
  set: (value: string) => set(siteUserConfig.value, "merge.timezoneOffset", value as timezoneOffset),
});

const timeoutValue = computed<number>({
  get: () => siteUserConfig.value.timeout ?? 30e3,
  set: (val: number) => {
    siteUserConfig.value.timeout = val;
  },
});

const downloadIntervalValue = computed<number>({
  get: () => siteUserConfig.value.downloadInterval ?? 0,
  set: (val: number) => {
    siteUserConfig.value.downloadInterval = val;
  },
});

const uploadSpeedLimitValue = computed<number>({
  get: () => siteUserConfig.value.uploadSpeedLimit ?? 0,
  set: (val: number) => {
    siteUserConfig.value.uploadSpeedLimit = val;
  },
});

const downloadLinkAppendixValue = computed<string>({
  get: () => siteUserConfig.value.downloadLinkAppendix ?? "",
  set: (val: string) => {
    siteUserConfig.value.downloadLinkAppendix = val;
  },
});

const isSensitiveField = (name: string) => /pass|key|token|secret|cookie|auth|pwd/i.test(name);

function isFieldVisible(name: string): boolean {
  if (name in secretVisibleMap) return secretVisibleMap[name];
  return !isSensitiveField(name);
}

function toggleFieldVisible(name: string) {
  secretVisibleMap[name] = !isFieldVisible(name);
}

const isUrlValid = computed(() => {
  if (siteMetaData.value.isDead) return true;
  if (urlMode.value === "preset") {
    return Boolean(siteUserConfig.value.url);
  }
  return isValidUrl(customSiteUrl.value);
});

const isNameValid = computed(() => siteMetaData.value.isDead || siteName.value.trim().length > 0);

const isSortIndexValid = computed(() => {
  if (siteMetaData.value.isDead) return true;
  const val = siteUserConfig.value.sortIndex;
  return val !== undefined && val !== null && !Number.isNaN(Number(val));
});

const missingRequiredInputs = computed(() => {
  if (siteMetaData.value.isDead || !siteMetaData.value.userInputSettingMeta) return new Set<string>();
  const missing = new Set<string>();
  for (const meta of siteMetaData.value.userInputSettingMeta) {
    if (meta.required && !siteUserConfig.value.inputSetting?.[meta.name]?.trim()) {
      missing.add(meta.name);
    }
  }
  return missing;
});

const isFormValid = computed<boolean>(() => {
  if (siteMetaData.value.isDead) return true;
  return isNameValid.value && isSortIndexValid.value && isUrlValid.value && missingRequiredInputs.value.size === 0;
});

watch(
  isFormValid,
  (valid) => {
    emit("update:formValid", valid);
  },
  { immediate: true },
);

function selectPresetUrl(url: TSiteUrl) {
  if (siteMetaData.value.isDead) return;
  urlMode.value = "preset";
  siteUserConfig.value.url = url;
}

function selectCustomUrlMode() {
  if (siteMetaData.value.isDead) return;
  urlMode.value = "custom";
  siteUserConfig.value.url = customSiteUrl.value as TSiteUrl;
}

watch(customSiteUrl, (val) => {
  if (urlMode.value === "custom") {
    siteUserConfig.value.url = val as TSiteUrl;
  }
});

function getSearchEntryEnabled(entryKey: string, defaultEnabled?: boolean): boolean {
  const custom = siteUserConfig.value.merge?.searchEntry?.[entryKey]?.enabled;
  return typeof custom === "boolean" ? custom : (defaultEnabled ?? true);
}

function setSearchEntryEnabled(entryKey: string, value: boolean) {
  set(siteUserConfig.value, `merge.searchEntry.${entryKey}.enabled`, value);
}

async function initSiteData(targetSiteId: TSiteID, flush = false) {
  if (!targetSiteId) return;
  isLoading.value = true;
  try {
    siteMetaData.value = await metadataStore.getSiteMetadata(targetSiteId);
    siteUserConfig.value = toMerged(
      { inputSetting: {}, url: siteMetaData.value.urls[0] },
      await metadataStore.getSiteUserConfig(targetSiteId, flush),
    );

    const currentUrl = siteUserConfig.value.url ?? "";
    if (currentUrl && !siteMetaData.value.urls?.includes(currentUrl as TSiteUrl)) {
      urlMode.value = "custom";
      customSiteUrl.value = currentUrl;
    } else {
      urlMode.value = "preset";
      customSiteUrl.value = "";
    }
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  initSiteData(siteId.value);
});

watch(siteId, (newValue) => {
  initSiteData(newValue);
});

const nameSuggestions = computed(() => {
  const list = [siteMetaData.value.name, ...(siteMetaData.value.aka ?? [])].filter(Boolean);
  return Array.from(new Set(list));
});

const hasSearchEntries = computed(() =>
  Boolean(siteMetaData.value.searchEntry && Object.keys(siteMetaData.value.searchEntry).length > 0),
);

const timeZone: Array<{ value: timezoneOffset; title: string }> = [
  { value: "-1200", title: "(UTC -12:00) Enitwetok, Kwajalien" },
  { value: "-1100", title: "(UTC -11:00) Midway Island, Samoa" },
  { value: "-1000", title: "(UTC -10:00) Hawaii" },
  { value: "-0900", title: "(UTC -09:00) Alaska" },
  { value: "-0800", title: "(UTC -08:00) Pacific Time (US & Canada)" },
  { value: "-0700", title: "(UTC -07:00) Mountain Time (US & Canada)" },
  { value: "-0600", title: "(UTC -06:00) Central Time (US & Canada), Mexico City" },
  { value: "-0500", title: "(UTC -05:00) Eastern Time (US & Canada), Bogota, Lima" },
  { value: "-0400", title: "(UTC -04:00) Atlantic Time (Canada), Caracas, La Paz" },
  { value: "-0330", title: "(UTC -03:30) Newfoundland" },
  { value: "-0300", title: "(UTC -03:00) Brazil, Buenos Aires, Falkland Is." },
  { value: "-0200", title: "(UTC -02:00) Mid-Atlantic, Ascention Is., St Helena" },
  { value: "-0100", title: "(UTC -01:00) Azores, Cape Verde Islands" },
  { value: "+0000", title: "(UTC ±00:00) Casablanca, Dublin, London, Lisbon, Monrovia" },
  { value: "+0100", title: "(UTC +01:00) Brussels, Copenhagen, Madrid, Paris" },
  { value: "+0200", title: "(UTC +02:00) Sofia, Izrael, South Africa," },
  { value: "+0300", title: "(UTC +03:00) Baghdad, Riyadh, Moscow, Nairobi" },
  { value: "+0330", title: "(UTC +03:30) Tehran" },
  { value: "+0400", title: "(UTC +04:00) Abu Dhabi, Baku, Muscat, Tbilisi" },
  { value: "+0430", title: "(UTC +04:30) Kabul" },
  { value: "+0500", title: "(UTC +05:00) Ekaterinburg, Karachi, Tashkent" },
  { value: "+0530", title: "(UTC +05:30) Bombay, Calcutta, Madras, New Delhi" },
  { value: "+0600", title: "(UTC +06:00) Almaty, Colomba, Dhakra" },
  { value: "+0700", title: "(UTC +07:00) Bangkok, Hanoi, Jakarta" },
  { value: "+0800", title: "(UTC +08:00) ShangHai, HongKong, Perth, Singapore, Taipei" },
  { value: "+0900", title: "(UTC +09:00) Osaka, Sapporo, Seoul, Tokyo, Yakutsk" },
  { value: "+0930", title: "(UTC +09:30) Adelaide, Darwin" },
  { value: "+1000", title: "(UTC +10:00) Melbourne, Papua New Guinea, Sydney" },
  { value: "+1100", title: "(UTC +11:00) Magadan, New Caledonia, Solomon Is." },
  { value: "+1200", title: "(UTC +12:00) Auckland, Fiji, Marshall Island" },
];
</script>

<template>
  <div class="space-y-5">
    <Alert v-if="siteMetaData.isDead" variant="warning">
      {{ siteMetaData.name }} ({{ t("SetSite.common.isOffline") }})
    </Alert>

    <!-- 基本信息 -->
    <section class="space-y-3">
      <div class="flex items-center justify-between">
        <h4 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {{ t("common.basicInfo") }}
        </h4>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-12">
        <div class="space-y-1.5 sm:col-span-5">
          <Label for="site-name">
            {{ t("SetSite.common.name") }}
            <span class="text-destructive">*</span>
          </Label>
          <Input
            id="site-name"
            v-model="siteName"
            :disabled="siteMetaData.isDead"
            :class="!isNameValid ? 'border-destructive focus-visible:ring-destructive/30' : ''"
          />
          <div v-if="nameSuggestions.length > 1" class="flex flex-wrap gap-1 pt-0.5">
            <button
              v-for="alias in nameSuggestions"
              :key="alias"
              type="button"
              :disabled="siteMetaData.isDead"
              :class="
                cn(
                  'rounded px-1.5 py-0.5 text-[11px] transition-colors',
                  siteName === alias
                    ? 'bg-primary/15 text-primary font-medium'
                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
                )
              "
              @click="siteName = alias"
            >
              {{ alias }}
            </button>
          </div>
        </div>

        <div class="space-y-1.5 sm:col-span-4">
          <Label for="site-schema">{{ t("common.type") }}</Label>
          <Input id="site-schema" :model-value="siteMetaData.schema ?? ''" disabled />
        </div>

        <div class="space-y-1.5 sm:col-span-3">
          <Label for="site-sort-index">
            {{ t("common.sortIndex") }}
            <span class="text-destructive">*</span>
          </Label>
          <Input
            id="site-sort-index"
            v-model="sortIndexValue"
            type="number"
            :disabled="siteMetaData.isDead"
            :placeholder="t('SetSite.editor.sortIndexTip')"
            class="tabular-nums"
          />
        </div>

        <div class="space-y-1.5 sm:col-span-12">
          <Label>{{ t("SetSite.common.groups") }}</Label>
          <TagsInput
            v-model="groupsValue"
            :suggestions="siteMetaData.tags ?? []"
            :placeholder="t('SetSite.editor.tagTip')"
            :disabled="siteMetaData.isDead"
          />
        </div>
      </div>
    </section>

    <Separator />

    <!-- 连接配置 -->
    <section class="space-y-3">
      <h4 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {{ t("SetSite.common.url") }} &amp; {{ t("SetSite.editor.timezone") }}
      </h4>

      <div class="space-y-2">
        <Label>
          {{ t("SetSite.common.url") }}
          <span class="text-destructive">*</span>
        </Label>
        <div class="space-y-1.5">
          <div
            v-for="url in siteMetaData.urls ?? []"
            :key="url"
            :class="
              cn(
                'flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                urlMode === 'preset' && siteUserConfig.url === url
                  ? 'border-primary bg-primary/5 text-foreground'
                  : 'border-border bg-background hover:bg-muted/40',
                siteMetaData.isDead && 'pointer-events-none opacity-50',
              )
            "
            @click="selectPresetUrl(url)"
          >
            <div class="flex min-w-0 items-center gap-2.5">
              <span
                :class="
                  cn(
                    'flex size-4 shrink-0 items-center justify-center rounded-full border',
                    urlMode === 'preset' && siteUserConfig.url === url
                      ? 'border-primary bg-primary'
                      : 'border-input bg-background',
                  )
                "
              >
                <span
                  v-if="urlMode === 'preset' && siteUserConfig.url === url"
                  class="size-1.5 rounded-full bg-primary-foreground"
                />
              </span>
              <span class="truncate font-mono text-xs">{{ url }}</span>
            </div>
            <Tooltip :content="t('SetSite.common.open')">
              <Button
                as="a"
                :href="url"
                target="_blank"
                rel="noopener noreferrer nofollow"
                variant="ghost"
                size="icon-xs"
                @click.stop
              >
                <ExternalLink class="size-3.5 text-muted-foreground" />
              </Button>
            </Tooltip>
          </div>

          <div
            :class="
              cn(
                'flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors',
                urlMode === 'custom' ? 'border-primary bg-primary/5' : 'border-border bg-background hover:bg-muted/40',
                siteMetaData.isDead && 'pointer-events-none opacity-50',
              )
            "
            @click="selectCustomUrlMode"
          >
            <span
              :class="
                cn(
                  'flex size-4 shrink-0 items-center justify-center rounded-full border',
                  urlMode === 'custom' ? 'border-primary bg-primary' : 'border-input bg-background',
                )
              "
            >
              <span v-if="urlMode === 'custom'" class="size-1.5 rounded-full bg-primary-foreground" />
            </span>
            <div class="flex-1 space-y-1">
              <Input
                v-model="customSiteUrl"
                :disabled="siteMetaData.isDead"
                :placeholder="t('SetSite.editor.customUrlPlaceholder')"
                :class="
                  cn(
                    'h-7.5 font-mono text-xs',
                    urlMode === 'custom' && customSiteUrl && !isValidUrl(customSiteUrl)
                      ? 'border-destructive focus-visible:ring-destructive/30'
                      : '',
                  )
                "
                @focus="selectCustomUrlMode"
                @click.stop="selectCustomUrlMode"
              />
              <p v-if="urlMode === 'custom' && !isUrlValid" class="text-[11px] text-destructive">
                {{ t("SetSite.editor.addUrlTip") }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="space-y-1.5">
          <Label>{{ t("SetSite.editor.timezone") }}</Label>
          <Select v-model="siteTimezoneOffset" :disabled="siteMetaData.isDead">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="tz in timeZone" :key="tz.value" :value="tz.value">
                {{ tz.title }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <Label for="site-dl-appendix">{{ t("SetSite.Editor.downloadLinkSuffix") }}</Label>
            <Tooltip :content="t('SetSite.Editor.downloadLinkSuffixExample')">
              <Info class="size-3.5 cursor-help text-muted-foreground" />
            </Tooltip>
          </div>
          <Input
            id="site-dl-appendix"
            v-model="downloadLinkAppendixValue"
            :disabled="siteMetaData.isDead"
            :placeholder="t('SetSite.Editor.downloadLinkSuffixHint')"
            class="font-mono text-xs"
          />
        </div>
      </div>
    </section>

    <!-- 站点认证字段 -->
    <template v-if="siteMetaData.userInputSettingMeta?.length && siteUserConfig.inputSetting">
      <Separator />
      <section class="space-y-3">
        <div class="flex items-center gap-1.5">
          <KeyRound class="size-3.5 text-primary" />
          <h4 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {{ t("SetSite.Editor.siteSettings") }}
          </h4>
        </div>

        <div class="space-y-3">
          <div v-for="userInputMeta in siteMetaData.userInputSettingMeta" :key="userInputMeta.name" class="space-y-1.5">
            <Label :for="`site-input-${userInputMeta.name}`">
              {{ userInputMeta.label }}
              <span v-if="userInputMeta.required && !siteMetaData.isDead" class="text-destructive">*</span>
            </Label>
            <div class="relative">
              <Input
                :id="`site-input-${userInputMeta.name}`"
                v-model="siteUserConfig.inputSetting[userInputMeta.name]"
                :type="isFieldVisible(userInputMeta.name) ? 'text' : 'password'"
                :disabled="siteMetaData.isDead"
                :class="
                  cn(
                    'pr-9 font-mono text-xs',
                    missingRequiredInputs.has(userInputMeta.name)
                      ? 'border-destructive focus-visible:ring-destructive/30'
                      : '',
                  )
                "
              />
              <button
                type="button"
                tabindex="-1"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                @click="toggleFieldVisible(userInputMeta.name)"
              >
                <Eye v-if="isFieldVisible(userInputMeta.name)" class="size-3.5" />
                <EyeOff v-else class="size-3.5" />
              </button>
            </div>
            <p v-if="userInputMeta.hint" class="text-[11px] leading-relaxed text-muted-foreground">
              {{ userInputMeta.hint }}
            </p>
          </div>
        </div>
      </section>
    </template>

    <Separator />

    <!-- 传输与超时设置 -->
    <section class="space-y-3">
      <h4 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {{ t("SetSite.Editor.otherSettings") }}
      </h4>

      <div class="space-y-3 rounded-lg border border-border bg-muted/20 p-3.5">
        <div class="space-y-1.5">
          <div class="flex items-center justify-between gap-2">
            <Label class="text-xs font-medium">{{ t("SetSite.Editor.requestTimeout") }}</Label>
            <Button
              type="button"
              variant="outline"
              size="xs"
              class="h-6 gap-1 px-2 font-mono text-[11px] tabular-nums"
              :disabled="siteMetaData.isDead"
              @click="siteUserConfig.timeout = 30e3"
            >
              <RotateCcw class="size-2.5 text-muted-foreground" />
              {{ formatDate(timeoutValue, "mm:ss") }}
            </Button>
          </div>
          <Slider v-model="timeoutValue" :min="0" :max="10 * 60e3" :step="1e3" :disabled="siteMetaData.isDead" />
          <p class="text-[11px] text-muted-foreground">{{ t("SetSite.Editor.requestTimeoutHint") }}</p>
        </div>

        <Separator />

        <div class="space-y-1.5">
          <div class="flex items-center justify-between gap-2">
            <Label class="text-xs font-medium">{{ t("SetSite.Editor.downloadInterval") }}</Label>
            <Button
              type="button"
              variant="outline"
              size="xs"
              class="h-6 gap-1 px-2 font-mono text-[11px] tabular-nums"
              :disabled="siteMetaData.isDead"
              @click="siteUserConfig.downloadInterval = 0"
            >
              <RotateCcw class="size-2.5 text-muted-foreground" />
              {{ formatDate(downloadIntervalValue * 1e3, "mm:ss") }}
            </Button>
          </div>
          <Slider
            v-model="downloadIntervalValue"
            :min="0"
            :max="downloadIntervalValue < 600 ? 600 : 1200"
            :step="downloadIntervalValue <= 60 ? 1 : 10"
            :disabled="siteMetaData.isDead"
          />
          <p class="text-[11px] text-muted-foreground">{{ t("SetSite.Editor.downloadIntervalHint") }}</p>
        </div>

        <Separator />

        <div class="space-y-1.5">
          <div class="flex items-center justify-between gap-2">
            <Label class="text-xs font-medium">{{ t("SetSite.editor.uploadSpeedLimit") }}</Label>
            <Button
              type="button"
              variant="outline"
              size="xs"
              class="h-6 gap-1 px-2 font-mono text-[11px] tabular-nums"
              :disabled="siteMetaData.isDead"
              @click="siteUserConfig.uploadSpeedLimit = 0"
            >
              <RotateCcw class="size-2.5 text-muted-foreground" />
              {{ uploadSpeedLimitValue }} MiB/s
            </Button>
          </div>
          <Slider v-model="uploadSpeedLimitValue" :min="0" :max="1024" :step="1" :disabled="siteMetaData.isDead" />
          <p class="text-[11px] text-muted-foreground">{{ t("SetSite.editor.uploadSpeedLimitHint") }}</p>
        </div>
      </div>
    </section>

    <Separator />

    <!-- 功能开关与搜索入口 -->
    <section class="space-y-3">
      <h4 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {{ t("common.advancedSettings") }}
      </h4>

      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div class="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <Label for="sw-isOffline" class="cursor-pointer text-xs font-medium">
            {{ t("SetSite.common.isOffline") }}
          </Label>
          <Switch
            id="sw-isOffline"
            :model-value="Boolean(siteUserConfig.isOffline)"
            :disabled="siteMetaData.isDead"
            @update:model-value="(v) => (siteUserConfig.isOffline = v)"
          />
        </div>

        <div
          v-if="siteMetaData.search"
          class="flex items-center justify-between rounded-lg border border-border px-3 py-2"
        >
          <Label for="sw-allowSearch" class="cursor-pointer text-xs font-medium">
            {{ t("SetSite.common.allowSearch") }}
          </Label>
          <Switch
            id="sw-allowSearch"
            :model-value="siteUserConfig.allowSearch ?? true"
            :disabled="siteMetaData.isDead || siteUserConfig.isOffline"
            @update:model-value="(v) => (siteUserConfig.allowSearch = v)"
          />
        </div>

        <div
          v-if="siteMetaData.userInfo"
          class="flex items-center justify-between rounded-lg border border-border px-3 py-2"
        >
          <Label for="sw-allowQueryUserInfo" class="cursor-pointer text-xs font-medium">
            {{ t("SetSite.common.allowQueryUserInfo") }}
          </Label>
          <Switch
            id="sw-allowQueryUserInfo"
            :model-value="siteUserConfig.allowQueryUserInfo ?? true"
            :disabled="siteMetaData.isDead || siteUserConfig.isOffline"
            @update:model-value="(v) => (siteUserConfig.allowQueryUserInfo = v)"
          />
        </div>

        <div
          v-if="configStore.contentScript.enabled && configStore.contentScript.allowExceptionSites"
          class="flex items-center justify-between rounded-lg border border-border px-3 py-2"
        >
          <Label for="sw-allowContentScript" class="cursor-pointer text-xs font-medium">
            {{ t("SetSite.common.allowContentScript") }}
          </Label>
          <Switch
            id="sw-allowContentScript"
            :model-value="siteUserConfig.allowContentScript ?? true"
            :disabled="siteMetaData.isDead || siteUserConfig.isOffline"
            @update:model-value="(v) => (siteUserConfig.allowContentScript = v)"
          />
        </div>
      </div>

      <div v-if="hasSearchEntries" class="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
        <div class="text-xs font-medium text-foreground">
          {{ t("SetSite.index.table.searchEntries") }}
        </div>
        <div class="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          <div
            v-for="(entry, entryKey) in siteMetaData.searchEntry"
            :key="entryKey"
            class="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-card px-2.5 py-1.5"
          >
            <Label :for="`editor-entry-${entryKey}`" class="cursor-pointer truncate text-xs font-normal">
              {{ entry.name ?? entryKey }}
            </Label>
            <Switch
              :id="`editor-entry-${entryKey}`"
              :model-value="getSearchEntryEnabled(String(entryKey), entry.enabled)"
              :disabled="siteMetaData.isDead"
              @update:model-value="(v) => setSearchEntryEnabled(String(entryKey), v)"
            />
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
