<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import {
  AccordionContent as RekaAccordionContent,
  AccordionHeader,
  AccordionItem as RekaAccordionItem,
  AccordionRoot,
  AccordionTrigger as RekaAccordionTrigger,
} from "reka-ui";
import { ChevronDown } from "lucide-vue-next";
import { cn } from "~/lib/utils";

const modelValue = defineModel<string | string[]>();

const props = withDefaults(
  defineProps<{
    type?: "single" | "multiple";
    collapsible?: boolean;
    items: Array<{
      value: string;
      title: string;
      badge?: string | number;
      disabled?: boolean;
    }>;
    class?: HTMLAttributes["class"];
  }>(),
  {
    type: "single",
    collapsible: true,
  },
);
</script>

<template>
  <AccordionRoot
    v-model="modelValue"
    :type="props.type"
    :collapsible="props.collapsible"
    :class="cn('w-full divide-y divide-border rounded-lg border border-border bg-card', props.class)"
  >
    <RekaAccordionItem
      v-for="item in props.items"
      :key="item.value"
      :value="item.value"
      :disabled="item.disabled"
      class="p-0"
    >
      <AccordionHeader class="flex px-4">
        <RekaAccordionTrigger
          class="flex flex-1 items-center justify-between py-3 text-left text-sm font-medium transition-all hover:text-foreground disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180"
        >
          <span class="flex items-center gap-2">
            <span>{{ item.title }}</span>
            <span
              v-if="item.badge !== undefined && item.badge !== ''"
              class="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-medium text-secondary-foreground"
            >
              {{ item.badge }}
            </span>
          </span>
          <ChevronDown class="size-4 shrink-0 text-muted-foreground transition-transform duration-200" />
        </RekaAccordionTrigger>
      </AccordionHeader>
      <RekaAccordionContent
        class="overflow-hidden text-sm data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
      >
        <div class="px-4 pb-4 pt-1">
          <slot :name="item.value" :item="item" />
        </div>
      </RekaAccordionContent>
    </RekaAccordionItem>
  </AccordionRoot>
</template>
