import { createRulesPlugin, createVuetify } from "vuetify";
import { en, zhHans } from "vuetify/locale";

import { type TLangCode } from "./i18n.ts";

export const vuetifyLangMap: Record<TLangCode, string> = {
  en: "en",
  zh_CN: "zhHans",
};

export const vuetifyInstance = createVuetify({
  theme: {
    defaultTheme: "light",
    themes: {
      light: {
        dark: false,
        colors: {
          background: "#F8FAFC",
          surface: "#FFFFFF",
          "surface-variant": "#F1F5F9",
          primary: "#2563EB",
          secondary: "#475569",
          success: "#16A34A",
          warning: "#D97706",
          error: "#DC2626",
          info: "#0284C7",
        },
      },
      dark: {
        dark: true,
        colors: {
          background: "#0B1120",
          surface: "#111827",
          "surface-variant": "#1E293B",
          primary: "#3B82F6",
          secondary: "#94A3B8",
          success: "#22C55E",
          warning: "#F59E0B",
          error: "#EF4444",
          info: "#38BDF8",
        },
      },
    },
  },
  defaults: {
    VCard: { elevation: 0, rounded: "lg", border: true },
    VBtn: { elevation: 0, rounded: "lg" },
    VChip: { rounded: "md" },
    VTextField: { variant: "outlined", density: "compact", color: "primary" },
    VSelect: { variant: "outlined", density: "compact", color: "primary" },
    VCombobox: { variant: "outlined", density: "compact", color: "primary" },
    VAutocomplete: { variant: "outlined", density: "compact", color: "primary" },
    VNumberInput: { variant: "outlined", density: "compact", color: "primary" },
    VTextarea: { variant: "outlined", density: "compact", color: "primary" },
    VSwitch: { color: "primary", inset: true, density: "compact" },
    VDataTable: { hover: true },
  },
  locale: {
    locale: "zhHans",
    fallback: "en",
    messages: { zhHans, en },
  },
});

/** 站点 / 下载器地址的校验正则；同时也作为 pattern 别名的参数直接在模板里用。 */
export const urlPattern = /^(https?):\/\/[-A-Za-z0-9+&@#/%?=~_|!:,.;[\]]+[-A-Za-z0-9+&@#/%=~_|]$/;

export const vuetifyRulesPlugin = createRulesPlugin(
  {
    aliases: {
      url: (err?: string) => (v: unknown) => (typeof v === "string" && urlPattern.test(v)) || err || "Not url",
    },
  },
  vuetifyInstance.locale,
);
