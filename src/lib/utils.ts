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
