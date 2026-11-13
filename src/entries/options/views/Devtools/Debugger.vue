<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import * as estoolkit from "es-toolkit";
import * as datefns from "date-fns";
import axios from "axios";
import Sizzle from "sizzle";
import {
  definitionList,
  getDefinedSiteMetadata,
  getFavicon,
  getSite as createSiteInstance,
  type TSiteID,
} from "@ptd/site";
import { getDownloader } from "@ptd/downloader";
import { getBackupServer } from "@ptd/backupServer";
import { AlertTriangle, Bug, Database, Globe, Server, Terminal } from "lucide-vue-next";

import { useMetadataStore } from "@/options/stores/metadata.ts";
import { useConfigStore } from "@/options/stores/config.ts";
import { sendMessage } from "@/messages.ts";
import { setupReplaceUnsafeHeader } from "~/extends/axios/replaceUnsafeHeader.ts";
import { setupRetryWhenCloudflareBlock } from "~/extends/axios/retryWhenCloudflareBlock.ts";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui";

setupRetryWhenCloudflareBlock(setupReplaceUnsafeHeader(axios));

const { t } = useI18n();

function enableLibrary() {
  const win = window as unknown as Record<string, unknown>;
  win.axios = axios;
  win.Sizzle = Sizzle;
  win._ = estoolkit;
  win.datefns = datefns;
  win.sendMessage = sendMessage;
  console.log("开发库已启用");
}

const selectedSite = ref<TSiteID>("");
const useCustomerConfig = ref<boolean>(true);

const clearSiteTarget = ref<TSiteID>("all");
const siteSelectItems = computed(() => [
  { title: t("Debugger.siteAll"), value: "all" },
  ...definitionList.map((x) => ({ title: x, value: x })),
]);

const piniaStoreContent = import.meta.glob<Record<string, Function>>("@/options/stores/*.ts");
const piniaStoreName: Array<{ title: string; value: string }> = Object.keys(piniaStoreContent).map((x) => ({
  title: x.replace(/^.+\//, "").replace(/\.ts$/, ""),
  value: x,
}));
const selectedPiniaStore = ref<string>("");

const metadataStore = useMetadataStore();

const simpleServer = ref<Record<string, { selected: string; piniaKey: keyof typeof metadataStore; getFn: Function }>>({
  Downloader: { selected: "", piniaKey: "downloaders", getFn: getDownloader },
  BackupServer: { selected: "", piniaKey: "backupServers", getFn: getBackupServer },
});

async function getSiteMetadata() {
  return await getDefinedSiteMetadata(selectedSite.value);
}

async function getSiteConfig() {
  return await metadataStore.getSiteUserConfig(selectedSite.value, useCustomerConfig.value);
}

async function getSiteInstance() {
  let customerConfig = {};
  if (useCustomerConfig.value) {
    customerConfig = await getSiteConfig();
  }
  return await createSiteInstance(selectedSite.value, customerConfig);
}

async function getSiteFavicon() {
  const siteInstance = await getSiteInstance();
  return await getFavicon(siteInstance.metadata);
}

async function getPiniaStore(storeName: string) {
  const storeModule = await piniaStoreContent[storeName]();
  const storeFunction = Object.keys(storeModule).filter((f) => /use.+Store/.test(f));
  if (storeFunction.length > 0) {
    return storeModule[storeFunction[0]]();
  }
}

const log = async (v: unknown) => {
  console.log(await v);
};

interface resetItem {
  id?: string;
  title: string;
  subTitle?: string;
  resetFn: () => Promise<void>;
}

const resetItems = computed<resetItem[]>(() => [
  {
    title: t("Debugger.resetItems.resetSystemSettings"),
    subTitle: t("Debugger.resetItems.resetSystemSettingsDesc"),
    resetFn: async () => {
      const configStore = useConfigStore();
      configStore.$reset();
      await configStore.$save();
    },
  },
  {
    title: t("Debugger.resetItems.clearUserConfig"),
    subTitle: t("Debugger.resetItems.clearUserConfigDesc"),
    resetFn: async () => {
      const metadataStore = useMetadataStore();
      metadataStore.$reset();
      await metadataStore.$save();
    },
  },
  {
    id: "clearSiteData",
    title: t("Debugger.resetItems.clearSiteData"),
    subTitle: t("Debugger.resetItems.clearSiteDataDesc"),
    resetFn: async () => {
      const metadataStore = useMetadataStore();
      if (clearSiteTarget.value === "all") {
        metadataStore.lastUserInfo = {};
        await sendMessage("setExtStorage", { key: "userInfo", value: {} });
      } else {
        if (metadataStore.lastUserInfo[clearSiteTarget.value]) delete metadataStore.lastUserInfo[clearSiteTarget.value];
        const userInfo = (await sendMessage("getExtStorage", "userInfo")) as Record<string, any>;
        if (userInfo && userInfo[clearSiteTarget.value]) {
          delete userInfo[clearSiteTarget.value];
          await sendMessage("setExtStorage", { key: "userInfo", value: userInfo });
        }
      }
      await metadataStore.$save();
    },
  },
  {
    title: t("Debugger.resetItems.clearFaviconCache"),
    resetFn: async () => {
      await sendMessage("clearSiteFaviconCache", undefined);
    },
  },
]);

async function resetFnWrapper(resetFn: resetItem["resetFn"]) {
  if (confirm(t("Debugger.confirmReset"))) {
    await resetFn();
    alert(t("Debugger.resetSuccess"));
  }
}
</script>

<template>
  <div class="space-y-4">
    <Alert variant="warning" :title="t('Debugger.title')">
      {{ t("Debugger.consoleOutput") }}
    </Alert>

    <!-- 启用开发库 -->
    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <Terminal class="size-4 text-primary" />
          {{ t("Debugger.enableLibrary") }}
        </CardTitle>
        <CardDescription>{{ t("Debugger.libraryList") }}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button size="sm" variant="secondary" @click="enableLibrary">
          <Bug class="size-4" />
          {{ t("common.enable") }}
        </Button>
      </CardContent>
    </Card>

    <!-- 调试内置站点 -->
    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <Globe class="size-4 text-primary" />
          {{ t("Debugger.debugBuiltinSite") }}
        </CardTitle>
      </CardHeader>
      <CardContent class="space-y-3">
        <div class="flex flex-wrap items-center gap-3">
          <Select v-model="selectedSite">
            <SelectTrigger class="w-full sm:w-64">
              <SelectValue :placeholder="t('Debugger.selectSite')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="site in definitionList" :key="site" :value="site">
                {{ site }}
              </SelectItem>
            </SelectContent>
          </Select>

          <label class="flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
            <Checkbox v-model="useCustomerConfig" />
            <span>{{ t("Debugger.mergeUserConfig") }}</span>
          </label>
        </div>

        <div class="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" :disabled="!selectedSite" @click="log(getSiteMetadata())">
            {{ t("Debugger.outputSiteDefinition") }}
          </Button>
          <Button size="sm" variant="outline" :disabled="!selectedSite" @click="log(getSiteConfig())">
            {{ t("Debugger.outputUserConfig") }}
          </Button>
          <Button size="sm" variant="outline" :disabled="!selectedSite" @click="log(getSiteInstance())">
            {{ t("Debugger.outputSiteInstance") }}
          </Button>
          <Button size="sm" variant="outline" :disabled="!selectedSite" @click="log(getSiteFavicon())">
            {{ t("Debugger.outputFavicon") }}
          </Button>
        </div>
      </CardContent>
    </Card>

    <!-- 调试下载器与备份服务器 -->
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card v-for="(server, serverType) in simpleServer" :key="serverType">
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <Server class="size-4 text-primary" />
            {{ t("Debugger.debug", { serverType }) }}
          </CardTitle>
          <CardDescription>{{ t("Debugger.addServerFirst", { serverType }) }}</CardDescription>
        </CardHeader>
        <CardContent class="space-y-3">
          <Select v-model="simpleServer[serverType].selected">
            <SelectTrigger>
              <SelectValue :placeholder="serverType" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="item in serverType === 'Downloader'
                  ? metadataStore.getDownloaders
                  : metadataStore.getBackupServers"
                :key="item.id"
                :value="item.id"
              >
                {{ item.name }}
              </SelectItem>
            </SelectContent>
          </Select>

          <div class="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              :disabled="!server.selected"
              @click="
                // @ts-ignore
                log(metadataStore[server.piniaKey][server.selected])
              "
            >
              {{ t("Debugger.outputConfig") }}
            </Button>
            <Button
              size="sm"
              variant="outline"
              :disabled="!server.selected"
              @click="
                // @ts-ignore
                log(server.getFn(metadataStore[server.piniaKey][server.selected]))
              "
            >
              {{ t("Debugger.outputInstance", { serverType }) }}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- 调试 Pinia Store -->
    <Card>
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          <Database class="size-4 text-primary" />
          {{ t("Debugger.debugPinia") }}
        </CardTitle>
      </CardHeader>
      <CardContent class="flex flex-wrap items-center gap-3">
        <Select v-model="selectedPiniaStore">
          <SelectTrigger class="w-full sm:w-64">
            <SelectValue placeholder="piniaStore" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="store in piniaStoreName" :key="store.value" :value="store.value">
              {{ store.title }}
            </SelectItem>
          </SelectContent>
        </Select>

        <Button
          size="sm"
          variant="outline"
          :disabled="!selectedPiniaStore"
          @click="log(getPiniaStore(selectedPiniaStore))"
        >
          {{ t("Debugger.outputPinia") }}
        </Button>
      </CardContent>
    </Card>

    <!-- 危险区：插件重置 -->
    <Card class="border-destructive/40">
      <CardHeader>
        <CardTitle class="flex items-center gap-2 text-destructive">
          <AlertTriangle class="size-4" />
          {{ t("Debugger.pluginReset") }}
        </CardTitle>
      </CardHeader>
      <CardContent class="space-y-3">
        <Alert variant="destructive">
          {{ t("Debugger.dangerWarning") }}
        </Alert>

        <div class="divide-y divide-border rounded-lg border border-border">
          <div
            v-for="item in resetItems"
            :key="item.title"
            class="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="min-w-0 space-y-0.5">
              <div class="text-sm font-medium text-foreground">{{ item.title }}</div>
              <div v-if="item.subTitle" class="text-xs text-muted-foreground">{{ item.subTitle }}</div>
            </div>

            <div class="flex shrink-0 items-center gap-2">
              <Select v-if="item.id === 'clearSiteData'" v-model="clearSiteTarget">
                <SelectTrigger class="w-40">
                  <SelectValue :placeholder="t('Debugger.selectSite')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="opt in siteSelectItems" :key="opt.value" :value="opt.value">
                    {{ opt.title }}
                  </SelectItem>
                </SelectContent>
              </Select>

              <Button variant="destructive" size="sm" @click="resetFnWrapper(item.resetFn)">
                {{ t("common.dialog.reset") }}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
