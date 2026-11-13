<script setup lang="ts">
import { reactive, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import type { TSiteID, ISiteUserConfig } from "@ptd/site";
import type { ISiteMetadataIndexEntry } from "@ptd/site/metadataIndex";

import { useMetadataStore } from "@/options/stores/metadata.ts";
import { Label, Switch } from "~/components/ui";

const { item } = defineProps<{
  item: {
    id: TSiteID;
    metadata: ISiteMetadataIndexEntry;
    userConfig: ISiteUserConfig;
  };
}>();

const { t } = useI18n();
const metadataStore = useMetadataStore();

const searchEntryEnabledStatus = reactive<Record<string, boolean>>({});

onMounted(() => {
  // 索引里的 searchEntries 只保留了 name / enabled 两个标量（每个入口自己的搜索参数可能含函数）
  for (const [entryKey, entry] of Object.entries(item.metadata.searchEntries ?? {})) {
    let entryEnabledStatus = false;
    if (typeof item.userConfig.merge?.searchEntry?.[entryKey]?.enabled === "boolean") {
      entryEnabledStatus = item.userConfig.merge.searchEntry[entryKey].enabled;
    } else {
      entryEnabledStatus = entry.enabled ?? true;
    }

    searchEntryEnabledStatus[entryKey] = entryEnabledStatus;
  }
});

function toggleEntry(entryKey: string, value: boolean) {
  searchEntryEnabledStatus[entryKey] = value;
  metadataStore.simplePatch("sites", item.id, `merge.searchEntry.${entryKey}.enabled`, value);
}
</script>

<template>
  <div class="space-y-2">
    <div class="text-xs font-semibold text-foreground">
      {{ t("SetSite.index.table.searchEntries") }}
    </div>
    <div class="max-h-64 space-y-1 overflow-y-auto pr-0.5">
      <div
        v-for="(searchEntry, entryKey) in item.metadata.searchEntries"
        :key="entryKey"
        class="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60"
      >
        <Label :for="`entry-${item.id}-${entryKey}`" class="cursor-pointer text-xs font-normal text-foreground">
          {{ searchEntry.name }}
        </Label>
        <Switch
          :id="`entry-${item.id}-${entryKey}`"
          :model-value="searchEntryEnabledStatus[entryKey]"
          @update:model-value="(v) => toggleEntry(String(entryKey), v)"
        />
      </div>
    </div>
  </div>
</template>
