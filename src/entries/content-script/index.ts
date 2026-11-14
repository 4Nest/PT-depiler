// This file is the entry point for the content script
//
// 此入口保持极度轻量（仅做当前页面是否需要挂载的判断），
// 重资源（Vue/站点包与 MoviePilot 引擎）分别在 assets/cs-app.js 与 assets/mp-inject.js 中按需动态加载。

import { sendMessage } from "@/messages.ts";
import type { IConfigPiniaStorageSchema, IMoviePilotConfig } from "@/shared/types/storages/config.ts";
import type * as CsAppModule from "./app/init.ts";
import type { IPtdData } from "./app/utils.ts";
import type * as MpInjectModule from "./moviepilot/index.ts";

let mpModulePromise: Promise<typeof MpInjectModule> | null = null;
let isMatchedPtdSite = false;

function isMoviePilotCandidateLocation(loc: Location, matchedPtdSite: boolean): boolean {
  const host = loc.hostname.toLowerCase();
  const path = loc.pathname;

  if (/\/details[^/]*\.php$/i.test(path)) return true;
  if (/\/forum\.php$/i.test(path) && /mod=viewthread/i.test(loc.search)) return true;
  if (host === "totheglory.im" && path.startsWith("/t/")) return true;
  if (host === "bangumi.moe" && path.startsWith("/torrent/")) return true;
  if (/(^|\.)acgnx\.se$/.test(host) && path.startsWith("/show-")) return true;
  if (/(^|\.)dmhy\.org$/.test(host) && path.startsWith("/topics/view/")) return true;
  if (/(^|\.)nyaa\.si$/.test(host) && path.startsWith("/view/")) return true;
  if (host === "mikanani.me" && /^\/Home\/Episode\//i.test(path)) return true;
  if (/(^|\.)m-team\.(cc|io)$/.test(host)) return true;
  if (host === "sunnypt.top" || /(^|\.)sunnypt\.top$/.test(host)) return true;
  if (host === "anibt.net" || /(^|\.)anibt\.net$/.test(host)) return true;

  if (matchedPtdSite && !/\.php$/i.test(path)) {
    return /\/(?:torrents?|detail|t|view|release)\/\d+/i.test(path);
  }

  return false;
}

function shouldRunMoviePilotOnLocation(): boolean {
  return isMoviePilotCandidateLocation(window.location, isMatchedPtdSite);
}

async function ensureMpModule(): Promise<typeof MpInjectModule> {
  if (!mpModulePromise) {
    // 静态 import 会将 235KB 引擎打入所有网页执行的 IIFE 引导脚本，此处必须通过运行时扩展 URL 按需加载独立 ESM 入口
    const mpUrl = chrome.runtime.getURL("assets/mp-inject.js");
    mpModulePromise = import(/* @vite-ignore */ mpUrl) as Promise<typeof MpInjectModule>;
  }
  return mpModulePromise;
}

async function syncMoviePilotState(mpConfig?: IMoviePilotConfig) {
  if (mpConfig?.enabled && shouldRunMoviePilotOnLocation()) {
    const mod = await ensureMpModule();
    mod.mountOrUpdateMoviePilot(mpConfig);
  } else if (mpModulePromise) {
    const mod = await mpModulePromise;
    mod.unmountMoviePilot();
  }
}

async function loadApp(props: IPtdData) {
  // 静态 import 会将完整 Vue + 站点定义打入 IIFE 引导脚本，必须通过运行时扩展 URL 按需加载
  const appUrl = chrome.runtime.getURL("assets/cs-app.js");
  console.debug("[PTD] loading app from", appUrl);
  const { mountApp } = (await import(/* @vite-ignore */ appUrl)) as typeof CsAppModule;
  console.debug("[PTD] app module loaded");
  await mountApp(document, props);
  console.debug("[PTD] app mounted");
}

sendMessage("getExtStorage", "config").then(async (data) => {
  const configStore = data as IConfigPiniaStorageSchema | undefined;

  const siteMatchPromise = sendMessage("matchSitePage", window.location.href).catch(() => null);

  if (configStore?.contentScript?.enabled ?? true) {
    siteMatchPromise.then(async (siteMatch) => {
      if (!siteMatch) return;
      isMatchedPtdSite = true;

      if (configStore?.moviePilot?.enabled) {
        void syncMoviePilotState(configStore.moviePilot);
      }

      if (!siteMatch.allowContentScript) {
        console.debug(`[PTD] Content script is disabled for site: ${siteMatch.siteId}`);
        return;
      }

      console.debug(`[PTD] host found for site: ${siteMatch.siteId}, loading app...`);
      await loadApp({ siteId: siteMatch.siteId });
    });
  }

  // 对未加入 PTD 站点但属于 MoviePilot 原生支持的详情页（如公网动漫站或新 PT 站），直接按开关启动
  if (configStore?.moviePilot?.enabled && isMoviePilotCandidateLocation(window.location, false)) {
    void syncMoviePilotState(configStore.moviePilot);
  }
});

// 监听配置实时变更：开关关闭时立即卸载清理，开关开启或修改参数时免刷新实时生效
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes.config) return;
  let nextConfig = changes.config.newValue as IConfigPiniaStorageSchema | string | undefined;
  if (typeof nextConfig === "string") {
    try {
      nextConfig = JSON.parse(nextConfig) as IConfigPiniaStorageSchema;
    } catch {
      return;
    }
  }
  if (nextConfig && typeof nextConfig === "object") {
    void syncMoviePilotState(nextConfig.moviePilot);
  }
});
