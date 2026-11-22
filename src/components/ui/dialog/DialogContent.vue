<script setup lang="ts">
import { ref, type ComponentPublicInstance, type HTMLAttributes } from "vue";
import { DialogClose, DialogContent as RekaDialogContent, DialogOverlay, DialogPortal } from "reka-ui";
import { X } from "lucide-vue-next";
import { cn, isInteractInsideCurrentOrUpperLayer, usePortalTarget } from "~/lib/utils";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes["class"];
    hideClose?: boolean;
    preventOutsideClose?: boolean;
  }>(),
  {
    hideClose: false,
    preventOutsideClose: false,
  },
);

const portalTarget = usePortalTarget();
const contentRef = ref<ComponentPublicInstance | HTMLElement | null>(null);

function getDialogElement(): HTMLElement | null {
  const raw = contentRef.value;
  if (!raw) return null;
  if (raw instanceof HTMLElement) return raw;
  return (raw.$el as HTMLElement | null) ?? null;
}

function handleInteractOutside(e: any) {
  if (props.preventOutsideClose || isInteractInsideCurrentOrUpperLayer(getDialogElement(), e)) {
    e.preventDefault();
  }
}

function handleEscapeKeyDown(e: any) {
  if (props.preventOutsideClose) {
    e.preventDefault();
  }
}
</script>

<template>
  <DialogPortal :to="portalTarget">
    <DialogOverlay
      class="fixed inset-0 z-50 bg-black/55 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
    />
    <RekaDialogContent
      ref="contentRef"
      v-bind="$attrs"
      :aria-describedby="undefined"
      :class="
        cn(
          'fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[calc(100vw-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-0 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-xl duration-150 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          props.class,
        )
      "
      @interact-outside="handleInteractOutside"
      @escape-key-down="handleEscapeKeyDown"
    >
      <slot />
      <DialogClose
        v-if="!props.hideClose"
        class="absolute right-3.5 top-3.5 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 disabled:pointer-events-none"
      >
        <X class="size-4" />
        <span class="sr-only">Close</span>
      </DialogClose>
    </RekaDialogContent>
  </DialogPortal>
</template>
