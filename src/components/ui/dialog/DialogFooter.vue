<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "~/lib/utils";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
</script>

<template>
  <div
    :class="
      cn('flex flex-wrap items-center justify-end gap-2 border-t border-border bg-muted/25 px-5 py-3', props.class)
    "
  >
    <slot />
  </div>
</template>
