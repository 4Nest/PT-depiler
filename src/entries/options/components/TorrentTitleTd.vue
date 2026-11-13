<script setup lang="ts">
import { ref, computed, getCurrentInstance, type CSSProperties } from "vue";
import { useI18n } from "vue-i18n";
import { ChevronRight, ImageOff, Search, X } from "lucide-vue-next";

import {
  cleanSubTitleTagPrefixes,
  isPromotionTagName,
  tagsToPromotion,
  type ITorrent,
  type ITorrentTag,
} from "@ptd/site";

import { cn } from "~/lib/utils";
import { Tooltip } from "~/components/ui";
import { useConfigStore } from "@/options/stores/config.ts";
import { sendMessage } from "@/messages.ts";

const { item } = defineProps<{
  item: Partial<ITorrent>;
}>();

const { t } = useI18n();
const router = getCurrentInstance()?.appContext.config.globalProperties.$router;
const configStore = useConfigStore();

const tagsExpanded = ref(false);
const coverError = ref(false);

const visibleTags = computed(() => {
  const tags = item.tags;
  if (!tags || !tags.length) return [];
  const hiddenNames = configStore.searchEntifyControl.hiddenTagNames || [];
  const hidePromotionTags = ["factor", "none"].includes(configStore.searchEntifyControl.promotionDisplay);
  return tags.filter((tag) => !hiddenNames.includes(tag.name) && !(hidePromotionTags && isPromotionTagName(tag.name)));
});

const maxTagCount = computed(() => configStore.searchEntifyControl.maxTagCountBeforeGroup || 0);

const displayedTags = computed(() => {
  if (!maxTagCount.value || maxTagCount.value >= visibleTags.value.length || tagsExpanded.value) {
    return visibleTags.value;
  }
  return visibleTags.value.slice(0, maxTagCount.value);
});

const hasMoreTags = computed(
  () => maxTagCount.value > 0 && visibleTags.value.length > maxTagCount.value && !tagsExpanded.value,
);

const hiddenTagCount = computed(() => visibleTags.value.length - maxTagCount.value);

const displaySubTitle = computed(() => {
  if (!configStore.searchEntifyControl.showTorrentSubtitle || !item.subTitle) return "";
  const sub = cleanSubTitleTagPrefixes(String(item.subTitle), item.tags);
  const title = String(item.title ?? "").trim();
  if (!sub || sub === title) return "";
  return sub;
});

function tempHideTag(name: string) {
  if (!configStore.searchEntifyControl.hiddenTagNames.includes(name)) {
    configStore.searchEntifyControl.hiddenTagNames = [...configStore.searchEntifyControl.hiddenTagNames, name];
  }
}

function tagTooltip(tag: ITorrentTag): string | undefined {
  const { downloadVolumeFactor, uploadVolumeFactor } = tagsToPromotion([tag]);
  const parts: string[] = [];

  if (downloadVolumeFactor !== undefined) {
    parts.push(
      downloadVolumeFactor === 0
        ? t("SearchEntity.index.tagTooltip.freeDownload")
        : t("SearchEntity.index.tagTooltip.downloadPercent", [Math.round(downloadVolumeFactor * 100)]),
    );
  }

  if (uploadVolumeFactor !== undefined && uploadVolumeFactor !== 1) {
    parts.push(
      uploadVolumeFactor === 0
        ? t("SearchEntity.index.tagTooltip.noUpload")
        : t("SearchEntity.index.tagTooltip.uploadTimes", [uploadVolumeFactor]),
    );
  }

  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/**
 * 判断字符串是否为原生合法 CSS 颜色（#hex / rgb() / hsl() / 标准 CSS 颜色名）
 */
function isCssColorLiteral(color?: string): boolean {
  if (!color) return false;
  const trimmed = color.trim();
  if (/^(#[0-9a-f]{3,8}|rgba?\(|hsla?\(|oklch\()/i.test(trimmed)) return true;
  if (/^[a-z]+$/i.test(trimmed) && !["black", "white", "gray", "grey"].includes(trimmed.toLowerCase())) {
    // 排除 Vuetify 连字符色名，保留 turquoise / gold / crimson 等原生 CSS 具名色
    return true;
  }
  return false;
}

/**
 * 将预定义语义色名（含原 Vuetify Material 调色板名称）映射为高对比 Tonal Tailwind 类
 */
function mapNamedPaletteToClass(color?: string): string | null {
  if (!color) return null;
  const c = color.toLowerCase();

  if (c.startsWith("pink")) {
    return "border-pink-500/35 bg-pink-500/14 text-pink-700 dark:border-pink-400/35 dark:bg-pink-400/15 dark:text-pink-300";
  }
  if (c.startsWith("deep-purple") || c.startsWith("purple")) {
    return "border-purple-500/35 bg-purple-500/14 text-purple-700 dark:border-purple-400/35 dark:bg-purple-400/15 dark:text-purple-300";
  }
  if (c.startsWith("indigo")) {
    return "border-indigo-500/35 bg-indigo-500/14 text-indigo-700 dark:border-indigo-400/35 dark:bg-indigo-400/15 dark:text-indigo-300";
  }
  if (c.startsWith("blue-grey") || c === "gray" || c === "grey") {
    return "border-slate-500/35 bg-slate-500/14 text-slate-700 dark:border-slate-400/35 dark:bg-slate-400/15 dark:text-slate-300";
  }
  if (c.startsWith("light-blue") || c.startsWith("blue")) {
    return "border-sky-500/35 bg-sky-500/14 text-sky-700 dark:border-sky-400/35 dark:bg-sky-400/15 dark:text-sky-300";
  }
  if (c.startsWith("cyan")) {
    return "border-cyan-500/35 bg-cyan-500/14 text-cyan-700 dark:border-cyan-400/35 dark:bg-cyan-400/15 dark:text-cyan-300";
  }
  if (c.startsWith("teal")) {
    return "border-teal-500/35 bg-teal-500/14 text-teal-700 dark:border-teal-400/35 dark:bg-teal-400/15 dark:text-teal-300";
  }
  if (c.startsWith("light-green") || c.startsWith("green")) {
    return "border-emerald-500/35 bg-emerald-500/14 text-emerald-700 dark:border-emerald-400/35 dark:bg-emerald-400/15 dark:text-emerald-300";
  }
  if (c.startsWith("lime")) {
    return "border-lime-500/35 bg-lime-500/14 text-lime-700 dark:border-lime-400/35 dark:bg-lime-400/15 dark:text-lime-300";
  }
  if (c.startsWith("yellow") || c.startsWith("amber")) {
    return "border-amber-500/38 bg-amber-500/15 text-amber-700 dark:border-amber-400/38 dark:bg-amber-400/16 dark:text-amber-300";
  }
  if (c.startsWith("deep-orange") || c.startsWith("orange")) {
    return "border-orange-500/38 bg-orange-500/15 text-orange-700 dark:border-orange-400/38 dark:bg-orange-400/16 dark:text-orange-300";
  }
  if (c.startsWith("red") || c === "black") {
    return "border-rose-500/40 bg-rose-500/15 text-rose-700 dark:border-rose-400/40 dark:bg-rose-400/16 dark:text-rose-300";
  }
  if (c.startsWith("brown")) {
    return "border-amber-600/35 bg-amber-600/14 text-amber-800 dark:border-amber-400/35 dark:bg-amber-500/15 dark:text-amber-200";
  }
  return null;
}

function getTagPresentation(tag: ITorrentTag): { className: string; style?: CSSProperties } {
  const name = tag.name;
  const lower = name.toLowerCase();

  // 1. 优惠促销类微徽章（字重更高、对比更鲜明）
  if (lower === "2xfree") {
    return {
      className:
        "border-emerald-500/45 bg-emerald-500/18 text-emerald-700 dark:border-emerald-400/45 dark:bg-emerald-400/20 dark:text-emerald-300 font-semibold",
    };
  }
  if (lower === "free") {
    return {
      className:
        "border-sky-500/45 bg-sky-500/18 text-sky-700 dark:border-sky-400/45 dark:bg-sky-400/20 dark:text-sky-300 font-semibold",
    };
  }
  if (lower === "2xup" || lower === "1.5xup") {
    return {
      className:
        "border-lime-500/45 bg-lime-500/16 text-lime-700 dark:border-lime-400/45 dark:bg-lime-400/18 dark:text-lime-300 font-semibold",
    };
  }
  if (lower === "2x50%") {
    return {
      className:
        "border-teal-500/45 bg-teal-500/16 text-teal-700 dark:border-teal-400/45 dark:bg-teal-400/18 dark:text-teal-300 font-semibold",
    };
  }
  if (lower === "25%" || lower === "30%" || lower === "35%") {
    return {
      className:
        "border-violet-500/45 bg-violet-500/16 text-violet-700 dark:border-violet-400/45 dark:bg-violet-400/18 dark:text-violet-300 font-semibold",
    };
  }
  if (lower === "50%" || lower === "70%" || lower === "75%") {
    return {
      className:
        "border-amber-500/45 bg-amber-500/18 text-amber-700 dark:border-amber-400/45 dark:bg-amber-400/20 dark:text-amber-300 font-semibold",
    };
  }
  if (lower === "nl.") {
    return {
      className:
        "border-purple-500/45 bg-purple-500/16 text-purple-700 dark:border-purple-400/45 dark:bg-purple-400/18 dark:text-purple-300 font-semibold",
    };
  }
  if (isPromotionTagName(name)) {
    return {
      className: "border-info/45 bg-info/16 text-info font-semibold",
    };
  }

  // 2. 高警示与站点核心语义标签
  if (lower === "h&r" || lower === "hnr" || lower === "freeload") {
    return {
      className:
        "border-rose-500/45 bg-rose-500/18 text-rose-700 dark:border-rose-400/45 dark:bg-rose-400/20 dark:text-rose-300 font-semibold",
    };
  }
  if (lower === "hot" || name === "热门") {
    return {
      className:
        "border-amber-500/40 bg-amber-500/16 text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/18 dark:text-amber-300 font-medium",
    };
  }
  if (lower === "excl." || lower === "vip") {
    return {
      className:
        "border-orange-500/40 bg-orange-500/15 text-orange-700 dark:border-orange-400/40 dark:bg-orange-400/18 dark:text-orange-300 font-medium",
    };
  }
  if (name === "官方") {
    return {
      className:
        "border-blue-500/40 bg-blue-500/15 text-blue-700 dark:border-blue-400/40 dark:bg-blue-400/18 dark:text-blue-300 font-medium",
    };
  }

  // 3. 命中预定义语义色名（如中字 pink-darken-1、HDR purple、国语 cyan-darken-2、DIY brown 等）
  const paletteClass = mapNamedPaletteToClass(tag.color);
  if (paletteClass) {
    return { className: `${paletteClass} font-medium` };
  }

  // 4. 站点动态自定义 CSS 颜色（如 #8b0000 特效、#530 官字组、rgb(...) 等）
  if (isCssColorLiteral(tag.color)) {
    return {
      className: "ptd-dynamic-tag font-medium",
      style: { "--ptd-tag-color": tag.color!.trim() } as CSSProperties,
    };
  }

  // 5. 无色兜底标签
  return {
    className: "border-border bg-secondary/70 text-secondary-foreground",
  };
}

function searchByExtId(prefix: string, id: string | number) {
  const query = { search: `${prefix}|${id}`, flush: "1" };
  if (router) {
    router.push({ name: "SearchEntity", query });
  } else {
    sendMessage("openOptionsPage", { path: "/search-entity", query });
  }
}

const showCover = computed(() => !!item.cover && configStore.searchEntifyControl.showTorrentCover);

const hasMetaRow = computed(
  () =>
    (configStore.searchEntifyControl.showTorrentTag && visibleTags.value.length > 0) ||
    Boolean(displaySubTitle.value) ||
    Boolean(item.ext_imdb) ||
    Boolean(item.ext_douban),
);
</script>

<template>
  <div :class="cn('min-w-0 py-0.5', showCover && 'flex items-start gap-2.5')">
    <!-- 种子自带封面：缩略图 + 悬停大图预览 -->
    <Tooltip
      v-if="showCover"
      side="right"
      :delay-duration="120"
      :disabled="coverError"
      class="max-w-none rounded-lg border border-border bg-popover p-1.5 shadow-xl"
    >
      <div
        class="relative mt-0.5 flex h-11 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40"
      >
        <img
          v-if="!coverError"
          :src="item.cover"
          alt=""
          class="size-full object-cover"
          loading="lazy"
          @error="coverError = true"
        />
        <ImageOff v-else class="size-4 text-muted-foreground/60" />
      </div>
      <template #content>
        <img :src="item.cover" alt="" class="block max-h-[60vh] max-w-[50vw] rounded object-contain" />
      </template>
    </Tooltip>

    <div class="min-w-0 flex-1">
      <!-- 第一行：清晰易读的主标题外链 -->
      <div class="min-w-0">
        <a
          :href="item.url || item.link"
          class="inline text-[13.5px] font-semibold leading-snug text-foreground break-words [overflow-wrap:anywhere] transition-colors hover:text-primary"
          rel="noopener noreferrer nofollow"
          target="_blank"
        >
          {{ item.title ?? item.url ?? item.link ?? "-" }}
        </a>
      </div>

      <!-- 第二行：紧凑语义彩色微徽章 + 外部评分索引 + 纯净副标题 -->
      <div v-if="hasMetaRow" class="mt-1 flex min-w-0 flex-col gap-1">
        <div
          v-if="
            (configStore.searchEntifyControl.showTorrentTag && displayedTags.length > 0) ||
            item.ext_imdb ||
            item.ext_douban
          "
          class="flex flex-wrap items-center gap-1"
        >
          <template v-if="configStore.searchEntifyControl.showTorrentTag && displayedTags.length > 0">
            <Tooltip
              v-for="tag in displayedTags"
              :key="tag.name"
              :content="tagTooltip(tag)"
              :disabled="!tagTooltip(tag)"
              side="top"
            >
              <span
                :style="getTagPresentation(tag).style"
                :class="
                  cn(
                    'group/tag inline-flex h-[19px] items-center gap-0.5 rounded-[5px] border px-1.5 text-[11px] leading-none transition-colors select-none',
                    getTagPresentation(tag).className,
                  )
                "
              >
                <span>{{ tag.name }}</span>
                <button
                  type="button"
                  class="-mr-0.5 ml-0.5 hidden size-3 items-center justify-center rounded-xs opacity-65 transition-opacity hover:opacity-100 group-hover/tag:inline-flex"
                  :aria-label="`Hide ${tag.name}`"
                  @click.stop="tempHideTag(tag.name)"
                >
                  <X class="size-2.5" />
                </button>
              </span>
            </Tooltip>

            <button
              v-if="hasMoreTags"
              type="button"
              class="inline-flex h-[19px] items-center gap-0.5 rounded-[5px] border border-primary/30 bg-primary/12 px-1.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20 tabular-nums"
              @click="tagsExpanded = true"
            >
              <ChevronRight class="size-2.5" />
              <span>+{{ hiddenTagCount }}</span>
            </button>
          </template>

          <button
            v-if="item.ext_imdb"
            type="button"
            class="inline-flex h-[19px] items-center gap-1 rounded-[5px] border border-amber-500/30 bg-amber-500/10 px-1.5 text-[11px] font-medium text-amber-700 transition-colors hover:border-amber-500/50 hover:bg-amber-500/18 dark:border-amber-400/30 dark:bg-amber-400/12 dark:text-amber-300 tabular-nums"
            @click="searchByExtId('imdb', item.ext_imdb)"
          >
            <Search class="size-2.5 opacity-70" />
            <span>IMDb {{ item.ext_imdb }}</span>
          </button>

          <button
            v-if="item.ext_douban"
            type="button"
            class="inline-flex h-[19px] items-center gap-1 rounded-[5px] border border-emerald-500/30 bg-emerald-500/10 px-1.5 text-[11px] font-medium text-emerald-700 transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/18 dark:border-emerald-400/30 dark:bg-emerald-400/12 dark:text-emerald-300 tabular-nums"
            @click="searchByExtId('douban', item.ext_douban)"
          >
            <Search class="size-2.5 opacity-70" />
            <span>Douban {{ item.ext_douban }}</span>
          </button>
        </div>

        <div
          v-if="displaySubTitle"
          :title="displaySubTitle"
          class="min-w-0 line-clamp-2 text-xs leading-relaxed text-muted-foreground break-words [overflow-wrap:anywhere]"
        >
          {{ displaySubTitle }}
        </div>
      </div>
    </div>
  </div>
</template>
