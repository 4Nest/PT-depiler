<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { CheckboxIndicator, CheckboxRoot } from "reka-ui";
import { Check, Minus } from "lucide-vue-next";
import { cn } from "~/lib/utils";

const checked = defineModel<boolean | "indeterminate">({ default: false });

const props = defineProps<{
  disabled?: boolean;
  id?: string;
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <CheckboxRoot
    :id="props.id"
    v-model="checked"
    :disabled="props.disabled"
    :class="
      cn(
        'peer flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input bg-background shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground',
        props.class,
      )
    "
  >
    <CheckboxIndicator class="flex items-center justify-center text-current">
      <Minus v-if="checked === 'indeterminate'" class="size-3 stroke-[2.75]" />
      <Check v-else class="size-3 stroke-[2.75]" />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
