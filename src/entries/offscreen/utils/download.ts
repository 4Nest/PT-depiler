import axios, { type AxiosRequestConfig } from "axios";
import { toMerged } from "es-toolkit";
import { isEmpty } from "es-toolkit/compat";

import { stringifyQuery } from "@ptd/utils/url.ts";

import {
  getDownloader,
  getDownloaderMetaData,
  getRemoteTorrentFile,
  type CAddTorrentOptions,
  type TorrentClientStatus,
} from "@ptd/downloader";
import type { ITorrent } from "@ptd/site";

import { onMessage, sendMessage } from "@/messages.ts";
import type {
  IConfigPiniaStorageSchema,
  IDownloaderMetadata,
  IMetadataPiniaStorageSchema,
  TTorrentDownloadStatus,
  IDownloadTorrentOption,
  IDownloadTorrentResult,
  AugmentedRequired,
} from "@/shared/types.ts";

import { logger } from "./logger.ts";
import { getSiteInstance } from "./site.ts";

type TLocalDownloadOption = AugmentedRequired<IDownloadTorrentOption, "downloadId" | "localDownloadMethod">;
type TRemoteDownloadOption = AugmentedRequired<
  IDownloadTorrentOption,
  "downloadId" | "downloaderId" | "addTorrentOptions"
>;

let nextDownloadTaskId = 1;

export async function getDownloaderConfig(downloaderId: string) {
  const metadataStore = (await sendMessage("getExtStorage", "metadata")) as IMetadataPiniaStorageSchema;
  return metadataStore?.downloaders?.[downloaderId] ?? ({} as IDownloaderMetadata);
}

type DownloaderInstance = Awaited<ReturnType<typeof getDownloader>>;

const downloaderInstanceCache = new Map<string, { configKey: string; instance: DownloaderInstance }>();

function getDownloaderConfigKey(config: IDownloaderMetadata): string {
  const { id, type, address, username, password, timeout } = config;
  return JSON.stringify({ id, type, address, username, password, timeout });
}

export async function getDownloaderInstance(downloaderId: string): Promise<DownloaderInstance | null> {
  const downloaderConfig = await getDownloaderConfig(downloaderId);
  if (!downloaderConfig.id) return null;

  const configKey = getDownloaderConfigKey(downloaderConfig);
  const cached = downloaderInstanceCache.get(downloaderId);
  if (cached && cached.configKey === configKey) {
    return cached.instance;
  }

  const instance = await getDownloader(downloaderConfig);
  downloaderInstanceCache.set(downloaderId, { configKey, instance });
  return instance;
}

onMessage("getDownloaderConfig", async ({ data: downloaderId }) => await getDownloaderConfig(downloaderId));

onMessage("getDownloaderList", async () => {
  const metadata = (await sendMessage("getExtStorage", "metadata")) as IMetadataPiniaStorageSchema;
  const downloaders = metadata?.downloaders ?? {};
  return Object.entries(downloaders).map(([id, config]) => ({
    id,
    name: config.name ?? "",
    type: config.type ?? "",
    enabled: config.enabled ?? false,
    address: config.address ?? "",
  }));
});

onMessage("getDownloaderVersion", async ({ data: downloaderId }) => {
  let downloaderVersion = "unknown";

  const downloaderInstance = await getDownloaderInstance(downloaderId);
  if (downloaderInstance) {
    downloaderVersion = await downloaderInstance.getClientVersion();
  }

  return downloaderVersion;
});

onMessage("getDownloaderStatus", async ({ data: downloaderId }) => {
  let downloaderStatus: TorrentClientStatus = { dlSpeed: 0, upSpeed: 0, dlData: 0, upData: 0 };

  const downloaderInstance = await getDownloaderInstance(downloaderId);
  if (downloaderInstance) {
    downloaderStatus = await downloaderInstance.getClientStatus();
  }

  return downloaderStatus;
});

export async function getTorrentDownloadLink(torrent: ITorrent) {
  const site = await getSiteInstance<"public">(torrent.site);
  return await site.getTorrentDownloadLink(torrent);
}

onMessage("getTorrentDownloadLink", async ({ data: torrent }) => await getTorrentDownloadLink(torrent));

// 下载器能力元数据（feature 声明）
onMessage("getDownloaderMetaData", async ({ data: downloaderId }) => {
  const downloaderConfig = await getDownloaderConfig(downloaderId);
  if (!downloaderConfig.type) {
    return undefined;
  }
  return await getDownloaderMetaData(downloaderConfig.type);
});

const lastSiteDownloadAt = new Map<string, number>();

async function downloadTorrent(downloadOption: IDownloadTorrentOption): Promise<IDownloadTorrentResult> {
  const configStoreRaw = (await sendMessage("getExtStorage", "config")) as IConfigPiniaStorageSchema;

  // 0. 解析传来的下载参数
  const { torrent, downloaderId = "local", addTorrentOptions = {} as CAddTorrentOptions } = downloadOption;
  const isDownloadToLocalFile: boolean = downloaderId === "local";

  // 1. 分配内存级递增任务号，追踪单次下载与站点间隔延迟重排
  const downloadId = downloadOption.downloadId ?? nextDownloadTaskId++;
  downloadOption.downloadId = downloadId;
  logger({ msg: `generate download torrent task #${downloadId}`, data: downloadOption });

  let downloadStatus: TTorrentDownloadStatus = "pending";
  let errorMessage: string | undefined;

  // 2. 构建下载链接的请求配置（蓝光原盘大体积 .torrent 动态生成可能耗时 20~60s+，默认放宽至 120s）
  let downloadRequestConfig: AxiosRequestConfig = { url: torrent.link, method: "GET", timeout: 120e3 };
  if (torrent.site) {
    const siteInstance = await getSiteInstance<"public">(torrent.site);

    if (
      siteInstance.downloadInterval > 0 &&
      !(isDownloadToLocalFile && configStoreRaw?.download?.ignoreSiteDownloadIntervalWhenLocalDownload)
    ) {
      const leftInterval =
        siteInstance.downloadInterval * 1000 - (new Date().getTime() - (lastSiteDownloadAt.get(torrent.site) ?? 0));

      if (leftInterval > 0) {
        logger({ msg: `Site ${torrent.site} download interval not reached, waiting...` });
        sendMessage("reDownloadTorrent", { ...downloadOption, downloadId, leftInterval }).catch();
        return {
          downloadId,
          downloadStatus: "pending",
        };
      }

      lastSiteDownloadAt.set(torrent.site, new Date().getTime());
    }

    if (!isDownloadToLocalFile && (siteInstance.userConfig?.uploadSpeedLimit ?? 0) > 0) {
      addTorrentOptions.uploadSpeedLimit = siteInstance.userConfig.uploadSpeedLimit;
    }

    downloadRequestConfig = toMerged(
      downloadRequestConfig,
      await siteInstance.getTorrentDownloadRequestConfig(torrent as ITorrent),
    );
  }

  try {
    downloadStatus = "downloading";
    if (isDownloadToLocalFile) {
      downloadOption.localDownloadMethod ??= configStoreRaw?.download?.localDownloadMethod ?? "web";
      const localResult = await downloadTorrentToLocalFile(
        downloadOption as TLocalDownloadOption,
        downloadRequestConfig,
      );
      downloadStatus = localResult.downloadStatus;
      errorMessage = localResult.errorMessage;
    } else {
      addTorrentOptions.localDownload ??= true;
      if (!(configStoreRaw?.download?.allowDirectSendToClient ?? false)) {
        addTorrentOptions.localDownload = true;
      }
      downloadOption.addTorrentOptions = addTorrentOptions;
      const remoteResult = await downloadTorrentToRemote(
        downloadOption as TRemoteDownloadOption,
        downloadRequestConfig,
      );
      downloadStatus = remoteResult.downloadStatus;
      errorMessage = remoteResult.errorMessage;
    }
  } catch (e) {
    downloadStatus = "failed";
    errorMessage = getErrorMessage(e);
  }

  return { downloadId, downloadStatus, errorMessage };
}

onMessage("downloadTorrent", async ({ data: downloadOption }) => await downloadTorrent(downloadOption));

async function downloadTorrentToLocalFile(
  downloadOption: TLocalDownloadOption,
  downloadRequestConfig: AxiosRequestConfig,
): Promise<Pick<IDownloadTorrentResult, "downloadStatus" | "errorMessage">> {
  let { torrent, localDownloadMethod = "web" } = downloadOption;
  let downloadStatus: TTorrentDownloadStatus = "downloading";
  let errorMessage: string | undefined;

  const downloadUri = axios.getUri(downloadRequestConfig);
  const {
    method: downloadMethod = "GET",
    data: downloadData = {},
    headers: downloadHeaders = {} as Record<string, string>,
  } = downloadRequestConfig;

  if (localDownloadMethod === "web") {
    if (downloadMethod.toUpperCase() === "GET" && isEmpty(downloadHeaders)) {
      logger({ msg: `Download torrent file with web method: ${downloadUri}` });
      window.open(downloadUri, "_blank");
      return { downloadStatus: "completed", errorMessage };
    } else {
      localDownloadMethod = "extension";
    }
  }

  if (localDownloadMethod === "browser" && ["GET", "POST"].includes(downloadMethod.toUpperCase())) {
    try {
      const downloadOptions: chrome.downloads.DownloadOptions = {
        url: downloadUri,
        conflictAction: "uniquify",
        method: downloadMethod.toUpperCase() as "GET" | "POST",
      };

      if (downloadMethod.toUpperCase() === "POST" && !isEmpty(downloadData ?? {})) {
        downloadOptions.body = stringifyQuery(downloadData);
      }

      if (!isEmpty(downloadHeaders)) {
        downloadOptions.headers = Object.entries(downloadHeaders).map(([name, value]) => ({ name, value }));
      }

      logger({ msg: `Download torrent file with browser method: ${downloadUri}`, data: downloadOptions });
      await sendMessage("downloadFile", downloadOptions);
      return { downloadStatus: "completed", errorMessage };
    } catch (e) {
      localDownloadMethod = "extension";
    }
  } else {
    localDownloadMethod = "extension";
  }

  if (localDownloadMethod === "extension") {
    try {
      logger({ msg: `Download torrent file with extension method: ${downloadUri}`, data: downloadRequestConfig });

      const torrentInstance = await getRemoteTorrentFile(downloadRequestConfig);
      const torrentUrl = URL.createObjectURL(torrentInstance.metadata.blob());
      let filename = torrentInstance.name;
      if (filename === "1.torrent") {
        filename = `[${torrent.site}] ${torrent.title}.torrent`;
      }

      await sendMessage("downloadFile", { url: torrentUrl, filename, conflictAction: "uniquify" });
      downloadStatus = "completed";
      URL.revokeObjectURL(torrentUrl);
    } catch (e) {
      downloadStatus = "failed";
      errorMessage = getErrorMessage(e);
    }
  }

  return { downloadStatus, errorMessage };
}

async function downloadTorrentToRemote(
  downloadOption: TRemoteDownloadOption,
  downloadRequestConfig: AxiosRequestConfig,
): Promise<Pick<IDownloadTorrentResult, "downloadStatus" | "errorMessage">> {
  const { torrent, downloaderId, addTorrentOptions } = downloadOption;
  let downloadStatus: TTorrentDownloadStatus = "failed";
  let errorMessage: string | undefined;

  const downloaderConfig = await getDownloaderConfig(downloaderId);
  if (downloaderConfig.id && downloaderConfig.enabled) {
    const downloaderInstance = await getDownloaderInstance(downloaderId);
    if (!downloaderInstance) {
      return { downloadStatus, errorMessage: `Downloader not found: ${downloaderId}` };
    }
    if (addTorrentOptions.localDownload) {
      addTorrentOptions.localDownloadOption = downloadRequestConfig;
    }

    const loggerData: Record<string, unknown> = { torrent, downloaderId, downloadRequestConfig, addTorrentOptions };
    try {
      logger({ msg: "downloadTorrentToDownloader", data: loggerData });
      const addTorrentResult = await downloaderInstance.addTorrent(downloadRequestConfig.url!, addTorrentOptions);
      loggerData.addTorrentResult = addTorrentResult;
      if (addTorrentResult?.success === true) {
        logger({ msg: "Successfully added torrent to downloader", data: loggerData });
        downloadStatus = "completed";
      } else {
        logger({ msg: "Failed to add torrent to downloader", data: loggerData });
        errorMessage = getErrorMessage(addTorrentResult?.message || "Downloader rejected the torrent");
      }
    } catch (e) {
      logger({ msg: "Error adding torrent to downloader", data: loggerData });
      errorMessage = getErrorMessage(e);
    }
  } else {
    errorMessage = `Downloader is missing or disabled: ${downloaderId}`;
  }

  return { downloadStatus, errorMessage };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
