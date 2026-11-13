<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "~/lib/utils";

const modelValue = defineModel<string>({ default: "" });

const props = defineProps<{
  class?: HTMLAttributes["class"];
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
  rows?: number;
  id?: string;
}>();
</script>

<template>
  <textarea
    :id="id"
    v-model="modelValue"
    :rows="rows ?? 4"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    :class="
      cn(
        'flex min-h-[76px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-2xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50',
        props.class,
      )
    "
  />
</template>
