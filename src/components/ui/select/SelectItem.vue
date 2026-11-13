<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { SelectItem as RekaSelectItem, SelectItemIndicator, SelectItemText, type AcceptableValue } from "reka-ui";
import { Check } from "lucide-vue-next";
import { cn } from "~/lib/utils";

const props = defineProps<{
  value: AcceptableValue;
  disabled?: boolean;
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <RekaSelectItem
    :value="props.value"
    :disabled="props.disabled"
    :class="
      cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-md py-1.5 pl-2.5 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        props.class,
      )
    "
  >
    <span class="absolute right-2 flex size-3.5 items-center justify-center">
      <SelectItemIndicator>
        <Check class="size-3.5 text-primary" />
      </SelectItemIndicator>
    </span>
    <SelectItemText>
      <slot />
    </SelectItemText>
  </RekaSelectItem>
</template>
