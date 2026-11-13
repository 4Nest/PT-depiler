<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

import { isPromotionTagName, tagsToPromotion, type ITorrent, type ITorrentTag } from "@ptd/site";

import { useConfigStore } from "@/options/stores/config.ts";

const { item } = defineProps<{
  item: Partial<ITorrent>;
}>();

const { t } = useI18n();
const router = useRouter();
const configStore = useConfigStore();

const tagsExpanded = ref(false);

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
  const sub = String(item.subTitle).trim();
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

function searchByExtId(prefix: string, id: string | number) {
  router.push({ name: "SearchEntity", query: { search: `${prefix}|${id}`, flush: "1" } });
}

const showCover = computed(() => !!item.cover && configStore.searchEntifyControl.showTorrentCover);
</script>

<template>
  <div :class="{ t_with_cover: showCover }" class="t_main py-1">
    <!-- 种子自带的封面：缩略图跨标题与副标题两行，悬停显示大图 -->
    <v-menu v-if="showCover" location="end" open-on-hover>
      <template v-slot:activator="{ props }">
        <v-img v-bind="props" :src="item.cover" class="t_cover rounded mr-2" height="44" width="64">
          <template #error>
            <v-icon class="t_cover_error" color="grey" icon="mdi-image-off-outline" />
          </template>
        </v-img>
      </template>
      <v-card>
        <img :src="item.cover" alt="" class="t_cover_preview" />
      </v-card>
    </v-menu>

    <!-- 第一行：种子主标题（完整展示，自动换行不截断） -->
    <div class="t_title_row">
      <a
        :href="item.url || item.link"
        class="t_title text-decoration-none text-high-emphasis"
        rel="noopener noreferrer nofollow"
        target="_blank"
      >
        {{ item.title ?? item.url ?? item.link ?? "-" }}
      </a>
    </div>

    <!-- 第二行：优惠/标签、外部 ID 与完整副标题 -->
    <div
      v-if="
        (configStore.searchEntifyControl.showTorrentTag && visibleTags.length > 0) ||
        displaySubTitle ||
        item.ext_imdb ||
        item.ext_douban
      "
      class="t_meta_row d-flex flex-column ga-1"
    >
      <div
        v-if="
          (configStore.searchEntifyControl.showTorrentTag && displayedTags.length > 0) ||
          item.ext_imdb ||
          item.ext_douban
        "
        class="d-flex align-center flex-wrap ga-1"
      >
        <template v-if="configStore.searchEntifyControl.showTorrentTag && displayedTags.length > 0">
          <v-hover v-for="tag in displayedTags" :key="tag.name" v-slot:default="{ isHovering, props }">
            <v-chip
              v-bind="props"
              :color="tag.color"
              :variant="isPromotionTagName(tag.name) ? 'flat' : 'tonal'"
              :closable="isHovering as unknown as boolean"
              :title="tagTooltip(tag)"
              label
              size="x-small"
              @click:close="tempHideTag(tag.name)"
            >
              {{ tag.name }}
            </v-chip>
          </v-hover>
          <v-chip
            v-if="hasMoreTags"
            label
            size="x-small"
            color="primary"
            variant="tonal"
            prepend-icon="mdi-arrow-expand-right"
            class="cursor-pointer"
            @click="tagsExpanded = true"
          >
            +{{ hiddenTagCount }}
          </v-chip>
        </template>

        <v-chip
          v-if="item.ext_imdb"
          label
          size="x-small"
          color="amber-darken-2"
          variant="tonal"
          class="cursor-pointer ptd-num"
          @click="searchByExtId('imdb', item.ext_imdb)"
        >
          IMDb: {{ item.ext_imdb }}
        </v-chip>
        <v-chip
          v-if="item.ext_douban"
          label
          size="x-small"
          color="teal"
          variant="tonal"
          class="cursor-pointer ptd-num"
          @click="searchByExtId('douban', item.ext_douban)"
        >
          Douban: {{ item.ext_douban }}
        </v-chip>
      </div>

      <div v-if="displaySubTitle" class="t_subTitle">
        {{ displaySubTitle }}
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.t_main {
  min-width: 0;
}

.t_title_row {
  min-width: 0;
}

.t_title {
  display: inline;
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.45;
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
  transition: color 0.15s ease;

  &:hover {
    color: rgb(var(--v-theme-primary)) !important;
  }
}

.t_meta_row {
  margin-top: 4px;
  min-width: 0;
}

.t_subTitle {
  min-width: 0;
  font-size: 0.78rem;
  line-height: 1.4;
  white-space: normal;
  word-break: break-word;
  overflow-wrap: anywhere;
  color: rgba(var(--v-theme-on-surface), 0.68);
}

.t_main.t_with_cover {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;

  .t_cover {
    grid-row: span 2;
    margin-top: 2px;
  }
}

.t_cover_preview {
  display: block;
  height: clamp(240px, 55vh, 720px);
  width: auto;
  max-width: 60vw;
  object-fit: contain;
}

.t_cover_error {
  width: 100%;
  height: 100%;
}
</style>
