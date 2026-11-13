<script setup lang="ts">
import { useDisplay } from "vuetify/framework";

const display = useDisplay();

const {
  disabled = false,
  tonal = true,
  variant,
  ...props
} = defineProps<{
  icon: string;
  text: string;
  disabled?: boolean;
  tonal?: boolean;
  variant?: "flat" | "tonal" | "outlined" | "text";
}>();
</script>

<template>
  <v-btn
    v-bind="$attrs"
    :class="{ 'nav-button-full': !display.smAndDown.value }"
    :icon="display.smAndDown.value"
    :prepend-icon="display.smAndDown.value ? undefined : props.icon"
    rounded="lg"
    :size="display.smAndDown.value ? 'small' : 'default'"
    :disabled="disabled"
    :title="props.text"
    :variant="display.smAndDown.value ? 'text' : (variant ?? (tonal ? 'tonal' : 'flat'))"
  >
    <v-icon v-if="display.smAndDown.value" class="nav-button-icon" :icon="props.icon" />
    <span v-else class="nav-button-text">{{ props.text }}</span>
  </v-btn>
</template>

<style scoped lang="scss">
.nav-button-full + .nav-button-full {
  margin-left: 8px;
}

.nav-button-text {
  font-size: 0.875rem;
  font-weight: 500;
  line-height: normal;
  letter-spacing: 0;
  text-transform: none;
  white-space: nowrap;
}

.nav-button-full {
  font-size: 0.875rem;
}

.nav-button-full :deep(.v-btn__prepend > .v-icon) {
  --v-icon-size-multiplier: 1;
  font-size: 1.125rem;
}

.nav-button-icon {
  --v-icon-size-multiplier: 1;
  font-size: 1.125rem;
}
</style>
