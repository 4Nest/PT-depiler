<script setup lang="ts">
import { computed, ref, useAttrs, watch } from "vue";
import { type TSiteID } from "@ptd/site";
import { cn } from "~/lib/utils";
import { useMetadataStore } from "@/options/stores/metadata.ts";

const metadataStore = useMetadataStore();

const props = defineProps<{
  siteId: TSiteID;
  tag?: string;
  class?: string[] | string;
}>();

const attrs = useAttrs();
const siteName = ref<string>("");
const siteUrl = ref<string>("#");

const tagIs = computed(() => props.tag ?? "a");

function updateSiteInfo(siteId: TSiteID) {
  siteName.value = siteId;
  if (metadataStore.siteNameMap?.[siteId]) {
    siteName.value = metadataStore.siteNameMap[siteId];
  } else {
    metadataStore.getSiteName(siteId).then((name) => {
      siteName.value = name;
    });
  }
  if (tagIs.value === "a") {
    metadataStore.getSiteUrl(siteId).then((url) => {
      siteUrl.value = url || "#";
    });
  }
}

watch(
  () => props.siteId,
  (id) => updateSiteInfo(id),
  { immediate: true },
);
</script>

<template>
  <slot :name="siteName">
    <component
      :is="tagIs"
      v-bind="attrs"
      :href="tagIs === 'a' ? siteUrl : undefined"
      :target="tagIs === 'a' ? '_blank' : undefined"
      :rel="tagIs === 'a' ? 'noopener noreferrer nofollow' : undefined"
      :class="
        cn(
          'whitespace-nowrap',
          tagIs === 'a' &&
            'font-medium text-foreground transition-colors hover:text-primary hover:underline underline-offset-4',
          props.class,
        )
      "
    >
      {{ siteName }}
    </component>
  </slot>
</template>
