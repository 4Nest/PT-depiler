<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { DropdownMenuItem as RekaDropdownMenuItem } from "reka-ui";
import { cn } from "~/lib/utils";

const props = defineProps<{
  disabled?: boolean;
  destructive?: boolean;
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <RekaDropdownMenuItem
    :disabled="props.disabled"
    :class="
      cn(
        'relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-xs outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0',
        props.destructive && 'text-destructive focus:bg-destructive/10 focus:text-destructive',
        props.class,
      )
    "
  >
    <slot />
  </RekaDropdownMenuItem>
</template>
