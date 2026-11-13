import { AbstractBittorrentClient, type DownloaderBaseConfig, type TorrentClientMetaData } from "./types";
import { cloneDeep } from "es-toolkit";

export * from "./types";
export { getRemoteTorrentFile } from "./utils";

interface downloaderEntity {
  default: AbstractBittorrentClient;
  clientConfig: DownloaderBaseConfig;
  clientMetaData: TorrentClientMetaData;
}

export const requireContext = import.meta.glob<downloaderEntity>("./entity/*.ts");
export const entityList = Object.keys(requireContext).map((value: string) => {
  return value.replace(/^\.\/entity\//, "").replace(/\.ts$/, "");
}) as string[];

// 从 requireContext 中获取对应模块
export async function getDownloaderModule(configType: string): Promise<downloaderEntity> {
  return await requireContext[`./entity/${configType}.ts`]();
}

export async function getDownloaderDefaultConfig(type: string): Promise<DownloaderBaseConfig> {
  const mod = await getDownloaderModule(type);
  const config = cloneDeep(mod.clientConfig);
  // 填入/覆盖 缺失项：默认开启自动开始，且对支持绕过 CSRF 的客户端（如 qBittorrent）默认启用移除 Origin 头
  config.feature ??= {};
  config.feature.DefaultAutoStart ??= true;
  config.feature.BypassCSRF ??= Boolean(mod.clientMetaData?.feature?.BypassCSRF?.allowed);

  return config;
}

export async function getDownloaderMetaData(type: string): Promise<TorrentClientMetaData> {
  return cloneDeep((await getDownloaderModule(type)).clientMetaData);
}

export async function getDownloader(config: DownloaderBaseConfig): Promise<AbstractBittorrentClient> {
  const DownloaderClass = (await getDownloaderModule(config.type)).default;

  // @ts-ignore
  return new DownloaderClass(config);
}

export function getDownloaderIcon(type: string) {
  return `/icons/downloader/${type}.png`;
}
