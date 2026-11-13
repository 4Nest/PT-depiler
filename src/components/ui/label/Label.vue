<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { Label as RekaLabel } from "reka-ui";
import { cn } from "~/lib/utils";

const props = defineProps<{
  for?: string;
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <RekaLabel
    :for="props.for"
    :class="
      cn(
        'text-xs font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        props.class,
      )
    "
  >
    <slot />
  </RekaLabel>
</template>
