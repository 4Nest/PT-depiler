<script setup lang="ts">
import { computed, ref, type HTMLAttributes } from "vue";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-vue-next";
import { cn } from "~/lib/utils";

const props = withDefaults(
  defineProps<{
    variant?: "default" | "info" | "warning" | "destructive" | "success";
    title?: string;
    closable?: boolean;
    class?: HTMLAttributes["class"];
  }>(),
  {
    variant: "default",
    closable: false,
  },
);

const dismissed = ref(false);

const variantClasses = computed(() => {
  switch (props.variant) {
    case "info":
      return "border-info/25 bg-info/8 text-foreground [&>svg]:text-info";
    case "warning":
      return "border-warning/30 bg-warning/8 text-foreground [&>svg]:text-warning";
    case "destructive":
      return "border-destructive/30 bg-destructive/8 text-foreground [&>svg]:text-destructive";
    case "success":
      return "border-success/25 bg-success/8 text-foreground [&>svg]:text-success";
    default:
      return "border-border bg-muted/45 text-foreground [&>svg]:text-muted-foreground";
  }
});

const IconComp = computed(() => {
  switch (props.variant) {
    case "warning":
      return AlertTriangle;
    case "destructive":
      return AlertCircle;
    case "success":
      return CheckCircle2;
    case "info":
    default:
      return Info;
  }
});
</script>

<template>
  <div
    v-if="!dismissed"
    role="alert"
    :class="
      cn(
        'relative flex items-start gap-3 rounded-lg border px-3.5 py-2.5 text-xs leading-relaxed',
        variantClasses,
        props.class,
      )
    "
  >
    <component :is="IconComp" class="mt-0.5 size-4 shrink-0" />
    <div class="min-w-0 flex-1">
      <div v-if="title" class="mb-0.5 font-medium text-foreground">{{ title }}</div>
      <div
        class="text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-foreground"
      >
        <slot />
      </div>
    </div>
    <div v-if="$slots.action || closable" class="flex shrink-0 items-center gap-1.5">
      <slot name="action" />
      <button
        v-if="closable"
        type="button"
        class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        @click="dismissed = true"
      >
        <X class="size-3.5" />
      </button>
    </div>
  </div>
</template>
