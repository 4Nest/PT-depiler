<script setup lang="ts">
import { X } from "lucide-vue-next";
import type { ISearchSolution } from "@/shared/types.ts";
import SolutionDetail from "@/options/components/SolutionDetail.vue";
import SiteName from "@/options/components/SiteName.vue";
import { cn } from "~/lib/utils";

const {
  solutions,
  closable = true,
  column = false,
  groupProps = {},
} = defineProps<{
  solutions: ISearchSolution[];
  closable?: boolean;
  column?: boolean;
  groupProps?: Record<string, any>;
}>();

const emit = defineEmits<{
  (e: "remove:solution", solution: ISearchSolution): void;
}>();

function removeSolution(solution: ISearchSolution) {
  emit("remove:solution", solution);
}
</script>

<template>
  <div :class="cn('flex flex-wrap gap-1.5', (column || groupProps?.column) && 'flex-col items-start')">
    <div
      v-for="solution in solutions"
      :key="solution.id"
      class="inline-flex max-w-full flex-wrap items-center gap-1 rounded-md border border-border bg-muted/55 px-2 py-1 text-xs leading-tight transition-colors hover:bg-muted"
    >
      <button
        v-if="closable"
        type="button"
        class="-ml-0.5 mr-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
        @click="removeSolution(solution)"
      >
        <X class="size-3" />
      </button>
      <SiteName class="font-medium text-foreground" :site-id="solution.siteId" tag="span" />
      <span class="text-muted-foreground">→</span>
      <SolutionDetail :solution="solution" />
    </div>
  </div>
</template>
