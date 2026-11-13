<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { DropdownMenuCheckboxItem as RekaDropdownMenuCheckboxItem, DropdownMenuItemIndicator } from "reka-ui";
import { Check } from "lucide-vue-next";
import { cn } from "~/lib/utils";

const checked = defineModel<boolean | "indeterminate">({ default: false });

const props = defineProps<{
  disabled?: boolean;
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <RekaDropdownMenuCheckboxItem
    v-model="checked"
    :disabled="props.disabled"
    :class="
      cn(
        'relative flex cursor-pointer select-none items-center rounded-md py-1.5 pl-7 pr-2.5 text-xs outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        props.class,
      )
    "
    @select.prevent
  >
    <span class="absolute left-2 flex size-3.5 items-center justify-center">
      <DropdownMenuItemIndicator>
        <Check class="size-3.5 text-primary" />
      </DropdownMenuItemIndicator>
    </span>
    <slot />
  </RekaDropdownMenuCheckboxItem>
</template>
