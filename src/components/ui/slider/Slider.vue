<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue";
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from "reka-ui";
import { cn } from "~/lib/utils";

const modelValue = defineModel<number | number[]>({ default: 0 });

const props = withDefaults(
  defineProps<{
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    class?: HTMLAttributes["class"];
  }>(),
  {
    min: 0,
    max: 100,
    step: 1,
  },
);

const internalArray = computed<number[]>({
  get: () => (Array.isArray(modelValue.value) ? modelValue.value : [modelValue.value]),
  set: (val) => {
    if (Array.isArray(modelValue.value)) {
      modelValue.value = val;
    } else {
      modelValue.value = val[0] ?? props.min;
    }
  },
});
</script>

<template>
  <SliderRoot
    v-model="internalArray"
    :min="props.min"
    :max="props.max"
    :step="props.step"
    :disabled="props.disabled"
    :class="cn('relative flex w-full touch-none select-none items-center py-1.5', props.class)"
  >
    <SliderTrack class="relative h-1.5 w-full grow overflow-hidden rounded-full bg-secondary">
      <SliderRange class="absolute h-full bg-primary" />
    </SliderTrack>
    <SliderThumb
      v-for="(_, idx) in internalArray"
      :key="idx"
      class="block size-4 rounded-full border-2 border-primary bg-background shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50"
    />
  </SliderRoot>
</template>
