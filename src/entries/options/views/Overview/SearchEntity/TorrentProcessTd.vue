<script setup lang="ts">
import { computed } from "vue";
import { ArrowDown, ArrowUp, Check, WifiOff } from "lucide-vue-next";
import { ETorrentStatus } from "@ptd/site";

import { cn } from "~/lib/utils";
import type { ISearchResultTorrent } from "@/shared/types.ts";

const { torrent } = defineProps<{
  torrent: ISearchResultTorrent;
}>();

const progress = computed(() => Math.min(100, Math.max(0, Number(torrent.progress ?? 0))));

const statusMeta = computed(() => {
  switch (torrent.status) {
    case ETorrentStatus.downloading:
      return {
        icon: ArrowDown,
        textClass: "text-info",
        barClass: "bg-info",
      };
    case ETorrentStatus.completed:
      return {
        icon: Check,
        textClass: "text-muted-foreground",
        barClass: "bg-muted-foreground/70",
      };
    case ETorrentStatus.inactive:
      return {
        icon: WifiOff,
        textClass: "text-muted-foreground",
        barClass: "bg-muted-foreground/50",
      };
    case ETorrentStatus.seeding:
    default:
      return {
        icon: ArrowUp,
        textClass: "text-success",
        barClass: "bg-success",
      };
  }
});
</script>

<template>
  <div class="mt-1 flex w-full min-w-[68px] items-center gap-1.5" :title="`${progress}%`">
    <component :is="statusMeta.icon" :class="cn('size-3 shrink-0', statusMeta.textClass)" />
    <div class="h-1 flex-1 overflow-hidden rounded-full bg-muted">
      <div :class="cn('h-full rounded-full transition-all', statusMeta.barClass)" :style="{ width: `${progress}%` }" />
    </div>
  </div>
</template>
