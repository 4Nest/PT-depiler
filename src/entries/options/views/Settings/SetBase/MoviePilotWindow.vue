<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  CheckCircle2,
  Clapperboard,
  Eye,
  EyeOff,
  HelpCircle,
  Loader2,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-vue-next";

import { sendMessage } from "@/messages.ts";
import { useConfigStore } from "@/options/stores/config.ts";
import { useRuntimeStore } from "@/options/stores/runtime.ts";
import {
  Badge,
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
const runtimeStore = useRuntimeStore();

const showApiKey = ref(false);
const isTesting = ref(false);
const testResult = ref<{ type: "success" | "error"; text: string } | null>(null);
const remoteClients = ref<string[]>([]);
const remotePaths = ref<string[]>([]);

function ensureMoviePilotState() {
  if (!configStore.moviePilot) {
    configStore.moviePilot = {
      enabled: false,
      url: "",
      apiKey: "",
      themeMode: "auto",
      defaultDownloader: "",
      defaultSavePath: "",
      showSpecs: true,
      subAutoFillSpecs: false,
      debug: false,
    };
  }
}

ensureMoviePilotState();

function unwrapMpJson(rawText: string): any {
  try {
    const parsed = JSON.parse(rawText || "null");
    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      "data" in parsed &&
      ("success" in parsed || "message" in parsed)
    ) {
      return parsed.data;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function loadRemoteOptions(baseUrl: string, apiKey: string) {
  const cleanUrl = baseUrl.trim().replace(/\/+$/, "");
  if (!cleanUrl || !apiKey.trim()) return { clients: [] as string[], paths: [] as string[] };

  const headers = { "X-Api-Key": apiKey.trim(), Accept: "application/json" };
  const [clientsRes, pathsRes] = await Promise.all([
    sendMessage("moviePilotHttpRequest", {
      url: `${cleanUrl}/api/v1/download/clients`,
      method: "GET",
      headers,
      timeout: 8000,
    }),
    sendMessage("moviePilotHttpRequest", {
      url: `${cleanUrl}/api/v1/download/paths`,
      method: "GET",
      headers,
      timeout: 8000,
    }),
  ]);

  const extractClients = (raw: any) => {
    const list = Array.isArray(raw?.value) ? raw.value : Array.isArray(raw) ? raw : [];
    return list
      .map((c: any) => (typeof c === "string" ? c : c && c.enabled !== false && c.name ? String(c.name) : ""))
      .filter(Boolean);
  };
  const extractPaths = (raw: any) => {
    const list = Array.isArray(raw?.value) ? raw.value : Array.isArray(raw) ? raw : [];
    const set = new Set<string>();
    for (const d of list) {
      const p = typeof d === "string" ? d : d?.path || d?.download_path || d?.library_path || "";
      if (p) set.add(String(p));
    }
    return [...set];
  };

  let clients = extractClients(unwrapMpJson(clientsRes.responseText));
  let paths = extractPaths(unwrapMpJson(pathsRes.responseText));

  if (clients.length === 0 || paths.length === 0) {
    const [fallbackDl, fallbackDir] = await Promise.all([
      clients.length === 0
        ? sendMessage("moviePilotHttpRequest", {
            url: `${cleanUrl}/api/v1/system/setting/Downloaders`,
            method: "GET",
            headers,
            timeout: 8000,
          })
        : Promise.resolve(null),
      paths.length === 0
        ? sendMessage("moviePilotHttpRequest", {
            url: `${cleanUrl}/api/v1/system/setting/Directories`,
            method: "GET",
            headers,
            timeout: 8000,
          })
        : Promise.resolve(null),
    ]);
    if (fallbackDl) clients = extractClients(unwrapMpJson(fallbackDl.responseText));
    if (fallbackDir) paths = extractPaths(unwrapMpJson(fallbackDir.responseText));
  }
  remoteClients.value = clients;
  remotePaths.value = paths;
  return { clients, paths };
}

async function handleToggleEnabled(val: boolean) {
  ensureMoviePilotState();
  configStore.moviePilot.enabled = val;
  await sendMessage("updateMoviePilotConfig", { ...configStore.moviePilot });
  void configStore.$save();
  runtimeStore.showSnackbar(val ? t("SetBase.moviepilot.enabledToast") : t("SetBase.moviepilot.disabledToast"), {
    color: "success",
  });
}

async function handleToggleBoolField(field: "showSpecs" | "subAutoFillSpecs" | "debug", val: boolean) {
  ensureMoviePilotState();
  configStore.moviePilot[field] = Boolean(val);
  await sendMessage("updateMoviePilotConfig", { ...configStore.moviePilot });
  void configStore.$save();
}

async function handleAutoSaveSwitch() {
  ensureMoviePilotState();
  await sendMessage("updateMoviePilotConfig", { ...configStore.moviePilot });
  void configStore.$save();
}

async function testAndSaveConnection() {
  ensureMoviePilotState();
  const cleanUrl = (configStore.moviePilot.url || "").trim().replace(/\/+$/, "");
  const cleanKey = (configStore.moviePilot.apiKey || "").trim();

  if (!cleanUrl || !cleanKey) {
    testResult.value = { type: "error", text: t("SetBase.moviepilot.fillUrlAndKey") };
    return;
  }
  if (!/^https?:\/\//i.test(cleanUrl)) {
    testResult.value = { type: "error", text: t("SetBase.moviepilot.invalidUrlProtocol") };
    return;
  }

  configStore.moviePilot.url = cleanUrl;
  configStore.moviePilot.apiKey = cleanKey;
  isTesting.value = true;
  testResult.value = null;

  try {
    const userRes = await sendMessage("moviePilotHttpRequest", {
      url: `${cleanUrl}/api/v1/user/current`,
      method: "GET",
      headers: { "X-Api-Key": cleanKey, Accept: "application/json" },
      timeout: 8000,
    });

    if (userRes.status === 200) {
      const userData = unwrapMpJson(userRes.responseText);
      const userName = userData?.name || userData?.user_name || "";
      const { clients } = await loadRemoteOptions(cleanUrl, cleanKey);
      if (!configStore.moviePilot.enabled) {
        configStore.moviePilot.enabled = true;
      }
      await sendMessage("updateMoviePilotConfig", { ...configStore.moviePilot });
      void configStore.$save();

      const clientInfo = clients.length > 0 ? clients.join(", ") : t("SetBase.moviepilot.noClientsDetected");
      testResult.value = {
        type: "success",
        text: t("SetBase.moviepilot.verifySuccess", {
          user: userName ? ` (${userName})` : "",
          clients: clientInfo,
        }),
      };
    } else if (userRes.isTimeout) {
      testResult.value = { type: "error", text: t("SetBase.moviepilot.verifyTimeout") };
    } else {
      testResult.value = {
        type: "error",
        text: t("SetBase.moviepilot.verifyFailed", { status: userRes.status || "ERR" }),
      };
    }
  } catch (err: any) {
    testResult.value = {
      type: "error",
      text: err?.message || t("SetBase.moviepilot.verifyNetworkError"),
    };
  } finally {
    isTesting.value = false;
  }
}

async function clearConnectionConfig() {
  ensureMoviePilotState();
  configStore.moviePilot.url = "";
  configStore.moviePilot.apiKey = "";
  configStore.moviePilot.defaultDownloader = "";
  configStore.moviePilot.defaultSavePath = "";
  remoteClients.value = [];
  remotePaths.value = [];
  testResult.value = null;
  await sendMessage("updateMoviePilotConfig", { ...configStore.moviePilot });
  void configStore.$save();
  runtimeStore.showSnackbar(t("SetBase.moviepilot.clearedToast"), { color: "info" });
}

function beforeSave() {
  ensureMoviePilotState();
  configStore.moviePilot.url = (configStore.moviePilot.url || "").trim().replace(/\/+$/, "");
  configStore.moviePilot.apiKey = (configStore.moviePilot.apiKey || "").trim();
}

onMounted(() => {
  ensureMoviePilotState();
  if (configStore.moviePilot.url && configStore.moviePilot.apiKey) {
    void loadRemoteOptions(configStore.moviePilot.url, configStore.moviePilot.apiKey);
  }
});

defineExpose({ beforeSave });
</script>

<template>
  <div class="space-y-6">
    <!-- 独立总开关行 -->
    <div
      :class="[
        'flex items-center justify-between gap-4 rounded-xl border px-4 py-3 shadow-2xs transition-colors',
        configStore.moviePilot.enabled ? 'border-primary/40 bg-primary/[0.03]' : 'border-border/80 bg-card',
      ]"
    >
      <div class="flex min-w-0 items-center gap-3">
        <div class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Clapperboard class="size-4" />
        </div>
        <div class="flex min-w-0 flex-wrap items-center gap-2">
          <span class="text-sm font-semibold text-foreground">{{ t("SetBase.moviepilot.enableTitle") }}</span>
          <Badge :variant="configStore.moviePilot.enabled ? 'default' : 'secondary'" class="h-4.5 px-1.5 text-[10px]">
            {{ configStore.moviePilot.enabled ? t("SetBase.moviepilot.statusOn") : t("SetBase.moviepilot.statusOff") }}
          </Badge>
          <Tooltip :content="t('SetBase.moviepilot.enableDesc')" side="top">
            <HelpCircle class="size-3.5 shrink-0 text-muted-foreground/75" />
          </Tooltip>
        </div>
      </div>

      <Switch :model-value="Boolean(configStore.moviePilot.enabled)" @update:model-value="handleToggleEnabled" />
    </div>

    <!-- 服务器连接与默认推送设置 -->
    <section class="space-y-2">
      <div class="flex items-center gap-1.5 px-1">
        <h2 class="text-xs font-medium text-muted-foreground">{{ t("SetBase.moviepilot.serverCardTitle") }}</h2>
        <Tooltip :content="t('SetBase.moviepilot.serverCardDesc')" side="top">
          <HelpCircle class="size-3.5 shrink-0 text-muted-foreground/75" />
        </Tooltip>
      </div>
      <div class="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xs">
        <div class="space-y-4 p-4">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div class="space-y-1.5">
              <Label class="text-xs font-medium text-muted-foreground">{{ t("SetBase.moviepilot.serverUrl") }}</Label>
              <Input
                v-model="configStore.moviePilot.url"
                placeholder="http://192.168.1.100:3000"
                @keydown.enter.prevent="testAndSaveConnection"
              />
            </div>

            <div class="space-y-1.5">
              <div class="flex items-center gap-1.5">
                <Label class="text-xs font-medium text-muted-foreground">{{ t("SetBase.moviepilot.apiKey") }}</Label>
                <Tooltip :content="t('SetBase.moviepilot.apiKeyHint')" side="top">
                  <HelpCircle class="size-3.5 shrink-0 text-muted-foreground/75" />
                </Tooltip>
              </div>
              <div class="relative flex items-center">
                <Input
                  v-model="configStore.moviePilot.apiKey"
                  :type="showApiKey ? 'text' : 'password'"
                  class="pr-9"
                  placeholder="MoviePilot API_TOKEN"
                  @keydown.enter.prevent="testAndSaveConnection"
                />
                <button
                  type="button"
                  class="absolute right-2.5 inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                  @click="showApiKey = !showApiKey"
                >
                  <EyeOff v-if="showApiKey" class="size-3.5" />
                  <Eye v-else class="size-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div class="space-y-1.5">
              <Label class="text-xs font-medium text-muted-foreground">{{ t("SetBase.moviepilot.themeMode") }}</Label>
              <Select
                :model-value="configStore.moviePilot.themeMode"
                @update:model-value="
                  (v) => {
                    configStore.moviePilot.themeMode = v as 'auto' | 'light' | 'dark';
                    handleAutoSaveSwitch();
                  }
                "
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">{{ t("SetBase.moviepilot.themeAuto") }}</SelectItem>
                  <SelectItem value="light">{{ t("SetBase.moviepilot.themeLight") }}</SelectItem>
                  <SelectItem value="dark">{{ t("SetBase.moviepilot.themeDark") }}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="space-y-1.5">
              <Label class="text-xs font-medium text-muted-foreground">{{
                t("SetBase.moviepilot.defaultDownloader")
              }}</Label>
              <Select
                :model-value="configStore.moviePilot.defaultDownloader || '__mp_default__'"
                @update:model-value="
                  (v) => {
                    configStore.moviePilot.defaultDownloader = v === '__mp_default__' ? '' : String(v);
                    handleAutoSaveSwitch();
                  }
                "
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__mp_default__">{{ t("SetBase.moviepilot.letMpDecide") }}</SelectItem>
                  <SelectItem
                    v-if="
                      configStore.moviePilot.defaultDownloader &&
                      !remoteClients.includes(configStore.moviePilot.defaultDownloader)
                    "
                    :value="configStore.moviePilot.defaultDownloader"
                  >
                    {{ configStore.moviePilot.defaultDownloader }}
                  </SelectItem>
                  <SelectItem v-for="c in remoteClients" :key="c" :value="c">{{ c }}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="space-y-1.5">
              <Label class="text-xs font-medium text-muted-foreground">{{
                t("SetBase.moviepilot.defaultSavePath")
              }}</Label>
              <Select
                :model-value="configStore.moviePilot.defaultSavePath || '__mp_default__'"
                @update:model-value="
                  (v) => {
                    configStore.moviePilot.defaultSavePath = v === '__mp_default__' ? '' : String(v);
                    handleAutoSaveSwitch();
                  }
                "
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__mp_default__">{{ t("SetBase.moviepilot.autoRulePath") }}</SelectItem>
                  <SelectItem
                    v-if="
                      configStore.moviePilot.defaultSavePath &&
                      !remotePaths.includes(configStore.moviePilot.defaultSavePath)
                    "
                    :value="configStore.moviePilot.defaultSavePath"
                  >
                    {{ configStore.moviePilot.defaultSavePath }}
                  </SelectItem>
                  <SelectItem v-for="p in remotePaths" :key="p" :value="p">{{ p }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <!-- 验证结果反馈条 -->
          <div
            v-if="testResult"
            :class="[
              'flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-xs leading-relaxed',
              testResult.type === 'success'
                ? 'border-success/35 bg-success/10 text-success'
                : 'border-destructive/35 bg-destructive/10 text-destructive',
            ]"
          >
            <CheckCircle2 v-if="testResult.type === 'success'" class="mt-0.5 size-4 shrink-0" />
            <XCircle v-else class="mt-0.5 size-4 shrink-0" />
            <span class="whitespace-pre-line">{{ testResult.text }}</span>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-end gap-2 bg-muted/20 px-4 py-2.5">
          <Button variant="outline" size="sm" :disabled="isTesting" @click="clearConnectionConfig">
            <Trash2 class="size-3.5" />
            <span>{{ t("SetBase.moviepilot.clearBtn") }}</span>
          </Button>
          <Button variant="default" size="sm" :disabled="isTesting" @click="testAndSaveConnection">
            <Loader2 v-if="isTesting" class="size-3.5 animate-spin" />
            <RefreshCw v-else class="size-3.5" />
            <span>{{ t("SetBase.moviepilot.verifyAndSaveBtn") }}</span>
          </Button>
        </div>
      </div>
    </section>

    <!-- 详情页内联识别行为偏好 -->
    <section class="space-y-2">
      <h2 class="px-1 text-xs font-medium text-muted-foreground">{{ t("SetBase.moviepilot.behaviorCardTitle") }}</h2>
      <div class="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xs">
        <div class="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/25">
          <div class="flex min-w-0 items-center gap-1.5">
            <span class="text-sm font-medium text-foreground">{{ t("SetBase.moviepilot.showSpecs") }}</span>
            <Tooltip :content="t('SetBase.moviepilot.showSpecsDesc')" side="top">
              <HelpCircle class="size-3.5 shrink-0 text-muted-foreground/75" />
            </Tooltip>
          </div>
          <Switch
            :model-value="configStore.moviePilot.showSpecs"
            @update:model-value="(v) => handleToggleBoolField('showSpecs', v)"
          />
        </div>

        <div class="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/25">
          <div class="flex min-w-0 items-center gap-1.5">
            <span class="text-sm font-medium text-foreground">{{ t("SetBase.moviepilot.subAutoFillSpecs") }}</span>
            <Tooltip :content="t('SetBase.moviepilot.subAutoFillSpecsDesc')" side="top">
              <HelpCircle class="size-3.5 shrink-0 text-muted-foreground/75" />
            </Tooltip>
          </div>
          <Switch
            :model-value="configStore.moviePilot.subAutoFillSpecs"
            @update:model-value="(v) => handleToggleBoolField('subAutoFillSpecs', v)"
          />
        </div>

        <div class="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/25">
          <div class="flex min-w-0 items-center gap-1.5">
            <span class="text-sm font-medium text-foreground">{{ t("SetBase.moviepilot.debugLog") }}</span>
            <Tooltip :content="t('SetBase.moviepilot.debugLogDesc')" side="top">
              <HelpCircle class="size-3.5 shrink-0 text-muted-foreground/75" />
            </Tooltip>
          </div>
          <Switch
            :model-value="configStore.moviePilot.debug"
            @update:model-value="(v) => handleToggleBoolField('debug', v)"
          />
        </div>
      </div>
    </section>
  </div>
</template>
