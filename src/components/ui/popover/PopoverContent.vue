<script setup lang="ts">
import { ref, type ComponentPublicInstance, type HTMLAttributes } from "vue";
import { PopoverContent as RekaPopoverContent, PopoverPortal } from "reka-ui";
import { cn, isInteractInsideCurrentOrUpperLayer, usePortalTarget } from "~/lib/utils";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    align?: "start" | "center" | "end";
    side?: "top" | "right" | "bottom" | "left";
    sideOffset?: number;
    class?: HTMLAttributes["class"];
  }>(),
  {
    align: "center",
    side: "bottom",
    sideOffset: 6,
  },
);

const portalTarget = usePortalTarget();
const contentRef = ref<ComponentPublicInstance | HTMLElement | null>(null);

function getPopoverElement(): HTMLElement | null {
  const raw = contentRef.value;
  if (!raw) return null;
  if (raw instanceof HTMLElement) return raw;
  return (raw.$el as HTMLElement | null) ?? null;
}

function handleInteractOutside(e: any) {
  if (isInteractInsideCurrentOrUpperLayer(getPopoverElement(), e)) {
    e.preventDefault();
  }
}
</script>

<template>
  <PopoverPortal :to="portalTarget">
    <RekaPopoverContent
      ref="contentRef"
      v-bind="$attrs"
      :align="props.align"
      :side="props.side"
      :side-offset="props.sideOffset"
      :collision-padding="16"
      :avoid-collisions="true"
      :class="
        cn(
          'z-[60] max-h-[min(82dvh,var(--reka-popover-content-available-height,82dvh))] w-72 max-w-[calc(100vw-24px)] rounded-xl border border-border bg-popover p-3.5 text-popover-foreground shadow-lg outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          props.class,
        )
      "
      @interact-outside="handleInteractOutside"
    >
      <slot />
    </RekaPopoverContent>
  </PopoverPortal>
</template>
