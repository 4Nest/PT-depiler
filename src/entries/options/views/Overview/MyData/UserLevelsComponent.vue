<script setup lang="ts">
import { Layers } from "lucide-vue-next";
import { type ILevelRequirement, type IUserInfo } from "@ptd/site";

import UserLevelShowSpan from "./UserLevelShowSpan.vue";

const {
  userInfo,
  levelRequirement,
  hideRatioInTable = false,
  useJoinTimeAsRef = false,
} = defineProps<{
  userInfo: IUserInfo;
  levelRequirement: Omit<ILevelRequirement, "id" | "name">;
  hideRatioInTable?: boolean;
  useJoinTimeAsRef?: boolean;
}>();
</script>

<template>
  <span class="inline-flex flex-wrap items-center gap-1.5">
    <UserLevelShowSpan
      :user-info="userInfo"
      :level-requirement="levelRequirement"
      :hide-ratio-in-table="hideRatioInTable"
      :use-join-time-as-ref="useJoinTimeAsRef"
    />
    <span
      v-if="levelRequirement.alternative"
      class="inline-flex flex-wrap items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 text-xs text-muted-foreground"
    >
      <Layers class="size-3 shrink-0" />
      <span>(</span>
      <template v-for="(alternative, key, idx) in levelRequirement.alternative" :key="key">
        <span v-if="(idx ?? 0) > 0" class="text-muted-foreground/60">/</span>
        <span class="inline-flex items-center">
          [
          <UserLevelShowSpan
            :user-info="userInfo"
            :level-requirement="alternative"
            :hide-ratio-in-table="hideRatioInTable"
            :use-join-time-as-ref="useJoinTimeAsRef"
          />
          ]
        </span>
      </template>
      <span>)</span>
    </span>
  </span>
</template>
