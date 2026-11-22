import { inject, provide, type InjectionKey, type Ref } from "vue";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const urlPattern = /^(https?):\/\/[-A-Za-z0-9+&@#/%?=~_|!:,.;]+[-A-Za-z0-9+&@#/%=~_|]/;

export function isValidUrl(value: unknown): boolean {
  return typeof value === "string" && urlPattern.test(value.trim());
}

/**
 * Portal 挂载目标注入键：
 * - Options 主应用默认使用 "body"
 * - Content Script Shadow DOM 注入 shadowRoot 内部的容器元素，使 Dialog/Select/Popover/Tooltip
 *   全部留在 Shadow DOM 内部并完整继承 shadcn 样式变量，零宿主污染。
 */
export const PORTAL_TARGET_KEY: InjectionKey<Ref<HTMLElement | string> | HTMLElement | string> =
  Symbol("ptd-portal-target");

export function providePortalTarget(target: Ref<HTMLElement | string> | HTMLElement | string) {
  provide(PORTAL_TARGET_KEY, target);
}

export function usePortalTarget(): HTMLElement | string {
  const injected = inject(PORTAL_TARGET_KEY, "body");
  if (injected && typeof injected === "object" && "value" in injected) {
    return injected.value;
  }
  return injected || "body";
}

const shadowActualTargetMap = new WeakMap<Event, EventTarget>();

/**
 * 在 closed Shadow DOM 根节点捕获阶段记录原始事件目标。
 * 事件跨出 Shadow 边界冒泡到宿主页 document 后，event.target 会被浏览器 retarget 为宿主元素，
 * 导致 Reka UI DismissableLayer 无法识别点击发生在 Portal 子浮层（如 Popover / TagsInput）内部而误关 Dialog。
 */
export function registerShadowEventTracker(root: ShadowRoot) {
  const captureTarget = (e: Event) => {
    if (e.target) {
      shadowActualTargetMap.set(e, e.target);
    }
  };
  root.addEventListener("pointerdown", captureTarget, true);
  root.addEventListener("focusin", captureTarget, true);
  root.addEventListener("click", captureTarget, true);
}

export function getActualEventTarget(event?: Event | null): Element | null {
  if (!event) return null;
  const raw = shadowActualTargetMap.get(event) ?? event.composedPath?.()?.[0] ?? event.target;
  return raw instanceof Element ? raw : null;
}

/**
 * 判断 Reka UI 的 interactOutside 事件是否实际发生在当前层或更上层的浮层内
 * （如 Shadow DOM 中 Dialog 内打开的 Popover / TagsInput / DropdownMenu）。
 */
export function isInteractInsideCurrentOrUpperLayer(
  layerRootEl: HTMLElement | null | undefined,
  customEvent: { detail?: { originalEvent?: Event }; target?: EventTarget | null },
): boolean {
  if (!layerRootEl) return false;
  const originalEvent = customEvent?.detail?.originalEvent;
  const actualTarget =
    getActualEventTarget(originalEvent) ?? (customEvent?.target instanceof Element ? customEvent.target : null);
  if (!actualTarget) return false;

  if (layerRootEl.contains(actualTarget)) return true;

  const targetLayer = actualTarget.closest("[data-dismissable-layer]");
  if (!targetLayer) return false;

  const mainLayer =
    layerRootEl.dataset?.dismissableLayer === "" ? layerRootEl : layerRootEl.querySelector("[data-dismissable-layer]");
  if (!mainLayer) return false;
  if (mainLayer === targetLayer) return true;

  const rootNode = layerRootEl.getRootNode() as Document | ShadowRoot;
  if (!("querySelectorAll" in rootNode)) return false;

  const layers = Array.from(rootNode.querySelectorAll("[data-dismissable-layer]"));
  const mainIndex = layers.indexOf(mainLayer);
  const targetIndex = layers.indexOf(targetLayer);
  return mainIndex !== -1 && targetIndex !== -1 && mainIndex <= targetIndex;
}
