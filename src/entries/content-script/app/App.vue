<script setup lang="ts">
import { computed, inject, provide, ref, shallowReactive, useTemplateRef, watch, withModifiers } from "vue";
import { useI18n } from "vue-i18n";
import { useDraggable, useWindowSize } from "@vueuse/core";
import { Toaster } from "vue-sonner";
import { type ITorrent } from "@ptd/site";
import { LayoutDashboard, X } from "lucide-vue-next";

import { sendMessage } from "@/messages.ts";
import { useConfigStore } from "@/options/stores/config.ts";
import { cn, providePortalTarget } from "~/lib/utils";
import { BrandLogo, Separator } from "~/components/ui";

import type { IRemoteDownloadDialogData } from "./types.ts";
import { currentView, type IPtdData, pageType, updatePageType } from "./utils.ts";

import SpeedDialBtn from "./components/SpeedDialBtn.vue";
import SentToDownloaderDialog from "@/options/components/SentToDownloaderDialog/Index.vue";

const configStore = useConfigStore();
const { t } = useI18n();

const ptdData = inject<IPtdData>("ptd_data", {});
const portalEl = inject<HTMLElement | string>("ptd_portal", "body");
const themeTargets = inject<HTMLElement[]>("ptd_theme_targets", []);

providePortalTarget(portalEl);

const effectiveTheme = computed<"light" | "dark">(() =>
  configStore.contentScript?.applyTheme ? configStore.uiTheme : "light",
);

watch(
  effectiveTheme,
  (theme) => {
    const isDark = theme === "dark";
    for (const target of themeTargets) {
      target.classList?.toggle("dark", isDark);
    }
  },
  { immediate: true },
);

const el = useTemplateRef<HTMLElement>("el");
const triggerBtn = useTemplateRef<HTMLElement>("triggerBtn");
provide("app", el);

const { width: windowWidth, height: windowHeight } = useWindowSize();
const rightX = ref<number>(0);
const bottomY = ref<number>(0);
const openSpeedDial = ref<boolean>(false);

let startPos = { x: 0, y: 0 };
let movedDuringDrag = false;

const { x, y, style } = useDraggable(el, {
  handle: triggerBtn,
  preventDefault: true,
  initialValue: { x: -100, y: -100 },
  onStart: (pos) => {
    startPos = { x: pos.x, y: pos.y };
    movedDuringDrag = false;
  },
  onMove: (pos) => {
    if (Math.hypot(pos.x - startPos.x, pos.y - startPos.y) > 4) {
      movedDuringDrag = true;
    }
  },
  onEnd: ({ x: endX, y: endY }) => {
    configStore.updateContentScriptPosition(endX, endY);
    const { clientWidth, clientHeight } = document.documentElement;
    rightX.value = clientWidth - endX;
    bottomY.value = clientHeight - endY;
  },
});

const openUpward = computed(() => y.value > windowHeight.value / 2);
const alignRight = computed(() => x.value > windowWidth.value / 2);

window.addEventListener("resize", () => {
  const { clientWidth, clientHeight } = document.documentElement;

  x.value = clientWidth - rightX.value;
  if (x.value > clientWidth - 50 || x.value < 0) {
    x.value = clientWidth - 100;
  }
  rightX.value = clientWidth - x.value;

  y.value = clientHeight - bottomY.value;
  if (y.value > clientHeight - 50 || y.value < 0) {
    y.value = clientHeight - 100;
  }
  bottomY.value = clientHeight - y.value;
});

const isSupportedPage = computed(() => pageType.value === "list" || pageType.value === "detail");

// 立即检测页面类型：仅种子列表页 (list) 与详情页 (detail) 展示悬浮窗，同时提前就绪 siteInstance
void updatePageType(ptdData);

configStore.$onReady(() => {
  openSpeedDial.value = configStore.contentScript?.defaultOpenSpeedDial ?? false;
  void updatePageType(ptdData);
  const { x: storeX = -100, y: storeY = -100 } = configStore.contentScript?.position ?? {};
  const { clientWidth, clientHeight } = document.documentElement;

  x.value = storeX <= 0 || storeX > clientWidth - 50 ? clientWidth - 100 : storeX;
  y.value = storeY <= 0 || storeY > clientHeight - 50 ? clientHeight - 100 : storeY;
  rightX.value = clientWidth - x.value;
  bottomY.value = clientHeight - y.value;
});

const remoteDownloadDialogData = shallowReactive<IRemoteDownloadDialogData>({
  show: false,
  torrents: [] as ITorrent[],
  isDefaultSend: false,
});
provide("remoteDownloadDialogData", remoteDownloadDialogData);

const CUSTOM_DRAG_MIME = "text/json+ptd";
const isDragging = ref<boolean>(false);

function fixDraggingLink(link: string): string {
  if (!link.startsWith("http") && !link.startsWith("magnet:")) {
    return new URL(link, window.location.href).href;
  }
  return link;
}

document.addEventListener("dragstart", (e: DragEvent) => {
  const rawTarget = e.target as HTMLElement | null;
  const a = rawTarget?.closest?.("a") as HTMLAnchorElement | null;
  if (!a) return;

  let rawHref = a.getAttribute("href") || a.href || "";
  if (!rawHref || rawHref.startsWith("javascript:")) {
    // 兼容 Audiences 等站点详情页「下载链接」按钮旁隐藏的直链 input#passkeyDlUrl
    const hiddenPasskeyInput = document.querySelector<HTMLInputElement>("input#passkeyDlUrl[value*='download.php']");
    if (a.id === "copyDlLink" && hiddenPasskeyInput?.value) {
      rawHref = hiddenPasskeyInput.value.trim();
    } else {
      return;
    }
  }

  const link = fixDraggingLink(rawHref);
  if (link) {
    const list: ITorrent[] = [
      {
        site: ptdData.siteId || "",
        link,
        title: a.getAttribute("title") || a.innerText || document.title,
        id: getIDFromURL(URL.parse(link, location.href)),
      },
    ];
    e.dataTransfer?.setData(CUSTOM_DRAG_MIME, JSON.stringify(list));
  }
});

const SIMPLE_URL_REGEX = /https?:\/\/[^\s]+/g;

function extractLinksManually(dataTransfer: DataTransfer): string[] {
  if (Array.from(dataTransfer.types).includes("text/uri-list")) {
    const uriList = dataTransfer.getData("text/uri-list");
    if (uriList) {
      return uriList
        .split("\r\n")
        .map((line) => line.trim())
        .filter((uri) => !uri.startsWith("#") && uri.startsWith("http"));
    }
  }
  if (dataTransfer.types.includes("text/html")) {
    const textData = dataTransfer.getData("text/html");
    if (textData) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(textData, "text/html");
      const links = Array.from(doc.querySelectorAll("a[href]")).map((a) => (a as HTMLAnchorElement).href);
      return links.filter((link) => link.startsWith("http") || link.startsWith("magnet:"));
    }
  }
  if (dataTransfer.types.includes("text/plain")) {
    const textData = dataTransfer.getData("text/plain");
    if (textData) {
      return Array.from(
        textData
          .matchAll(SIMPLE_URL_REGEX)
          .map((matched) => matched[0])
          .filter((url) => URL.canParse(url)),
      );
    }
  }
  return [];
}

function getIDFromURL(url?: URL | null): string {
  if (!url) return "";
  for (const i of ["id", "tid", "torrent_id", "torrentId", "hash", "hash_id"]) {
    if (url.searchParams.has(i)) {
      return url.searchParams.get(i) || "";
    }
  }
  if (url.pathname) {
    for (const pathnameMatcher of [/\/(\d+)(?:\/|$)/]) {
      const match = url.pathname.match(pathnameMatcher);
      if (match) {
        return match[1] || "";
      }
    }
  }
  return "";
}

function onDrop(event: DragEvent) {
  const dataTransfer = event.dataTransfer;
  if (!dataTransfer) {
    isDragging.value = false;
    return;
  }
  let torrents: ITorrent[] = [];
  if (Array.from(dataTransfer.types).includes(CUSTOM_DRAG_MIME)) {
    try {
      torrents = JSON.parse(dataTransfer.getData(CUSTOM_DRAG_MIME));
    } catch (error) {
      console.warn("[PTD] Failed to parse dropped data as JSON:", error);
    }
  } else {
    const links = extractLinksManually(dataTransfer);
    for (const link of links) {
      const url = URL.parse(link);
      if (!url || !(url.protocol.startsWith("http") || url.protocol.startsWith("magnet"))) continue;
      torrents.push({ link, title: "", site: ptdData.siteId || "", id: getIDFromURL(url) });
    }
  }
  if (torrents.length > 0) {
    remoteDownloadDialogData.torrents = torrents;
    remoteDownloadDialogData.show = true;
  } else {
    console.warn("[PTD] No valid torrent data found in the dropped content.");
  }
  isDragging.value = false;
}

const dropAction = computed(() => {
  if (ptdData.siteId && (configStore.contentScript?.dragLinkOnSpeedDial ?? true)) {
    return {
      drop: withModifiers((e) => onDrop(e as DragEvent), ["prevent"]),
      dragover: withModifiers(() => (isDragging.value = true), ["prevent"]),
      dragenter: withModifiers(() => (isDragging.value = true), ["prevent"]),
    };
  }
  return {};
});

function toggleSpeedDial() {
  if (movedDuringDrag) {
    movedDuringDrag = false;
    return;
  }
  openSpeedDial.value = !openSpeedDial.value;
  if (openSpeedDial.value) {
    void updatePageType(ptdData);
  }
}

function openOptions() {
  sendMessage("openOptionsPage", "/");
}
</script>

<template>
  <div
    v-show="isSupportedPage"
    ref="el"
    :style="style"
    style="position: fixed; z-index: 9999999"
    :class="
      cn(
        'select-none transition-opacity duration-200',
        configStore.contentScript.fadeEnterStyle && !openSpeedDial && 'opacity-75 hover:opacity-100',
      )
    "
  >
    <div class="relative inline-flex items-center justify-center">
      <!-- 视口自适应纵向快捷菜单卡片 -->
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="scale-95 opacity-0"
        enter-to-class="scale-100 opacity-100"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="scale-100 opacity-100"
        leave-to-class="scale-95 opacity-0"
      >
        <div
          v-show="openSpeedDial"
          :class="
            cn(
              'absolute z-10 flex w-54 flex-col gap-1 rounded-xl border border-zinc-300/90 bg-popover p-1.5 text-popover-foreground backdrop-blur-xl dark:border-white/16 [box-shadow:0_16px_40px_-8px_rgba(15,23,42,0.26),0_4px_14px_-2px_rgba(15,23,42,0.12),0_0_0_1px_rgba(15,23,42,0.04)] dark:[box-shadow:0_18px_42px_-8px_rgba(0,0,0,0.65),0_4px_14px_-2px_rgba(0,0,0,0.4)]',
              openUpward ? 'bottom-full mb-3' : 'top-full mt-3',
              alignRight ? 'right-0' : 'left-0',
              openUpward && alignRight && 'origin-bottom-right',
              openUpward && !alignRight && 'origin-bottom-left',
              !openUpward && alignRight && 'origin-top-right',
              !openUpward && !alignRight && 'origin-top-left',
            )
          "
        >
          <component :is="currentView" :key="pageType" />

          <Separator class="my-1" />

          <SpeedDialBtn key="home" :icon="LayoutDashboard" :title="t('contentScript.openPTD')" @click="openOptions" />
        </div>
      </Transition>

      <!-- 悬浮触发按钮（支持自由拖拽与拖放种子链接推送） -->
      <button
        ref="triggerBtn"
        type="button"
        :title="t('contentScript.openPTD')"
        :class="
          cn(
            'group relative flex size-11.5 items-center justify-center rounded-2xl border border-zinc-300/90 bg-card/98 text-foreground backdrop-blur-xl transition-all duration-150 hover:-translate-y-0.5 hover:scale-105 hover:border-primary/60 focus:outline-none dark:border-white/18 [box-shadow:0_10px_26px_-4px_rgba(15,23,42,0.24),0_3px_8px_-2px_rgba(15,23,42,0.12)] dark:[box-shadow:0_10px_28px_-4px_rgba(0,0,0,0.65),0_3px_8px_-2px_rgba(0,0,0,0.4)]',
            openSpeedDial && 'border-primary ring-3 ring-primary/25',
            isDragging && 'scale-110 border-primary bg-primary/10 ring-4 ring-primary/30',
          )
        "
        @click="toggleSpeedDial"
        @mouseleave.prevent="isDragging = false"
        @dragleave.prevent="isDragging = false"
        v-on="dropAction"
      >
        <BrandLogo
          :size="28"
          :class="cn('transition-transform duration-200 group-hover:scale-105', isDragging && 'ptd-fab-loading')"
        />
        <span
          v-if="openSpeedDial && !isDragging"
          class="absolute -right-1.5 -top-1.5 flex size-4.5 items-center justify-center rounded-full border border-zinc-300 bg-background text-foreground shadow-sm dark:border-white/20"
        >
          <X class="size-2.5" />
        </span>
      </button>
    </div>
  </div>

  <Toaster
    position="bottom-right"
    :theme="effectiveTheme"
    rich-colors
    close-button
    :toast-options="{
      class: 'font-sans text-xs',
    }"
  />

  <SentToDownloaderDialog
    v-model="remoteDownloadDialogData.show"
    :torrent-items="remoteDownloadDialogData.torrents"
    :is-default-send="remoteDownloadDialogData.isDefaultSend"
  />
</template>

<style scoped>
@keyframes onFABLoading {
  100% {
    transform: rotate(360deg);
  }
}

.ptd-fab-loading {
  animation: onFABLoading 1.9s linear infinite running;
}
</style>
