<script setup lang="ts">
import { watch } from "vue";
import { DialogRoot } from "reka-ui";

const open = defineModel<boolean>({ default: false });

const emit = defineEmits<{
  openAutoFocus: [];
  afterOpen: [];
  afterClose: [];
}>();

watch(open, (isOpen) => {
  if (isOpen) {
    queueMicrotask(() => emit("afterOpen"));
  } else {
    queueMicrotask(() => emit("afterClose"));
  }
});
</script>

<template>
  <DialogRoot v-model:open="open">
    <slot />
  </DialogRoot>
</template>
