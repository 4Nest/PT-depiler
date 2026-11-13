<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, shallowRef, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import {
  ArrowLeft,
  Check,
  Copy,
  Eye,
  EyeOff,
  ImageDown,
  Loader2,
  Lock,
  Palette,
  RotateCcw,
  Save,
  Sparkles,
  Unlock,
  WifiOff,
} from "lucide-vue-next";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Slider,
  Switch,
} from "~/components/ui";
import { downloadBlob, formatDate, formatTimeAgo } from "@/options/utils.ts";
import { useMetadataStore } from "@/options/stores/metadata.ts";
import {
  defaultTimelineBackgroundColor,
  defaultTimelineTextColor,
  defaultTimelineUserNameColor,
  useConfigStore,
} from "@/options/stores/config.ts";
import { useRuntimeStore } from "@/options/stores/runtime.ts";

import SiteFavicon from "@/options/components/SiteFavicon/Index.vue";
import SiteName from "@/options/components/SiteName.vue";
import CheckSwitchButton from "@/options/components/CheckSwitchButton.vue";

import {
  canThisSiteShow,
  timelineDataRef,
  selectedSites,
  CTimelineUserInfoField,
  type ITimelineUserInfoField,
  fixedLastUserInfo,
  loadFullData,
} from "./utils.ts";
import { allAddedSiteMetadata, loadAllAddedSiteMetadata } from "../utils/siteMetadata.ts";

const extVersion = __EXT_VERSION__;

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const configStore = useConfigStore();
const metadataStore = useMetadataStore();
const runtimeStore = useRuntimeStore();
const control = configStore.userDataTimelineControl;

interface TimelineThemePreset {
  id: string;
  label: string;
  backgroundColor: string;
  userNameColor: string;
  textColor: string;
  swatch: string;
}

const THEME_PRESETS: TimelineThemePreset[] = [
  {
    id: "obsidian",
    label: "曜石极光",
    backgroundColor: "#0B1120",
    userNameColor: "#60A5FA",
    textColor: "#F8FAFC",
    swatch: "linear-gradient(135deg, #0B1120 0%, #1E293B 55%, #3B82F6 100%)",
  },
  {
    id: "aurora",
    label: "翡冷翠夜",
    backgroundColor: "#06191D",
    userNameColor: "#34D399",
    textColor: "#ECFDF5",
    swatch: "linear-gradient(135deg, #06191D 0%, #0F2E35 55%, #10B981 100%)",
  },
  {
    id: "pearl",
    label: "浅雾纯白",
    backgroundColor: "#F8FAFC",
    userNameColor: "#2563EB",
    textColor: "#0F172A",
    swatch: "linear-gradient(135deg, #FFFFFF 0%, #EEF4FF 60%, #3B82F6 100%)",
  },
  {
    id: "amber",
    label: "暮光黑金",
    backgroundColor: "#14110E",
    userNameColor: "#FBBF24",
    textColor: "#FAF8F5",
    swatch: "linear-gradient(135deg, #14110E 0%, #292118 55%, #F59E0B 100%)",
  },
];

const FIELD_ACCENT_COLORS: Record<string, string> = {
  uploaded: "#10B981",
  downloaded: "#38BDF8",
  ratio: "#F59E0B",
  seeding: "#818CF8",
  seedingSize: "#2DD4BF",
  bonus: "#FBBF24",
  bonusPerHour: "#FB923C",
  uploads: "#F472B6",
};

const FONT_SANS =
  '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
const FONT_MONO = '"JetBrains Mono", "SF Mono", Consolas, "Liberation Mono", Menlo, monospace';

const CANVAS_WIDTH = 760;
const PIXEL_RATIO = 2;

const isLoading = ref<boolean>(false);
const { ref: timelineData, reset: resetTimelineData } = timelineDataRef;
const allowEdit = reactive({ name: false, title: false });

const posterCanvas = useTemplateRef<HTMLCanvasElement>("posterCanvas");
const realAllSite = shallowRef<string[]>([]);
const canvasHeight = ref<number>(680);

const isPrivacyBlurred = computed(() => Boolean(configStore.myDataTableControl.privacyBlur));

function togglePrivacyBlur() {
  configStore.myDataTableControl.privacyBlur = !configStore.myDataTableControl.privacyBlur;
  configStore.$save();
}

function applyThemePreset(preset: TimelineThemePreset) {
  control.backgroundColor = preset.backgroundColor;
  control.userNameColor = preset.userNameColor;
  control.textColor = preset.textColor;
}

const activePresetId = computed(() => {
  const bg = (control.backgroundColor || "").toUpperCase();
  const accent = (control.userNameColor || "").toUpperCase();
  return (
    THEME_PRESETS.find((p) => p.backgroundColor.toUpperCase() === bg && p.userNameColor.toUpperCase() === accent)?.id ??
    "custom"
  );
});

function resetTimelineDataWithControl() {
  resetTimelineData();

  if (configStore.userName === "") {
    configStore.userName = configStore.getUserNames.perfName;
  }

  if (control.title !== "") {
    timelineData.value.title = control.title;
  }
}

const siteInfo = computed(() => timelineData.value.siteInfo.filter((x) => selectedSites.value.includes(x.site)));

const realShowField = computed(() => {
  const showField: ITimelineUserInfoField[] = [];
  for (const key of CTimelineUserInfoField) {
    if (control.showField[key.name]) {
      showField.push(key);
    }
  }
  return showField;
});

function formatSiteDateText(siteDate: number): string {
  return control.dateFormat === "time_added" ? String(formatDate(siteDate, "yyyy-MM-dd")) : formatTimeAgo(siteDate);
}

function parseHexRgb(hex: string, fallback: [number, number, number] = [11, 17, 32]): [number, number, number] {
  const clean = (hex || "").trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    return [parseInt(clean[0] + clean[0], 16), parseInt(clean[1] + clean[1], 16), parseInt(clean[2] + clean[2], 16)];
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
  }
  return fallback;
}

function rgba(rgb: [number, number, number], alpha: number): string {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

function mixRgb(a: [number, number, number], b: [number, number, number], weightB: number): [number, number, number] {
  const wA = 1 - weightB;
  return [
    Math.round(a[0] * wA + b[0] * weightB),
    Math.round(a[1] * wA + b[1] * weightB),
    Math.round(a[2] * wA + b[2] * weightB),
  ];
}

function getRelativeLuminance([r, g, b]: [number, number, number]): number {
  const toLinear = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function ellipsize(ctx: CanvasRenderingContext2D, str: string, maxWidth: number): string {
  if (!str || maxWidth <= 0) return "";
  if (ctx.measureText(str).width <= maxWidth) return str;
  let end = str.length;
  while (end > 1 && ctx.measureText(str.slice(0, end) + "…").width > maxWidth) {
    end--;
  }
  return str.slice(0, end) + "…";
}

function drawRoundedCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  fill: string | CanvasGradient,
  stroke?: string,
  lineWidth = 1,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function withPrivacyFilter(ctx: CanvasRenderingContext2D, blurred: boolean, drawFn: () => void) {
  ctx.save();
  if (blurred) {
    ctx.filter = "blur(6px)";
  }
  drawFn();
  ctx.restore();
}

function drawBrandShield(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  accentRgb: [number, number, number],
) {
  ctx.save();
  const grad = ctx.createLinearGradient(x, y, x + size, y + size);
  grad.addColorStop(0, rgba(mixRgb(accentRgb, [37, 99, 235], 0.35), 1));
  grad.addColorStop(1, rgba(mixRgb(accentRgb, [79, 70, 229], 0.55), 1));
  drawRoundedCard(ctx, x, y, size, size, 13, grad, "rgba(255,255,255,0.22)", 1);

  const s = size / 32;
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 2.6 * s;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(x + 9.2 * s, y + 11.2 * s);
  ctx.lineTo(x + 16 * s, y + 7.2 * s);
  ctx.lineTo(x + 22.8 * s, y + 11.2 * s);
  ctx.lineTo(x + 16 * s, y + 15.2 * s);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,0.24)";
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + 9.2 * s, y + 16.4 * s);
  ctx.lineTo(x + 16 * s, y + 20.4 * s);
  ctx.lineTo(x + 22.8 * s, y + 16.4 * s);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + 9.2 * s, y + 21.2 * s);
  ctx.lineTo(x + 16 * s, y + 25.2 * s);
  ctx.lineTo(x + 22.8 * s, y + 21.2 * s);
  ctx.strokeStyle = "rgba(255,255,255,0.72)";
  ctx.stroke();
  ctx.restore();
}

function drawSiteAvatar(
  ctx: CanvasRenderingContext2D,
  siteId: string,
  cx: number,
  cy: number,
  radius: number,
  options: {
    blurPx: number;
    isDead?: boolean;
    surfaceBg: string;
    ringStroke: string;
    fallbackTextRgb: [number, number, number];
  },
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = options.surfaceBg;
  ctx.fill();
  ctx.strokeStyle = options.ringStroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const meta = allAddedSiteMetadata[siteId];
  const img = meta?.faviconElement;

  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(4, radius - 3), 0, Math.PI * 2);
  ctx.clip();

  const filters: string[] = [];
  if (options.blurPx > 0) filters.push(`blur(${options.blurPx}px)`);
  if (options.isDead) filters.push("grayscale(1)");
  if (filters.length > 0) ctx.filter = filters.join(" ");

  const iconSize = (radius - 3) * 2;
  if (img && img.width > 0 && img.height > 0) {
    try {
      ctx.drawImage(img, cx - iconSize / 2, cy - iconSize / 2, iconSize, iconSize);
    } catch {
      // ignore broken image
    }
  } else {
    ctx.font = `700 ${Math.round(radius * 0.85)}px ${FONT_SANS}`;
    ctx.fillStyle = rgba(options.fallbackTextRgb, 0.8);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((siteId[0] || "P").toUpperCase(), cx, cy + 0.5);
  }
  ctx.restore();
}

function renderPoster() {
  const canvas = posterCanvas.value;
  if (!canvas || isLoading.value) return;

  const pad = 28;
  const contentW = CANVAS_WIDTH - pad * 2; // 704
  const fields = realShowField.value;
  const sites = siteInfo.value;
  const blurred = isPrivacyBlurred.value;
  const effectiveFaviconBlur = blurred ? Math.max(control.faviconBlue, 6) : control.faviconBlue;

  const bgRgb = parseHexRgb(control.backgroundColor, [11, 17, 32]);
  const accentRgb = parseHexRgb(control.userNameColor, [96, 165, 250]);
  const textRgb = parseHexRgb(control.textColor, [248, 250, 252]);
  const isLight = getRelativeLuminance(bgRgb) >= 0.48;

  const palette = {
    cardBg: isLight ? "rgba(255, 255, 255, 0.86)" : "rgba(255, 255, 255, 0.045)",
    cardAltBg: isLight ? "rgba(241, 245, 249, 0.85)" : "rgba(255, 255, 255, 0.03)",
    cardStroke: isLight ? "rgba(15, 23, 42, 0.085)" : "rgba(255, 255, 255, 0.095)",
    subtleStroke: isLight ? "rgba(15, 23, 42, 0.06)" : "rgba(255, 255, 255, 0.065)",
    pillBg: isLight ? rgba(accentRgb, 0.1) : rgba(accentRgb, 0.15),
    pillStroke: isLight ? rgba(accentRgb, 0.24) : rgba(accentRgb, 0.32),
    mutedPillBg: isLight ? "rgba(15, 23, 42, 0.05)" : "rgba(255, 255, 255, 0.065)",
    textPrimary: rgba(textRgb, 0.98),
    textSecondary: rgba(textRgb, isLight ? 0.66 : 0.68),
    textMuted: rgba(textRgb, isLight ? 0.46 : 0.46),
    accentText: rgba(accentRgb, 1),
    nodeSurface: isLight ? "#FFFFFF" : rgba(mixRgb(bgRgb, [255, 255, 255], 0.09), 1),
  };

  // ===== 第一阶段：精确测算各分区高度 =====
  let cursorY = pad;

  // 1. Hero 头部卡片
  const heroY = cursorY;
  const heroH = 98;
  cursorY += heroH + 16;

  // 2. Bento 总览指标网格（加上固定「收录站点」首卡，形成丰富整齐的 Bento 矩阵）
  const bentoItems: Array<{ key: string; label: string; value: string; dotColor: string; sub?: string }> = [
    {
      key: "sites",
      label: `${t("UserDataTimeline.total")}${t("UserDataTimeline.field.site")}`,
      value: `${timelineData.value.totalInfo.sites}`,
      sub:
        timelineData.value.totalInfo.deadSites > 0
          ? `${t("UserDataTimeline.controls.offline") || "离线"} ${timelineData.value.totalInfo.deadSites}`
          : undefined,
      dotColor: rgba(accentRgb, 1),
    },
    ...fields.map((f) => ({
      key: f.name,
      label: `${t("UserDataTimeline.total")}${t("UserDataTimeline.field." + f.name)}`,
      value: String(f.format(timelineData.value.totalInfo[f.name] ?? 0)),
      dotColor: FIELD_ACCENT_COLORS[f.name] ?? rgba(accentRgb, 1),
    })),
  ];

  const bentoCols = bentoItems.length === 4 || bentoItems.length === 8 ? 4 : bentoItems.length === 2 ? 2 : 3;
  const bentoGap = 10;
  const bentoCardH = 68;
  const bentoRows = Math.ceil(bentoItems.length / bentoCols);
  const bentoY = cursorY;
  const bentoTotalH = bentoRows * bentoCardH + (bentoRows - 1) * bentoGap;
  cursorY += bentoTotalH + 16;

  // 3. Top 冠亚军荣耀卡片
  const topFields = control.showTop
    ? fields.filter((f) => (timelineData.value.topInfo[f.name]?.maxValue ?? 0) > 0)
    : [];
  const showTopSection = topFields.length > 0;
  const topCols = 2;
  const topRows = Math.ceil(topFields.length / topCols);
  const topRowH = 38;
  const topRowGap = 8;
  const topY = cursorY;
  const topH = showTopSection ? 46 + topRows * topRowH + Math.max(0, topRows - 1) * topRowGap + 14 : 0;
  if (showTopSection) {
    cursorY += topH + 18;
  }

  // 4. Chronicle 双侧交错卡片时间轴
  interface SiteLayoutItem {
    userInfo: (typeof sites)[number];
    side: "left" | "right";
    yearMarker?: number;
    yearY?: number;
    cardY: number;
    cardH: number;
    nodeY: number;
    metrics: Array<{ label: string; value: string; color: string }>;
    metaBadges: string[];
  }

  const timelineLayouts: SiteLayoutItem[] = [];
  const showTimelineSection = control.showTimeline && sites.length > 0;
  const timelineHeaderY = cursorY;
  let timelineAxisStartY = cursorY;
  let timelineAxisEndY = cursorY;

  if (showTimelineSection) {
    cursorY += 46; // 章节标题高度
    timelineAxisStartY = cursorY;

    let prevYear: number | null = null;
    sites.forEach((u, idx) => {
      const joinYear = u.joinTime ? new Date(u.joinTime).getFullYear() : null;
      let yearMarker: number | undefined;
      let yearY: number | undefined;
      if (joinYear && joinYear !== prevYear) {
        yearMarker = joinYear;
        yearY = cursorY + 13;
        prevYear = joinYear;
        cursorY += 34;
      }

      const metrics = fields.map((f) => ({
        label: t("UserDataTimeline.field." + f.name),
        value: String(f.format((u[f.name] as number) ?? 0)),
        color: FIELD_ACCENT_COLORS[f.name] ?? palette.textPrimary,
      }));

      const metaBadges: string[] = [];
      if (control.showPerSiteField.name && u.name) metaBadges.push(u.name);
      if (control.showPerSiteField.uid && u.id && String(u.id) !== "0") metaBadges.push(`#${u.id}`);

      const metricRows = Math.ceil(metrics.length / 2);
      const hasHeader = control.showPerSiteField.siteName || control.showPerSiteField.level;
      const baseH = (hasHeader ? 26 : 6) + 22 + (metaBadges.length > 0 ? 20 : 0);
      const metricsH = metricRows > 0 ? 10 + metricRows * 21 + 6 : 6;
      const cardH = Math.max(66, baseH + metricsH + 10);

      const cardY = cursorY;
      const nodeY = cardY + Math.min(32, cardH / 2);

      timelineLayouts.push({
        userInfo: u,
        side: idx % 2 === 0 ? "left" : "right",
        yearMarker,
        yearY,
        cardY,
        cardH,
        nodeY,
        metrics,
        metaBadges,
      });

      // 双侧错落紧凑排布：相邻左右卡片可适度交错节省纵向留白，保持清晰呼吸感
      cursorY += cardH + 12;
    });

    timelineAxisEndY = cursorY - 4;
    cursorY += 8;
  }

  // 5. Footer 签名栏
  const footerY = cursorY + 4;
  const totalHeight = footerY + 34;
  canvasHeight.value = totalHeight;

  // ===== 第二阶段：2x Retina 超清矢量绘制 =====
  canvas.width = CANVAS_WIDTH * PIXEL_RATIO;
  canvas.height = totalHeight * PIXEL_RATIO;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.save();
  ctx.scale(PIXEL_RATIO, PIXEL_RATIO);

  // 0. 底层背景渐变 + 顶部双极光径向光晕 + 科技感细微点阵
  const baseGrad = ctx.createLinearGradient(0, 0, 0, totalHeight);
  baseGrad.addColorStop(0, rgba(bgRgb, 1));
  baseGrad.addColorStop(1, rgba(isLight ? mixRgb(bgRgb, [226, 232, 240], 0.35) : mixRgb(bgRgb, [3, 7, 18], 0.38), 1));
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, totalHeight);

  const glow1 = ctx.createRadialGradient(130, 40, 10, 130, 40, 360);
  glow1.addColorStop(0, rgba(accentRgb, isLight ? 0.13 : 0.18));
  glow1.addColorStop(1, rgba(accentRgb, 0));
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, CANVAS_WIDTH, 420);

  const secondaryGlowRgb = mixRgb(accentRgb, [139, 92, 246], 0.55);
  const glow2 = ctx.createRadialGradient(CANVAS_WIDTH - 90, 90, 10, CANVAS_WIDTH - 90, 90, 320);
  glow2.addColorStop(0, rgba(secondaryGlowRgb, isLight ? 0.09 : 0.13));
  glow2.addColorStop(1, rgba(secondaryGlowRgb, 0));
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, CANVAS_WIDTH, 420);

  // 细微点阵背景纹理（仅在顶部 280px 渐隐呈现精致质感）
  ctx.fillStyle = isLight ? "rgba(15, 23, 42, 0.035)" : "rgba(255, 255, 255, 0.035)";
  for (let gx = 20; gx < CANVAS_WIDTH - 12; gx += 22) {
    for (let gy = 18; gy < Math.min(totalHeight - 16, 260); gy += 22) {
      ctx.fillRect(gx, gy, 1.2, 1.2);
    }
  }

  // 外层微光精细画框线
  drawRoundedCard(ctx, 10, 10, CANVAS_WIDTH - 20, totalHeight - 20, 20, "transparent", palette.subtleStroke, 1);

  // ===== 1. 绘制 Hero 名片头栏 =====
  const heroGrad = ctx.createLinearGradient(pad, heroY, pad + contentW, heroY + heroH);
  heroGrad.addColorStop(0, isLight ? "rgba(255,255,255,0.92)" : rgba(mixRgb(bgRgb, accentRgb, 0.1), 0.78));
  heroGrad.addColorStop(1, palette.cardBg);
  drawRoundedCard(ctx, pad, heroY, contentW, heroH, 16, heroGrad, palette.cardStroke, 1);

  drawBrandShield(ctx, pad + 20, heroY + 23, 52, accentRgb);

  const nameX = pad + 88;
  withPrivacyFilter(ctx, blurred, () => {
    ctx.font = `700 22px ${FONT_SANS}`;
    ctx.fillStyle = palette.accentText;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const displayName = configStore.userName || "PT Player";
    ctx.fillText(ellipsize(ctx, displayName, 360), nameX, heroY + 36);
  });

  // Hero 底部胶囊徽标：PT 年龄 + 收录站点数
  const ageText = t("UserDataTimeline.ptAge", { years: timelineData.value.joinTimeInfo.years });
  ctx.font = `600 11.5px ${FONT_SANS}`;
  const agePillW = Math.ceil(ctx.measureText(ageText).width) + 20;
  drawRoundedCard(ctx, nameX, heroY + 55, agePillW, 23, 999, palette.pillBg, palette.pillStroke, 1);
  withPrivacyFilter(ctx, blurred, () => {
    ctx.font = `600 11.5px ${FONT_SANS}`;
    ctx.fillStyle = palette.accentText;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(ageText, nameX + 10, heroY + 66.5);
  });

  const subtitleMotto = timelineData.value.title || "Personal PT Chronicle";
  ctx.font = `500 12px ${FONT_SANS}`;
  ctx.fillStyle = palette.textSecondary;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(ellipsize(ctx, subtitleMotto, 260), nameX + agePillW + 10, heroY + 66.5);

  // 右上角快照时间胶囊
  const dateStr = String(formatDate(timelineData.value.createAt, "yyyy-MM-dd HH:mm"));
  ctx.font = `500 11px ${FONT_MONO}`;
  const dateBadgeW = Math.ceil(ctx.measureText(dateStr).width) + 20;
  const dateBadgeX = pad + contentW - 18 - dateBadgeW;
  drawRoundedCard(ctx, dateBadgeX, heroY + 20, dateBadgeW, 23, 7, palette.mutedPillBg, palette.subtleStroke, 1);
  withPrivacyFilter(ctx, blurred, () => {
    ctx.font = `500 11px ${FONT_MONO}`;
    ctx.fillStyle = palette.textSecondary;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(dateStr, dateBadgeX + dateBadgeW / 2, heroY + 31.5);
  });

  ctx.font = `600 11px ${FONT_SANS}`;
  ctx.fillStyle = palette.textMuted;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(`PT Depiler Lite · ${extVersion.split("+")[0]}`, pad + contentW - 18, heroY + 66.5);

  // ===== 2. 绘制 Bento 核心资产总览网格 =====
  const bentoCardW = (contentW - bentoGap * (bentoCols - 1)) / bentoCols;
  bentoItems.forEach((item, idx) => {
    const col = idx % bentoCols;
    const row = Math.floor(idx / bentoCols);
    const cx = pad + col * (bentoCardW + bentoGap);
    const cy = bentoY + row * (bentoCardH + bentoGap);

    drawRoundedCard(ctx, cx, cy, bentoCardW, bentoCardH, 13, palette.cardBg, palette.cardStroke, 1);

    // 语义色圆点 + 指标标题
    ctx.beginPath();
    ctx.arc(cx + 15, cy + 21, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = item.dotColor;
    ctx.fill();

    ctx.font = `500 11.5px ${FONT_SANS}`;
    ctx.fillStyle = palette.textSecondary;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(ellipsize(ctx, item.label, bentoCardW - 34), cx + 25, cy + 21);

    // 核心大数字
    withPrivacyFilter(ctx, blurred, () => {
      ctx.font = `700 18.5px ${FONT_SANS}`;
      ctx.fillStyle = palette.textPrimary;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(ellipsize(ctx, item.value, bentoCardW - (item.sub ? 78 : 26)), cx + 14, cy + 47);

      if (item.sub) {
        ctx.font = `500 11px ${FONT_SANS}`;
        ctx.fillStyle = palette.textMuted;
        ctx.textAlign = "right";
        ctx.fillText(item.sub, cx + bentoCardW - 13, cy + 48);
      }
    });
  });

  // ===== 3. 绘制 Hall of Fame 站点单项冠亚军榜 =====
  if (showTopSection) {
    drawRoundedCard(ctx, pad, topY, contentW, topH, 15, palette.cardBg, palette.cardStroke, 1);

    // 标题栏
    ctx.beginPath();
    ctx.arc(pad + 20, topY + 23, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#F59E0B";
    ctx.fill();

    ctx.font = `600 13px ${FONT_SANS}`;
    ctx.fillStyle = palette.textPrimary;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(t("UserDataTimeline.controls.showTopSites"), pad + 32, topY + 23);

    ctx.font = `600 11px ${FONT_MONO}`;
    ctx.textAlign = "right";
    const runnerText = "● #2 RUNNER-UP";
    const runnerRightX = pad + contentW - 16;
    ctx.fillStyle = isLight ? "#64748B" : "#94A3B8";
    ctx.fillText(runnerText, runnerRightX, topY + 23);
    const runnerW = ctx.measureText(runnerText).width;
    ctx.fillStyle = "#F59E0B";
    ctx.fillText("● #1 TOP", runnerRightX - runnerW - 14, topY + 23);

    // 分隔线
    ctx.beginPath();
    ctx.moveTo(pad + 16, topY + 40);
    ctx.lineTo(pad + contentW - 16, topY + 40);
    ctx.strokeStyle = palette.subtleStroke;
    ctx.lineWidth = 1;
    ctx.stroke();

    const innerPad = 14;
    const itemW = (contentW - innerPad * 2 - 10) / 2;
    const startItemY = topY + 48;

    topFields.forEach((f, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const ix = pad + innerPad + col * (itemW + 10);
      const iy = startItemY + row * (topRowH + topRowGap);

      drawRoundedCard(ctx, ix, iy, itemW, topRowH, 9, palette.cardAltBg, palette.subtleStroke, 1);

      const labelStr = t("UserDataTimeline.field." + f.name);
      ctx.font = `500 11.5px ${FONT_SANS}`;
      ctx.fillStyle = palette.textSecondary;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(ellipsize(ctx, labelStr, 82), ix + 11, iy + topRowH / 2);

      const topEntry = timelineData.value.topInfo[f.name];
      const slotW = (itemW - 96) / 2;

      // #1 冠军
      if (topEntry.maxValue > 0 && topEntry.site?.site) {
        const s1X = ix + 94;
        drawSiteAvatar(ctx, topEntry.site.site, s1X + 11, iy + topRowH / 2, 11, {
          blurPx: effectiveFaviconBlur,
          isDead: allAddedSiteMetadata[topEntry.site.site]?.isDead,
          surfaceBg: palette.nodeSurface,
          ringStroke: "#F59E0B",
          fallbackTextRgb: textRgb,
        });
        withPrivacyFilter(ctx, blurred, () => {
          ctx.font = `600 11.5px ${FONT_SANS}`;
          ctx.fillStyle = palette.textPrimary;
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(ellipsize(ctx, String(f.format(topEntry.maxValue)), slotW - 28), s1X + 26, iy + topRowH / 2);
        });
      }

      // #2 亚军
      if (topEntry.subValue > 0 && topEntry.subSite?.site) {
        const s2X = ix + 94 + slotW;
        drawSiteAvatar(ctx, topEntry.subSite.site, s2X + 11, iy + topRowH / 2, 11, {
          blurPx: effectiveFaviconBlur,
          isDead: allAddedSiteMetadata[topEntry.subSite.site]?.isDead,
          surfaceBg: palette.nodeSurface,
          ringStroke: isLight ? "#94A3B8" : "#CBD5E1",
          fallbackTextRgb: textRgb,
        });
        withPrivacyFilter(ctx, blurred, () => {
          ctx.font = `500 11.5px ${FONT_SANS}`;
          ctx.fillStyle = palette.textSecondary;
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(ellipsize(ctx, String(f.format(topEntry.subValue)), slotW - 24), s2X + 26, iy + topRowH / 2);
        });
      }
    });
  }

  // ===== 4. 绘制 Chronicle 双侧交错卡片式时间轴 =====
  if (showTimelineSection) {
    const centerX = CANVAS_WIDTH / 2;

    // 章节标题胶囊与两侧流光渐变横线
    const secTitle = timelineData.value.title || "这些年走过的路";
    ctx.font = `600 13px ${FONT_SANS}`;
    const secPillW = Math.min(340, Math.ceil(ctx.measureText(secTitle).width) + 36);
    const secCenterY = timelineHeaderY + 18;

    const leftLineGrad = ctx.createLinearGradient(pad, secCenterY, centerX - secPillW / 2 - 12, secCenterY);
    leftLineGrad.addColorStop(0, "transparent");
    leftLineGrad.addColorStop(1, palette.cardStroke);
    ctx.strokeStyle = leftLineGrad;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, secCenterY);
    ctx.lineTo(centerX - secPillW / 2 - 12, secCenterY);
    ctx.stroke();

    const rightLineGrad = ctx.createLinearGradient(centerX + secPillW / 2 + 12, secCenterY, pad + contentW, secCenterY);
    rightLineGrad.addColorStop(0, palette.cardStroke);
    rightLineGrad.addColorStop(1, "transparent");
    ctx.strokeStyle = rightLineGrad;
    ctx.beginPath();
    ctx.moveTo(centerX + secPillW / 2 + 12, secCenterY);
    ctx.lineTo(pad + contentW, secCenterY);
    ctx.stroke();

    drawRoundedCard(
      ctx,
      centerX - secPillW / 2,
      secCenterY - 13,
      secPillW,
      26,
      999,
      palette.cardBg,
      palette.cardStroke,
      1,
    );
    ctx.font = `600 12.5px ${FONT_SANS}`;
    ctx.fillStyle = palette.textPrimary;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ellipsize(ctx, secTitle, secPillW - 24), centerX, secCenterY);

    // 居中渐变时间主干轴线
    const axisGrad = ctx.createLinearGradient(centerX, timelineAxisStartY, centerX, timelineAxisEndY);
    axisGrad.addColorStop(0, rgba(accentRgb, 0.65));
    axisGrad.addColorStop(0.85, rgba(accentRgb, 0.35));
    axisGrad.addColorStop(1, rgba(accentRgb, 0.08));
    ctx.strokeStyle = axisGrad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, timelineAxisStartY + 4);
    ctx.lineTo(centerX, timelineAxisEndY);
    ctx.stroke();

    const sideCardW = 314;

    timelineLayouts.forEach((item) => {
      const { userInfo: u, side, yearMarker, yearY, cardY, cardH, nodeY, metrics, metaBadges } = item;
      const meta = allAddedSiteMetadata[u.site];
      const isDead = Boolean(meta?.isDead);

      // 年份里程碑胶囊节点
      if (yearMarker && yearY !== undefined) {
        const yPillW = 58;
        const yPillH = 21;
        drawRoundedCard(
          ctx,
          centerX - yPillW / 2,
          yearY - yPillH / 2,
          yPillW,
          yPillH,
          999,
          palette.nodeSurface,
          palette.pillStroke,
          1.2,
        );
        withPrivacyFilter(ctx, blurred, () => {
          ctx.font = `700 11px ${FONT_MONO}`;
          ctx.fillStyle = palette.accentText;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(yearMarker), centerX, yearY + 0.5);
        });
      }

      const cardX = side === "left" ? pad : CANVAS_WIDTH - pad - sideCardW;

      // 节点与卡片之间的水平连接细线
      ctx.beginPath();
      if (side === "left") {
        ctx.moveTo(cardX + sideCardW, nodeY);
        ctx.lineTo(centerX - 18, nodeY);
      } else {
        ctx.moveTo(centerX + 18, nodeY);
        ctx.lineTo(cardX, nodeY);
      }
      ctx.strokeStyle = isDead ? palette.subtleStroke : rgba(accentRgb, 0.36);
      ctx.lineWidth = 1.25;
      ctx.stroke();

      // 中心轴圆形站点图标节点
      drawSiteAvatar(ctx, u.site, centerX, nodeY, 17, {
        blurPx: effectiveFaviconBlur,
        isDead,
        surfaceBg: palette.nodeSurface,
        ringStroke: isDead ? palette.cardStroke : rgba(accentRgb, 0.65),
        fallbackTextRgb: textRgb,
      });

      // 站点信息卡片
      drawRoundedCard(ctx, cardX, cardY, sideCardW, cardH, 13, palette.cardBg, palette.cardStroke, 1);

      // 卡片左侧或右侧微光语义饰条
      ctx.save();
      ctx.beginPath();
      const barX = side === "left" ? cardX + sideCardW - 3 : cardX;
      ctx.roundRect(barX, cardY + 12, 3, Math.min(26, cardH - 24), 2);
      ctx.fillStyle = isDead ? "rgba(148, 163, 184, 0.45)" : rgba(accentRgb, 0.78);
      ctx.fill();
      ctx.restore();

      let innerY = cardY + 13;
      const innerX = cardX + 14;
      const innerW = sideCardW - 28;

      // 第一行：站点名称 + 等级胶囊
      const hasHeaderRow = control.showPerSiteField.siteName || control.showPerSiteField.level;
      if (hasHeaderRow) {
        let levelPillOccupiedW = 0;
        if (control.showPerSiteField.level && u.levelName) {
          ctx.font = `600 10.5px ${FONT_SANS}`;
          const lvlStr = ellipsize(ctx, u.levelName, 120);
          const lvlW = Math.ceil(ctx.measureText(lvlStr).width) + 14;
          levelPillOccupiedW = lvlW + 8;
          const lvlX = innerX + innerW - lvlW;
          drawRoundedCard(ctx, lvlX, innerY - 1, lvlW, 19, 6, palette.pillBg, palette.pillStroke, 1);
          withPrivacyFilter(ctx, blurred, () => {
            ctx.font = `600 10.5px ${FONT_SANS}`;
            ctx.fillStyle = palette.accentText;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(lvlStr, lvlX + lvlW / 2, innerY + 8.5);
          });
        }

        if (control.showPerSiteField.siteName) {
          const rawSiteName = `${isDead ? "[离线] " : ""}${meta?.siteName || u.site}`;
          withPrivacyFilter(ctx, blurred, () => {
            ctx.font = `700 13.5px ${FONT_SANS}`;
            ctx.fillStyle = isDead ? palette.textMuted : palette.textPrimary;
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(ellipsize(ctx, rawSiteName, innerW - levelPillOccupiedW), innerX, innerY + 8.5);
          });
        }

        innerY += 24;
      }

      // 第二行：入站日期/时长 + 用户名/UID 标签
      const joinDateLabel = u.joinTime ? formatSiteDateText(u.joinTime) : "-";
      withPrivacyFilter(ctx, blurred, () => {
        ctx.font = `500 11.5px ${FONT_MONO}`;
        ctx.fillStyle = palette.textSecondary;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(joinDateLabel, innerX, innerY + 7);
      });
      innerY += 20;

      if (metaBadges.length > 0) {
        const joinedMeta = metaBadges.join(" · ");
        withPrivacyFilter(ctx, blurred, () => {
          ctx.font = `500 11px ${FONT_SANS}`;
          ctx.fillStyle = palette.textMuted;
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(ellipsize(ctx, joinedMeta, innerW), innerX, innerY + 6);
        });
        innerY += 19;
      }

      // 第三区：双列紧凑核心指标矩阵
      if (metrics.length > 0) {
        ctx.beginPath();
        ctx.moveTo(innerX, innerY + 3);
        ctx.lineTo(innerX + innerW, innerY + 3);
        ctx.strokeStyle = palette.subtleStroke;
        ctx.lineWidth = 1;
        ctx.stroke();

        innerY += 10;
        const mColW = (innerW - 12) / 2;

        metrics.forEach((m, mIdx) => {
          const mCol = mIdx % 2;
          const mRow = Math.floor(mIdx / 2);
          const mx = innerX + mCol * (mColW + 12);
          const my = innerY + mRow * 21 + 8;

          ctx.font = `500 11px ${FONT_SANS}`;
          ctx.fillStyle = palette.textMuted;
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          const lbl = ellipsize(ctx, m.label, 52);
          ctx.fillText(lbl, mx, my);

          withPrivacyFilter(ctx, blurred, () => {
            ctx.font = `600 11.5px ${FONT_SANS}`;
            ctx.fillStyle = palette.textPrimary;
            ctx.textAlign = "right";
            ctx.textBaseline = "middle";
            ctx.fillText(ellipsize(ctx, m.value, mColW - 54), mx + mColW, my);
          });
        });
      }
    });
  }

  // ===== 5. Footer 底部极简签名栏 =====
  ctx.beginPath();
  ctx.moveTo(pad + 60, footerY);
  ctx.lineTo(CANVAS_WIDTH - pad - 60, footerY);
  ctx.strokeStyle = palette.subtleStroke;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = `500 11px ${FONT_SANS}`;
  ctx.fillStyle = palette.textMuted;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`Generated by PT Depiler Lite (${extVersion})`, CANVAS_WIDTH / 2, footerY + 17);

  ctx.restore();
}

let rafHandle = 0;
function scheduleRender() {
  if (rafHandle) cancelAnimationFrame(rafHandle);
  rafHandle = requestAnimationFrame(() => {
    rafHandle = 0;
    renderPoster();
  });
}

watch(
  [
    () => configStore.userName,
    () => configStore.myDataTableControl.privacyBlur,
    () => timelineData.value,
    () => selectedSites.value.slice(),
    control,
  ],
  () => {
    scheduleRender();
  },
  { deep: true },
);

onMounted(async () => {
  isLoading.value = true;

  // 若旧配置仍为老版默认灰绿色 #455A64，平滑升级为全新曜石极光主题
  if (control.backgroundColor?.toUpperCase() === "#455A64") {
    control.backgroundColor = defaultTimelineBackgroundColor;
    if (control.userNameColor?.toUpperCase() === "#FFFFFF") {
      control.userNameColor = defaultTimelineUserNameColor;
    }
    control.textColor = defaultTimelineTextColor;
  }

  await loadAllAddedSiteMetadata(Object.keys(metadataStore.sites));
  fixedLastUserInfo.value = await loadFullData();
  realAllSite.value = Object.keys(fixedLastUserInfo.value).filter((x) => canThisSiteShow(x));

  const { sites = [] } = route.query ?? {};

  if ((sites as string[]).length > 0) {
    selectedSites.value = sites as string[];
  } else if ((configStore.userDataTimelineControl.selectedSites ?? []).length > 0) {
    selectedSites.value = configStore.userDataTimelineControl.selectedSites;
  } else {
    selectedSites.value = realAllSite.value;
  }

  resetTimelineDataWithControl();
  isLoading.value = false;
  await nextTick();
  renderPoster();
});

const isExporting = ref(false);
const isCopying = ref(false);
const copiedSuccess = ref(false);

function canvasToPngBlob(): Promise<Blob> {
  renderPoster();
  return new Promise((resolve, reject) => {
    const canvas = posterCanvas.value;
    if (!canvas) {
      reject(new Error("Canvas not ready"));
      return;
    }
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to encode PNG"));
    }, "image/png");
  });
}

async function exportTimelineImg() {
  isExporting.value = true;
  const filename =
    t("UserDataTimeline.exportFilename", {
      name: isPrivacyBlurred.value ? "Blurred" : configStore.userName,
      date: formatDate(timelineData.value.createAt),
    }) + ".png";

  try {
    const blob = await canvasToPngBlob();
    await downloadBlob(blob, filename);
  } finally {
    isExporting.value = false;
  }
}

async function copyTimelineImg() {
  isCopying.value = true;
  try {
    const blob = await canvasToPngBlob();
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    copiedSuccess.value = true;
    runtimeStore.showSnackbar(t("common.saveSuccess"), { color: "success" });
    setTimeout(() => {
      copiedSuccess.value = false;
    }, 2000);
  } catch (e) {
    console.error("Failed to copy timeline image:", e);
    runtimeStore.showSnackbar(String(e), { color: "error" });
  } finally {
    isCopying.value = false;
  }
}

function saveControl() {
  configStore.userDataTimelineControl.selectedSites = selectedSites.value;
  configStore.$save();
  runtimeStore.showSnackbar(t("common.saveSuccess"), { color: "success" });
}

function toggleSite(siteId: string, checked: boolean | "indeterminate") {
  if (checked === true) {
    if (!selectedSites.value.includes(siteId)) {
      selectedSites.value = [...selectedSites.value, siteId];
    }
  } else {
    selectedSites.value = selectedSites.value.filter((id) => id !== siteId);
  }
  resetTimelineDataWithControl();
}
</script>

<template>
  <div class="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
    <!-- 左侧可滚动配置工作台 -->
    <Card class="flex flex-col overflow-hidden lg:sticky lg:top-4 lg:col-span-5 lg:max-h-[calc(100vh-5.5rem)]">
      <CardHeader class="flex flex-row items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div class="flex items-center gap-2">
          <Button variant="outline" size="xs" @click="router.back()">
            <ArrowLeft />
            {{ t("common.back") }}
          </Button>
          <CardTitle class="text-sm">{{ t("UserDataTimeline.controls.styleSettings") }}</CardTitle>
        </div>
        <Button size="xs" @click="saveControl">
          <Save />
          {{ t("common.saveSettings") }}
        </Button>
      </CardHeader>

      <CardContent class="flex-1 space-y-5 overflow-y-auto p-4">
        <!-- 精选海报风格预设 -->
        <div class="space-y-2.5">
          <div class="flex items-center justify-between">
            <Label class="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Palette class="size-3.5 text-primary" />
              <span>海报风格预设</span>
            </Label>
            <Badge variant="outline" class="px-1.5 py-0 text-[10px] font-normal text-muted-foreground">
              <Sparkles class="mr-0.5 size-2.5 text-primary" />
              2× Retina
            </Badge>
          </div>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button
              v-for="preset in THEME_PRESETS"
              :key="preset.id"
              type="button"
              :class="[
                'group flex flex-col items-start gap-1.5 rounded-lg border p-2 text-left transition-all',
                activePresetId === preset.id
                  ? 'border-primary bg-primary/[0.06] ring-1 ring-primary/30'
                  : 'border-border bg-card hover:border-primary/40 hover:bg-accent/40',
              ]"
              @click="applyThemePreset(preset)"
            >
              <span
                class="h-5 w-full rounded-md border border-black/10 shadow-2xs dark:border-white/10"
                :style="{ background: preset.swatch }"
              />
              <span class="flex w-full items-center justify-between text-[11px] font-medium text-foreground">
                <span class="truncate">{{ preset.label }}</span>
                <Check v-if="activePresetId === preset.id" class="size-3 shrink-0 text-primary" />
              </span>
            </button>
          </div>
        </div>

        <Separator />

        <!-- 用户名与标题 -->
        <div class="space-y-3">
          <Label class="text-xs font-semibold text-foreground">
            {{ t("UserDataTimeline.controls.usernameAndTitle") }}
          </Label>

          <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div class="space-y-1">
              <Label class="text-[11px] text-muted-foreground">{{ t("common.username") }}</Label>
              <div
                :class="[
                  'flex items-center gap-1 transition-[filter] duration-150',
                  isPrivacyBlurred && 'ptd-privacy-blur',
                ]"
              >
                <Button
                  variant="outline"
                  size="icon-xs"
                  :class="allowEdit.name ? 'border-success/50 text-success' : ''"
                  @click="allowEdit.name = !allowEdit.name"
                >
                  <Unlock v-if="allowEdit.name" />
                  <Lock v-else />
                </Button>
                <Select
                  v-if="!allowEdit.name && Object.keys(configStore.getUserNames.names).length > 0"
                  v-model="configStore.userName"
                >
                  <SelectTrigger class="h-7.5 flex-1 text-xs">
                    <SelectValue :placeholder="t('common.username')" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="(_, name) in configStore.getUserNames.names" :key="name" :value="String(name)">
                      {{ name }}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Input v-else v-model="configStore.userName" :readonly="!allowEdit.name" class="h-7.5 flex-1 text-xs" />
                <Button
                  variant="ghost"
                  size="icon-xs"
                  :title="t('common.dialog.reset')"
                  @click="configStore.userName = configStore.getUserNames.perfName"
                >
                  <RotateCcw />
                </Button>
              </div>
            </div>

            <div class="space-y-1">
              <Label class="text-[11px] text-muted-foreground">{{
                t("UserDataTimeline.controls.timelineTitle")
              }}</Label>
              <div class="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-xs"
                  :disabled="!control.showTimeline"
                  :class="allowEdit.title ? 'border-success/50 text-success' : ''"
                  @click="allowEdit.title = !allowEdit.title"
                >
                  <Unlock v-if="allowEdit.title" />
                  <Lock v-else />
                </Button>
                <Input
                  v-model="timelineData.title"
                  :disabled="!control.showTimeline"
                  :readonly="!allowEdit.title"
                  class="h-7.5 flex-1 text-xs"
                  @update:model-value="(v: string | number) => (control.title = String(v))"
                />
                <Button
                  variant="ghost"
                  size="icon-xs"
                  :disabled="!control.showTimeline"
                  :title="t('common.dialog.reset')"
                  @click="
                    () => {
                      control.title = '';
                      resetTimelineDataWithControl();
                    }
                  "
                >
                  <RotateCcw />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <!-- 组件开关 & 自定义配色微调 -->
        <div class="space-y-3">
          <Label class="text-xs font-semibold text-foreground">{{ t("UserDataTimeline.controls.components") }}</Label>
          <div class="space-y-2">
            <label class="flex cursor-pointer items-center justify-between gap-2 text-xs select-none">
              <span class="text-foreground">{{ t("UserDataTimeline.controls.showTopSites") }}</span>
              <Switch v-model="control.showTop" />
            </label>
            <label class="flex cursor-pointer items-center justify-between gap-2 text-xs select-none">
              <span class="text-foreground">{{ t("UserDataTimeline.controls.showTimeline") }}</span>
              <Switch v-model="control.showTimeline" />
            </label>
          </div>

          <div class="grid grid-cols-1 gap-2.5 pt-1 sm:grid-cols-3">
            <div class="space-y-1">
              <Label class="text-[11px] text-muted-foreground">{{
                t("UserDataTimeline.controls.customBgColor")
              }}</Label>
              <div class="flex items-center gap-1">
                <input
                  v-model="control.backgroundColor"
                  type="color"
                  class="h-7.5 w-8 shrink-0 cursor-pointer rounded border border-input bg-transparent p-0.5"
                />
                <Input v-model="control.backgroundColor" class="h-7.5 min-w-0 flex-1 font-mono text-[11px]" />
                <Button
                  variant="ghost"
                  size="icon-xs"
                  @click="control.backgroundColor = defaultTimelineBackgroundColor"
                >
                  <RotateCcw />
                </Button>
              </div>
            </div>

            <div class="space-y-1">
              <Label class="text-[11px] text-muted-foreground">{{
                t("UserDataTimeline.controls.userNameColor")
              }}</Label>
              <div class="flex items-center gap-1">
                <input
                  v-model="control.userNameColor"
                  type="color"
                  class="h-7.5 w-8 shrink-0 cursor-pointer rounded border border-input bg-transparent p-0.5"
                />
                <Input v-model="control.userNameColor" class="h-7.5 min-w-0 flex-1 font-mono text-[11px]" />
                <Button variant="ghost" size="icon-xs" @click="control.userNameColor = defaultTimelineUserNameColor">
                  <RotateCcw />
                </Button>
              </div>
            </div>

            <div class="space-y-1">
              <Label class="text-[11px] text-muted-foreground">{{ t("UserDataTimeline.controls.textColor") }}</Label>
              <div class="flex items-center gap-1">
                <input
                  v-model="control.textColor"
                  type="color"
                  class="h-7.5 w-8 shrink-0 cursor-pointer rounded border border-input bg-transparent p-0.5"
                />
                <Input v-model="control.textColor" class="h-7.5 min-w-0 flex-1 font-mono text-[11px]" />
                <Button variant="ghost" size="icon-xs" @click="control.textColor = defaultTimelineTextColor">
                  <RotateCcw />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <!-- Favicon 模糊度 & 时间显示模式 -->
        <div class="space-y-3">
          <Label class="text-xs font-semibold text-foreground">{{ t("UserDataTimeline.controls.siteDisplay") }}</Label>

          <div class="space-y-1.5">
            <div class="flex items-center justify-between text-xs">
              <span class="text-muted-foreground">{{ t("UserDataTimeline.controls.faviconBlur") }}</span>
              <Badge :variant="control.faviconBlue > 4 ? 'destructive' : 'secondary'" class="tabular-nums text-[11px]">
                {{ control.faviconBlue }} px
              </Badge>
            </div>
            <Slider v-model="control.faviconBlue" :min="0" :max="8" :step="1" />
          </div>

          <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Label class="text-xs text-muted-foreground">{{ t("UserDataTimeline.controls.timeDisplay") }}</Label>
            <div class="inline-flex items-center rounded-md border border-border bg-muted/40 p-0.5">
              <Button
                :variant="control.dateFormat === 'time_added' ? 'secondary' : 'ghost'"
                size="xs"
                :class="control.dateFormat === 'time_added' ? 'bg-background shadow-2xs' : ''"
                @click="control.dateFormat = 'time_added'"
              >
                {{ t("UserDataTimeline.controls.timeAdded") }}
              </Button>
              <Button
                :variant="control.dateFormat === 'time_alive' ? 'secondary' : 'ghost'"
                size="xs"
                :class="control.dateFormat === 'time_alive' ? 'bg-background shadow-2xs' : ''"
                @click="control.dateFormat = 'time_alive'"
              >
                {{ t("UserDataTimeline.controls.timeAlive") }}
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        <!-- 展示字段开关 -->
        <div class="space-y-3">
          <Label class="text-xs font-semibold text-foreground">{{
            t("UserDataTimeline.controls.displayContent")
          }}</Label>

          <div class="space-y-1.5">
            <div class="text-[11px] font-medium text-muted-foreground">
              {{ t("UserDataTimeline.controls.statsSection") }}
            </div>
            <div class="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              <label
                v-for="(v, key) in control.showField"
                :key="key"
                class="flex cursor-pointer items-center justify-between gap-2 rounded-md border border-border bg-background px-2 py-1 text-xs select-none"
              >
                <span class="truncate">{{ t("UserDataTimeline.field." + key) }}</span>
                <Switch v-model="control.showField[key]" class="scale-90" />
              </label>
            </div>
          </div>

          <div class="space-y-1.5">
            <div class="text-[11px] font-medium text-muted-foreground">
              {{ t("UserDataTimeline.controls.timelineSection") }}
            </div>
            <div class="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              <label
                v-for="(v, key) in control.showPerSiteField"
                :key="key"
                class="flex cursor-pointer items-center justify-between gap-2 rounded-md border border-border bg-background px-2 py-1 text-xs select-none"
              >
                <span class="truncate">{{ t("UserDataTimeline.field." + key) }}</span>
                <Switch v-model="control.showPerSiteField[key]" class="scale-90" />
              </label>
            </div>
          </div>
        </div>

        <Separator />

        <!-- 站点勾选列表 -->
        <div class="space-y-2.5">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <Label class="text-xs font-semibold text-foreground">
                {{ t("UserDataTimeline.controls.displaySiteSettings") }}
              </Label>
              <Badge
                variant="secondary"
                :class="[
                  'text-[11px] tabular-nums transition-[filter] duration-150',
                  isPrivacyBlurred && 'ptd-privacy-blur',
                ]"
              >
                {{ selectedSites.length }} / {{ realAllSite.length }}
              </Badge>
            </div>
            <CheckSwitchButton
              :model-value="selectedSites"
              :all="realAllSite"
              @update:model-value="
                (v) => {
                  selectedSites = v;
                  resetTimelineDataWithControl();
                }
              "
            />
          </div>

          <div
            :class="[
              'grid grid-cols-2 gap-1.5 sm:grid-cols-3 transition-[filter] duration-150',
              isPrivacyBlurred && 'ptd-privacy-blur',
            ]"
          >
            <label
              v-for="siteId in realAllSite"
              :key="siteId"
              :class="[
                'flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-xs transition-colors select-none',
                selectedSites.includes(siteId)
                  ? 'border-primary/40 bg-primary/[0.04]'
                  : 'border-border bg-background hover:bg-muted/40',
              ]"
            >
              <Checkbox
                :model-value="selectedSites.includes(siteId)"
                @update:model-value="(v) => toggleSite(siteId, v)"
              />
              <SiteFavicon :site-id="siteId" :size="15" />
              <SiteName :site-id="siteId" tag="span" class="flex-1 truncate" />
              <WifiOff
                v-if="allAddedSiteMetadata[siteId]?.isDead || metadataStore.sites[siteId]?.isOffline"
                class="size-3 shrink-0 text-muted-foreground"
              />
            </label>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 右侧居中自适应高清海报预览区 -->
    <Card class="overflow-hidden lg:col-span-7">
      <CardHeader class="flex flex-row flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div class="flex items-center gap-2">
          <CardTitle class="text-sm">{{ t("MyData.index.viewTimeline") }}</CardTitle>
          <Badge variant="outline" class="font-mono text-[11px] tabular-nums">
            {{ CANVAS_WIDTH }} × {{ canvasHeight }}
          </Badge>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="xs"
            :class="
              isPrivacyBlurred
                ? 'border-primary/45 bg-primary/12 text-primary hover:bg-primary/18 hover:text-primary'
                : ''
            "
            @click="togglePrivacyBlur"
          >
            <EyeOff v-if="isPrivacyBlurred" />
            <Eye v-else />
            <span>{{ isPrivacyBlurred ? t("MyData.index.privacyBlurred") : t("MyData.index.privacyBlur") }}</span>
          </Button>
          <Button variant="outline" size="xs" :disabled="isLoading || isCopying" @click="copyTimelineImg">
            <Loader2 v-if="isCopying" class="animate-spin" />
            <Check v-else-if="copiedSuccess" class="text-success" />
            <Copy v-else />
            {{ t("contentScript.copyLink").includes("链接") ? "复制图片" : "Copy PNG" }}
          </Button>
          <Button size="xs" :disabled="isLoading || isExporting" @click="exportTimelineImg">
            <Loader2 v-if="isExporting" class="animate-spin" />
            <ImageDown v-else />
            {{ t("common.exportImage") }}
          </Button>
        </div>
      </CardHeader>

      <CardContent class="flex justify-center bg-muted/25 p-4 sm:p-6">
        <div
          v-if="isLoading"
          class="flex h-[560px] w-full max-w-[760px] items-center justify-center rounded-xl border border-border bg-muted/50 animate-pulse"
        >
          <Loader2 class="size-8 animate-spin text-muted-foreground" />
        </div>

        <div
          v-else
          class="w-full max-w-[760px] overflow-hidden rounded-2xl border border-border/80 shadow-xl transition-shadow"
        >
          <canvas ref="posterCanvas" class="block h-auto w-full" />
        </div>
      </CardContent>
    </Card>
  </div>
</template>
