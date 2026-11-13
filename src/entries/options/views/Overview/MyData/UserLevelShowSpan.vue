<script setup lang="ts">
import { useI18n } from "vue-i18n";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarClock,
  ChevronsDown,
  ChevronsUp,
  Clock,
  Coins,
  FileCheck,
  FileDown,
  FileText,
  FileUp,
  HandHelping,
  HardDrive,
  Leaf,
  Scale,
  Sprout,
  Timer,
  Zap,
} from "lucide-vue-next";
import {
  IImplicitUserInfo,
  isoDuration,
  convertIsoDurationToDate,
  convertSecondsToIsoDuration,
  type IUserInfo,
} from "@ptd/site";
import { formatNumber, formatSize, formatDate, simplifyNumber } from "@/options/utils";
import { useConfigStore } from "@/options/stores/config";

const {
  userInfo,
  levelRequirement,
  hideRatioInTable = false,
  useJoinTimeAsRef = false,
} = defineProps<{
  userInfo: IUserInfo;
  levelRequirement: IImplicitUserInfo;
  hideRatioInTable?: boolean;
  useJoinTimeAsRef?: boolean; // 在 formatIntervalDate 中是否使用 joinTime 作为参考时间，默认参考为 currentTime
}>();

const { t } = useI18n();
const configStore = useConfigStore();

function toggleIntervalDisplay() {
  configStore.myDataTableControl.showIntervalAsDate = !configStore.myDataTableControl.showIntervalAsDate;
  void configStore.$save();
}

function toggleNumberSimplification() {
  configStore.myDataTableControl.simplifyBonusNumbers = !configStore.myDataTableControl.simplifyBonusNumbers;
  void configStore.$save();
}

function getIntervalDisplay(interval: number | isoDuration) {
  const showAsDate = configStore.myDataTableControl.showIntervalAsDate;
  const durationText = formatDuration(interval);
  const dateText = formatIntervalDate(interval);

  return {
    text: showAsDate ? dateText : durationText,
    title: showAsDate ? durationText : dateText,
  };
}

function formatDuration(duration: number | isoDuration) {
  try {
    if (typeof duration === "number") {
      const isoDurationStr = convertSecondsToIsoDuration(duration);
      return isoDurationStr.substring(1);
    } else {
      if (duration === "P") return "0D";
      return duration.substring(1);
    }
  } catch (e) {
    console.error("Error formatting duration:", duration, e);
    return "";
  }
}

function formatIntervalDate(duration: number | isoDuration): string {
  try {
    // #1140 unmet 结果带有绝对达标时间时优先使用，避免「挂载时刻 + 重算差值」的时钟错位导致日期漂移
    if (levelRequirement.passTime) {
      const passTimeDate = formatDate(new Date(levelRequirement.passTime), "yyyy-MM-dd");
      if (typeof passTimeDate === "string") {
        return passTimeDate;
      }
    }

    const refTime = useJoinTimeAsRef ? (userInfo.joinTime ?? Date.now()) : Date.now();
    if (typeof duration === "number") {
      const targetDate = new Date(refTime + duration * 1000);
      const result = formatDate(targetDate, "yyyy-MM-dd");
      return typeof result === "string" ? result : "";
    } else {
      const result = formatDate(convertIsoDurationToDate(duration, refTime), "yyyy-MM-dd");
      return typeof result === "string" ? result : "";
    }
  } catch (e) {
    console.error("Error formatting interval date:", duration, e);
    return "";
  }
}

function formatBonus(bonusKey: "bonus" | "seedingBonus") {
  return (
    (configStore.myDataTableControl.simplifyBonusNumbers
      ? simplifyNumber(levelRequirement[bonusKey]!)
      : formatNumber(levelRequirement[bonusKey]!)) +
    (configStore.myDataTableControl.showBonusNeededInterval && levelRequirement[`${bonusKey}NeededInterval`]
      ? ` (~${levelRequirement[`${bonusKey}NeededInterval`]})`
      : "")
  );
}
</script>

<template>
  <span class="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs tabular-nums">
    <slot name="prepend" />

    <span
      v-if="levelRequirement.interval"
      class="inline-flex cursor-pointer select-none items-center gap-1 whitespace-nowrap"
      :title="`${t('levelRequirement.interval')}: ${getIntervalDisplay(levelRequirement.interval).title}`"
      @dblclick="toggleIntervalDisplay"
    >
      <CalendarClock class="size-3.5 shrink-0 text-muted-foreground" />
      <span>{{ getIntervalDisplay(levelRequirement.interval).text }}</span>
    </span>

    <span
      v-if="levelRequirement.uploaded"
      class="inline-flex items-center gap-0.5 whitespace-nowrap"
      :title="t('levelRequirement.uploaded')"
    >
      <ArrowUp class="size-3.5 shrink-0 text-success" />
      <span>{{ formatSize(levelRequirement.uploaded) }}</span>
    </span>

    <span
      v-if="levelRequirement.trueUploaded"
      class="inline-flex items-center gap-0.5 whitespace-nowrap"
      :title="t('levelRequirement.trueUploaded')"
    >
      <ChevronsUp class="size-3.5 shrink-0 text-success" />
      <span>{{ formatSize(levelRequirement.trueUploaded) }}</span>
    </span>

    <span
      v-if="levelRequirement.downloaded"
      class="inline-flex items-center gap-0.5 whitespace-nowrap"
      :title="t('levelRequirement.downloaded')"
    >
      <ArrowDown class="size-3.5 shrink-0 text-destructive" />
      <span>{{ formatSize(levelRequirement.downloaded) }}</span>
    </span>

    <span
      v-if="levelRequirement.trueDownloaded"
      class="inline-flex items-center gap-0.5 whitespace-nowrap"
      :title="t('levelRequirement.trueDownloaded')"
    >
      <ChevronsDown class="size-3.5 shrink-0 text-destructive" />
      <span>{{ formatSize(levelRequirement.trueDownloaded) }}</span>
    </span>

    <span
      v-if="levelRequirement.totalTraffic"
      class="inline-flex items-center gap-0.5 whitespace-nowrap"
      :title="t('levelRequirement.totalTraffic')"
    >
      <ArrowUpDown class="size-3.5 shrink-0 text-warning" />
      <span>{{ formatSize(levelRequirement.totalTraffic) }}</span>
    </span>

    <span
      v-if="levelRequirement.ratio && !hideRatioInTable"
      class="inline-flex items-center gap-0.5 whitespace-nowrap"
      :title="t('levelRequirement.ratio')"
    >
      <Scale class="size-3.5 shrink-0 text-warning" />
      <span>{{ levelRequirement.ratio }}</span>
    </span>

    <span
      v-if="levelRequirement.trueRatio && !hideRatioInTable"
      class="inline-flex items-center gap-0.5 whitespace-nowrap"
      :title="t('levelRequirement.trueRatio')"
    >
      <Scale class="size-3.5 shrink-0 text-info" />
      <span>{{ levelRequirement.trueRatio }}</span>
    </span>

    <span
      v-if="levelRequirement.seeding"
      class="inline-flex items-center gap-0.5 whitespace-nowrap"
      :title="t('levelRequirement.seeding')"
    >
      <Sprout class="size-3.5 shrink-0 text-success" />
      <span>{{ formatNumber(levelRequirement.seeding, { minimumFractionDigits: 0 }) }}</span>
    </span>

    <span
      v-if="levelRequirement.seedingSize"
      class="inline-flex items-center gap-0.5 whitespace-nowrap"
      :title="t('levelRequirement.seedingSize')"
    >
      <HardDrive class="size-3.5 shrink-0 text-info" />
      <span>{{ formatSize(levelRequirement.seedingSize) }}</span>
    </span>

    <span
      v-if="levelRequirement.seedingTime"
      class="inline-flex items-center gap-0.5 whitespace-nowrap"
      :title="t('levelRequirement.seedingTime')"
    >
      <Timer class="size-3.5 shrink-0 text-success" />
      <span>{{ formatDuration(levelRequirement.seedingTime) }}</span>
    </span>

    <span
      v-if="levelRequirement.averageSeedingTime"
      class="inline-flex items-center gap-0.5 whitespace-nowrap"
      :title="t('levelRequirement.averageSeedingTime')"
    >
      <Clock class="size-3.5 shrink-0 text-info" />
      <span>{{ formatDuration(levelRequirement.averageSeedingTime) }}</span>
    </span>

    <span
      v-if="levelRequirement.bonus"
      class="inline-flex cursor-pointer select-none items-center gap-0.5 whitespace-nowrap"
      :title="`${t('levelRequirement.bonus')}: ${formatNumber(levelRequirement.bonus)}`"
      @dblclick="toggleNumberSimplification"
    >
      <Coins class="size-3.5 shrink-0 text-warning" />
      <span>{{ formatBonus("bonus") }}</span>
    </span>

    <span
      v-if="levelRequirement.seedingBonus"
      class="inline-flex cursor-pointer select-none items-center gap-0.5 whitespace-nowrap"
      :title="`${t('levelRequirement.seedingBonus')}: ${formatNumber(levelRequirement.seedingBonus)}`"
      @dblclick="toggleNumberSimplification"
    >
      <Zap class="size-3.5 shrink-0 text-warning" />
      <span>{{ formatBonus("seedingBonus") }}</span>
    </span>

    <span
      v-if="levelRequirement.bonusPerHour"
      class="inline-flex items-center gap-0.5 whitespace-nowrap"
      :title="t('levelRequirement.bonusPerHour')"
    >
      <Leaf class="size-3.5 shrink-0 text-success" />
      <span>{{ formatNumber(levelRequirement.bonusPerHour) }}</span>
    </span>

    <span
      v-if="levelRequirement.uploads"
      class="inline-flex items-center gap-0.5 whitespace-nowrap"
      :title="t('levelRequirement.uploads')"
    >
      <FileUp class="size-3.5 shrink-0 text-success" />
      <span>{{ formatNumber(levelRequirement.uploads, { minimumFractionDigits: 0 }) }}</span>
    </span>

    <span
      v-if="levelRequirement.leeching"
      class="inline-flex items-center gap-0.5 whitespace-nowrap"
      :title="t('levelRequirement.leeching')"
    >
      <FileDown class="size-3.5 shrink-0 text-destructive" />
      <span>{{ formatNumber(levelRequirement.leeching, { minimumFractionDigits: 0 }) }}</span>
    </span>

    <span
      v-if="levelRequirement.snatches"
      class="inline-flex items-center gap-0.5 whitespace-nowrap"
      :title="t('levelRequirement.snatches')"
    >
      <FileCheck class="size-3.5 shrink-0 text-warning" />
      <span>{{ formatNumber(levelRequirement.snatches, { minimumFractionDigits: 0 }) }}</span>
    </span>

    <span
      v-if="levelRequirement.posts"
      class="inline-flex items-center gap-0.5 whitespace-nowrap"
      :title="t('levelRequirement.posts')"
    >
      <FileText class="size-3.5 shrink-0 text-success" />
      <span>{{ formatNumber(levelRequirement.posts, { minimumFractionDigits: 0 }) }}</span>
    </span>

    <span
      v-if="levelRequirement.adoptions"
      class="inline-flex items-center gap-0.5 whitespace-nowrap"
      :title="t('levelRequirement.adoptions')"
    >
      <HandHelping class="size-3.5 shrink-0 text-success" />
      <span>{{ formatNumber(levelRequirement.adoptions, { minimumFractionDigits: 0 }) }}</span>
    </span>
  </span>
</template>
