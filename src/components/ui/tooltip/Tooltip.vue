<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { TooltipContent, TooltipPortal, TooltipProvider, TooltipRoot, TooltipTrigger } from "reka-ui";
import { cn, usePortalTarget } from "~/lib/utils";

const props = withDefaults(
  defineProps<{
    content?: string;
    side?: "top" | "right" | "bottom" | "left";
    delayDuration?: number;
    disabled?: boolean;
    class?: HTMLAttributes["class"];
  }>(),
  {
    side: "top",
    delayDuration: 220,
    disabled: false,
  },
);

const portalTarget = usePortalTarget();
</script>

<template>
  <TooltipProvider :delay-duration="props.delayDuration">
    <TooltipRoot :disabled="props.disabled || (!props.content && !$slots.content)">
      <TooltipTrigger as-child>
        <slot />
      </TooltipTrigger>
      <TooltipPortal :to="portalTarget">
        <TooltipContent
          :side="props.side"
          :side-offset="5"
          :class="
            cn(
              'z-[70] max-w-xs overflow-hidden rounded-md bg-foreground px-2.5 py-1.5 text-xs text-background shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
              props.class,
            )
          "
        >
          <slot name="content">{{ props.content }}</slot>
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>
