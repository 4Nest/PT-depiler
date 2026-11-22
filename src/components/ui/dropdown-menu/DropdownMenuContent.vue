<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { DropdownMenuContent as RekaDropdownMenuContent, DropdownMenuPortal } from "reka-ui";
import { cn, usePortalTarget } from "~/lib/utils";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    align?: "start" | "center" | "end";
    sideOffset?: number;
    class?: HTMLAttributes["class"];
  }>(),
  {
    align: "end",
    sideOffset: 5,
  },
);

const portalTarget = usePortalTarget();
</script>

<template>
  <DropdownMenuPortal :to="portalTarget">
    <RekaDropdownMenuContent
      v-bind="$attrs"
      :align="props.align"
      :side-offset="props.sideOffset"
      :collision-padding="12"
      :class="
        cn(
          'z-[60] min-w-40 max-w-[calc(100vw-24px)] overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          props.class,
        )
      "
    >
      <slot />
    </RekaDropdownMenuContent>
  </DropdownMenuPortal>
</template>
