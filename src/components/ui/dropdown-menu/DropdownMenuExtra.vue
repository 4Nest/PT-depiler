<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import {
  DropdownMenuLabel as RekaDropdownMenuLabel,
  DropdownMenuSeparator as RekaDropdownMenuSeparator,
} from "reka-ui";
import { cn } from "~/lib/utils";

defineProps<{
  type?: "label" | "separator";
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <RekaDropdownMenuSeparator v-if="type === 'separator'" :class="cn('-mx-1 my-1 h-px bg-border', $props.class)" />
  <RekaDropdownMenuLabel v-else :class="cn('px-2.5 py-1.5 text-xs font-semibold text-muted-foreground', $props.class)">
    <slot />
  </RekaDropdownMenuLabel>
</template>
