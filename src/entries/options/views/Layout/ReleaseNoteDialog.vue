<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { BookOpen, ExternalLink, GitCommitHorizontal, Sparkles } from "lucide-vue-next";

import { useConfigStore } from "@/options/stores/config.ts";
import { REPO_URL } from "~/helper.ts";
import {
  Badge,
  BrandLogo,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui";

const showDialog = defineModel<boolean>({ default: false });

const { t } = useI18n();
const configStore = useConfigStore();

const currentVersion = __EXT_VERSION__;
const gitVersion = __GIT_VERSION__;

function confirmAndClose() {
  if (configStore.version !== currentVersion) {
    configStore.version = currentVersion;
    configStore.$save();
  }
  showDialog.value = false;
}
</script>

<template>
  <Dialog v-model="showDialog">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>
          <BrandLogo :size="22" class="rounded-md" />
          <span>PT Depiler Lite</span>
          <Badge variant="secondary" class="font-mono text-[11px]">{{ currentVersion }}</Badge>
        </DialogTitle>
        <DialogDescription>
          {{ t("layout.releaseNote.title", { extName: "PT Depiler Lite" }) }}
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-3 px-5 py-4 text-xs leading-relaxed text-muted-foreground">
        <div class="rounded-lg border border-border bg-muted/40 p-3 space-y-1.5">
          <div class="flex items-center justify-between">
            <span class="font-medium text-foreground">当前构建版本</span>
            <span class="font-mono text-foreground">{{ currentVersion }}</span>
          </div>
          <div v-if="gitVersion?.short" class="flex items-center justify-between">
            <span>Git Commit</span>
            <a
              :href="`${REPO_URL}/commit/${gitVersion.long}`"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 font-mono text-primary hover:underline"
            >
              <GitCommitHorizontal class="size-3.5" />
              {{ gitVersion.short }}
            </a>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <a
            :href="`${REPO_URL}/releases`"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-foreground transition-colors hover:bg-accent"
          >
            <span class="inline-flex items-center gap-1.5 font-medium">
              <Sparkles class="size-3.5 text-primary" />
              Release Notes
            </span>
            <ExternalLink class="size-3 text-muted-foreground" />
          </a>
          <a
            :href="`${REPO_URL}/wiki`"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-foreground transition-colors hover:bg-accent"
          >
            <span class="inline-flex items-center gap-1.5 font-medium">
              <BookOpen class="size-3.5 text-primary" />
              Wiki & FAQ
            </span>
            <ExternalLink class="size-3 text-muted-foreground" />
          </a>
        </div>
      </div>

      <DialogFooter>
        <Button class="w-full sm:w-auto" @click="confirmAndClose">
          {{ t("layout.releaseNote.startUsing") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
