<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { SelectIcon, SelectTrigger as RekaSelectTrigger } from "reka-ui";
import { ChevronDown } from "lucide-vue-next";
import { cn } from "~/lib/utils";

const props = defineProps<{
  class?: HTMLAttributes["class"];
  disabled?: boolean;
}>();
</script>

<template>
  <RekaSelectTrigger
    :disabled="props.disabled"
    :class="
      cn(
        'flex h-8.5 w-full items-center justify-between gap-2 whitespace-nowrap rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-2xs transition-colors data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/35 focus:border-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:truncate',
        props.class,
      )
    "
  >
    <slot />
    <SelectIcon as-child>
      <ChevronDown class="size-3.5 shrink-0 opacity-50" />
    </SelectIcon>
  </RekaSelectTrigger>
</template>
