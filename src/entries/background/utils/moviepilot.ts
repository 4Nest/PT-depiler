import { onMessage } from "@/messages.ts";
import { extStorage } from "@/storage.ts";
import type { IConfigPiniaStorageSchema, IMoviePilotConfig } from "@/shared/types.ts";

const DEFAULT_MOVIEPILOT_CONFIG: IMoviePilotConfig = {
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

const EXTRA_ALLOWED_HOSTS = new Set(["api.m-team.cc", "api.m-team.io", "api.sunnypt.top"]);

function extractHostname(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.hostname.toLowerCase();
  } catch {
    return "";
  }
}

let configWriteQueue: Promise<IMoviePilotConfig> = Promise.resolve(DEFAULT_MOVIEPILOT_CONFIG);

onMessage("updateMoviePilotConfig", async ({ data: patch }) => {
  const run = async (): Promise<IMoviePilotConfig> => {
    const rawConfig = ((await extStorage.getItem("config")) ?? {}) as IConfigPiniaStorageSchema;
    const merged: IMoviePilotConfig = {
      ...DEFAULT_MOVIEPILOT_CONFIG,
      ...(rawConfig.moviePilot ?? {}),
      ...patch,
    };
    await extStorage.setItem("config", {
      ...rawConfig,
      moviePilot: merged,
    });
    return merged;
  };
  configWriteQueue = configWriteQueue.then(run, run);
  return configWriteQueue;
});

onMessage("moviePilotHttpRequest", async ({ data }) => {
  const targetHost = extractHostname(data.url);
  if (!targetHost) {
    return { status: 0, responseText: "Invalid target URL", errorMessage: "Invalid target URL" };
  }

  // 安全守卫：仅放行已配置的 MoviePilot 实例域名、带 X-Api-Key 验证中的 MoviePilot 实例或 M-Team/SunnyPT 元数据接口
  const rawConfig = (await extStorage.getItem("config")) as IConfigPiniaStorageSchema | null;
  const configuredHost = extractHostname(rawConfig?.moviePilot?.url ?? "");
  const hasMpApiKeyHeader = Boolean(data.headers?.["X-Api-Key"] || data.headers?.["x-api-key"]);

  if (targetHost !== configuredHost && !EXTRA_ALLOWED_HOSTS.has(targetHost) && !hasMpApiKeyHeader) {
    return {
      status: 0,
      responseText: "Blocked by MoviePilot host guard",
      errorMessage: "Blocked by MoviePilot host guard",
    };
  }

  const controller = new AbortController();
  const timeoutMs = Math.max(1000, Math.min(Number(data.timeout) || 15000, 60000));
  const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);

  try {
    const method = (data.method || "GET").toUpperCase();
    const response = await fetch(data.url, {
      method,
      headers: data.headers ?? {},
      body: method === "GET" || method === "HEAD" ? undefined : data.data,
      credentials: "omit",
      signal: controller.signal,
    });
    const responseText = await response.text();
    return {
      status: response.status,
      responseText,
    };
  } catch (err: any) {
    const aborted = controller.signal.aborted;
    return {
      status: 0,
      responseText: aborted ? "请求超时（后端可能仍在处理）" : err?.message || "网络请求失败",
      isTimeout: aborted,
      errorMessage: err?.message || String(err),
    };
  } finally {
    clearTimeout(timer);
  }
});
