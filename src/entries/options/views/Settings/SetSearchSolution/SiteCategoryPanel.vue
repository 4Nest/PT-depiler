<script setup lang="ts">
import { onMounted, ref, shallowRef } from "vue";
import { useI18n } from "vue-i18n";
import { ArrowRight, ChevronDown, Code2, RotateCcw } from "lucide-vue-next";
import type { ISearchCategories, TSiteID } from "@ptd/site";

import type { ISearchSolution } from "@/shared/types/storages/metadata.ts";
import { Badge, Button, Checkbox, Tooltip } from "~/components/ui";
import { cn } from "~/lib/utils";

import {
  generateSiteSearchSolution,
  getSiteMetaCategory,
  isDefaultCategory,
  radioDefault,
  type TSelectCategory,
} from "./utils.ts";
import CustomSolutionDialog from "./CustomSolutionDialog.vue";

const { siteId } = defineProps<{
  siteId: TSiteID;
}>();

const emit = defineEmits<{
  (e: "update:solution", solution: ISearchSolution): void;
}>();

const { t } = useI18n();
const showCustomSolutionDialog = ref(false);

const selectCategory = ref<TSelectCategory>({});
const siteMetaCategory = shallowRef<ISearchCategories[]>([]);
const openCategoryKeys = ref<string[]>([]);

function resetSelectCategory() {
  for (const category of siteMetaCategory.value) {
    selectCategory.value[category.key] = category.cross ? [] : radioDefault;
  }
}

function toggleCategoryPanel(key: string) {
  if (openCategoryKeys.value.includes(key)) {
    openCategoryKeys.value = openCategoryKeys.value.filter((k) => k !== key);
  } else {
    openCategoryKeys.value = [...openCategoryKeys.value, key];
  }
}

function getAllCheckboxState(category: ISearchCategories): boolean | "indeterminate" {
  const field = selectCategory.value[category.key];
  if (!Array.isArray(field) || field.length === 0) return false;
  if (field.length === category.options.length) return true;
  return "indeterminate";
}

function toggleAllCheckbox(category: ISearchCategories, checked: boolean | "indeterminate") {
  selectCategory.value[category.key] = checked === true ? category.options.map((sp) => sp.value) : [];
}

function toggleMultiOption(categoryKey: string, optionValue: string | number, checked: boolean | "indeterminate") {
  const current = Array.isArray(selectCategory.value[categoryKey])
    ? ([...(selectCategory.value[categoryKey] as (string | number)[])] as (string | number)[])
    : [];
  if (checked === true) {
    if (!current.includes(optionValue)) current.push(optionValue);
  } else {
    const idx = current.indexOf(optionValue);
    if (idx !== -1) current.splice(idx, 1);
  }
  selectCategory.value[categoryKey] = current;
}

function isMultiOptionSelected(categoryKey: string, optionValue: string | number): boolean {
  const current = selectCategory.value[categoryKey];
  return Array.isArray(current) && current.includes(optionValue);
}

function showCustomSolutionDialogFn() {
  showCustomSolutionDialog.value = true;
}

function saveGeneratedSolution(searchSolution: ISearchSolution) {
  emit("update:solution", searchSolution);
  resetSelectCategory();
}

async function generateSolution() {
  const searchSolution = await generateSiteSearchSolution(siteId, selectCategory.value!);
  saveGeneratedSolution(searchSolution);
}

onMounted(async () => {
  siteMetaCategory.value = await getSiteMetaCategory(siteId);
  resetSelectCategory();
});
</script>

<template>
  <div class="flex flex-col gap-3 sm:flex-row sm:items-start">
    <div class="min-w-0 flex-1 space-y-2">
      <div
        v-if="siteMetaCategory.length > 0"
        class="divide-y divide-border rounded-lg border border-border bg-background"
      >
        <div v-for="category in siteMetaCategory" :key="category.key">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50"
            @click="toggleCategoryPanel(category.key)"
          >
            <div class="flex min-w-0 items-center gap-1.5">
              <span class="font-medium text-foreground">{{ category.name }}</span>
              <span v-if="category.notes" class="truncate text-muted-foreground">{{ category.notes }}</span>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <Badge
                :variant="isDefaultCategory(selectCategory[category.key]) ? 'secondary' : 'info'"
                class="font-mono text-[10px]"
              >
                {{ category.key }}
              </Badge>
              <ChevronDown
                :class="
                  cn(
                    'size-3.5 text-muted-foreground transition-transform duration-150',
                    openCategoryKeys.includes(category.key) && 'rotate-180',
                  )
                "
              />
            </div>
          </button>

          <div v-if="openCategoryKeys.includes(category.key)" class="border-t border-border/60 bg-muted/20 px-3 py-2.5">
            <!-- 多选类别 -->
            <template v-if="category.cross && category.cross.mode">
              <div class="mb-2 flex flex-wrap items-center gap-2 border-b border-border/50 pb-2">
                <Checkbox
                  :id="`cat-all-${siteId}-${category.key}`"
                  :model-value="getAllCheckboxState(category)"
                  @update:model-value="(v) => toggleAllCheckbox(category, v)"
                />
                <label
                  :for="`cat-all-${siteId}-${category.key}`"
                  class="cursor-pointer text-xs font-semibold text-foreground select-none"
                >
                  {{ t("common.checkbox.all") }}
                </label>
                <span v-if="getAllCheckboxState(category) === true" class="text-[11px] text-destructive">
                  {{ t("SetSearchSolution.spDialog.selectAllNotice") }}
                </span>
              </div>

              <div class="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3 md:grid-cols-4">
                <label
                  v-for="opt in category.options"
                  :key="String(opt.value)"
                  class="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs text-foreground transition-colors hover:bg-accent/60"
                >
                  <Checkbox
                    :model-value="isMultiOptionSelected(category.key, opt.value)"
                    @update:model-value="(v) => toggleMultiOption(category.key, opt.value, v)"
                  />
                  <span class="truncate" :title="opt.name">{{ opt.name }}</span>
                </label>
              </div>
            </template>

            <!-- 单选类别 -->
            <template v-else>
              <div class="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4">
                <label
                  :class="
                    cn(
                      'flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1 text-xs transition-colors',
                      selectCategory[category.key] === radioDefault
                        ? 'border-primary/40 bg-primary/10 font-medium text-primary'
                        : 'border-transparent hover:bg-accent/60 text-foreground',
                    )
                  "
                >
                  <input
                    v-model="selectCategory[category.key]"
                    type="radio"
                    :name="`cat-radio-${siteId}-${category.key}`"
                    :value="radioDefault"
                    class="size-3.5 accent-primary"
                  />
                  <span class="truncate">{{ t("SetSite.SiteCategoryPanel.siteDefault") }}</span>
                </label>

                <label
                  v-for="opt in category.options"
                  :key="String(opt.value)"
                  :class="
                    cn(
                      'flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1 text-xs transition-colors',
                      selectCategory[category.key] === opt.value
                        ? 'border-primary/40 bg-primary/10 font-medium text-primary'
                        : 'border-transparent hover:bg-accent/60 text-foreground',
                    )
                  "
                >
                  <input
                    v-model="selectCategory[category.key]"
                    type="radio"
                    :name="`cat-radio-${siteId}-${category.key}`"
                    :value="opt.value"
                    class="size-3.5 accent-primary"
                  />
                  <span class="truncate" :title="opt.name">{{ opt.name }}</span>
                </label>
              </div>
            </template>
          </div>
        </div>
      </div>

      <div v-else class="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
        {{ t("SetSearchSolution.spDialog.noDefNotice") }}
      </div>
    </div>

    <!-- 右侧操作按钮列 -->
    <div class="flex shrink-0 flex-row items-center gap-1 sm:flex-col">
      <Tooltip :content="t('SetSearchSolution.spDialog.action.reset')" side="left">
        <Button
          variant="ghost"
          size="icon-sm"
          class="text-muted-foreground hover:text-destructive"
          @click="resetSelectCategory"
        >
          <RotateCcw class="size-3.5" />
        </Button>
      </Tooltip>
      <Tooltip :content="t('SetSearchSolution.spDialog.action.create')" side="left">
        <Button
          variant="ghost"
          size="icon-sm"
          class="text-muted-foreground hover:text-primary"
          @click="showCustomSolutionDialogFn"
        >
          <Code2 class="size-3.5" />
        </Button>
      </Tooltip>
      <Tooltip :content="t('SetSearchSolution.spDialog.action.add')" side="left">
        <Button size="icon-sm" @click="generateSolution">
          <ArrowRight class="size-3.5" />
        </Button>
      </Tooltip>
    </div>

    <CustomSolutionDialog
      v-model="showCustomSolutionDialog"
      :save-generated-solution="saveGeneratedSolution"
      :select-category="selectCategory"
      :site-id="siteId"
    />
  </div>
</template>
