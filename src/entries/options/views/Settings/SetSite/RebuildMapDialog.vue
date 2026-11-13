<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Loader2, RefreshCw, Wrench } from "lucide-vue-next";

import { useMetadataStore } from "@/options/stores/metadata.ts";
import { useResetableRef } from "@/options/directives/useResetableRef.ts";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Label, Switch } from "~/components/ui";

const showDialog = defineModel<boolean>({ default: false });

const { t } = useI18n();
const isRebuilding = ref(false);

const { ref: reBuildControlRef, reset: resetReBuildControlRef } = useResetableRef(() => ({
  rebuildSiteHostMap: true,
  rebuildSiteNameMap: false,
}));

async function doReBuild() {
  if (isRebuilding.value) return;
  isRebuilding.value = true;
  try {
    const metadataStore = useMetadataStore();

    if (reBuildControlRef.value.rebuildSiteHostMap) {
      await metadataStore.buildSiteHostMap();
    }

    if (reBuildControlRef.value.rebuildSiteNameMap) {
      await metadataStore.buildSiteNameMap();
    }

    await metadataStore.$save();
    showDialog.value = false;
  } finally {
    isRebuilding.value = false;
  }
}

const canReBuild = computed<boolean>(() => Object.values(reBuildControlRef.value).some(Boolean));

function dialogEnter() {
  resetReBuildControlRef();
}
</script>

<template>
  <Dialog v-model="showDialog" @after-open="dialogEnter">
    <DialogContent class="max-w-md" :prevent-outside-close="isRebuilding" :hide-close="isRebuilding">
      <DialogHeader>
        <DialogTitle>
          <Wrench class="size-4 text-primary" />
          {{ t("SetSite.ReBuildMapDialog.title") }}
        </DialogTitle>
      </DialogHeader>

      <div class="flex-1 space-y-2.5 overflow-y-auto px-5 py-4">
        <div
          class="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-muted/25 px-3.5 py-2.5 transition-colors hover:bg-muted/45"
          @click="reBuildControlRef.rebuildSiteHostMap = !reBuildControlRef.rebuildSiteHostMap"
        >
          <Label for="rebuild-host-map" class="cursor-pointer text-sm font-medium">
            {{ t("SetSite.ReBuildMapDialog.rebuildSiteHostMap") }}
          </Label>
          <Switch id="rebuild-host-map" v-model="reBuildControlRef.rebuildSiteHostMap" @click.stop />
        </div>

        <div
          class="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-muted/25 px-3.5 py-2.5 transition-colors hover:bg-muted/45"
          @click="reBuildControlRef.rebuildSiteNameMap = !reBuildControlRef.rebuildSiteNameMap"
        >
          <Label for="rebuild-name-map" class="cursor-pointer text-sm font-medium">
            {{ t("SetSite.ReBuildMapDialog.rebuildSiteNameMap") }}
          </Label>
          <Switch id="rebuild-name-map" v-model="reBuildControlRef.rebuildSiteNameMap" @click.stop />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" :disabled="isRebuilding" @click="showDialog = false">
          {{ t("common.dialog.cancel") }}
        </Button>
        <Button :disabled="!canReBuild || isRebuilding" @click="doReBuild">
          <Loader2 v-if="isRebuilding" class="size-4 animate-spin" />
          <RefreshCw v-else class="size-4" />
          {{ t("SetSite.ReBuildMapDialog.doRebuildBtn") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
