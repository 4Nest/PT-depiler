<script lang="ts" setup>
import { provide, ref } from "vue";
import { useI18n } from "vue-i18n";
import { type ISiteUserConfig, type TSiteID } from "@ptd/site";
import { Check, SlidersHorizontal } from "lucide-vue-next";

import { useMetadataStore } from "@/options/stores/metadata.ts";
import SiteFavicon from "@/options/components/SiteFavicon/Index.vue";
import Editor from "./Editor.vue";
import { Badge, Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui";

const showDialog = defineModel<boolean>({ default: false });
const props = defineProps<{
  siteId: TSiteID;
}>();

const { t } = useI18n();
const metadataStore = useMetadataStore();

const isFormValid = ref<boolean>(false);
const storedSiteUserConfig = ref<ISiteUserConfig & { valid?: boolean }>({ valid: false });
provide("storedSiteUserConfig", storedSiteUserConfig);

async function patchSite() {
  await metadataStore.addSite(props.siteId, storedSiteUserConfig.value);
  showDialog.value = false;
}

function dialogEnter() {
  storedSiteUserConfig.value = {
    valid: false,
    ...(metadataStore.sites[props.siteId] ?? {}),
  };
}
</script>

<template>
  <Dialog v-model="showDialog" @after-open="dialogEnter">
    <DialogContent class="max-w-3xl">
      <DialogHeader>
        <DialogTitle>
          <SlidersHorizontal class="size-4 text-primary" />
          <span>{{ t("SetSite.edit.title") }}</span>
          <Badge v-if="props.siteId" variant="secondary" class="ml-1 gap-1.5 font-normal">
            <SiteFavicon :site-id="props.siteId" :size="14" />
            <span>{{ metadataStore.siteNameMap[props.siteId] ?? props.siteId }}</span>
          </Badge>
        </DialogTitle>
      </DialogHeader>

      <div class="flex-1 overflow-y-auto px-5 py-4">
        <Editor v-model="props.siteId" @update:form-valid="(v) => (isFormValid = v)" />
      </div>

      <DialogFooter>
        <Button variant="outline" @click="showDialog = false">
          {{ t("common.dialog.cancel") }}
        </Button>
        <Button :disabled="!isFormValid" @click="patchSite">
          <Check class="size-4" />
          {{ t("common.dialog.ok") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
