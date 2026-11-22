<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { SelectContent as RekaSelectContent, SelectPortal, SelectViewport } from "reka-ui";
import { cn, usePortalTarget } from "~/lib/utils";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes["class"];
    position?: "popper" | "item-aligned";
  }>(),
  {
    position: "popper",
  },
);

const portalTarget = usePortalTarget();
</script>

<template>
  <SelectPortal :to="portalTarget">
    <RekaSelectContent
      v-bind="$attrs"
      :position="props.position"
      :side-offset="4"
      :class="
        cn(
          'relative z-[60] max-h-72 min-w-32 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          props.position === 'popper' &&
            'data-[side=bottom]:translate-y-0.5 data-[side=left]:-translate-x-0.5 data-[side=right]:translate-x-0.5 data-[side=top]:-translate-y-0.5',
          props.class,
        )
      "
    >
      <SelectViewport
        :class="
          cn(
            'p-1 max-h-70 overflow-y-auto',
            props.position === 'popper' && 'w-full min-w-[var(--reka-select-trigger-width)]',
          )
        "
      >
        <slot />
      </SelectViewport>
    </RekaSelectContent>
  </SelectPortal>
</template>
