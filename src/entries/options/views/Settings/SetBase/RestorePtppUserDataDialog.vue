<script setup lang="ts">
import { computed, ref, shallowRef } from "vue";
import { useI18n } from "vue-i18n";
import { omit } from "es-toolkit";
import { isEmpty } from "es-toolkit/compat";
import {
  definitionList,
  EResultParseStatus,
  getHostFromUrl,
  type IUserInfo,
  parseSizeString,
  parseValidTimeString,
  type TSiteHost,
  type TSiteID,
} from "@ptd/site";
import { Check, Database, HelpCircle, Loader2, Upload, X } from "lucide-vue-next";

import { sendMessage } from "@/messages.ts";
import { useMetadataStore } from "@/options/stores/metadata.ts";
import { useRuntimeStore } from "@/options/stores/runtime.ts";
import { useConfigStore } from "@/options/stores/config.ts";
import type { IPtppDumpUserInfo, IPtppUserInfo, TUserInfoStorageSchema } from "@/shared/types.ts";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Switch,
} from "~/components/ui";
import { cn } from "~/lib/utils";

import SiteName from "@/options/components/SiteName.vue";
import SiteFavicon from "@/options/components/SiteFavicon/Index.vue";
import CheckSwitchButton from "@/options/components/CheckSwitchButton.vue";

const showDialog = defineModel<boolean>({ default: false });
const { ptppUserData } = defineProps<{
  ptppUserData: IPtppDumpUserInfo;
}>();

const { t } = useI18n();
const configStore = useConfigStore();
const metadataStore = useMetadataStore();
const runtimeStore = useRuntimeStore();

const parsePtppSize = (v: unknown) => (typeof v === "string" ? parseSizeString(v) : v);

type TUserInfoTransferFull = { key: keyof IUserInfo; format?: (v: unknown) => unknown };
type TUserInfoTransfer = false | undefined | keyof IUserInfo | TUserInfoTransferFull;

const userInfoTransferMap = {
  trueDownloaded: { key: "trueDownloaded", format: parsePtppSize },
  totalTraffic: { key: "totalTraffic", format: parsePtppSize },
  seedingPoints: "seedingBonus",
  averageSeedtime: "averageSeedingTime",
  bonusPage: false,
  unsatisfiedsPage: false,
  unsatisfieds: { key: "hnrUnsatisfied", format: (v) => Number(v) },
  prewarn: "hnrPreWarning",
  lastUpdateTime: "updateAt",
  lastUpdateStatus: {
    key: "status",
    format: (v) => (v === "success" ? EResultParseStatus.success : EResultParseStatus.unknownError),
  },
  isLogged: false,
  isLoading: false,
  lastErrorMsg: false,
  joinTime: {
    key: "joinTime",
    format: (v: unknown) => {
      if (typeof v === "number") {
        if (v > 1e12) return v;
        if (v > 1e9) return v * 1000;
      }
      if (typeof v === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v)) {
        return parseValidTimeString(v);
      }
      return v;
    },
  },
} as Record<keyof IPtppUserInfo, TUserInfoTransfer>;

const isImporting = ref<boolean>(false);
const toImportSite = ref<string[]>([]);
const allSupportedSiteHostMap = shallowRef<Record<TSiteHost, TSiteID>>({});

const allSupportedSiteHost = computed(() =>
  Object.keys(ptppUserData ?? {})
    .map((x) => ({ site: allSupportedSiteHostMap.value[x], host: x }))
    .filter((x) => !!x.site)
    .map((x) => x.host),
);
const overwriteExistUserInfo = ref<boolean>(false);

function toggleImportHost(host: string, checked: boolean | "indeterminate") {
  if (!allSupportedSiteHost.value.includes(host)) return;
  if (checked === true) {
    if (!toImportSite.value.includes(host)) {
      toImportSite.value = [...toImportSite.value, host];
    }
  } else {
    toImportSite.value = toImportSite.value.filter((h) => h !== host);
  }
}

function getHostStatus(host: string) {
  if (!allSupportedSiteHost.value.includes(host)) {
    return {
      variant: "outline" as const,
      icon: X,
      title: t("ptppSettings.RestorePtppUserDataDialog.notSupported"),
    };
  }
  if (toImportSite.value.includes(host)) {
    return {
      variant: "success" as const,
      icon: Check,
      title: t("ptppSettings.RestorePtppUserDataDialog.selected"),
    };
  }
  return {
    variant: "secondary" as const,
    icon: HelpCircle,
    title: "",
  };
}

function transferUserInfo(userInfo: IPtppUserInfo) {
  const newUserInfo = {} as IUserInfo;
  for (const [key, value] of Object.entries(userInfo)) {
    if (userInfoTransferMap[key as keyof IPtppUserInfo]) {
      const transfer = userInfoTransferMap[key as keyof IPtppUserInfo];
      if (transfer === false) {
        continue;
      } else if (transfer === undefined) {
        newUserInfo[key] = value;
      } else if (typeof transfer === "string") {
        newUserInfo[transfer] = value;
      } else {
        const { key: targetKey, format = undefined } = transfer as TUserInfoTransferFull;
        newUserInfo[targetKey as keyof IPtppUserInfo] = format ? format(value) : value;
      }
    } else {
      newUserInfo[key] = value;
    }
  }
  return newUserInfo;
}

async function doImport() {
  if (isEmpty(metadataStore.sites)) {
    if (!confirm(t("ptppSettings.RestorePtppUserDataDialog.noSiteWarning"))) {
      runtimeStore.showSnackbar(t("ptppSettings.RestorePtppUserDataDialog.importCancelled"), { color: "warning" });
      return;
    }
  }

  isImporting.value = true;
  const autoReflushStatus = configStore.userInfo.autoReflush.enabled;

  try {
    if (autoReflushStatus) {
      configStore.userInfo.autoReflush.enabled = false;
      await configStore.$save();
    }

    const userInfoStorage = ((await sendMessage("getExtStorage", "userInfo")) as TUserInfoStorageSchema) ?? {};

    for (const [host, data] of Object.entries(ptppUserData)) {
      if (toImportSite.value.includes(host)) {
        const siteId = allSupportedSiteHostMap.value[host];
        userInfoStorage[siteId] ??= {};

        const latestUserInfo = data.latest ?? {};
        if (
          overwriteExistUserInfo.value &&
          latestUserInfo?.lastUpdateStatus === "success" &&
          (latestUserInfo?.lastUpdateTime ?? -1) > (metadataStore.lastUserInfo[siteId]?.updateAt ?? 0)
        ) {
          metadataStore.lastUserInfo[siteId] = { ...transferUserInfo(latestUserInfo), site: siteId };
        }

        for (const [date, userData] of Object.entries(omit(data, ["latest"]))) {
          if (typeof userInfoStorage[siteId][date] == "undefined" || overwriteExistUserInfo.value) {
            userInfoStorage[siteId][date] = { ...transferUserInfo(userData), site: siteId };
          }
        }
      }
    }

    await sendMessage("setExtStorage", { key: "userInfo", value: userInfoStorage });
    await metadataStore.$save();

    runtimeStore.showSnackbar(t("ptppSettings.RestorePtppUserDataDialog.importSuccess"), { color: "success" });
    setTimeout(() => (showDialog.value = false), 5000);
  } catch (e) {
    console.error("导入失败", e);
    runtimeStore.showSnackbar(t("ptppSettings.RestorePtppUserDataDialog.importFailure"), { color: "error" });
  } finally {
    configStore.userInfo.autoReflush.enabled = autoReflushStatus;
    await configStore.$save();
    isImporting.value = false;
  }
}

async function entryDialog() {
  const siteHostMap: Record<TSiteHost, TSiteID> = {};
  for (const siteId of definitionList) {
    if (metadataStore.sites[siteId]?.url) {
      siteHostMap[getHostFromUrl(metadataStore.sites[siteId].url)] = siteId;
    }
    const urls = await metadataStore.getSiteMergedMetadata(siteId, "urls", []);
    if (urls.length > 0) {
      for (const url of urls) {
        siteHostMap[getHostFromUrl(url)] = siteId;
      }
    }
    const legacyUrls = (await metadataStore.getSiteMergedMetadata(siteId, "legacyUrls", []))!;
    if (legacyUrls.length > 0) {
      for (const url of legacyUrls) {
        siteHostMap[getHostFromUrl(url)] = siteId;
      }
    }
  }

  allSupportedSiteHostMap.value = siteHostMap;
  toImportSite.value = allSupportedSiteHost.value;
}
</script>

<template>
  <Dialog v-model="showDialog" @after-open="entryDialog">
    <DialogContent class="max-w-3xl" :prevent-outside-close="isImporting" :hide-close="isImporting">
      <DialogHeader>
        <DialogTitle>
          <Database class="size-4 text-primary" />
          <span>{{ t("ptppSettings.RestorePtppUserDataDialog.title") }}</span>
        </DialogTitle>
      </DialogHeader>

      <div class="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        <Alert variant="info">
          <span>{{ t("ptppSettings.RestorePtppUserDataDialog.pendingImportData") }}</span>
          <template #action>
            <CheckSwitchButton v-model="toImportSite" :all="allSupportedSiteHost" :disabled="isImporting" />
          </template>
        </Alert>

        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div
            v-for="(data, host) in ptppUserData"
            :key="host"
            :class="
              cn(
                'flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/25 px-3 py-2.5',
                !allSupportedSiteHost.includes(String(host)) && 'opacity-55',
              )
            "
          >
            <div class="flex min-w-0 items-center gap-2.5">
              <Checkbox
                :model-value="
                  !allSupportedSiteHost.includes(String(host)) ? 'indeterminate' : toImportSite.includes(String(host))
                "
                :disabled="!allSupportedSiteHost.includes(String(host)) || isImporting"
                @update:model-value="(v) => toggleImportHost(String(host), v)"
              />
              <div class="flex min-w-0 flex-wrap items-center gap-1 text-xs">
                <span class="truncate font-mono text-muted-foreground">{{ host }}</span>
                <template v-if="allSupportedSiteHost.includes(String(host))">
                  <span class="text-muted-foreground">→</span>
                  <SiteFavicon :site-id="allSupportedSiteHostMap[String(host)]" :size="16" />
                  <SiteName
                    :site-id="allSupportedSiteHostMap[String(host)]"
                    tag="span"
                    class="font-semibold text-foreground"
                  />
                </template>
              </div>
            </div>

            <Badge
              :variant="getHostStatus(String(host)).variant"
              :title="getHostStatus(String(host)).title"
              class="shrink-0 gap-1 tabular-nums"
            >
              <component :is="getHostStatus(String(host)).icon" class="size-3" />
              {{ t("ptppSettings.RestorePtppUserDataDialog.recordCount", [Object.keys(data).length - 1]) }}
            </Badge>
          </div>
        </div>
      </div>

      <DialogFooter class="sm:justify-between">
        <label class="flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
          <Switch v-model="overwriteExistUserInfo" :disabled="isImporting" />
          <span>{{ t("ptppSettings.RestorePtppUserDataDialog.overwriteExisting") }}</span>
        </label>

        <div class="flex items-center gap-2">
          <Button variant="outline" :disabled="isImporting" @click="showDialog = false">
            {{ t("common.dialog.cancel") }}
          </Button>
          <Button :disabled="isImporting || toImportSite.length === 0" @click="doImport">
            <Loader2 v-if="isImporting" class="size-4 animate-spin" />
            <Upload v-else class="size-4" />
            {{ t("common.import") }}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
