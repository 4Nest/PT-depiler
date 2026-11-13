/**
 * @JackettDefinitions https://github.com/Jackett/Jackett/blob/master/src/Jackett.Common/Definitions/hdarea.yml
 * @PTPPDefinitions https://github.com/pt-plugins/PT-Plugin-Plus/blob/dev/resource/sites/hdarea.co/config.json
 * @ApiDocs https://hdarea.club/api_docs.php (RESTful JSON API v1)
 */
import { isAxiosError, type AxiosRequestConfig, type AxiosResponse } from "axios";
import { set } from "es-toolkit/compat";

import {
  CFBlockedError,
  EResultParseStatus,
  ETorrentStatus,
  NeedLoginError,
  NoUserInputError,
  type ISearchEntryRequestConfig,
  type ISearchInput,
  type ISearchResult,
  type ISiteMetadata,
  type ITorrent,
  type ITorrentTag,
  type IUserInfo,
} from "../types";
import NexusPHP, {
  CategoryInclbookmarked,
  CategoryIncldead,
  CategorySpstate,
  SchemaMetadata,
} from "../schemas/NexusPHP.ts";
import { guessUserLevelId, normalizeTorrentPromotion, parseSizeString, parseValidTimeString } from "../utils";

interface IHDAreaApiResp<T> {
  success: boolean;
  code: number;
  http_code: number;
  message: string;
  timestamp: number;
  data: T;
}

interface IHDAreaUserProfile {
  id: number;
  username: string;
  class: number;
  class_name: string;
  title?: string;
  avatar?: string;
  enabled: boolean;
  parked: boolean;
  donor: boolean;
  vip_until: string | null;
  svip: boolean;
  added: string;
  last_access: string;
  uploaded: number;
  downloaded: number;
  share_ratio: number;
  seedtime: number;
  leechtime: number;
  seedbonus: number;
  hourly_bonus: number;
  hourly_bonus_detail?: {
    total_per_hour?: number;
  };
  invites: number;
  temp_invites?: number;
  seeding_count: number;
  seeding_size: number;
  leeching_count: number;
  uploaded_torrents_count: number;
  completed_torrents_count: number;
  unread_messages_count: number;
}

interface IHDAreaApiTorrentItem {
  id: number;
  name: string;
  small_descr?: string;
  category_id: number;
  category_name: string;
  team_id?: number;
  team_name?: string;
  size: number;
  seeders: number;
  leechers: number;
  times_completed: number;
  comments: number;
  added: string;
  added_ts?: number;
  pos_state?: string;
  picktype?: string;
  first_upload?: boolean;
  forbid_transfer?: boolean;
  tags?: Array<string | { name?: string; color?: string }>;
  sp_state?: number;
  sp_state_name?: string;
  download_volume_factor?: number;
  upload_volume_factor?: number;
  is_free?: boolean;
  imdb_id?: string | null;
  douban_id?: string | null;
  poster_url?: string | null;
  anonymous?: boolean;
  uploader_name?: string | null;
  info_hash?: string | null;
  detail_url?: string;
  download_url?: string;
  user_status?: string;
  user_progress?: number;
}

interface IHDAreaTorrentsData {
  items: IHDAreaApiTorrentItem[];
  pagination?: {
    page: number;
    per_page: number;
    total: number;
  };
}

interface IHDAreaGenDlTokenData {
  ok: boolean;
  id: number;
  dl_token?: string;
  download_url?: string;
  url?: string;
}

const OFFICIAL_TEAM_IDS = new Set([1, 2, 8, 11]); // EPiC, HDArea, HDApad, HDATV
const API_MULTI_FILTER_KEYS = [
  "cat",
  "source",
  "medium",
  "codec",
  "audiocodec",
  "standard",
  "processing",
  "team",
] as const;

export const siteMetadata: ISiteMetadata = {
  ...SchemaMetadata,

  version: 2,
  id: "hdarea",
  name: "HDArea",
  aka: ["高清视界", "好大"],
  tags: ["影视", "综合"],
  timezoneOffset: "+0800",

  collaborator: ["lzl20110", "zhuweitung"],

  type: "private",
  schema: "NexusPHP",

  urls: ["uggcf://uqnern.pyho/"],
  legacyUrls: ["https://www.hdarea.co/"],

  officialGroupPattern: [/[@-]\s?(HDArea|EPiC|HDATV|HDApad)\b/i],

  category: [
    {
      name: "类型",
      key: "cat",
      options: [
        { name: "Movie UHD-4K", value: 300 },
        { name: "Movies Blu-ray", value: 401 },
        { name: "Movies REMUX", value: 415 },
        { name: "Movies 3D", value: 416 },
        { name: "Movies 1080p", value: 410 },
        { name: "Movies 720p", value: 411 },
        { name: "Movies DVD", value: 414 },
        { name: "Movies WEB-DL", value: 412 },
        { name: "Movies HDTV", value: 413 },
        { name: "Movies iPad", value: 417 },
        { name: "Documentaries", value: 404 },
        { name: "Animations", value: 405 },
        { name: "TV Series", value: 402 },
        { name: "TV Shows", value: 403 },
        { name: "Music Videos", value: 406 },
        { name: "Sports", value: 407 },
        { name: "Misc", value: 409 },
        { name: "HQ Audio", value: 408 },
      ],
      cross: { mode: "append" },
    },
    {
      name: "媒介",
      key: "medium",
      options: [
        { name: "Blu-ray", value: 1 },
        { name: "REMUX", value: 3 },
        { name: "Encode", value: 7 },
        { name: "WEB-DL", value: 9 },
        { name: "MiniBD", value: 4 },
        { name: "HDTV", value: 5 },
        { name: "HD DVD", value: 2 },
        { name: "DVDR", value: 6 },
        { name: "CD", value: 8 },
      ],
      cross: { mode: "append" },
    },
    {
      name: "编码",
      key: "codec",
      options: [
        { name: "H.264(x264/AVC)", value: 7 },
        { name: "H.265(x265/HEVC)", value: 6 },
        { name: "AV1", value: 8 },
        { name: "VP8/9", value: 9 },
        { name: "AVS", value: 10 },
        { name: "MPEG-4", value: 1 },
        { name: "MPEG-2", value: 4 },
        { name: "Xvid", value: 3 },
        { name: "VC-1", value: 2 },
        { name: "Other", value: 5 },
      ],
      cross: { mode: "append" },
    },
    {
      name: "音频编码",
      key: "audiocodec",
      options: [
        { name: "AAC", value: 6 },
        { name: "DD5.1/AC-3", value: 5 },
        { name: "DD2.0/AC-3", value: 11 },
        { name: "DDP/E-AC-3", value: 16 },
        { name: "DDP Atmos", value: 15 },
        { name: "TrueHD", value: 7 },
        { name: "TrueHD Atmos", value: 10 },
        { name: "DTS", value: 3 },
        { name: "DTS-HD MA", value: 4 },
        { name: "DTS-HD HR/HRA", value: 13 },
        { name: "DTS:X", value: 12 },
        { name: "LPCM", value: 8 },
        { name: "FLAC", value: 1 },
        { name: "ALAC", value: 22 },
        { name: "APE", value: 2 },
        { name: "WAV", value: 9 },
        { name: "Opus", value: 25 },
      ],
      cross: { mode: "append" },
    },
    {
      name: "分辨率",
      key: "standard",
      options: [
        { name: "4K", value: 5 },
        { name: "1080p", value: 1 },
        { name: "1080i", value: 2 },
        { name: "720p", value: 3 },
        { name: "SD", value: 4 },
      ],
      cross: { mode: "append" },
    },
    {
      name: "制作组",
      key: "team",
      options: [
        { name: "HDArea", value: 2 },
        { name: "EPiC", value: 1 },
        { name: "HDATV", value: 11 },
        { name: "HDApad", value: 8 },
        { name: "HDWING", value: 3 },
        { name: "WiKi", value: 4 },
        { name: "TTG", value: 5 },
        { name: "MTeam", value: 7 },
        { name: "CHD", value: 9 },
        { name: "HDAccess", value: 10 },
        { name: "cXcY", value: 12 },
        { name: "CMCT", value: 13 },
        { name: "other", value: 6 },
      ],
      cross: { mode: "append" },
    },
    CategoryIncldead,
    CategorySpstate,
    CategoryInclbookmarked,
  ],

  search: {
    ...SchemaMetadata.search,
    requestConfig: {
      ...SchemaMetadata.search.requestConfig,
      params: {
        ...SchemaMetadata.search.requestConfig!.params,
        search_area: 0,
        search_mode: 0,
      },
    },
    advanceKeywordParams: {
      imdb: {
        requestConfigTransformer: ({ requestConfig: config }) => {
          set(config!, "params.search_area", 4);
          return config!;
        },
      },
      douban: {
        requestConfigTransformer: ({ requestConfig: config }) => {
          set(config!, "params.search_area", 5);
          return config!;
        },
      },
    },
    selectors: {
      ...SchemaMetadata.search.selectors!,
      rows: {
        selector: "table.torrents > tbody > tr:has(table.torrentname)",
      },
      title: {
        ...SchemaMetadata.search.selectors!.title!,
        selector: [
          "a[href^='details.php?id='][title]:has(b)",
          "a[href*='details.php?id='][href*='hit']",
          "a[href*='hit'][title]",
          "a[href*='hit']:has(b)",
          "a[onmouseover*='get_ext_info_ajax']",
        ],
      },
      subTitle: {
        text: "",
        selector: [
          "a[href^='details.php?id='][title]:has(b)",
          "a[href*='details.php?id='][href*='hit']",
          "a[href*='hit'][title]",
          "a[href*='hit']:has(b)",
          "a[onmouseover*='get_ext_info_ajax']",
        ],
        elementProcess: (element: HTMLElement) => {
          const titleDiv = element.closest("td > div");
          const subtitleEl = titleDiv?.nextElementSibling;
          if (subtitleEl instanceof HTMLElement && subtitleEl.tagName === "DIV") {
            const clone = subtitleEl.cloneNode(true) as HTMLElement;
            clone.querySelectorAll("span, a, img, font").forEach((el) => el.remove());
            return clone.textContent?.trim() ?? "";
          }
          return "";
        },
      },
      tags: [
        ...SchemaMetadata.search.selectors!.tags!,
        { name: "首发", selector: "img.first_publish", color: "#3887D7" },
        { name: "禁转", selector: "img.transfer_forbidden", color: "#5E14DA" },
      ],
    },
  },

  detail: {
    ...SchemaMetadata.detail,
    selectors: {
      ...SchemaMetadata.detail.selectors,
      link: {
        selector: [`td:contains("下载链接") + td`, 'a[href*="download.php?id="]'],
        elementProcess: (element: HTMLElement) => {
          if (element.tagName.toLowerCase() === "a") {
            return element.getAttribute("href") ?? "";
          }
          const textNode = element?.childNodes[0];
          return textNode?.textContent?.trim() ?? "";
        },
      },
    },
  },

  userInfo: {
    ...SchemaMetadata.userInfo,
    selectors: {
      ...SchemaMetadata.userInfo.selectors!,
    },
    process: SchemaMetadata.userInfo.process!.map((item) =>
      item.requestConfig?.url === "/mybonus.php" ? { ...item, fields: [...(item.fields ?? []), "seedingSize"] } : item,
    ),
  },

  userInputSettingMeta: [
    {
      name: "apiKey",
      label: "API Key",
      hint: "推荐：在 控制面板 → 安全设定 → API Key 存取令牌管理 中创建 32 位令牌（勾选 read + download 权限）；留空则回退 Cookie 网页解析",
      required: false,
    },
  ],

  levelRequirements: [
    {
      id: 0,
      name: "User",
      privilege: "新用户的默认级别",
    },
    {
      id: 1,
      name: "Power User",
      interval: "P4W",
      downloaded: "50GB",
      ratio: 1.05,
      privilege:
        '得到1个邀请名额；可以直接发布种子；可以查看NFO文档；可以请求续种；可以发送邀请（开放邀请权限时）；可以查看其它用户的种子历史(如果用户隐私等级未设置为"强")；可以删除自己上传的字幕。',
    },
    { id: 2, name: "Elite User", interval: "P8W", downloaded: "120GB", ratio: 3.0, privilege: "权限同上。" },
    {
      id: 3,
      name: "Crazy User",
      interval: "P10W",
      downloaded: "300GB",
      ratio: 3.5,
      privilege: "可以在做种/下载/发布的时候选择匿名模式。",
    },
    {
      id: 4,
      name: "Insane User",
      interval: "P12W",
      downloaded: "750GB",
      ratio: 4.0,
      privilege: "可以查看普通日志。Insane User及以上用户封存账号后不会被删除。",
    },
    {
      id: 5,
      name: "Veteran User",
      interval: "P20W",
      downloaded: "1024GB",
      ratio: 4.5,
      isKept: true,
      privilege: "可以查看其它用户的评论、帖子历史。Veteran User及以上用户会永远保留账号。",
    },
    {
      id: 6,
      name: "Extreme User",
      interval: "P25W",
      downloaded: "2TB",
      ratio: 5.0,
      isKept: true,
      privilege: "可以更新过期的外部信息；可以查看Extreme User论坛。",
    },
    {
      id: 7,
      name: "Ultimate User",
      interval: "P30W",
      downloaded: "5TB",
      ratio: 5.5,
      isKept: true,
      privilege: "得到1个邀请名额。",
    },
    {
      id: 8,
      name: "Nexus Master",
      interval: "P40W",
      downloaded: "10TB",
      ratio: 6.0,
      isKept: true,
      privilege: "得到2个邀请名额。",
    },
  ],
};

export default class HDArea extends NexusPHP {
  private get apiKey(): string {
    return String(this.userConfig.inputSetting?.apiKey ?? "").trim();
  }

  public override async request<T>(
    axiosConfig: AxiosRequestConfig,
    checkLogin: boolean = true,
  ): Promise<AxiosResponse<T>> {
    const reqUrl = axiosConfig.url ?? "";
    if (this.apiKey.length > 0 && (reqUrl.startsWith("/api/") || reqUrl.includes("/api.php"))) {
      axiosConfig.responseType ??= "json";
      axiosConfig.headers = {
        Accept: "application/json",
        ...(axiosConfig.headers ?? {}),
        "X-API-Key": this.apiKey,
      };
    }
    return super.request<T>(axiosConfig, checkLogin);
  }

  protected override loggedCheck(res: AxiosResponse<any>): boolean {
    if (res.data && typeof res.data === "object" && "success" in res.data && "code" in res.data) {
      if (res.status === 401 || res.status === 403 || res.data.http_code === 401 || res.data.http_code === 403) {
        return false;
      }
      return res.data.success === true && res.data.code === 0;
    }
    return super.loggedCheck(res);
  }

  private mapApiUserStatus(status?: string, progress?: number): ETorrentStatus {
    switch ((status ?? "").toLowerCase()) {
      case "seeding":
        return ETorrentStatus.seeding;
      case "leeching":
      case "downloading":
        return ETorrentStatus.downloading;
      case "completed":
        return ETorrentStatus.completed;
      case "incomplete":
      case "inactivity":
        return (progress ?? 0) >= 100 ? ETorrentStatus.completed : ETorrentStatus.inactive;
      default:
        return ETorrentStatus.unknown;
    }
  }

  /**
   * 将旧网页参数（如 cat401=1, medium7=1, search_area=4）无损转换为 /api/v1/torrents 标准查询参数
   */
  private buildApiSearchParams(rawKeywords?: string, searchEntry: ISearchEntryRequestConfig = {}): Record<string, any> {
    const mergedParams: Record<string, any> = {
      ...(this.metadata.search?.requestConfig?.params ?? {}),
      ...(searchEntry.requestConfig?.params ?? {}),
    };

    const apiParams: Record<string, any> = {
      per_page: 100,
    };

    // 聚合 append 模式生成的字段（如 cat401=1&cat415=1 -> cat=401,415）
    const bucketMap = new Map<string, Set<string>>();
    for (const prefix of API_MULTI_FILTER_KEYS) {
      bucketMap.set(prefix, new Set<string>());
    }

    for (const [key, val] of Object.entries(mergedParams)) {
      if (val === undefined || val === null || val === "" || key === "notnewword" || key === "search") continue;

      let matchedPrefix = false;
      for (const prefix of API_MULTI_FILTER_KEYS) {
        if (key === prefix) {
          const items = Array.isArray(val) ? val : String(val).split(",");
          items
            .map((x) => String(x).trim())
            .filter(Boolean)
            .forEach((x) => bucketMap.get(prefix)!.add(x));
          matchedPrefix = true;
          break;
        }
        const m = key.match(new RegExp(`^${prefix}(\\d+)$`));
        if (m && (val === 1 || val === "1" || val === true)) {
          bucketMap.get(prefix)!.add(m[1]);
          matchedPrefix = true;
          break;
        }
      }

      if (!matchedPrefix && ["spstate", "incldead", "inclbookmarked", "sort", "order"].includes(key)) {
        apiParams[key] = val;
      }
    }

    for (const [prefix, values] of bucketMap.entries()) {
      if (values.size > 0) {
        apiParams[prefix] = [...values].join(",");
      }
    }

    // 处理关键词及 imdb| / douban| 高级检索前缀
    const kw = (rawKeywords ?? "").trim();
    if (kw) {
      if (kw.startsWith("imdb|")) {
        apiParams.imdb = kw.slice(5).trim();
      } else if (kw.startsWith("douban|")) {
        apiParams.douban = kw.slice(7).trim();
      } else {
        apiParams.q = kw;
        apiParams.search_area = mergedParams.search_area ?? 0;
        apiParams.search_mode = mergedParams.search_mode ?? 0;
      }
    }

    return apiParams;
  }

  private transformApiTorrent(item: IHDAreaApiTorrentItem): ITorrent {
    const tags: ITorrentTag[] = [];

    if (item.team_id && OFFICIAL_TEAM_IDS.has(item.team_id)) {
      tags.push({ name: "官方" });
    }
    if (item.picktype && item.picktype.toLowerCase() === "hot") {
      tags.push({ name: "Hot", color: "amber" });
    }
    if (item.first_upload) {
      tags.push({ name: "首发", color: "#3887D7" });
    }
    if (item.forbid_transfer) {
      tags.push({ name: "禁转", color: "#5E14DA" });
    }
    if (Array.isArray(item.tags)) {
      for (const rawTag of item.tags) {
        if (typeof rawTag === "string" && rawTag.trim()) {
          tags.push({ name: rawTag.trim() });
        } else if (rawTag && typeof rawTag === "object" && rawTag.name) {
          tags.push({ name: rawTag.name, color: rawTag.color });
        }
      }
    }

    const dlFactor =
      typeof item.download_volume_factor === "number" ? item.download_volume_factor : item.is_free ? 0 : 1;
    const ulFactor = typeof item.upload_volume_factor === "number" ? item.upload_volume_factor : 1;

    const addedTime = item.added_ts ? item.added_ts * 1000 : (parseValidTimeString(item.added) as number);

    const torrent: Partial<ITorrent> = {
      site: this.metadata.id,
      id: item.id,
      title: item.name,
      subTitle: item.small_descr ?? "",
      cover: item.poster_url || undefined,
      url: item.detail_url || new URL(`/details.php?id=${item.id}`, this.url).toString(),
      link: item.download_url || undefined,
      infoHash: item.info_hash || undefined,
      time: addedTime,
      size: Number(item.size ?? 0),
      author: item.uploader_name ?? "",
      seeders: Number(item.seeders ?? 0),
      leechers: Number(item.leechers ?? 0),
      completed: Number(item.times_completed ?? 0),
      comments: Number(item.comments ?? 0),
      category: item.category_name || String(item.category_id ?? "Other"),
      tags,
      downloadVolumeFactor: dlFactor,
      uploadVolumeFactor: ulFactor,
      ext_imdb: item.imdb_id || null,
      ext_douban: item.douban_id || null,
      progress: typeof item.user_progress === "number" ? item.user_progress : 0,
      status: this.mapApiUserStatus(item.user_status, item.user_progress),
    };

    return normalizeTorrentPromotion(torrent) as ITorrent;
  }

  public override async getSearchResult(
    keywords?: string,
    searchEntry: ISearchEntryRequestConfig = {},
  ): Promise<ISearchResult> {
    if (this.apiKey.length === 0) {
      return super.getSearchResult(keywords, searchEntry);
    }

    const result: ISearchResult = {
      data: [],
      status: EResultParseStatus.unknownError,
    };

    if (!this.allowSearch) {
      result.status = EResultParseStatus.passParse;
      return result;
    }

    try {
      const params = this.buildApiSearchParams(keywords, searchEntry);
      const resp = await this.request<IHDAreaApiResp<IHDAreaTorrentsData>>({
        method: "GET",
        url: "/api/v1/torrents",
        params,
      });

      const items = resp.data?.data?.items ?? [];
      result.data = items.map((item) => this.transformApiTorrent(item));
      result.status = EResultParseStatus.success;
    } catch (e) {
      result.status = EResultParseStatus.parseError;
      if (e instanceof CFBlockedError) {
        result.status = EResultParseStatus.CFBlocked;
      } else if (e instanceof NeedLoginError) {
        result.status = EResultParseStatus.needLogin;
      } else if (e instanceof NoUserInputError) {
        result.status = EResultParseStatus.noUserInput;
      } else if (isAxiosError(e) && (e.response?.status === 401 || e.response?.status === 403)) {
        result.status = EResultParseStatus.needLogin;
      } else if (isAxiosError(e) && !e.response) {
        result.statusMsg = "i18n.networkError";
      }
    }

    return result;
  }

  public override async getUserInfoResult(lastUserInfo: Partial<IUserInfo> = {}): Promise<IUserInfo> {
    if (this.apiKey.length === 0) {
      return super.getUserInfoResult(lastUserInfo);
    }

    const flushUserInfo: IUserInfo = {
      status: EResultParseStatus.unknownError,
      updateAt: Date.now(),
      site: this.metadata.id,
    };

    if (!this.allowQueryUserInfo) {
      flushUserInfo.status = EResultParseStatus.passParse;
      return flushUserInfo;
    }

    try {
      const resp = await this.request<IHDAreaApiResp<IHDAreaUserProfile>>({
        method: "GET",
        url: "/api/v1/user/profile",
      });

      const profile = resp.data?.data;
      if (!profile || !profile.id) {
        flushUserInfo.status = EResultParseStatus.parseError;
        return flushUserInfo;
      }

      const joinTime = parseValidTimeString(profile.added);
      const lastAccessAt = parseValidTimeString(profile.last_access);
      const levelName = profile.class_name || "User";
      const uploaded = Number(profile.uploaded ?? 0);
      const downloaded = Number(profile.downloaded ?? 0);

      Object.assign(flushUserInfo, {
        id: profile.id,
        name: profile.username,
        levelName,
        isDonor: Boolean(profile.donor || profile.svip || profile.vip_until),
        uploaded,
        downloaded,
        ratio: Number(profile.share_ratio ?? (downloaded > 0 ? uploaded / downloaded : Infinity)),
        bonus: Number(profile.seedbonus ?? 0),
        bonusPerHour: Number(profile.hourly_bonus ?? profile.hourly_bonus_detail?.total_per_hour ?? 0),
        seeding: Number(profile.seeding_count ?? 0),
        seedingSize: Number(profile.seeding_size ?? 0),
        leeching: Number(profile.leeching_count ?? 0),
        uploads: Number(profile.uploaded_torrents_count ?? 0),
        invites: Number(profile.invites ?? 0) + Number(profile.temp_invites ?? 0),
        messageCount: Number(profile.unread_messages_count ?? 0),
        joinTime: typeof joinTime === "number" ? joinTime : undefined,
        lastAccessAt: typeof lastAccessAt === "number" ? lastAccessAt : undefined,
      });

      flushUserInfo.levelId = guessUserLevelId(flushUserInfo, this.metadata.levelRequirements ?? []);
      flushUserInfo.status = EResultParseStatus.success;
    } catch (e) {
      if (e instanceof CFBlockedError) {
        flushUserInfo.status = EResultParseStatus.CFBlocked;
      } else if (e instanceof NeedLoginError || (isAxiosError(e) && [401, 403].includes(e.response?.status ?? 0))) {
        flushUserInfo.status = EResultParseStatus.needLogin;
      } else {
        flushUserInfo.status = EResultParseStatus.parseError;
      }
    }

    return flushUserInfo;
  }

  public override async getTorrentDownloadLink(torrent: ITorrent): Promise<string> {
    if (torrent.link && /(?:dl_token|passkey|apikey|downhash)=/i.test(torrent.link)) {
      return torrent.link;
    }

    if (this.apiKey.length > 0) {
      let tid = torrent.id;
      if (!tid && torrent.url) {
        const m = torrent.url.match(/[?&]id=(\d+)/);
        if (m) tid = m[1];
      }

      if (tid) {
        try {
          const resp = await this.request<IHDAreaApiResp<IHDAreaGenDlTokenData>>(
            {
              method: "POST",
              url: "/api/v1/torrents/genDlToken",
              data: { id: Number(tid) },
              headers: { "Content-Type": "application/json" },
            },
            false,
          );
          const dlUrl = resp.data?.data?.download_url || resp.data?.data?.url;
          if (dlUrl) {
            torrent.link = dlUrl;
            return dlUrl;
          }
        } catch {
          // 若子令牌未勾选签发短效 token 或网络抖动，回退带 apikey 的标准直链
        }

        const fallbackUrl = new URL(
          `/download.php?id=${tid}&apikey=${encodeURIComponent(this.apiKey)}`,
          this.url,
        ).toString();
        torrent.link = fallbackUrl;
        return fallbackUrl;
      }
    }

    return super.getTorrentDownloadLink(torrent);
  }

  // ===== 以下保留未填写 API Key 时的 Cookie 网页解析兼容逻辑 =====

  private async getDataCountFromSeedingPage(userId: number, type?: string): Promise<number | null> {
    const page = await this.requestUserSeedingPage(userId, type);
    if (!page) return null;
    const match = page.match(/data-count=['"](\d+)['"]/);
    return match ? parseInt(match[1], 10) : null;
  }

  protected async parseUserInfoForSeedingSize(
    flushUserInfo: Partial<IUserInfo>,
    dataDocument: Document,
  ): Promise<Partial<IUserInfo>> {
    const bodyText = dataDocument.documentElement?.innerHTML ?? "";
    const sizeMatch = bodyText.match(/做种总积\s*<b>([\d.]+)\s*([ZEPTGMK]?i?B)/);
    if (sizeMatch) {
      flushUserInfo.seedingSize = parseSizeString(`${sizeMatch[1]} ${sizeMatch[2]}`);
    }
    return flushUserInfo;
  }

  protected override async parseUserInfoForSeedingStatus(
    flushUserInfo: Partial<IUserInfo>,
  ): Promise<Partial<IUserInfo>> {
    const count = await this.getDataCountFromSeedingPage(flushUserInfo.id as number);
    return { ...flushUserInfo, seeding: count ?? 0 };
  }

  protected override async parseUserInfoForUploads(flushUserInfo: Partial<IUserInfo>): Promise<Partial<IUserInfo>> {
    const userId = flushUserInfo.id as number;
    flushUserInfo.uploads = (await this.getDataCountFromSeedingPage(userId, "uploaded")) ?? 0;
    return flushUserInfo;
  }

  protected override parseTorrentRowForTags(
    torrent: Partial<ITorrent>,
    row: Element | Document,
    searchConfig: ISearchInput,
  ): Partial<ITorrent> {
    super.parseTorrentRowForTags(torrent, row, searchConfig);

    // 仅扫描标题表格内的标签元素，避免误把时间/大小列的 font 混入
    const customTags = row.querySelectorAll("table.torrentname font[class]:not(.new)");
    if (customTags.length > 0) {
      const tags: ITorrentTag[] = torrent.tags || [];
      customTags.forEach((element) => {
        const htmlElement = element as HTMLElement;
        const tagName = htmlElement.textContent?.replace(/\s/g, "").replace("免费", "Free");
        if (tagName) {
          tags.push({ name: tagName });
        }
      });
      torrent.tags = tags;
    }

    return torrent;
  }
}
