<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "~/lib/utils";

const modelValue = defineModel<string | number>({ default: "" });

const props = defineProps<{
  class?: HTMLAttributes["class"];
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  id?: string;
  autocomplete?: string;
}>();
</script>

<template>
  <input
    :id="id"
    v-model="modelValue"
    :type="type ?? 'text'"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    :min="min"
    :max="max"
    :step="step"
    :autocomplete="autocomplete"
    :class="
      cn(
        'flex h-8.5 w-full rounded-md border border-input bg-background px-3 py-1 text-base shadow-2xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 min-[641px]:text-sm',
        props.class,
      )
    "
  />
</template>
