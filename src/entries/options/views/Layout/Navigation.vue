<script setup lang="ts">
import { computed, type Component } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { useMediaQuery } from "@vueuse/core";
import {
  Bug,
  CloudUpload,
  ExternalLink,
  Globe,
  HardDriveDownload,
  Languages,
  LayoutDashboard,
  Layers,
  ScrollText,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-vue-next";

import { routes } from "@/options/plugins/router.ts";
import { definedLangMetaData } from "@/options/plugins/i18n.ts";
import { useConfigStore } from "@/options/stores/config.ts";
import { useMetadataStore } from "@/options/stores/metadata.ts";
import { isDebug, REPO_URL } from "~/helper.ts";
import { cn } from "~/lib/utils";
import {
  BrandLogo,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tooltip,
} from "~/components/ui";

const emit = defineEmits<{
  openReleaseNote: [];
}>();

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const configStore = useConfigStore();
const metadataStore = useMetadataStore();
const isMobile = useMediaQuery("(max-width: 767px)");
const needLoginCount = computed(() => metadataStore.getNeedLoginSites.length);

const extVersion = __EXT_VERSION__;
const gitVersion = __GIT_VERSION__;

const iconMap: Record<string, Component> = {
  "layout-dashboard": LayoutDashboard,
  search: Search,
  globe: Globe,
  "hard-drive-download": HardDriveDownload,
  layers: Layers,
  "cloud-upload": CloudUpload,
  "sliders-horizontal": SlidersHorizontal,
  "scroll-text": ScrollText,
  bug: Bug,
};

const menuGroups = computed(() =>
  routes
    .filter((r) => r.meta?.isMainMenu)
    .map((group) => ({
      name: String(group.name),
      label: t(`route.${String(group.name)}.default`),
      items: (group.children ?? [])
        .filter((c) => c.meta?.show !== false)
        .map((c) => ({
          name: String(c.name),
          path: c.path,
          label: t(`route.${String(group.name)}.${String(c.name)}`),
          icon: iconMap[(c.meta?.icon as string) ?? ""] ?? LayoutDashboard,
        })),
    })),
);

function isItemActive(itemName: string, itemPath: string): boolean {
  if (route.name === itemName) return true;
  if (itemName === "SetBase" && String(route.name ?? "").startsWith("SetBase")) return true;
  if (itemName === "MyData" && (route.name === "UserDataStatistic" || route.name === "UserDataTimeline")) return true;
  return route.path === itemPath;
}

function navigateTo(name: string) {
  router.push({ name });
  if (isMobile.value) {
    configStore.isNavBarOpen = false;
  }
}

function switchLang(code: any) {
  configStore.lang = code;
  configStore.$save();
}

const collapsed = computed(() => !isMobile.value && !configStore.isNavBarOpen);
</script>

<template>
  <!-- 移动端遮罩 -->
  <div
    v-if="isMobile && configStore.isNavBarOpen"
    class="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px]"
    @click="configStore.isNavBarOpen = false"
  />

  <aside
    :class="
      cn(
        'z-40 flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200 select-none',
        isMobile
          ? ['fixed inset-y-0 left-0 w-60 shadow-xl', configStore.isNavBarOpen ? 'translate-x-0' : '-translate-x-full']
          : ['sticky top-0 h-screen', collapsed ? 'w-14' : 'w-52'],
      )
    "
  >
    <!-- Sidebar Header / Brand -->
    <div
      :class="
        cn(
          'flex h-14 shrink-0 items-center border-b border-sidebar-border',
          collapsed ? 'justify-center px-2' : 'justify-between px-4',
        )
      "
    >
      <button
        type="button"
        class="flex items-center gap-2.5 text-left focus:outline-none"
        @click="navigateTo('MyData')"
      >
        <BrandLogo :size="28" class="shadow-xs rounded-lg" />
        <div v-if="!collapsed" class="flex items-center gap-1.5 overflow-hidden">
          <span class="truncate text-sm font-semibold tracking-tight text-foreground">PT Depiler</span>
          <Badge variant="secondary" class="h-4.5 px-1.5 text-[10px] font-semibold">Lite</Badge>
        </div>
      </button>
    </div>

    <!-- Sidebar Menu -->
    <nav class="flex-1 space-y-5 overflow-y-auto px-2.5 py-4">
      <div v-for="group in menuGroups" :key="group.name" class="space-y-1">
        <div
          v-if="!collapsed"
          class="px-2.5 pb-1 text-[11px] font-medium tracking-wider text-muted-foreground/80 uppercase"
        >
          {{ group.label }}
        </div>

        <template v-for="item in group.items" :key="item.name">
          <Tooltip :content="item.label" side="right" :disabled="!collapsed">
            <button
              type="button"
              :class="
                cn(
                  'group relative flex w-full items-center rounded-lg text-[13px] font-medium transition-colors',
                  collapsed ? 'h-9 justify-center px-0' : 'h-10 gap-2.5 px-2.5 md:h-8.5',
                  isItemActive(item.name, item.path)
                    ? 'bg-primary/12 text-primary font-semibold'
                    : 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground',
                )
              "
              @click="navigateTo(item.name)"
            >
              <span
                v-if="isItemActive(item.name, item.path)"
                class="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r bg-primary"
              />
              <component
                :is="item.icon"
                :class="
                  cn(
                    'size-4 shrink-0 transition-colors',
                    isItemActive(item.name, item.path)
                      ? 'text-primary'
                      : 'text-muted-foreground group-hover:text-foreground',
                  )
                "
              />
              <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
              <Badge
                v-if="item.name === 'MyData' && needLoginCount > 0 && !collapsed"
                variant="destructive"
                class="ml-auto h-4 min-w-4 justify-center px-1 text-[10px] tabular-nums"
              >
                {{ needLoginCount }}
              </Badge>
              <span
                v-else-if="item.name === 'MyData' && needLoginCount > 0 && collapsed"
                class="absolute top-1.5 right-2 size-2 rounded-full bg-destructive"
              />
            </button>
          </Tooltip>
        </template>
      </div>
    </nav>

    <!-- Sidebar Footer -->
    <div class="shrink-0 border-t border-sidebar-border p-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
      <div v-if="!collapsed" class="flex items-center justify-between gap-1 rounded-lg bg-muted/45 px-2.5 py-2">
        <div class="min-w-0 flex-1">
          <button
            type="button"
            class="flex max-w-full min-w-0 items-center gap-1 text-[11px] font-medium text-foreground hover:text-primary"
            :title="extVersion"
            @click="emit('openReleaseNote')"
          >
            <Sparkles class="size-3 shrink-0 text-primary" />
            <span class="truncate tabular-nums">{{ extVersion }}</span>
          </button>
          <span v-if="isDebug" class="mt-0.5 inline-block text-[10px] text-warning">DEV MODE</span>
        </div>

        <div class="flex shrink-0 items-center gap-0.5">
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="ghost" size="icon-xs" title="Language">
                <Languages class="size-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem v-for="lang in definedLangMetaData" :key="lang.value" @click="switchLang(lang.value)">
                <span :class="configStore.lang === lang.value ? 'font-semibold text-primary' : ''">
                  {{ lang.title }}
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            as="a"
            :href="REPO_URL"
            target="_blank"
            rel="noopener noreferrer"
            variant="ghost"
            size="icon-xs"
            title="GitHub"
          >
            <ExternalLink class="size-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      <div v-else class="flex flex-col items-center gap-1">
        <Tooltip :content="extVersion" side="right">
          <Button variant="ghost" size="icon-sm" @click="emit('openReleaseNote')">
            <Sparkles class="size-4 text-muted-foreground" />
          </Button>
        </Tooltip>
      </div>
    </div>
  </aside>
</template>
