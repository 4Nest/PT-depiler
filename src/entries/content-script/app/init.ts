import appCss from "./app.css?inline";

import { createApp } from "vue";

import App from "./App.vue";
import { updatePageType, type IPtdData } from "./utils.ts";
import { PORTAL_TARGET_KEY } from "~/lib/utils";
import { piniaInstance as pinia } from "@/options/plugins/pinia.ts";
import { i18nInstance as i18n } from "@/options/plugins/i18n.ts";

export function mountApp(document: Document, data: IPtdData = {}) {
  const contentRoot = document.createElement("div");
  contentRoot.id = "ptd-content-script-host";
  const shadowRoot = contentRoot.attachShadow({ mode: "closed" });

  // 1. 内联 Shadow DOM 隔离基座样式
  const baseStyleElement = document.createElement("style");
  baseStyleElement.id = "ptd-content-script-style-base";
  baseStyleElement.textContent = appCss.replaceAll(":root", ":host");
  shadowRoot.appendChild(baseStyleElement);

  // 2. 引入完整 Tailwind CSS v4 + shadcn-vue 令牌样式表
  const buildStyleElement = document.createElement("link");
  buildStyleElement.id = "ptd-content-script-style-build";
  buildStyleElement.rel = "stylesheet";
  buildStyleElement.href = chrome.runtime.getURL("pt-depiler.css");
  shadowRoot.appendChild(buildStyleElement);

  // 3. 在 Shadow Root 内建立根容器 + 应用挂载点 + 专属浮层 Portal 容器
  const rootContainer = document.createElement("div");
  rootContainer.id = "ptd-content-script-root";
  shadowRoot.appendChild(rootContainer);

  const appMountElement = document.createElement("div");
  appMountElement.id = "ptd-content-script-app";
  rootContainer.appendChild(appMountElement);

  const portalElement = document.createElement("div");
  portalElement.id = "ptd-content-script-portal";
  rootContainer.appendChild(portalElement);

  document.body.append(contentRoot);

  // 4. 挂载 Vue 应用并注入 Portal 目标与主题控制目标
  const app = createApp(App).use(pinia).use(i18n);
  app.provide("ptd_data", data);
  app.provide("ptd_portal", portalElement);
  app.provide("ptd_theme_targets", [contentRoot, rootContainer, portalElement]);
  app.provide(PORTAL_TARGET_KEY, portalElement);
  app.mount(appMountElement);

  // 5. 监听 SPA 路由切换与宿主 body 重建
  let lastHref = document.location.href;
  const mutationObserver = new MutationObserver(() => {
    if (document.location.href !== lastHref) {
      lastHref = document.location.href;
      updatePageType(data).catch();
    }

    if (!document.body.contains(contentRoot)) {
      console.debug("[PTD] Content root removed from body, remounting app...");
      app.unmount();
      mutationObserver.disconnect();
      mountApp(document, data);
    }
  });

  mutationObserver.observe(document, { childList: true, subtree: true });

  return { contentRoot, shadowRoot, rootContainer, appMountElement, portalElement, app };
}
