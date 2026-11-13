<script setup lang="ts">
import { useAttrs, type TransitionProps } from "vue";

const {
  title,
  icon,
  color = "primary",
} = defineProps<{
  title: string;
  icon: string;
  color?: string;
  transition?: TransitionProps;
}>();

const attrs = useAttrs();
</script>

<template>
  <v-btn
    v-bind="attrs"
    :color="color"
    :prepend-icon="icon"
    :title="title"
    class="ptd-capsule-btn justify-start font-weight-medium"
    density="comfortable"
    rounded="lg"
    size="small"
    variant="tonal"
  >
    <span class="text-truncate">{{ title }}</span>
  </v-btn>
</template>

<style scoped lang="scss">
.ptd-capsule-btn {
  width: 100%;
  min-width: 152px;
  letter-spacing: 0;
}
</style>
