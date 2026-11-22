<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "~/lib/utils";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
</script>

<template>
  <div
    :class="cn('flex flex-col gap-1 border-b border-border px-4 py-3 pr-11 sm:px-5 sm:py-3.5 sm:pr-11', props.class)"
  >
    <slot />
  </div>
</template>
