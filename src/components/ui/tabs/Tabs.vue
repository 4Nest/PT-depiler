<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { TabsRoot, type StringOrNumber } from "reka-ui";
import { cn } from "~/lib/utils";

const modelValue = defineModel<StringOrNumber>();

const props = defineProps<{
  defaultValue?: StringOrNumber;
  orientation?: "horizontal" | "vertical";
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <TabsRoot
    v-model="modelValue"
    :default-value="props.defaultValue"
    :orientation="props.orientation"
    :class="cn('flex flex-col', props.class)"
  >
    <slot />
  </TabsRoot>
</template>
