<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { TabsContent as RekaTabsContent, type StringOrNumber } from "reka-ui";
import { cn } from "~/lib/utils";

const props = defineProps<{
  value: StringOrNumber;
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <RekaTabsContent
    :value="props.value"
    :class="cn('mt-3 ring-offset-background focus-visible:outline-none', props.class)"
  >
    <slot />
  </RekaTabsContent>
</template>
