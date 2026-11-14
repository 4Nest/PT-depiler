<script setup lang="ts" generic="T extends Record<string, any>">
import { computed, ref, watch, type HTMLAttributes } from "vue";
import { SelectValue } from "reka-ui";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Inbox,
} from "lucide-vue-next";
import { cn } from "~/lib/utils";
import Checkbox from "../checkbox/Checkbox.vue";
import Button from "../button/Button.vue";
import Select from "../select/Select.vue";
import SelectTrigger from "../select/SelectTrigger.vue";
import SelectContent from "../select/SelectContent.vue";
import SelectItem from "../select/SelectItem.vue";

export interface DataTableSortItem {
  key: string;
  order: "asc" | "desc";
}

export interface DataTableColumn<Row = any> {
  key: string;
  title: string;
  align?: "start" | "center" | "end";
  width?: number | string;
  minWidth?: number | string;
  maxWidth?: number | string;
  sortable?: boolean;
  sortValue?: (row: Row) => any;
  cellClass?: string;
  headerClass?: string;
}

const selected = defineModel<any[]>("selected", { default: () => [] });
const sortBy = defineModel<DataTableSortItem[]>("sortBy", { default: () => [] });
const itemsPerPageModel = defineModel<number>("itemsPerPage", { default: 25 });

const props = withDefaults(
  defineProps<{
    columns: DataTableColumn<T>[];
    items: T[];
    rowKey?: string | ((row: T) => string | number);
    selectable?: boolean;
    isRowSelectable?: (row: T) => boolean;
    search?: string;
    filterKeys?: string[];
    customFilter?: (value: any, query: string, item: { raw: T }) => boolean;
    multiSort?: boolean;
    loading?: boolean;
    hidePagination?: boolean;
    emptyText?: string;
    pageSizeOptions?: number[];
    rowClass?: (row: T, index: number) => string | undefined;
    rowStyle?: (row: T, index: number) => Record<string, string> | undefined;
    stickyActionColumn?: boolean;
    actionPosition?: "start" | "end";
    class?: HTMLAttributes["class"];
  }>(),
  {
    rowKey: "id",
    selectable: false,
    multiSort: false,
    loading: false,
    hidePagination: false,
    pageSizeOptions: () => [10, 25, 50, 100, -1],
    stickyActionColumn: false,
    actionPosition: "end",
  },
);

const arrangedColumns = computed<DataTableColumn<T>[]>(() => {
  const idx = props.columns.findIndex((c) => c.key === "action");
  if (idx === -1) return props.columns;
  const actionCol = props.columns[idx];
  const others = props.columns.filter((_, i) => i !== idx);
  return props.actionPosition === "start" ? [actionCol, ...others] : [...others, actionCol];
});

const currentPage = ref(1);

function getNestedValue(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  if (path in obj) return obj[path];
  return path.split(".").reduce((acc, part) => (acc == null ? undefined : acc[part]), obj);
}

function getRowId(row: T): string | number {
  if (typeof props.rowKey === "function") return props.rowKey(row);
  return getNestedValue(row, props.rowKey);
}

function canSelectRow(row: T): boolean {
  return props.isRowSelectable ? props.isRowSelectable(row) : true;
}

// 1. 过滤
const filteredItems = computed<T[]>(() => {
  const q = (props.search ?? "").trim();
  if (!q && !props.customFilter) return props.items;
  // 注意：高级过滤器（useAdvanceFilter）即使 search 是特殊标记或空也可能依赖 customFilter
  if (props.customFilter) {
    if (!q) return props.items;
    return props.items.filter((row) => {
      const keys = props.filterKeys?.length
        ? props.filterKeys
        : [typeof props.rowKey === "string" ? props.rowKey : "id"];
      return keys.some((k) => props.customFilter!(getNestedValue(row, k), q, { raw: row }));
    });
  }
  const lower = q.toLowerCase();
  const keys = props.filterKeys?.length ? props.filterKeys : props.columns.map((c) => c.key);
  return props.items.filter((row) =>
    keys.some((k) => {
      const v = getNestedValue(row, k);
      return v != null && String(v).toLowerCase().includes(lower);
    }),
  );
});

// 2. 排序
function compareValues(a: any, b: any, order: "asc" | "desc"): number {
  const isNilA = a === undefined || a === null || a === "" || Number.isNaN(a);
  const isNilB = b === undefined || b === null || b === "" || Number.isNaN(b);
  if (isNilA && isNilB) return 0;
  if (isNilA) return 1;
  if (isNilB) return -1;

  let cmp = 0;
  if (typeof a === "number" && typeof b === "number") {
    cmp = a - b;
  } else if (typeof a === "boolean" && typeof b === "boolean") {
    cmp = a === b ? 0 : a ? 1 : -1;
  } else {
    cmp = String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
  }
  return order === "asc" ? cmp : -cmp;
}

const sortedItems = computed<T[]>(() => {
  if (!sortBy.value || sortBy.value.length === 0) return filteredItems.value;
  const colMap = new Map(props.columns.map((c) => [c.key, c]));
  return [...filteredItems.value].sort((rowA, rowB) => {
    for (const rule of sortBy.value) {
      const col = colMap.get(rule.key);
      const valA = col?.sortValue ? col.sortValue(rowA) : getNestedValue(rowA, rule.key);
      const valB = col?.sortValue ? col.sortValue(rowB) : getNestedValue(rowB, rule.key);
      const res = compareValues(valA, valB, rule.order);
      if (res !== 0) return res;
    }
    return 0;
  });
});

// 3. 分页
const totalCount = computed(() => sortedItems.value.length);
const effectivePageSize = computed(() =>
  itemsPerPageModel.value <= 0 ? Math.max(totalCount.value, 1) : itemsPerPageModel.value,
);
const totalPages = computed(() =>
  itemsPerPageModel.value <= 0 ? 1 : Math.max(1, Math.ceil(totalCount.value / effectivePageSize.value)),
);

watch([() => props.search, () => props.items.length, itemsPerPageModel], () => {
  if (currentPage.value > totalPages.value) {
    currentPage.value = totalPages.value;
  }
});

const pagedItems = computed<T[]>(() => {
  if (props.hidePagination || itemsPerPageModel.value <= 0) return sortedItems.value;
  const start = (currentPage.value - 1) * effectivePageSize.value;
  return sortedItems.value.slice(start, start + effectivePageSize.value);
});

const rangeLabel = computed(() => {
  if (totalCount.value === 0) return "0 / 0";
  if (props.hidePagination || itemsPerPageModel.value <= 0) return `1-${totalCount.value} / ${totalCount.value}`;
  const start = (currentPage.value - 1) * effectivePageSize.value + 1;
  const end = Math.min(currentPage.value * effectivePageSize.value, totalCount.value);
  return `${start}-${end} / ${totalCount.value}`;
});

// 4. 勾选状态
const selectedSet = computed(() => new Set(selected.value));

const selectableFilteredIds = computed(() => filteredItems.value.filter(canSelectRow).map((r) => getRowId(r)));

const headerCheckState = computed<boolean | "indeterminate">(() => {
  const ids = selectableFilteredIds.value;
  if (ids.length === 0) return false;
  let count = 0;
  for (const id of ids) {
    if (selectedSet.value.has(id)) count++;
  }
  if (count === 0) return false;
  if (count === ids.length) return true;
  return "indeterminate";
});

function toggleAll(val: boolean | "indeterminate") {
  const ids = selectableFilteredIds.value;
  const idSet = new Set(ids);
  if (val === true) {
    const merged = new Set([...selected.value, ...ids]);
    selected.value = Array.from(merged);
  } else {
    selected.value = selected.value.filter((id) => !idSet.has(id));
  }
}

function toggleRow(row: T, val: boolean | "indeterminate") {
  const id = getRowId(row);
  if (val === true) {
    if (!selectedSet.value.has(id)) {
      selected.value = [...selected.value, id];
    }
  } else {
    selected.value = selected.value.filter((x) => x !== id);
  }
}

function toggleSort(col: DataTableColumn<T>) {
  if (col.sortable === false) return;
  const current = [...sortBy.value];
  const idx = current.findIndex((s) => s.key === col.key);

  if (!props.multiSort) {
    if (idx === -1) {
      sortBy.value = [{ key: col.key, order: "desc" }];
    } else if (current[idx].order === "desc") {
      sortBy.value = [{ key: col.key, order: "asc" }];
    } else {
      sortBy.value = [];
    }
    return;
  }

  if (idx === -1) {
    current.push({ key: col.key, order: "desc" });
  } else if (current[idx].order === "desc") {
    current[idx] = { key: col.key, order: "asc" };
  } else {
    current.splice(idx, 1);
  }
  sortBy.value = current;
}

function getSortState(key: string) {
  const idx = sortBy.value.findIndex((s) => s.key === key);
  if (idx === -1) return null;
  return { order: sortBy.value[idx].order, index: idx + 1 };
}

function formatColStyle(col: DataTableColumn<T>) {
  const style: Record<string, string> = {};
  if (col.width !== undefined) style.width = typeof col.width === "number" ? `${col.width}px` : col.width;
  if (col.minWidth !== undefined)
    style.minWidth = typeof col.minWidth === "number" ? `${col.minWidth}px` : col.minWidth;
  if (col.maxWidth !== undefined)
    style.maxWidth = typeof col.maxWidth === "number" ? `${col.maxWidth}px` : col.maxWidth;
  return style;
}

const pageSizeString = computed({
  get: () => String(itemsPerPageModel.value),
  set: (v: string) => {
    itemsPerPageModel.value = Number(v);
    currentPage.value = 1;
  },
});
</script>

<template>
  <div :class="cn('flex flex-col', props.class)">
    <div class="relative w-full overflow-x-auto">
      <div v-if="props.loading" class="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-primary/15">
        <div class="h-full w-1/3 animate-pulse bg-primary" />
      </div>

      <table class="w-full caption-bottom border-collapse text-sm">
        <thead class="border-b border-border bg-muted/50">
          <tr>
            <th v-if="props.selectable" class="h-9.5 w-9 px-2.5 text-left align-middle">
              <Checkbox
                :model-value="headerCheckState"
                :disabled="selectableFilteredIds.length === 0"
                @update:model-value="toggleAll"
              />
            </th>
            <th
              v-for="col in arrangedColumns"
              :key="col.key"
              :style="formatColStyle(col)"
              :class="
                cn(
                  'h-9.5 whitespace-nowrap px-3 text-xs font-medium text-muted-foreground select-none align-middle',
                  col.align === 'end' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                  col.sortable !== false && 'cursor-pointer transition-colors hover:text-foreground',
                  props.stickyActionColumn &&
                    col.key === 'action' &&
                    (props.actionPosition === 'start'
                      ? 'sticky left-0 z-10 bg-card/95 backdrop-blur-xs'
                      : 'sticky right-0 z-10 bg-card/95 backdrop-blur-xs'),
                  col.headerClass,
                )
              "
              @click="toggleSort(col)"
            >
              <div
                :class="
                  cn(
                    'inline-flex items-center gap-1',
                    col.align === 'end' && 'justify-end',
                    col.align === 'center' && 'justify-center',
                  )
                "
              >
                <slot :name="`header-${col.key}`" :column="col">
                  <span>{{ col.title }}</span>
                </slot>
                <template v-if="col.sortable !== false">
                  <template v-if="getSortState(col.key)">
                    <ArrowUp v-if="getSortState(col.key)!.order === 'asc'" class="size-3.5 text-primary" />
                    <ArrowDown v-else class="size-3.5 text-primary" />
                    <span
                      v-if="props.multiSort && sortBy.length > 1"
                      class="text-[10px] font-semibold text-primary tabular-nums"
                    >
                      {{ getSortState(col.key)!.index }}
                    </span>
                  </template>
                  <ArrowUpDown v-else class="size-3 opacity-30" />
                </template>
              </div>
            </th>
          </tr>
        </thead>

        <tbody class="divide-y divide-border/65">
          <slot name="body-prepend" />

          <tr v-if="pagedItems.length === 0 && !$slots['body-prepend']">
            <td :colspan="props.columns.length + (props.selectable ? 1 : 0)" class="h-32 px-4 text-center">
              <slot name="empty">
                <div class="flex flex-col items-center justify-center gap-1.5 py-6 text-muted-foreground">
                  <Inbox class="size-6 opacity-40" />
                  <span class="text-xs">{{ props.emptyText || "暂无数据" }}</span>
                </div>
              </slot>
            </td>
          </tr>

          <tr
            v-for="(row, rowIdx) in pagedItems"
            :key="getRowId(row)"
            :data-selected="selectedSet.has(getRowId(row)) ? 'true' : undefined"
            :style="props.rowStyle ? props.rowStyle(row, rowIdx) : undefined"
            :class="
              cn(
                'group transition-colors hover:bg-accent/40 data-[selected=true]:bg-primary/[0.06]',
                props.rowClass ? props.rowClass(row, rowIdx) : undefined,
              )
            "
          >
            <td v-if="props.selectable" class="w-9 px-2.5 py-2.5 align-middle">
              <Checkbox
                :model-value="selectedSet.has(getRowId(row))"
                :disabled="!canSelectRow(row)"
                @update:model-value="(v) => toggleRow(row, v)"
              />
            </td>

            <td
              v-for="col in arrangedColumns"
              :key="col.key"
              :style="formatColStyle(col)"
              :class="
                cn(
                  'px-3 py-2.5 align-middle',
                  col.align === 'end'
                    ? 'text-right tabular-nums'
                    : col.align === 'center'
                      ? 'text-center'
                      : 'text-left',
                  props.stickyActionColumn &&
                    col.key === 'action' &&
                    (props.actionPosition === 'start'
                      ? 'sticky left-0 z-10 bg-card/95 group-hover:bg-muted/80 backdrop-blur-xs'
                      : 'sticky right-0 z-10 bg-card/95 group-hover:bg-muted/80 backdrop-blur-xs'),
                  col.cellClass,
                )
              "
            >
              <slot :name="`cell-${col.key}`" :item="row" :value="getNestedValue(row, col.key)" :index="rowIdx">
                {{ getNestedValue(row, col.key) ?? "—" }}
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-if="!props.hidePagination"
      class="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-xs text-muted-foreground"
    >
      <div class="flex items-center gap-3">
        <slot name="footer-prepend" />
        <span v-if="props.selectable && selected.length > 0" class="font-medium text-foreground tabular-nums">
          已选 {{ selected.length }} 项
        </span>
      </div>

      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2">
          <span class="hidden sm:inline">每页</span>
          <Select v-model="pageSizeString">
            <SelectTrigger class="h-7 w-[82px] px-2.5 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="opt in props.pageSizeOptions" :key="opt" :value="String(opt)">
                {{ opt === -1 ? "全部" : opt }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <span class="tabular-nums">{{ rangeLabel }}</span>

        <div class="flex items-center gap-1">
          <Button variant="outline" size="icon-xs" :disabled="currentPage <= 1" @click="currentPage = 1">
            <ChevronsLeft />
          </Button>
          <Button variant="outline" size="icon-xs" :disabled="currentPage <= 1" @click="currentPage--">
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon-xs" :disabled="currentPage >= totalPages" @click="currentPage++">
            <ChevronRight />
          </Button>
          <Button
            variant="outline"
            size="icon-xs"
            :disabled="currentPage >= totalPages"
            @click="currentPage = totalPages"
          >
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
