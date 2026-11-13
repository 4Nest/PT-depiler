<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { Separator as RekaSeparator } from "reka-ui";
import { cn } from "~/lib/utils";

const props = withDefaults(
  defineProps<{
    orientation?: "horizontal" | "vertical";
    decorative?: boolean;
    class?: HTMLAttributes["class"];
  }>(),
  {
    orientation: "horizontal",
    decorative: true,
  },
);
</script>

<template>
  <RekaSeparator
    :decorative="props.decorative"
    :orientation="props.orientation"
    :class="cn('shrink-0 bg-border', props.orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px', props.class)"
  />
</template>
