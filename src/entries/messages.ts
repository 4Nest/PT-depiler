import { defineExtensionMessaging } from "@webext-core/messaging";
import type {
  IAdvancedSearchRequestConfig,
  ISearchResult,
  ISiteUserConfig,
  ITorrent,
  IUserInfo,
  TSiteID,
  getFaviconMetadata,
} from "@ptd/site";
import type { IBackupData, IBackupFileInfo } from "@ptd/backupServer";
import type { TExtensionStorageKey, IExtensionStorageSchema } from "@/storage.ts";
import {
  ILoggerItem,
  IRestoreOptions,
  IDownloaderMetadata,
  TBackupFields,
  IDownloadTorrentOption,
  IDownloadTorrentResult,
  AugmentedRequired,
} from "@/shared/types.ts";

import { isDebug } from "~/helper.ts";

type TMessageMap = Record<string, (data: any) => any>;

interface ProtocolMap extends TMessageMap {
  // 1. 与 chrome 相关的功能，需要在 service worker 中注册，主要供 offscreen, options 使用
  ping<T extends any>(data?: T): T extends undefined ? "pong" : T;
  openOptionsPage(url?: string | { path: string; query?: Record<string, any> }): void;

  // 1.1 chrome.downloads
  downloadFile(downloadOptions: chrome.downloads.DownloadOptions): number;

  // 1.2 chrome.storage
  getExtStorage<T extends TExtensionStorageKey>(key: T): IExtensionStorageSchema[T];
  setExtStorage<T extends TExtensionStorageKey>(data: { key: T; value: IExtensionStorageSchema[T] }): void;

  // 1.3 chrome.declarativeNetRequest
  updateDNRSessionRules(data: { rule: chrome.declarativeNetRequest.Rule; extOnly?: boolean }): void;
  removeDNRSessionRuleById(data: chrome.declarativeNetRequest.Rule["id"]): void;

  // 1.4 chrome.alarms
  reDownloadTorrent(data: AugmentedRequired<IDownloadTorrentOption, "downloadId" | "leftInterval">): void;

  // 1.5 chrome.cookies
  getAllCookies(data: chrome.cookies.GetAllDetails): chrome.cookies.Cookie[];
  setCookie(data: chrome.cookies.SetDetails): void;
  getCookie(data: chrome.cookies.CookieDetails): chrome.cookies.Cookie | null;
  removeCookie(data: chrome.cookies.CookieDetails | chrome.cookies.SetDetails): chrome.cookies.CookieDetails;
  checkAndExtendCookies(url: string): void;

  // 2. 在 offscreen 中注册，涉及页面解析等功能，主要供 options 使用
  logger(data: ILoggerItem): void;
  getLogger(): ILoggerItem[];
  clearLogger(): void;

  // 2.1 站点基础 ( utils/site )
  getSiteUserConfig(data: { siteId: TSiteID; flush?: boolean }): ISiteUserConfig;
  getSiteFavicon(data: { site: TSiteID | getFaviconMetadata; flush?: boolean }): string;
  clearSiteFaviconCache(): void;

  // 2.2 站点搜索、搜索快照 ( utils/search )
  getSiteSearchResult(data: {
    siteId: TSiteID;
    keyword?: string;
    searchEntry?: IAdvancedSearchRequestConfig;
  }): ISearchResult;
  // 2.3 下载器 ( utils/download )
  getDownloaderConfig(downloaderId: string): IDownloaderMetadata;
  getDownloaderVersion(downloaderId: string): string;
  getTorrentDownloadLink(torrent: ITorrent): string;
  downloadTorrent(data: IDownloadTorrentOption): IDownloadTorrentResult;
  // 2.4 用户信息 ( utils/userInfo )
  getSiteUserInfoResult(siteId: TSiteID): IUserInfo;
  setSiteLastUserInfo(userInfo: IUserInfo): void;
  cancelUserInfoQueue(): void;
  getSiteUserInfo(siteId: TSiteID): Record<string, IUserInfo>;
  removeSiteUserInfo(data: { siteId: TSiteID; date: string[] }): void;

  /**
   * content-script 引导用：判断该 URL 命中哪个站点，以及该站点是否允许注入。
   * 只需 host → siteId 一项判断，因此不再把整份 metadata store 搬到页面上下文。
   */
  matchSitePage(url: string): { siteId: TSiteID; allowContentScript: boolean } | null;
  // 2.6 备份/恢复 ( utils/backup )
  exportBackupData(data: { backupServerId: string | "local"; backupFields: TBackupFields[] }): boolean;
  getBackupHistory(data: string): IBackupFileInfo[];
  deleteBackupHistory(data: { backupServerId: string; path: string }): boolean;
  applyBackupRetention(data: { backupServerId: string; keepFilename?: string }): IBackupFileInfo[];
  restoreBackupData(data: { restoreData: IBackupData; restoreOptions?: IRestoreOptions }): boolean;
  getRemoteBackupData(data: { backupServerId: string; path: string; decryptKey?: string }): IBackupData;

  // 2.9 Lightweight list queries (for CLI discovery)
  getSiteList(): Array<{ id: string; name: string; url: string; offline: boolean }>;
  getDownloaderList(): Array<{ id: string; name: string; type: string; enabled: boolean; address: string }>;
}

// 全局消息处理函数映射
const messageMaps: Partial<ProtocolMap> = {};

/**
 * 为 sendMessage 和 onMessage 创建一个包装器
 * 如果 sendMessage 和 onMessage 对应的 type 是在同一个 tab 中创建的，则直接调用，不然传递给 chrome.{runtime, tab}.sendMessage
 * 有效避免 chrome 中 background 是 server worker + offscreen, 而 firefox 中是 background script
 * 而导致的 chrome.runtime.sendMessage 无响应的问题
 */
function createMessageWrapper<PM extends ProtocolMap>(original: {
  sendMessage: <K extends keyof PM>(type: K, data: Parameters<PM[K]>[0]) => Promise<ReturnType<PM[K]>>;
  onMessage: <K extends keyof PM>(
    type: K,
    handler: (message: { data: Parameters<PM[K]>[0] }) => void | Promise<ReturnType<PM[K]>>,
  ) => void;
}) {
  // 包装后的 onMessage：将异步处理函数存入 messageMaps
  const wrappedOnMessage = <K extends keyof PM>(
    type: K,
    handler: (message: { data: Parameters<PM[K]>[0] }) => void | Promise<ReturnType<PM[K]>>,
  ) => {
    // @ts-expect-error
    messageMaps[type] = handler;
    original.onMessage(type, handler);
  };

  // 包装后的 sendMessage：优先使用 messageMaps 中的异步处理函数
  const wrappedSendMessage = async <K extends keyof PM>(
    type: K,
    data: Parameters<PM[K]>[0],
  ): Promise<ReturnType<PM[K]>> => {
    // @ts-expect-error
    const localHandler = messageMaps[type] as PM[K] | undefined;

    // 深拷贝数据，避免 Vue 响应式 Proxy 或其他不可序列化对象进入消息链路引发 DataCloneError。
    // 原实现仅对 firefox 生效，Chrome/Edge 下同样存在该问题（见 issue #1431），
    // 故对所有浏览器统一执行深拷贝。
    if (typeof data !== "undefined") {
      data = JSON.parse(JSON.stringify(data));
    }

    if (localHandler) {
      return await localHandler({ data }); // 执行本地异步处理
    }

    return await original.sendMessage(type, data); // 执行远程异步调用
  };

  return {
    sendMessage: wrappedSendMessage,
    onMessage: wrappedOnMessage,
  };
}

export const { sendMessage, onMessage } = createMessageWrapper(
  defineExtensionMessaging<ProtocolMap>({
    logger: __BROWSER__ == "firefox" || isDebug ? console : undefined,
  }),
);

/**
 * 用户信息刷新队列被主动取消（`cancelUserInfoQueue` → p-queue 的 `clear()`）时抛出的稳定错误信息。
 *
 * p-queue 10 起 `clear()` 会以 AbortError 结束被移除的排队任务，但 AbortError 是 DOMException，
 * 经 `sendMessage` 跨上下文序列化后无法可靠识别，因此 offscreen 侧统一归一化成这个信息再抛给调用方。
 */
export const USER_INFO_QUEUE_CANCELLED = "USER_INFO_QUEUE_CANCELLED";

export function isUserInfoQueueCancelledError(error: unknown): boolean {
  return (error as Error | undefined)?.message === USER_INFO_QUEUE_CANCELLED;
}
