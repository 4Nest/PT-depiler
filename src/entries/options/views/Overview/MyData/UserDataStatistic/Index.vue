<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { useElementSize } from "@vueuse/core";
import { computed, onMounted, ref, shallowRef, provide, useTemplateRef } from "vue";
import { eachDayOfInterval } from "date-fns";
import { flatten, mapValues, pick, uniq } from "es-toolkit";
import VChart, { THEME_KEY } from "vue-echarts";
import { isNumber } from "es-toolkit/compat";
import { use as useEcharts, type ComposeOption } from "echarts/core";
import { BarChart, LineChart, type LineSeriesOption, type BarSeriesOption } from "echarts/charts";
import { CanvasRenderer } from "echarts/renderers";
import {
  TitleComponent,
  type TitleComponentOption,
  TooltipComponent,
  type TooltipComponentOption,
  LegendComponent,
  type LegendComponentOption,
  GridComponent,
  type GridComponentOption,
} from "echarts/components";
import {
  ArrowLeft,
  CalendarRange,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  ImageDown,
  Lock,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Unlock,
} from "lucide-vue-next";

import { NO_IMAGE } from "@ptd/site";

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
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui";
import { downloadBlob, formatSize, formatDate } from "@/options/utils.ts";
import { IStoredUserInfo } from "@/shared/types.ts";

import { useRuntimeStore } from "@/options/stores/runtime.ts";
import { useConfigStore } from "@/options/stores/config.ts";

import SiteFavicon from "@/options/components/SiteFavicon/Index.vue";
import SiteName from "@/options/components/SiteName.vue";
import CheckSwitchButton from "@/options/components/CheckSwitchButton.vue";

import { type IUserDataStatistic, loadFullData, setSubDate } from "./utils.ts";
import { allAddedSiteMetadata, loadAllAddedSiteMetadata } from "../utils/siteMetadata.ts";

type EChartsLineChartOption = ComposeOption<
  TitleComponentOption | TooltipComponentOption | LegendComponentOption | GridComponentOption | LineSeriesOption
>;

type EChartsBarChartOption = ComposeOption<
  TitleComponentOption | TooltipComponentOption | LegendComponentOption | GridComponentOption | BarSeriesOption
>;

useEcharts([TitleComponent, TooltipComponent, LegendComponent, GridComponent, LineChart, BarChart, CanvasRenderer]);

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const configStore = useConfigStore();
const chartContainerRef = useTemplateRef<HTMLDivElement>("chartContainer");
const { width: containerWidth } = useElementSize(chartContainerRef);
const perChartHeight = 380;

const allowEditName = ref<boolean>(false);
const showControlPanel = ref<boolean>(true);
const customStartDate = ref<string>("");
const customEndDate = ref<string>("");
const customRangePopoverOpen = ref<boolean>(false);

const rawDataRef = shallowRef<IUserDataStatistic>({ siteDateRange: {}, dailyUserInfo: {}, incrementalData: {} });

const allDateRanges = computed(() => Object.keys(rawDataRef.value.dailyUserInfo));
const allSites = computed<string[]>(() => Object.keys(rawDataRef.value.siteDateRange));

const selectedDateRanges = shallowRef<string[]>([]);
const selectedDateRangeRawData = computed<IUserDataStatistic["dailyUserInfo"]>(() =>
  pick(rawDataRef.value.dailyUserInfo, selectedDateRanges.value),
);

const availableSites = computed(() =>
  uniq(flatten(Object.values(mapValues(selectedDateRangeRawData.value, (x) => Object.keys(x))))),
);

const selectedSites = ref<string[]>([]);
const selectedDataComputed = computed<IUserDataStatistic["dailyUserInfo"]>(() =>
  mapValues(selectedDateRangeRawData.value, (x) => pick(x, selectedSites.value)),
);

function getTotalDataByField(field: keyof IStoredUserInfo) {
  return selectedDateRanges.value.map((x) =>
    Object.values(selectedDataComputed.value[x] ?? {})
      .map((item: IStoredUserInfo) => item[field])
      .filter(isNumber)
      .reduce((a, b) => (a ?? 0) + (b ?? 0), 0),
  ) as number[];
}

const formatDict = {
  int: (value: number) => value.toFixed(0),
  number: (value: number) => value.toFixed(2),
  size: (value: number) => formatSize(value),
} as const;

function createTotalInfoTooltipFormatter(type: (keyof typeof formatDict)[]) {
  return function (params: any) {
    let result = `<div style="font-weight:600;margin-bottom:4px;">${params[0].name}</div>`;
    params.forEach(function (param: any) {
      const formatFunction = formatDict[type[param.seriesIndex] ?? "number"];
      result +=
        `<div style="color:${param.color};display:flex;align-items:center;gap:6px;">` +
        param.marker +
        `<span>${param.seriesName}: <strong>${formatFunction(param.value)}</strong></span>` +
        "</div>";
    });
    return result;
  };
}

const totalSiteBaseInfoChartOptions = computed(() => {
  const uploaded = getTotalDataByField("uploaded");
  const downloaded = getTotalDataByField("downloaded");
  const bonus = getTotalDataByField("bonus");
  const seedingBonus = getTotalDataByField("seedingBonus");

  return {
    backgroundColor: "transparent",
    title: {
      text: `[${configStore.userName}] ${t("UserDataStatistic.chart.totalSiteBase")}`,
      subtext: `${t("UserDataStatistic.chart.uploadLabel")}: ${formatSize(uploaded.at(-1) ?? 0)}, ${t("UserDataStatistic.chart.downloadLabel")}: ${formatSize(downloaded.at(-1) ?? 0)}, ${t("levelRequirement.bonus")}: ${(bonus.at(-1) ?? 0).toFixed(2)}, ${t("levelRequirement.seedingBonus")}: ${(seedingBonus.at(-1) ?? 0).toFixed(2)}`,
      left: "center",
    },
    tooltip: {
      trigger: "axis",
      formatter: createTotalInfoTooltipFormatter(["size", "size", "number", "number"]),
    },
    legend: {
      data: [
        t("UserDataStatistic.chart.uploadLabel"),
        t("UserDataStatistic.chart.downloadLabel"),
        t("levelRequirement.bonus"),
        t("levelRequirement.seedingBonus"),
      ],
      bottom: 6,
      orient: "horizontal",
    },
    grid: { left: "3%", right: "4%", bottom: "12%", containLabel: true },
    xAxis: { type: "category", boundaryGap: false, data: selectedDateRanges.value },
    yAxis: [
      {
        type: "value",
        name: t("UserDataStatistic.chart.dataLabel"),
        position: "left",
        axisLabel: { formatter: formatSize },
      },
      {
        type: "value",
        name: t("levelRequirement.bonus"),
        position: "right",
        axisLabel: { formatter: (value) => value.toFixed(0) },
      },
    ],
    series: [
      { name: t("UserDataStatistic.chart.uploadLabel"), type: "line", smooth: true, data: uploaded, yAxisIndex: 0 },
      { name: t("UserDataStatistic.chart.downloadLabel"), type: "line", smooth: true, data: downloaded, yAxisIndex: 0 },
      { name: t("levelRequirement.bonus"), type: "line", smooth: true, data: bonus, yAxisIndex: 1 },
      { name: t("levelRequirement.seedingBonus"), type: "line", smooth: true, data: seedingBonus, yAxisIndex: 1 },
    ],
  } as EChartsLineChartOption;
});

const totalSiteSeedingInfoChartOptions = computed(() => {
  const seeding = getTotalDataByField("seeding");
  const seedingSize = getTotalDataByField("seedingSize");

  return {
    backgroundColor: "transparent",
    title: {
      text: `[${configStore.userName}] ${t("UserDataStatistic.chart.totalSiteSeeding")}`,
      subtext: `${t("UserDataStatistic.chart.seedingSizeLabel")}: ${formatSize(seedingSize.at(-1) ?? 0)}, ${t("common.count")}: ${(seeding.at(-1) ?? 0).toFixed(0)}`,
      left: "center",
    },
    tooltip: {
      trigger: "axis",
      formatter: createTotalInfoTooltipFormatter(["size", "int"]),
    },
    legend: {
      data: [t("UserDataStatistic.chart.seedingSizeLabel"), t("UserDataStatistic.chart.seedingLabel")],
      bottom: 6,
      orient: "horizontal",
    },
    grid: { left: "3%", right: "4%", bottom: "12%", containLabel: true },
    xAxis: { type: "category", boundaryGap: false, data: selectedDateRanges.value },
    yAxis: [
      {
        type: "value",
        name: t("UserDataStatistic.chart.seedingSizeLabel"),
        position: "left",
        axisLabel: { formatter: formatSize },
      },
      {
        type: "value",
        name: t("UserDataStatistic.chart.seedingLabel"),
        position: "right",
        axisLabel: { formatter: (value) => value.toFixed(0) },
      },
    ],
    series: [
      {
        name: t("UserDataStatistic.chart.seedingSizeLabel"),
        type: "line",
        smooth: true,
        data: seedingSize,
        yAxisIndex: 0,
      },
      { name: t("UserDataStatistic.chart.seedingLabel"), type: "line", smooth: true, data: seeding, yAxisIndex: 1 },
    ],
  } as EChartsLineChartOption;
});

const lastHoveredSeriesIndex = ref<number>(-1);

function updateLastHoveredSeriesIndex(data: any) {
  lastHoveredSeriesIndex.value = data?.seriesIndex ?? -1;
}

const createPerSiteChartOptionsFn = (
  field: keyof IStoredUserInfo,
  format: keyof typeof formatDict,
  incr: boolean = false,
) =>
  computed(() => {
    const series = selectedSites.value.map((site) => {
      let data;
      if (incr) {
        data = selectedDateRanges.value.map((date) => {
          const incrementalValue = rawDataRef.value.incrementalData[site]?.[date]?.[field];
          return isNumber(incrementalValue) ? incrementalValue : Number(incrementalValue) || 0;
        });
      } else {
        data = selectedDateRanges.value.map((date) => {
          const val = selectedDataComputed.value[date]?.[site]?.[field];
          return isNumber(val) ? val : Number(val) || 0;
        });
      }

      return {
        name: site,
        type: "bar",
        emphasis: {
          focus: "series",
        },
        stack: "site",
        data,
      };
    });

    const seriesTotal = series.map((x) => ({ name: x.name, value: x.data.reduce((a, b) => a + b, 0) }));

    return {
      backgroundColor: "transparent",
      title: {
        text: `[${configStore.userName}] ${t("UserDataStatistic.chart.perSiteK" + field + (incr ? "Incr" : ""))}`,
        left: "center",
      },
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "shadow",
        },
        formatter: (params: any[]) => {
          let ret = "";
          const date = params?.[0]?.name ?? "No Date";
          ret += `<div style="font-weight:600;margin-bottom:4px;">${date}</div>`;

          const hasData = params.some((x) => Number(x.data));
          const totalCount = params.reduce((acc, cur) => acc + (Number(cur.data) || 0), 0);
          let thresholdSite = 0;

          if (hasData) {
            ret += '<table style="width: 100%; border-collapse: collapse;">';
            ret += `<tr style="font-weight:600;border-bottom:1px solid rgba(128,128,128,0.35);"><td style="padding-right:12px;">${t("UserDataStatistic.chart.totalLabel")}</td><td style="padding-right:12px;text-align:right;">${formatDict[format](totalCount)}</td><td style="text-align:right;">100%</td></tr>`;

            const sortedParams = [...params].sort((a, b) => b.data - a.data);

            for (const data of sortedParams) {
              const dataValue = Number(data.data) || 0;
              if (dataValue === 0) continue;

              const site = data.seriesName;
              const siteName = allAddedSiteMetadata[site]?.siteName ?? site;
              const siteFavicon = allAddedSiteMetadata[site]?.faviconSrc ?? NO_IMAGE;
              const precentValue = totalCount !== 0 ? (dataValue / totalCount) * 100 : 0;
              const isHighlightSite = lastHoveredSeriesIndex.value === data.seriesIndex;

              if (
                !isHighlightSite &&
                Math.abs(precentValue) < (configStore.userStatisticControl.hidePerSitePrecentThreshold ?? 0)
              ) {
                thresholdSite++;
                continue;
              }

              ret += `<tr style="${isHighlightSite ? `color:${data.color};` : ""}">
<td style="padding-right:12px;"><div style="display:inline-flex;align-items:center;"><img src="${siteFavicon}" style="width:16px;height:16px;margin-right:4px;" alt="${siteName}">${siteName}</div></td>
<td style="padding-right:12px;text-align:right;">${formatDict[format](data.value)}</td>
<td style="text-align:right;">${precentValue.toFixed(2)}%</td>
</tr>`;
            }

            if (thresholdSite > 0) {
              ret += `<tr><td colspan="3" style="text-align:right;">${t("UserDataStatistic.chart.hiddenSites", { count: thresholdSite })}</td></tr>`;
            }

            ret += "</table>";
          } else {
            ret += `${t("UserDataStatistic.chart.noData")}`;
          }

          return ret;
        },
      },
      legend: {
        data: seriesTotal.sort((a, b) => b.value - a.value).map((x) => x.name),
        bottom: 6,
        orient: "horizontal",
        type: "scroll",
        formatter: (site) => allAddedSiteMetadata[site]?.siteName ?? site,
      },
      grid: { left: "3%", right: "4%", bottom: "14%", containLabel: true },
      xAxis: { type: "category", boundaryGap: true, data: selectedDateRanges.value },
      yAxis: [
        { type: "value", name: t("UserDataStatistic.chart.dataLabel"), axisLabel: { formatter: formatDict[format] } },
      ],
      series,
    } as EChartsBarChartOption;
  });

const perSiteChartField: [keyof IStoredUserInfo, keyof typeof formatDict][] = [
  ["uploaded", "size"],
  ["downloaded", "size"],
  ["seeding", "int"],
  ["seedingSize", "size"],
  ["bonus", "number"],
  ["seedingBonus", "number"],
] as const;

const echartsTheme = computed(() => (configStore.uiTheme === "dark" ? "dark" : null));
provide(THEME_KEY, echartsTheme);

onMounted(async () => {
  rawDataRef.value = await loadFullData();
  await loadAllAddedSiteMetadata(Object.keys(rawDataRef.value.siteDateRange));

  const { days = -1, sites = [] } = route.query ?? {};
  const dateRange = (days as number) > 0 ? days : configStore.userStatisticControl.dateRange;

  if (typeof dateRange === "number") {
    selectedDateRanges.value = setSubDate(dateRange);
  } else {
    if (dateRange === "custom") {
      configStore.userStatisticControl.dateRange = "all";
    }
    selectedDateRanges.value = allDateRanges.value;
  }

  customStartDate.value = selectedDateRanges.value[0] ?? allDateRanges.value[0] ?? "";
  customEndDate.value = selectedDateRanges.value.at(-1) ?? allDateRanges.value.at(-1) ?? "";

  if ((sites as string[]).length > 0) {
    selectedSites.value = sites as string[];
  } else if ((configStore.userStatisticControl.selectedSites ?? []).length > 0) {
    selectedSites.value = configStore.userStatisticControl.selectedSites;
  } else {
    selectedSites.value = allSites.value;
  }

  if (configStore.userName === "") {
    configStore.userName = configStore.getUserNames.perfName;
  }
});

function selectDayRange(day: number) {
  configStore.userStatisticControl.dateRange = day;
  selectedDateRanges.value = setSubDate(day);
}

function selectAllRange() {
  configStore.userStatisticControl.dateRange = "all";
  selectedDateRanges.value = allDateRanges.value;
}

function applyCustomDateRange() {
  if (!customStartDate.value || !customEndDate.value) return;
  const start = new Date(`${customStartDate.value}T00:00:00`);
  const end = new Date(`${customEndDate.value}T00:00:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return;
  selectedDateRanges.value = eachDayOfInterval({ start, end }).map((x) => formatDate(x, "yyyy-MM-dd")) as string[];
  configStore.userStatisticControl.dateRange = "custom";
  customRangePopoverOpen.value = false;
}

function toggleSite(siteId: string, checked: boolean | "indeterminate") {
  if (checked === true) {
    if (!selectedSites.value.includes(siteId)) {
      selectedSites.value = [...selectedSites.value, siteId];
    }
  } else {
    selectedSites.value = selectedSites.value.filter((id) => id !== siteId);
  }
}

function exportStatisticImg() {
  const createdAt = formatDate(new Date());
  const chartsCanvas = Array.from(document.querySelectorAll("#chartContainer canvas")) as HTMLCanvasElement[];
  if (chartsCanvas.length === 0) return;

  const targetWidth = Math.max(...chartsCanvas.map((c) => c.clientWidth), containerWidth.value || 700);
  const mainCanvas = document.createElement("canvas");
  mainCanvas.width = targetWidth;
  mainCanvas.height = (perChartHeight + 16) * chartsCanvas.length + 24;

  const ctx = mainCanvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.fillStyle = configStore.uiTheme === "dark" ? "#0b1120" : "#ffffff";
  ctx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);

  let yIndex = 8;
  for (const chartCanvas of chartsCanvas) {
    const drawW = chartCanvas.clientWidth || targetWidth;
    const drawH = chartCanvas.clientHeight || perChartHeight;
    const offsetX = Math.max(0, (targetWidth - drawW) / 2);
    ctx.drawImage(chartCanvas, offsetX, yIndex, drawW, drawH);
    yIndex += drawH + 16;
  }

  ctx.font = "12px sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.textAlign = "right";
  ctx.fillText(`Created By PT-Depiler (${__EXT_VERSION__}) at ${createdAt}`, targetWidth - 12, yIndex + 4);

  mainCanvas.toBlob((blob) => {
    if (blob) {
      void downloadBlob(
        blob,
        t("UserDataStatistic.chart.exportFilename", { name: configStore.userName, date: createdAt }) + ".png",
      );
    }
  });
}

function saveControl() {
  configStore.userStatisticControl.selectedSites = selectedSites.value;
  configStore.$save();
  useRuntimeStore().showSnackbar(t("common.saveSuccess"), { color: "success" });
}
</script>

<template>
  <div class="space-y-4">
    <!-- 顶部控制栏 -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2.5">
        <Button variant="outline" size="sm" @click="router.back()">
          <ArrowLeft />
          {{ t("common.back") }}
        </Button>
        <div>
          <h1 class="text-lg font-semibold tracking-tight text-foreground">{{ t("MyData.index.viewStatistic") }}</h1>
          <p
            :class="[
              'text-xs text-muted-foreground tabular-nums transition-[filter] duration-150',
              configStore.myDataTableControl.privacyBlur && 'ptd-privacy-blur',
            ]"
          >
            {{ selectedDateRanges[0] ?? "-" }} ~ {{ selectedDateRanges.at(-1) ?? "-" }} · {{ selectedSites.length }}
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          :class="
            configStore.myDataTableControl.privacyBlur
              ? 'border-primary/45 bg-primary/12 text-primary hover:bg-primary/18 hover:text-primary'
              : ''
          "
          @click="
            () => {
              configStore.myDataTableControl.privacyBlur = !configStore.myDataTableControl.privacyBlur;
              configStore.$save();
            }
          "
        >
          <EyeOff v-if="configStore.myDataTableControl.privacyBlur" />
          <Eye v-else />
          <span>
            {{
              configStore.myDataTableControl.privacyBlur
                ? t("MyData.index.privacyBlurred")
                : t("MyData.index.privacyBlur")
            }}
          </span>
        </Button>
        <Button variant="outline" size="sm" @click="showControlPanel = !showControlPanel">
          <SlidersHorizontal />
          <span>{{ t("UserDataStatistic.chart.chartStyleSettings") }}</span>
          <ChevronUp v-if="showControlPanel" class="size-3.5" />
          <ChevronDown v-else class="size-3.5" />
        </Button>
        <Button variant="secondary" size="sm" @click="exportStatisticImg">
          <ImageDown />
          {{ t("common.exportImage") }}
        </Button>
        <Button size="sm" @click="saveControl">
          <Save />
          {{ t("common.saveSettings") }}
        </Button>
      </div>
    </div>

    <!-- 样式与筛选配置卡 -->
    <Card v-if="showControlPanel">
      <CardHeader class="border-b border-border py-3">
        <CardTitle class="text-sm">{{ t("UserDataStatistic.chart.chartStyleSettings") }}</CardTitle>
      </CardHeader>
      <CardContent class="space-y-5 pt-4">
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <!-- 用户名 -->
          <div class="space-y-1.5">
            <Label class="text-xs">{{ t("common.username") }}</Label>
            <div
              :class="[
                'flex items-center gap-1.5 transition-[filter] duration-150',
                configStore.myDataTableControl.privacyBlur && 'ptd-privacy-blur',
              ]"
            >
              <Button
                variant="outline"
                size="icon-sm"
                :class="allowEditName ? 'border-success/50 text-success' : ''"
                @click="allowEditName = !allowEditName"
              >
                <Unlock v-if="allowEditName" />
                <Lock v-else />
              </Button>
              <Select
                v-if="!allowEditName && Object.keys(configStore.getUserNames.names).length > 0"
                v-model="configStore.userName"
              >
                <SelectTrigger class="h-8 flex-1 text-xs">
                  <SelectValue :placeholder="t('common.username')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="(_, name) in configStore.getUserNames.names" :key="name" :value="String(name)">
                    {{ name }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Input v-else v-model="configStore.userName" :readonly="!allowEditName" class="h-8 flex-1 text-xs" />
              <Button
                variant="ghost"
                size="icon-sm"
                :title="t('common.dialog.reset')"
                @click="configStore.userName = configStore.getUserNames.perfName"
              >
                <RotateCcw />
              </Button>
            </div>
          </div>

          <!-- 时间段选择 -->
          <div class="space-y-1.5">
            <Label class="text-xs">{{ t("UserDataStatistic.chart.dateRange") }}</Label>
            <div class="flex flex-wrap items-center gap-1 rounded-md border border-border bg-muted/40 p-0.5">
              <Button
                v-for="day in [7, 30, 60, 90, 180]"
                :key="day"
                :variant="configStore.userStatisticControl.dateRange === day ? 'secondary' : 'ghost'"
                size="xs"
                :class="configStore.userStatisticControl.dateRange === day ? 'bg-background shadow-2xs' : ''"
                @click="selectDayRange(day)"
              >
                {{ t("UserDataStatistic.dateRange.day", [day]) }}
              </Button>
              <Popover v-model:open="customRangePopoverOpen">
                <PopoverTrigger as-child>
                  <Button
                    :variant="configStore.userStatisticControl.dateRange === 'custom' ? 'secondary' : 'ghost'"
                    size="xs"
                    :class="configStore.userStatisticControl.dateRange === 'custom' ? 'bg-background shadow-2xs' : ''"
                  >
                    <CalendarRange class="size-3" />
                    {{ t("UserDataStatistic.dateRange.custom") }}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" class="w-72 space-y-3 p-3.5">
                  <div class="space-y-1.5">
                    <Label class="text-xs">{{ t("common.AdvanceFilterGenerateDialog.date") }}</Label>
                    <div class="grid grid-cols-2 gap-2">
                      <Input
                        v-model="customStartDate"
                        type="date"
                        :min="allDateRanges[0]"
                        :max="allDateRanges.at(-1)"
                        class="h-8 text-xs"
                      />
                      <Input
                        v-model="customEndDate"
                        type="date"
                        :min="allDateRanges[0]"
                        :max="allDateRanges.at(-1)"
                        class="h-8 text-xs"
                      />
                    </div>
                  </div>
                  <div class="flex justify-end gap-2">
                    <Button variant="ghost" size="xs" @click="customRangePopoverOpen = false">
                      {{ t("common.dialog.cancel") }}
                    </Button>
                    <Button size="xs" @click="applyCustomDateRange">
                      {{ t("common.dialog.confirm") }}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                :variant="configStore.userStatisticControl.dateRange === 'all' ? 'secondary' : 'ghost'"
                size="xs"
                :class="configStore.userStatisticControl.dateRange === 'all' ? 'bg-background shadow-2xs' : ''"
                @click="selectAllRange"
              >
                {{ t("UserDataStatistic.dateRange.all") }}
              </Button>
            </div>
          </div>

          <!-- 阈值设置 -->
          <div class="space-y-1.5">
            <Label class="text-xs">{{ t("UserDataStatistic.chart.hideLowPercentLabel") }}</Label>
            <div class="flex items-center gap-2">
              <Input
                v-model.number="configStore.userStatisticControl.hidePerSitePrecentThreshold"
                type="number"
                :min="0"
                :max="100"
                :step="0.5"
                class="h-8 w-28 text-xs tabular-nums"
              />
              <span class="text-xs text-muted-foreground"
                >% · {{ t("UserDataStatistic.chart.hideLowPercentHint") }}</span
              >
            </div>
          </div>
        </div>

        <!-- 展示图表开关 -->
        <div class="space-y-2">
          <Label class="text-xs font-semibold">{{ t("UserDataStatistic.chart.displayChart") }}</Label>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
            <label
              v-for="(val, key) in configStore.userStatisticControl.showChart"
              :key="key"
              class="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs select-none hover:bg-muted/40"
            >
              <Checkbox v-model="configStore.userStatisticControl.showChart[key]" />
              <span class="truncate">{{ t("UserDataStatistic.chart." + key) }}</span>
            </label>
          </div>
        </div>

        <!-- 展示站点勾选 -->
        <div class="space-y-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <Label class="text-xs font-semibold">{{ t("UserDataStatistic.chart.displaySiteSettings") }}</Label>
              <Badge variant="secondary" class="text-[11px] tabular-nums">
                {{ selectedSites.length }} / {{ allSites.length }}
              </Badge>
            </div>
            <CheckSwitchButton v-model="selectedSites" :all="allSites" />
          </div>

          <div
            :class="[
              'grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 transition-[filter] duration-150',
              configStore.myDataTableControl.privacyBlur && 'ptd-privacy-blur',
            ]"
          >
            <label
              v-for="siteId in allSites"
              :key="siteId"
              :class="[
                'flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors select-none',
                !availableSites.includes(siteId)
                  ? 'cursor-not-allowed border-border/50 bg-muted/30 opacity-50'
                  : selectedSites.includes(siteId)
                    ? 'border-primary/40 bg-primary/[0.04]'
                    : 'border-border bg-background hover:bg-muted/40',
              ]"
            >
              <Checkbox
                :model-value="availableSites.includes(siteId) ? selectedSites.includes(siteId) : 'indeterminate'"
                :disabled="!availableSites.includes(siteId)"
                @update:model-value="(v) => toggleSite(siteId, v)"
              />
              <SiteFavicon :site-id="siteId" :size="15" />
              <SiteName :site-id="siteId" tag="span" class="truncate" />
            </label>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 双栏响应式 ECharts 图表网格 -->
    <div
      ref="chartContainer"
      id="chartContainer"
      :class="[
        'grid grid-cols-1 gap-4 xl:grid-cols-2 transition-[filter] duration-150',
        configStore.myDataTableControl.privacyBlur && 'ptd-privacy-blur',
      ]"
    >
      <Card v-if="configStore.userStatisticControl.showChart.totalSiteBase" class="overflow-hidden p-3">
        <v-chart
          :option="totalSiteBaseInfoChartOptions"
          :style="{ height: `${perChartHeight}px` }"
          autoresize
          class="w-full"
          group="totalSiteBase"
        />
      </Card>

      <Card v-if="configStore.userStatisticControl.showChart.totalSiteSeeding" class="overflow-hidden p-3">
        <v-chart
          :option="totalSiteSeedingInfoChartOptions"
          :style="{ height: `${perChartHeight}px` }"
          autoresize
          class="w-full"
          group="totalSiteSeeding"
        />
      </Card>

      <template v-for="[field, format] in perSiteChartField" :key="field">
        <Card
          v-if="(configStore.userStatisticControl.showChart as any)[`perSiteK${field}`]"
          class="overflow-hidden p-3"
        >
          <v-chart
            :group="`perSiteK${field}`"
            :option="createPerSiteChartOptionsFn(field, format).value"
            :style="{ height: `${perChartHeight}px` }"
            autoresize
            class="w-full"
            @mousemove="updateLastHoveredSeriesIndex"
          />
        </Card>

        <Card
          v-if="(configStore.userStatisticControl.showChart as any)[`perSiteK${field}Incr`]"
          class="overflow-hidden p-3"
        >
          <v-chart
            :group="`perSiteK${field}Incr`"
            :option="createPerSiteChartOptionsFn(field, format, true).value"
            :style="{ height: `${perChartHeight}px` }"
            autoresize
            class="w-full"
            @mousemove="updateLastHoveredSeriesIndex"
          />
        </Card>
      </template>
    </div>
  </div>
</template>
