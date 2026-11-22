<script setup lang="ts">
import { computed, ref, type HTMLAttributes } from "vue";
import { PopoverAnchor, PopoverRoot } from "reka-ui";
import { Check, Plus, X } from "lucide-vue-next";
import { cn, getActualEventTarget } from "~/lib/utils";
import PopoverContent from "../popover/PopoverContent.vue";

const modelValue = defineModel<string[]>({ default: () => [] });

const props = withDefaults(
  defineProps<{
    suggestions?: string[];
    placeholder?: string;
    disabled?: boolean;
    allowCustom?: boolean;
    class?: HTMLAttributes["class"];
  }>(),
  {
    suggestions: () => [],
    placeholder: "",
    disabled: false,
    allowCustom: true,
  },
);

const anchorRef = ref<HTMLElement | null>(null);
const inputValue = ref("");
const isOpen = ref(false);

const filteredSuggestions = computed(() => {
  const q = inputValue.value.trim().toLowerCase();
  return props.suggestions.filter((s) => !q || s.toLowerCase().includes(q));
});

function addTag(raw: string) {
  const val = raw.trim();
  if (!val) return;
  if (!props.allowCustom && !props.suggestions.includes(val)) return;
  if (!modelValue.value.includes(val)) {
    modelValue.value = [...modelValue.value, val];
  }
  inputValue.value = "";
}

function toggleSuggestion(val: string) {
  if (modelValue.value.includes(val)) {
    modelValue.value = modelValue.value.filter((x) => x !== val);
  } else {
    modelValue.value = [...modelValue.value, val];
    if (inputValue.value.trim()) {
      inputValue.value = "";
    }
  }
}

function handlePopoverInteractOutside(e: any) {
  const actualTarget =
    getActualEventTarget(e?.detail?.originalEvent) ?? (e?.target instanceof Element ? e.target : null);
  if (actualTarget && anchorRef.value?.contains(actualTarget)) {
    e.preventDefault();
  }
}

function removeTag(val: string) {
  modelValue.value = modelValue.value.filter((x) => x !== val);
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" || e.key === ",") {
    e.preventDefault();
    addTag(inputValue.value);
  } else if (e.key === "Backspace" && !inputValue.value && modelValue.value.length > 0) {
    modelValue.value = modelValue.value.slice(0, -1);
  }
}
</script>

<template>
  <PopoverRoot v-model:open="isOpen">
    <PopoverAnchor as-child>
      <div
        ref="anchorRef"
        :class="
          cn(
            'flex min-h-8.5 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-sm shadow-2xs transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/35',
            props.disabled && 'cursor-not-allowed opacity-50',
            props.class,
          )
        "
        @click="
          () => {
            if (!props.disabled && props.suggestions.length > 0) isOpen = true;
          }
        "
      >
        <span
          v-for="tag in modelValue"
          :key="tag"
          class="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground"
        >
          <span>{{ tag }}</span>
          <button
            v-if="!props.disabled"
            type="button"
            class="rounded-xs text-muted-foreground hover:text-foreground"
            @click.stop="removeTag(tag)"
          >
            <X class="size-3" />
          </button>
        </span>
        <input
          v-model="inputValue"
          :disabled="props.disabled"
          :placeholder="modelValue.length === 0 ? props.placeholder : ''"
          class="min-w-[80px] flex-1 bg-transparent px-1 py-0.5 text-base outline-none placeholder:text-muted-foreground min-[641px]:text-sm"
          @focus="
            () => {
              if (props.suggestions.length > 0) isOpen = true;
            }
          "
          @keydown="onKeydown"
          @blur="
            () => {
              if (inputValue.trim()) addTag(inputValue);
            }
          "
        />
      </div>
    </PopoverAnchor>

    <PopoverContent
      v-if="filteredSuggestions.length > 0 || (props.allowCustom && inputValue.trim())"
      align="start"
      class="w-[var(--reka-popover-trigger-width)] min-w-48 p-1"
      @open-auto-focus.prevent
      @interact-outside="handlePopoverInteractOutside"
    >
      <div class="max-h-52 overflow-y-auto">
        <button
          v-if="props.allowCustom && inputValue.trim() && !props.suggestions.includes(inputValue.trim())"
          type="button"
          class="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs hover:bg-accent"
          @mousedown.prevent="addTag(inputValue)"
        >
          <Plus class="size-3.5 text-primary" />
          <span class="truncate">{{ inputValue.trim() }}</span>
        </button>
        <button
          v-for="item in filteredSuggestions"
          :key="item"
          type="button"
          class="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs hover:bg-accent max-[640px]:py-2"
          @mousedown.prevent="toggleSuggestion(item)"
        >
          <span class="truncate">{{ item }}</span>
          <Check v-if="modelValue.includes(item)" class="size-3.5 shrink-0 text-primary" />
        </button>
      </div>
    </PopoverContent>
  </PopoverRoot>
</template>
