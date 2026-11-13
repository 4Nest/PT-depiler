<script setup lang="ts">
import { CornerDownRight } from "lucide-vue-next";
import { type IImplicitUserInfo, type ILevelRequirement, type IUserInfo } from "@ptd/site";

import UserLevelsComponent from "./UserLevelsComponent.vue";

const {
  nextLevelUnMet,
  userInfo,
  showNextLevelName = true,
  iconClass = "",
} = defineProps<{
  nextLevelUnMet: Partial<IImplicitUserInfo & { level?: ILevelRequirement }>;
  userInfo: IUserInfo;
  showNextLevelName?: boolean;
  iconClass?: string;
}>();
</script>

<template>
  <span class="inline-flex flex-wrap items-center gap-1 text-xs">
    <CornerDownRight :class="['size-3.5 shrink-0 text-warning', iconClass]" />
    <span v-if="showNextLevelName && nextLevelUnMet.level" class="font-medium text-foreground">
      {{ nextLevelUnMet.level.name }}:
    </span>
    <UserLevelsComponent :user-info="userInfo" :level-requirement="nextLevelUnMet" :hide-ratio-in-table="true" />
  </span>
</template>
