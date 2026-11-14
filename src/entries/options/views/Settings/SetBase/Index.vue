<script setup lang="ts">
import { computed, useTemplateRef, type Component } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { CheckCircle2, Clapperboard, Download, KeyRound, Palette, Search, User } from "lucide-vue-next";

import { setBaseChildren } from "@/options/plugins/router.ts";
import { useConfigStore } from "@/options/stores/config.ts";
import { useRuntimeStore } from "@/options/stores/runtime.ts";
import { Button } from "~/components/ui";
import { cn } from "~/lib/utils";

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const configStore = useConfigStore();
const runtimeStore = useRuntimeStore();

const iconMap: Record<string, Component> = {
  palette: Palette,
  search: Search,
  download: Download,
  user: User,
  "key-round": KeyRound,
  clapperboard: Clapperboard,
};

const setBaseTabs = setBaseChildren.map((x) => ({
  key: String(x.alias ?? x.path),
  route: String(x.name),
  icon: iconMap[String(x.meta?.icon ?? "")] ?? Palette,
}));

const setTabRef = useTemplateRef<{ beforeSave?: () => Promise<void> | void; afterSave?: () => Promise<void> | void }>(
  "setTabRef",
);

const activeTab = computed(() => String(route.name ?? "SetBaseUi"));

function selectTab(routeName: string) {
  router.push({ name: routeName });
}

const showSaveButton = computed(() => {
  return route.meta?.usesGlobalSave !== false;
});

async function save() {
  await setTabRef.value?.beforeSave?.();
  await configStore.$save();
  runtimeStore.showSnackbar(t("common.saveSuccess"), { color: "success" });
  await setTabRef.value?.afterSave?.();
}
</script>

<template>
  <div class="flex max-w-6xl flex-col gap-6 lg:flex-row lg:items-start">
    <!-- 左侧垂直导航（移动端自动转为横向胶囊条） -->
    <nav
      class="flex shrink-0 gap-1 overflow-x-auto pb-1 lg:sticky lg:top-20 lg:w-56 lg:flex-col lg:overflow-visible lg:pb-0"
    >
      <button
        v-for="tab in setBaseTabs"
        :key="tab.key"
        type="button"
        :class="
          cn(
            'flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
            activeTab === tab.route
              ? 'bg-accent text-accent-foreground shadow-2xs'
              : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
          )
        "
        @click="selectTab(tab.route)"
      >
        <component
          :is="tab.icon"
          :class="cn('size-4 shrink-0', activeTab === tab.route ? 'text-primary' : 'text-muted-foreground')"
        />
        <span class="whitespace-nowrap">{{ t(`SetBase.tab.${tab.key}`) }}</span>
      </button>
    </nav>

    <!-- 右侧设置分组面板 + 底部吸附保存栏 -->
    <div class="min-w-0 flex-1 space-y-5">
      <router-view v-slot="{ Component }">
        <component :is="Component" ref="setTabRef" />
      </router-view>

      <div
        v-if="showSaveButton"
        class="sticky bottom-4 z-20 flex items-center justify-end gap-3 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-md backdrop-blur-md"
      >
        <Button @click="save">
          <CheckCircle2 class="size-4" />
          {{ t("common.save") }}
        </Button>
      </div>
    </div>
  </div>
</template>
