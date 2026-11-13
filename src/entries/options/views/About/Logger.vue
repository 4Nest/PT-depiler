<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef } from "vue";
import { useI18n } from "vue-i18n";
import { Code2, FileSearch, Pause, Play, RefreshCw, Search, X } from "lucide-vue-next";

import { sendMessage } from "@/messages.ts";
import type { ILoggerItem } from "@/shared/types.ts";
import { formatDate } from "@/options/utils.ts";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Tooltip,
  type DataTableColumn,
  type DataTableSortItem,
} from "~/components/ui";

const { t } = useI18n();
const logger = shallowRef<ILoggerItem[]>([]);
const isPolling = ref<boolean>(true);
const isLoading = ref<boolean>(false);

const tableColumns = computed<DataTableColumn<ILoggerItem>[]>(() => [
  { title: "ID", key: "id", align: "start", width: 150 },
  { title: "Time", key: "time", align: "start", width: 170 },
  { title: "Message", key: "msg", align: "start", minWidth: 320 },
  { title: t("common.action"), key: "action", align: "end", width: 84, sortable: false },
]);
const sortBy = ref<DataTableSortItem[]>([{ key: "time", order: "desc" }]);

const showLogDataDialog = ref<boolean>(false);
const logData = ref<unknown>(null);
const tableFilter = ref<string>("");

function showLogDataDialogHandler(item: unknown) {
  logData.value = item;
  showLogDataDialog.value = true;
}

async function loadLogger() {
  isLoading.value = true;
  try {
    logger.value = await sendMessage("getLogger", undefined);
  } finally {
    isLoading.value = false;
  }
}

let loggerTimer: ReturnType<typeof setInterval> | undefined;

function startPolling() {
  stopPolling();
  loggerTimer = setInterval(() => {
    if (isPolling.value) {
      void loadLogger();
    }
  }, 1000);
}

function stopPolling() {
  if (loggerTimer) {
    clearInterval(loggerTimer);
    loggerTimer = undefined;
  }
}

function togglePolling() {
  isPolling.value = !isPolling.value;
  if (isPolling.value) {
    void loadLogger();
  }
}

onMounted(() => {
  void loadLogger();
  startPolling();
});

onUnmounted(() => {
  stopPolling();
});
</script>

<template>
  <Card>
    <CardHeader class="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
      <div class="flex flex-wrap items-center gap-2.5">
        <span class="text-sm font-semibold text-foreground">{{ t("route.About.Logger") }}</span>
        <Badge variant="secondary" class="tabular-nums">{{ logger.length }}</Badge>
        <Badge :variant="isPolling ? 'success' : 'outline'" class="gap-1 text-[11px]">
          <span class="size-1.5 rounded-full" :class="isPolling ? 'animate-pulse bg-success' : 'bg-muted-foreground'" />
          {{ isPolling ? "Live" : "Paused" }}
        </Badge>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" @click="togglePolling">
          <Pause v-if="isPolling" class="size-3.5" />
          <Play v-else class="size-3.5" />
          {{ isPolling ? "暂停" : "继续" }}
        </Button>

        <Tooltip content="立即刷新" side="top">
          <Button variant="outline" size="icon-sm" :disabled="isLoading" @click="loadLogger">
            <RefreshCw class="size-3.5" :class="{ 'animate-spin': isLoading }" />
          </Button>
        </Tooltip>

        <div class="relative w-full sm:w-72">
          <Search
            class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input v-model="tableFilter" :placeholder="t('common.search')" class="pl-8 pr-8" />
          <button
            v-if="tableFilter"
            type="button"
            class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            @click="tableFilter = ''"
          >
            <X class="size-3.5" />
          </button>
        </div>
      </div>
    </CardHeader>

    <DataTable
      v-model:sort-by="sortBy"
      :columns="tableColumns"
      :items="logger"
      :search="tableFilter"
      :filter-keys="['id', 'msg']"
      :row-key="(r) => `${r.id ?? ''}-${r.time ?? ''}-${r.msg ?? ''}`"
    >
      <template #cell-id="{ item }">
        <code class="whitespace-nowrap rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
          {{ item.id }}
        </code>
      </template>

      <template #cell-time="{ item }">
        <span class="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
          {{ formatDate(item.time!) }}
        </span>
      </template>

      <template #cell-msg="{ item }">
        <span class="text-xs leading-relaxed text-foreground">{{ item.msg }}</span>
      </template>

      <template #cell-action="{ item }">
        <div class="inline-flex items-center justify-end">
          <Tooltip :content="t('Logger.action.details')" side="top">
            <Button
              variant="ghost"
              size="icon-xs"
              :disabled="typeof item.data === 'undefined'"
              @click="showLogDataDialogHandler(item.data)"
            >
              <FileSearch class="size-3.5 text-primary" />
            </Button>
          </Tooltip>
        </div>
      </template>
    </DataTable>
  </Card>

  <Dialog v-model="showLogDataDialog">
    <DialogContent class="max-w-3xl">
      <DialogHeader>
        <DialogTitle>
          <Code2 class="size-4 text-primary" />
          <span>{{ t("Logger.action.details") }}</span>
        </DialogTitle>
      </DialogHeader>
      <div class="flex-1 overflow-y-auto px-5 py-4">
        <pre
          class="max-h-[65vh] overflow-auto rounded-lg border border-border bg-muted/40 p-4 font-mono text-xs leading-relaxed text-foreground"
          >{{ JSON.stringify(logData, null, 2) }}</pre>
      </div>
    </DialogContent>
  </Dialog>
</template>
