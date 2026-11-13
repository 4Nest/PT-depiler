<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { SwitchRoot, SwitchThumb } from "reka-ui";
import { cn } from "~/lib/utils";

const modelValue = defineModel<boolean>({ default: false });

const props = defineProps<{
  disabled?: boolean;
  id?: string;
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <SwitchRoot
    :id="props.id"
    v-model="modelValue"
    :disabled="props.disabled"
    :class="
      cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
        props.class,
      )
    "
  >
    <SwitchThumb
      class="pointer-events-none block size-4 rounded-full bg-background shadow-sm ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
    />
  </SwitchRoot>
</template>
