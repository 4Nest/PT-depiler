<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { DialogDescription as RekaDialogDescription } from "reka-ui";
import { cn } from "~/lib/utils";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
</script>

<template>
  <RekaDialogDescription :class="cn('text-xs text-muted-foreground', props.class)">
    <slot />
  </RekaDialogDescription>
</template>
