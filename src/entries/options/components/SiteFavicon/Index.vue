<script setup lang="ts">
import { onMounted, shallowRef, watch } from "vue";
import { NO_IMAGE, type TSiteID } from "@ptd/site";
import { Globe } from "lucide-vue-next";
import { cn } from "~/lib/utils";
import { getSiteFavicon } from "./utils.ts";

const props = withDefaults(
  defineProps<{
    siteId: TSiteID;
    size?: number;
    flushOnPre?: boolean;
    flushOnNoImage?: boolean;
    flushOnClick?: boolean;
    class?: string;
  }>(),
  {
    size: 20,
    flushOnPre: false,
    flushOnNoImage: false,
    flushOnClick: false,
  },
);

const siteFavicon = shallowRef<string>(NO_IMAGE);
const hasError = shallowRef(false);

async function loadFavicon(force = false) {
  hasError.value = false;
  let favicon = await getSiteFavicon(props.siteId, force || props.flushOnPre);
  if (favicon === NO_IMAGE && props.flushOnNoImage && !force) {
    favicon = await getSiteFavicon(props.siteId, true);
  }
  siteFavicon.value = favicon;
}

onMounted(() => {
  loadFavicon();
});

watch(
  () => props.siteId,
  () => loadFavicon(),
);

function handleClick() {
  if (!props.flushOnClick) return;
  loadFavicon(true);
}
</script>

<template>
  <span
    :style="{ width: `${props.size}px`, height: `${props.size}px` }"
    :class="
      cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-sm select-none',
        props.flushOnClick && 'cursor-pointer transition-transform hover:scale-105',
        props.class,
      )
    "
    @click="handleClick"
  >
    <img
      v-if="siteFavicon && siteFavicon !== NO_IMAGE && !hasError"
      :src="siteFavicon"
      :alt="props.siteId"
      :width="props.size"
      :height="props.size"
      class="size-full object-contain"
      loading="lazy"
      @error="hasError = true"
    />
    <Globe v-else class="size-3.5 text-muted-foreground/70" />
  </span>
</template>
