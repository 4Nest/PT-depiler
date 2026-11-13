import { uniqBy } from "es-toolkit";
import {
  cleanSubTitleTagPrefixes,
  normalizeTorrentPromotion,
  normalizedTorrentTagMap,
  sortTorrentTags,
  type TPatterns,
} from "@ptd/site";

import { onMessage, sendMessage } from "@/messages.ts";
import type { IConfigPiniaStorageSchema } from "@/shared/types.ts";

import { logger } from "./logger.ts";
import { getSiteInstance } from "./site.ts";

onMessage("getSiteSearchResult", async ({ data: { siteId, keyword = "", searchEntry = {} } }) => {
  const configStorage = (await sendMessage("getExtStorage", "config")) as IConfigPiniaStorageSchema;

  logger({
    msg: `getSiteSearchResult For site: ${siteId} with keyword: ${keyword}`,
    data: { siteId, keyword, searchEntry },
  });
  const site = await getSiteInstance<"public">(siteId);

  let searchResult = await site.getSearchResult(keyword, searchEntry);

  if (searchResult.data.length > 0) {
    let autoDetectOfficialGroupFromTitlePattern: TPatterns | undefined;
    if (configStorage?.searchEntity?.autoDetectOfficialGroupFromTitle && site.metadata.officialGroupPattern?.length) {
      autoDetectOfficialGroupFromTitlePattern = site.metadata.officialGroupPattern;
    }

    searchResult.data = searchResult.data.map((item) => {
      item.tags ??= [];

      if (autoDetectOfficialGroupFromTitlePattern && autoDetectOfficialGroupFromTitlePattern.length > 0 && item.title) {
        if (autoDetectOfficialGroupFromTitlePattern.some((pattern) => new RegExp(pattern!, "i").test(item.title))) {
          item.tags.push({ name: "官方" });
        }
      }

      // 让种子同时具备 factor 与 tag 两种优惠表示（factor 优先；仅 tags 时反推 factor）。
      // 这里也兜住了不经过 parseWholeTorrentFromRow 的 JSON API schema（如 GazelleJSONAPI 直接构造 ITorrent）。
      normalizeTorrentPromotion(item);

      const rawTagNames = item.tags.map((t) => t.name).filter(Boolean);

      // 尽可能将 tags 转换预定义的部分，去重并排序
      item.tags = sortTorrentTags(
        uniqBy(
          item.tags.map((tag) => {
            for (const normalizedTorrentTag of normalizedTorrentTagMap) {
              if (normalizedTorrentTag.from.test(tag.name)) {
                return normalizedTorrentTag.to;
              }
            }
            return tag;
          }),
          (tag) => tag.name,
        ),
      );

      if (item.subTitle) {
        item.subTitle = cleanSubTitleTagPrefixes(item.subTitle, item.tags, rawTagNames);
      }
      return item;
    });
  }

  return searchResult;
});
