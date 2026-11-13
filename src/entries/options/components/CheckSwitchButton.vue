<script setup lang="ts" generic="T = string">
import { useI18n } from "vue-i18n";
import { CheckSquare, FlipHorizontal2, Square } from "lucide-vue-next";
import { Button } from "~/components/ui";

const selected = defineModel<T[]>({ default: () => [] });

const { all, disabled = false } = defineProps<{
  all: T[];
  disabled?: boolean;
  size?: string;
}>();

const { t } = useI18n();

function selectAll() {
  selected.value = [...all];
}

function selectNone() {
  selected.value = [];
}

function selectInvert() {
  const current = new Set(selected.value);
  selected.value = all.filter((x) => !current.has(x));
}
</script>

<template>
  <div class="inline-flex items-center rounded-md border border-border bg-background p-0.5 shadow-2xs">
    <Button variant="ghost" size="xs" :disabled="disabled" @click="selectAll">
      <CheckSquare class="size-3.5" />
      {{ t("common.checkbox.all") }}
    </Button>
    <Button variant="ghost" size="xs" :disabled="disabled" @click="selectNone">
      <Square class="size-3.5" />
      {{ t("common.checkbox.none") }}
    </Button>
    <Button variant="ghost" size="xs" :disabled="disabled" @click="selectInvert">
      <FlipHorizontal2 class="size-3.5" />
      {{ t("common.checkbox.invert") }}
    </Button>
  </div>
</template>
