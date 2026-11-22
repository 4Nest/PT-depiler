<script setup lang="ts">
import type { Component } from "vue";
import { Loader2 } from "lucide-vue-next";
import { cn } from "~/lib/utils";

const {
  title,
  icon,
  emphasis = "default",
  loading = false,
  disabled = false,
} = defineProps<{
  title: string;
  icon: Component;
  emphasis?: "primary" | "default" | "secondary";
  loading?: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: "click", event: MouseEvent): void;
}>();
</script>

<template>
  <button
    type="button"
    :title="title"
    :disabled="disabled || loading"
    :class="
      cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-45 max-[640px]:min-h-10 max-[640px]:py-2.5',
        emphasis === 'primary'
          ? 'bg-primary text-primary-foreground shadow-2xs hover:bg-primary/90'
          : 'text-popover-foreground hover:bg-accent hover:text-accent-foreground',
      )
    "
    @click="(e) => emit('click', e)"
  >
    <Loader2 v-if="loading" class="size-4 shrink-0 animate-spin" />
    <component
      :is="icon"
      v-else
      :class="cn('size-4 shrink-0', emphasis === 'primary' ? 'text-primary-foreground' : 'text-muted-foreground')"
    />
    <span class="truncate">{{ title }}</span>
  </button>
</template>
