<script setup lang="ts">
import { SelectRoot, type AcceptableValue } from "reka-ui";

const modelValue = defineModel<AcceptableValue>();

const props = defineProps<{
  disabled?: boolean;
  name?: string;
}>();
</script>

<template>
  <SelectRoot v-model="modelValue" :disabled="props.disabled" :name="props.name">
    <slot />
  </SelectRoot>
</template>
