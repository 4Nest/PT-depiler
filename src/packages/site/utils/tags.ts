import type { ITorrentTag } from "../types/torrent";

interface IPreDefinedTorrentTag extends ITorrentTag {
  aka?: Array<string | RegExp>;
}

/**
 * 由于部分站点可能有动态标签情况，此处预定义一些比较基础的标签重新映射名称和颜色，以避免相同性质标签过多重复
 * 如果 site.getSearchResult 返回 tag name 命中 name 或者 aka 中的字段（不区分大小写），会直接替换为对应的 name 和 color
 *
 * color 请从 https://vuetifyjs.com/en/styles/colors/#material-colors 页面查找
 */
export const preDefinedTorrentTagMap: IPreDefinedTorrentTag[] = [
  // 优惠类
  { name: "NL.", color: "deep-purple", aka: ["Neutral", "0流量%"] }, // 中性种子（0xUP & 0xDL）
  { name: "Freeload", color: "red", aka: [] }, // Freeload
  { name: "2xFree", color: "green", aka: [] }, // 免费下载 + 2x 上传
  { name: "2xUp", color: "lime", aka: [] }, // 2x 上传
  { name: "2x50%", color: "light-green", aka: [] }, // 2x 上传 + 50% 下载
  { name: "1.5xUp", color: "light-green", aka: [] }, // 1.5x 上传
  { name: "25%", color: "purple", aka: [] }, // 25% 下载
  { name: "30%", color: "indigo", aka: [] }, // 30% 下载
  { name: "35%", color: "indigo-darken-3", aka: [] }, // 35% 下载
  { name: "50%", color: "orange", aka: [] }, // 50% 下载
  { name: "70%", color: "blue-grey", aka: [] }, // 70% 下载
  { name: "75%", color: "lime-darken-3", aka: [] }, // 75% 下载
  { name: "Free", color: "blue", aka: [] }, // 免费下载
  { name: "可退款", color: "gray", aka: ["Refund"] }, // 定期退还下载量

  // 站点属性类
  { name: "官方", color: "blue-darken-2", aka: ["官组", "官种", "Internal"] },
  { name: "Hot", color: "yellow-lighten-1", aka: ["热门", "熱門"] },
  { name: "H&R", color: "red", aka: ["HnR"] }, // 需要 H&R
  { name: "Excl.", color: "deep-orange-darken-1", aka: ["独家", "限转", "禁转"] }, // 禁止转载
  { name: "VIP", color: "orange-darken-2", aka: [] }, // 仅 VIP 可下载

  // 种子属性类
  { name: "DIY", color: "brown", aka: ["自定义"] },

  { name: "中字", color: "pink-darken-1", aka: ["中文", "简体"] },
  { name: "繁体", color: "amber-darken-3", aka: ["繁中"] },
  { name: "国语", color: "cyan-darken-2", aka: ["国配", "普通话", "中配", /国语$/] },
  { name: "粤语", color: "teal-darken-1", aka: ["粤配"] },

  { name: "4K", color: "teal-darken-3", aka: ["4p", "2160p", /4 ?[Kk]/] },
  { name: "1080p", color: "teal-darken-1", aka: [] },

  { name: "WEB-DL", color: "green-darken-2", aka: ["WEB DL", /WEB\.?DL/] },
  { name: "Blu-ray", color: "blue-darken-3", aka: ["蓝光", /Blu[-]?ray/] },

  { name: "H265", color: "indigo", aka: ["HEVC", "x265", /H\.?265/] },

  { name: "HDR", color: "purple", aka: ["HDR10", "HDR10+"] },
  { name: "HLG", color: "deep-purple", aka: ["Hybrid Log-Gamma", /混合对数伽玛/] },
  { name: "DoVi", color: "pink", aka: ["Dolby Vision", "DV", /杜比(视界)*/, /DOLBY\s?VISION/] },
] as const;

export type TPreDefinedTorrentTagName = (typeof preDefinedTorrentTagMap)[number]["name"];

export const preDefinedTorrentTagNameSet: Array<string> = preDefinedTorrentTagMap.map((item) => item.name);

// 构建一个中间态的转换 Map
export const normalizedTorrentTagMap: Array<{ from: RegExp; to: ITorrentTag }> = preDefinedTorrentTagMap.flatMap(
  (tagMap) => {
    const to = { name: tagMap.name, color: tagMap.color };
    const fromRaw = [tagMap.name, ...(tagMap.aka ?? [])];

    const retNormalized: Array<{ from: RegExp; to: ITorrentTag }> = [];

    // 将字符串类型的 from 转换为正则表达式
    retNormalized.push({
      from: new RegExp(fromRaw.filter((t) => typeof t === "string").join("|"), "i"),
      to,
    });

    // 将 正则表达式类型的 from 直接加入
    fromRaw
      .filter((t) => t instanceof RegExp)
      .forEach((regExp) => {
        retNormalized.push({ from: regExp as RegExp, to });
      });

    return retNormalized;
  },
);

export function sortTorrentTags(tags: ITorrentTag[]) {
  return tags.toSorted((a, b) => {
    const aIndex = preDefinedTorrentTagNameSet.findIndex((ntt) => ntt === a.name);
    const bIndex = preDefinedTorrentTagNameSet.findIndex((ntt) => ntt === b.name);
    return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
  });
}

const SAFE_BARE_TAG_ALIASES: Record<string, string[]> = {
  HDR: ["HDR10+", "HDR10", "HDRVivid", "菁彩HDR", "HDR"],
  DoVi: ["Dolby Vision", "杜比视界", "DoVi", "DV"],
  HLG: ["HLG"],
  H265: ["H.265", "H265", "HEVC", "x265"],
  "Blu-ray": ["UHD Blu-ray", "Blu-ray", "BluRay"],
  "WEB-DL": ["WEB-DL", "WEBDL"],
  "4K": ["2160p", "4K"],
  "1080p": ["1080p"],
  中字: ["中文字幕", "中英字幕", "特效字幕", "官字组", "官字", "中字", "简繁"],
  繁体: ["繁中", "繁体"],
  国语: ["国语", "国配", "中配", "普通话"],
  粤语: ["粤语", "粤配", "台配"],
  "Excl.": ["限时禁转", "禁转", "限转", "禁轉", "限轉", "独家", "Excl."],
  DIY: ["DIY原盘", "DIY"],
  官方: ["官方", "官种", "官组", "Internal"],
  Hot: ["热门", "熱門", "Hot"],
  "H&R": ["H&R", "HnR"],
  VIP: ["VIP"],
};

/**
 * 即使站点未单独配置对应 tag selector（或用户在 UI 隐藏了某标签），
 * 出现在副标题最左侧且不带规格分隔符时也无歧义属于 PT 标签的专用词。
 */
const ALWAYS_SAFE_PT_TAG_TOKENS = [
  "中文字幕",
  "中英字幕",
  "特效字幕",
  "官字组",
  "官字",
  "中字",
  "繁中",
  "简繁",
  "国语",
  "国配",
  "中配",
  "普通话",
  "粤语",
  "粤配",
  "台配",
  "限时禁转",
  "禁转",
  "限转",
  "禁轉",
  "限轉",
  "Excl.",
  "DIY原盘",
  "DIY",
  "HDR10+",
  "HDR10",
  "HDRVivid",
  "菁彩HDR",
  "Dolby Vision",
  "杜比视界",
  "DoVi",
  "HLG",
  "官种",
  "官组",
  "零魔",
  "应求",
  "驻站",
  "H&R",
  "HnR",
] as const;

/**
 * 单独出现在句首时可能与正常影视片名重合的标签词：
 * 仅当「后接另一个已知标签词（构成多标签粘连簇）」或「前面已剥离过至少一个粘连标签且本种子拥有该标签」时才剥离。
 */
const CONTEXTUAL_BARE_WORDS: Record<string, RegExp | true> = {
  官方: /^(?:机密|旗舰|公告|通报|声明)/,
  热门: /^(?:话题|事件|人物)/,
  熱門: /^(?:話題|事件|人物)/,
  Hot: true,
  Free: true,
  独家: /^(?:记忆|新闻|专访|报道|内幕|试驾)/,
  原创: /^(?:剧本|音乐|歌曲)/,
  原生: /^(?:家庭|态|之罪)/,
  动画: /^(?:世界|片|电影|工坊|大师|王国|大放映)/,
  完结: /^(?:篇|版)/,
  首发: /^(?:阵容|站)/,
  活动: /^(?:假人|鬼屋)/,
  合集: true,
  其他: true,
  繁体: /^(?:字)/,
};

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchLeadingToken(text: string, token: string): string | null {
  const endsWithAsciiWord = /[A-Za-z0-9+]$/.test(token);
  const boundary = endsWithAsciiWord ? "(?![A-Za-z0-9.+])" : "";
  const re = new RegExp(`^${escapeRegExp(token)}${boundary}[\\s]*`, "i");
  const m = text.match(re);
  if (!m) return null;
  const rest = text.slice(m[0].length).trim();
  // 保护剩余内容非空，且不以 Gazelle 规格分隔符（如 "2160p / HEVC"）开头
  if (!rest || /^[/|,·\-:：]/.test(rest)) return null;
  return rest;
}

/**
 * 剥离副标题最左侧因站点 DOM 标签未隔离而粘连的标签文字
 *（如 "官方国语粤语中字官字组DIY动画HDR10禁转天气之子..." -> "天气之子..."），
 * 同时保护 Gazelle 等站形如 "2160p / HEVC / ..." 的规格副标题与《官方机密》等正常片名不被误删。
 */
export function cleanSubTitleTagPrefixes(
  subTitle: string | number | undefined,
  tags?: ITorrentTag[],
  rawTagNames?: string[],
): string {
  if (subTitle === undefined || subTitle === null) return "";
  let cur = String(subTitle).trim();
  if (!cur) return "";

  const activeTagNames = new Set<string>();
  for (const t of tags ?? []) {
    if (t?.name) activeTagNames.add(t.name.trim());
  }
  for (const name of rawTagNames ?? []) {
    if (name?.trim()) activeTagNames.add(name.trim());
  }

  const bracketCandidates = new Set<string>(ALWAYS_SAFE_PT_TAG_TOKENS);
  const unconditionalBare = new Set<string>(ALWAYS_SAFE_PT_TAG_TOKENS);
  const contextualBare = new Set<string>();

  for (const name of activeTagNames) {
    bracketCandidates.add(name);
    // 跳过百分比或倍数优惠标签裸词（如 50%、30%、2x），避免误伤数字开头片名（如《50%的恋爱》）
    if (/^\d+%$|^\d+(?:\.\d+)?x/i.test(name)) continue;

    const aliases = SAFE_BARE_TAG_ALIASES[name] ?? [name];
    for (const token of aliases) {
      bracketCandidates.add(token);
      if (token.length > 14) continue;
      if (CONTEXTUAL_BARE_WORDS[token]) {
        contextualBare.add(token);
      } else {
        unconditionalBare.add(token);
      }
    }
  }

  const sortedBracket = [...bracketCandidates].filter(Boolean).sort((a, b) => b.length - a.length);
  const sortedUnconditional = [...unconditionalBare].filter(Boolean).sort((a, b) => b.length - a.length);
  const sortedContextual = [...contextualBare].filter(Boolean).sort((a, b) => b.length - a.length);
  const allKnownBare = [...new Set([...sortedUnconditional, ...sortedContextual])].sort((a, b) => b.length - a.length);

  const startsWithAnotherTag = (text: string, excludeLower: string): boolean => {
    for (const nextToken of allKnownBare) {
      if (nextToken.toLowerCase() === excludeLower) continue;
      if (matchLeadingToken(text, nextToken) !== null) return true;
    }
    for (const nextToken of sortedBracket) {
      const re = new RegExp(`^[\\s]*[\\[【]${escapeRegExp(nextToken)}[\\]】]`, "i");
      if (re.test(text)) return true;
    }
    return false;
  };

  const consumedContextual = new Set<string>();
  let strippedCount = 0;
  let changed = true;
  let guard = 0;

  while (changed && guard < 20) {
    changed = false;
    guard++;

    // 1. 优先剥离头部带方括号包裹的已知标签，如 [禁转] / [热门]
    for (const token of sortedBracket) {
      const re = new RegExp(`^[\\s]*[\\[【]${escapeRegExp(token)}[\\]】][\\s]*`, "i");
      const m = cur.match(re);
      if (m) {
        const rest = cur.slice(m[0].length).trim();
        if (rest.length > 0 && !/^[/|,·\-:：]/.test(rest)) {
          cur = rest;
          strippedCount++;
          changed = true;
          break;
        }
      }
    }
    if (changed) continue;

    // 2. 剥离无歧义 PT 专用标签裸词（如 中字 / 国语 / 粤语 / 官字组 / DIY / HDR10 / 禁转）
    for (const token of sortedUnconditional) {
      const rest = matchLeadingToken(cur, token);
      if (rest !== null) {
        cur = rest;
        strippedCount++;
        changed = true;
        break;
      }
    }
    if (changed) continue;

    // 3. 剥离上下文受保护标签词（如 官方 / 动画 / 原创 / 热门）：
    //    需满足：(a) 后接另一个已知标签词（构成 2+ 标签连缀簇）；或 (b) 前面已剥离过粘连标签且不构成受保护合成词。
    for (const token of sortedContextual) {
      const lower = token.toLowerCase();
      if (consumedContextual.has(lower)) continue;
      const rest = matchLeadingToken(cur, token);
      if (rest === null) continue;

      const followedByTag = startsWithAnotherTag(rest, lower);
      const compoundGuard = CONTEXTUAL_BARE_WORDS[token];
      const formsProtectedCompound = compoundGuard instanceof RegExp && compoundGuard.test(rest);

      if (followedByTag || (strippedCount > 0 && !formsProtectedCompound)) {
        consumedContextual.add(lower);
        cur = rest;
        strippedCount++;
        changed = true;
        break;
      }
    }
  }

  return cur;
}
