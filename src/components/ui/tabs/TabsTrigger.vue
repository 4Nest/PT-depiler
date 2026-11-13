<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { TabsTrigger as RekaTabsTrigger, type StringOrNumber } from "reka-ui";
import { cn } from "~/lib/utils";

const props = defineProps<{
  value: StringOrNumber;
  disabled?: boolean;
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <RekaTabsTrigger
    :value="props.value"
    :disabled="props.disabled"
    :class="
      cn(
        'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-2xs [&_svg]:size-3.5 [&_svg]:shrink-0',
        props.class,
      )
    "
  >
    <slot />
  </RekaTabsTrigger>
</template>
