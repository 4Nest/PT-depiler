<script setup lang="ts">
import { computed, ref } from "vue";
import { nanoid } from "nanoid";
import { useI18n } from "vue-i18n";
import { isJSON } from "es-toolkit";
import { CheckCircle2, Code2 } from "lucide-vue-next";
import type { TSiteID } from "@ptd/site";

import type { ISearchSolution } from "@/shared/types/storages/metadata.ts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from "~/components/ui";
import SiteName from "@/options/components/SiteName.vue";

import {
  generateSiteSearchSolution,
  getCategoryName,
  getCategoryOptionName,
  getSiteMetaCategory,
  type TSelectCategory,
} from "./utils.ts";

const showDialog = defineModel<boolean>({ default: false });

const { siteId, selectCategory, saveGeneratedSolution } = defineProps<{
  siteId: TSiteID;
  selectCategory: TSelectCategory;
  saveGeneratedSolution: (searchSolution: ISearchSolution) => void;
}>();

const { t } = useI18n();

const searchSolution = ref<ISearchSolution>({} as ISearchSolution);
const searchSolutionEntryRequestConfig = ref<string>("");

const isNameValid = computed(() => Boolean(searchSolution.value.name?.trim()));
const isJsonValid = computed(
  () => Boolean(searchSolutionEntryRequestConfig.value.trim()) && isJSON(searchSolutionEntryRequestConfig.value),
);
const formValid = computed(() => isNameValid.value && isJsonValid.value);

async function onEnter() {
  searchSolution.value = await generateSiteSearchSolution(siteId, selectCategory);

  if (searchSolution.value.id === "default") {
    searchSolution.value.id = nanoid();
    searchSolution.value.name = "";
  } else {
    const siteMetaCategory = await getSiteMetaCategory(siteId);

    searchSolution.value.name = Object.entries(searchSolution.value.selectedCategories!)
      .map(([category, value]) => {
        return (
          getCategoryName(siteMetaCategory, category) + ": " + getCategoryOptionName(siteMetaCategory, category, value)
        );
      })
      .join(";");

    delete searchSolution.value.selectedCategories;
  }

  searchSolutionEntryRequestConfig.value = JSON.stringify(
    searchSolution.value.searchEntries?.[searchSolution.value.id]?.requestConfig ?? { params: {}, data: {} },
    null,
    2,
  );
}

function doSubmit() {
  if (!formValid.value) return;

  try {
    const requestConfig = JSON.parse(searchSolutionEntryRequestConfig.value);
    if (searchSolution.value.searchEntries && searchSolution.value.id) {
      searchSolution.value.searchEntries[searchSolution.value.id] ??= {};
      searchSolution.value.searchEntries[searchSolution.value.id].requestConfig = requestConfig;
    }
  } catch (e) {
    console.error("请求配置 JSON 解析失败", e);
    return;
  }

  saveGeneratedSolution(searchSolution.value);
  showDialog.value = false;
}
</script>

<template>
  <Dialog v-model="showDialog" @after-open="onEnter">
    <DialogContent class="max-w-2xl">
      <DialogHeader>
        <DialogTitle>
          <Code2 class="size-4 text-primary" />
          <span>{{ t("SetSearchSolution.CustomSolutionDialog.title") }}</span>
        </DialogTitle>
        <DialogDescription class="flex items-center gap-1.5">
          <SiteName :site-id="siteId" tag="span" class="font-medium text-foreground" />
        </DialogDescription>
      </DialogHeader>

      <div class="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <div class="space-y-1.5">
          <Label for="custom-solution-name">{{ t("SetSearchSolution.CustomSolutionDialog.solutionName") }}</Label>
          <Input
            id="custom-solution-name"
            v-model="searchSolution.name"
            :placeholder="t('SetSearchSolution.CustomSolutionDialog.solutionName')"
          />
          <p v-if="!isNameValid" class="text-xs text-destructive">
            {{ t("SetSearchSolution.CustomSolutionDialog.solutionName") }}不能为空
          </p>
        </div>

        <div class="space-y-1.5">
          <Label for="custom-solution-json">{{ t("SetSearchSolution.CustomSolutionDialog.requestConfig") }}</Label>
          <Textarea
            id="custom-solution-json"
            v-model="searchSolutionEntryRequestConfig"
            :rows="10"
            class="font-mono text-xs leading-relaxed"
          />
          <p v-if="!isJsonValid" class="text-xs text-destructive">
            {{ t("SetSearchSolution.CustomSolutionDialog.requestConfigJsonError") }}
          </p>
          <p v-else class="text-xs text-muted-foreground">
            {{ t("SetSearchSolution.CustomSolutionDialog.requestConfigHint") }}
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="showDialog = false">
          {{ t("common.dialog.cancel") }}
        </Button>
        <Button :disabled="!formValid" @click="doSubmit">
          <CheckCircle2 class="size-4" />
          {{ t("common.dialog.ok") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
