<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from "vue";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Globe } from "lucide-vue-next";
import { cn } from "~/lib/utils";

const modelValue = defineModel<string | string[]>({ default: () => [] });

const {
  items,
  allLabel,
  allCount,
  multiple = false,
  mandatory = false,
  expandLabel,
  collapseLabel,
  hintText,
} = defineProps<{
  items: string[];
  allLabel: string;
  allCount?: number;
  multiple?: boolean;
  mandatory?: boolean;
  expandLabel?: string;
  collapseLabel?: string;
  hintText?: string;
}>();

const isExpanded = ref(false);
const hasOverflow = ref(false);
const canScrollLeft = ref(false);
const canScrollRight = ref(false);

const trackRef = useTemplateRef<HTMLDivElement>("trackRef");
let resizeObserver: ResizeObserver | null = null;

const selectedArray = computed<string[]>(() =>
  Array.isArray(modelValue.value) ? modelValue.value : modelValue.value ? [modelValue.value] : [],
);

const isAllSelected = computed(() => selectedArray.value.length === 0);

function emitSelection(next: string[]) {
  if (Array.isArray(modelValue.value) || multiple || next.length > 1) {
    modelValue.value = next;
  } else {
    modelValue.value = next[0] ?? "";
  }
}

function selectAll() {
  if (mandatory && items.length > 0 && isAllSelected.value) {
    emitSelection([items[0]!]);
    return;
  }
  emitSelection([]);
}

function toggleItem(item: string, event: MouseEvent) {
  const isMultiAction = multiple || event.ctrlKey || event.metaKey;
  const current = selectedArray.value;
  const has = current.includes(item);

  if (isMultiAction) {
    if (has) {
      if (mandatory && current.length <= 1) return;
      emitSelection(current.filter((x) => x !== item));
    } else {
      emitSelection([...current, item]);
    }
    return;
  }

  // 单击已唯一选中的胶囊 -> 取消筛选切回全部
  if (has && current.length === 1 && !mandatory) {
    emitSelection([]);
  } else {
    emitSelection([item]);
  }
}

function updateScrollMetrics() {
  const el = trackRef.value;
  if (!el || isExpanded.value) {
    canScrollLeft.value = false;
    canScrollRight.value = false;
    if (!el) hasOverflow.value = false;
    return;
  }
  const maxScroll = el.scrollWidth - el.clientWidth;
  hasOverflow.value = maxScroll > 4;
  canScrollLeft.value = el.scrollLeft > 4;
  canScrollRight.value = maxScroll - el.scrollLeft > 4;
}

function scrollByStep(direction: -1 | 1) {
  const el = trackRef.value;
  if (!el) return;
  const step = Math.max(220, Math.round(el.clientWidth * 0.65));
  el.scrollBy({ left: direction * step, behavior: "smooth" });
}

function onTrackWheel(event: WheelEvent) {
  if (isExpanded.value || !hasOverflow.value) return;
  const el = trackRef.value;
  if (!el) return;
  if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
    const atStart = el.scrollLeft <= 0 && event.deltaY < 0;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 && event.deltaY > 0;
    if (!atStart && !atEnd) {
      event.preventDefault();
      el.scrollLeft += event.deltaY;
      updateScrollMetrics();
    }
  }
}

function toggleExpand() {
  isExpanded.value = !isExpanded.value;
  nextTick(() => updateScrollMetrics());
}

watch(
  () => items.length,
  () => {
    nextTick(() => updateScrollMetrics());
  },
);

watch(
  selectedArray,
  (selected) => {
    if (isExpanded.value || selected.length === 0) return;
    nextTick(() => {
      const el = trackRef.value;
      if (!el) return;
      const target = el.querySelector<HTMLElement>(`[data-chip-id="${CSS.escape(selected[0]!)}"]`);
      target?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
    });
  },
  { deep: true },
);

onMounted(() => {
  updateScrollMetrics();
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => updateScrollMetrics());
    if (trackRef.value) resizeObserver.observe(trackRef.value);
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
});
</script>

<template>
  <div class="flex min-w-0 items-start gap-2" :title="hintText">
    <!-- 左侧固定「全部站点」锚点胶囊 -->
    <div class="flex shrink-0 items-center gap-2 pt-0.5">
      <button
        type="button"
        :class="
          cn(
            'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-all',
            isAllSelected
              ? 'border-primary/45 bg-primary/12 text-primary shadow-2xs ring-1 ring-primary/15'
              : 'border-border/80 bg-background text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground',
          )
        "
        @click="selectAll"
      >
        <Globe class="size-3.5 shrink-0" />
        <span>{{ allLabel }}</span>
        <span
          v-if="allCount !== undefined"
          :class="
            cn(
              'rounded-full px-1.5 py-0.2 text-[10px] leading-4 tabular-nums transition-colors',
              isAllSelected ? 'bg-primary text-primary-foreground font-semibold' : 'bg-muted text-muted-foreground',
            )
          "
        >
          {{ allCount }}
        </span>
      </button>

      <span class="h-4 w-px shrink-0 bg-border/80" />
    </div>

    <!-- 中间站点胶囊区：单行无滚动条丝滑轨道 / 多行平铺自由切换 -->
    <div class="relative min-w-0 flex-1">
      <!-- 左端渐隐遮罩与翻页微按钮 -->
      <div
        v-if="!isExpanded && canScrollLeft"
        class="pointer-events-none absolute inset-y-0 left-0 z-10 flex w-10 items-center justify-start bg-linear-to-r from-card via-card/85 to-transparent"
      >
        <button
          type="button"
          class="pointer-events-auto inline-flex size-6 items-center justify-center rounded-full border border-border/90 bg-background/95 text-muted-foreground shadow-xs transition-colors hover:border-primary/40 hover:text-foreground"
          @click="scrollByStep(-1)"
        >
          <ChevronLeft class="size-3.5" />
        </button>
      </div>

      <div
        ref="trackRef"
        :class="
          cn(
            'flex items-center gap-1.5 py-0.5',
            isExpanded ? 'flex-wrap' : 'overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          )
        "
        @scroll="updateScrollMetrics"
        @wheel="onTrackWheel"
      >
        <button
          v-for="item in items"
          :key="item"
          type="button"
          :data-chip-id="item"
          :class="
            cn(
              'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-all',
              selectedArray.includes(item)
                ? 'border-primary/45 bg-primary/12 text-primary shadow-2xs ring-1 ring-primary/15'
                : 'border-border/75 bg-background/90 text-foreground/85 hover:border-border hover:bg-accent hover:text-foreground',
            )
          "
          @click="toggleItem(item, $event)"
        >
          <slot name="chip" :item="item" :selected="selectedArray.includes(item)">
            <span>{{ item }}</span>
          </slot>
        </button>
      </div>

      <!-- 右端渐隐遮罩与翻页微按钮 -->
      <div
        v-if="!isExpanded && canScrollRight"
        class="pointer-events-none absolute inset-y-0 right-0 z-10 flex w-10 items-center justify-end bg-linear-to-l from-card via-card/85 to-transparent"
      >
        <button
          type="button"
          class="pointer-events-auto inline-flex size-6 items-center justify-center rounded-full border border-border/90 bg-background/95 text-muted-foreground shadow-xs transition-colors hover:border-primary/40 hover:text-foreground"
          @click="scrollByStep(1)"
        >
          <ChevronRight class="size-3.5" />
        </button>
      </div>
    </div>

    <!-- 右侧固定「展开 / 收起」多行平铺切换按钮（仅当站点较多溢出或已展开时显示） -->
    <div v-if="hasOverflow || isExpanded" class="shrink-0 pt-0.5">
      <button
        type="button"
        class="inline-flex h-7 items-center gap-1 rounded-lg border border-dashed border-border bg-muted/40 px-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground tabular-nums"
        @click="toggleExpand"
      >
        <span>{{ isExpanded ? (collapseLabel ?? "收起") : (expandLabel ?? `展开 (${items.length})`) }}</span>
        <ChevronUp v-if="isExpanded" class="size-3.5" />
        <ChevronDown v-else class="size-3.5" />
      </button>
    </div>
  </div>
</template>
