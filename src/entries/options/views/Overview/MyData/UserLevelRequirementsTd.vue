<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { computedAsync } from "@vueuse/core";
import { isEmpty } from "es-toolkit/compat";
import { Award, CheckCircle2, Crown, ShieldCheck, XCircle } from "lucide-vue-next";
import { getNextLevelUnMet, guessUserLevelGroupType, type IUserInfo, type TLevelGroupType } from "@ptd/site";

import { Badge, Popover, PopoverContent, PopoverTrigger } from "~/components/ui";
import { useMetadataStore } from "@/options/stores/metadata.ts";
import { useConfigStore } from "@/options/stores/config.ts";

import UserLevelsComponent from "./UserLevelsComponent.vue";
import UserNextLevelUnMet from "./UserNextLevelUnMet.vue";

const { userInfo, limitLevelNameTdWidth } = defineProps<{
  userInfo: IUserInfo;
  limitLevelNameTdWidth: boolean;
}>();

const { t } = useI18n();
const configStore = useConfigStore();
const metadataStore = useMetadataStore();

const userLevelRequirements = computedAsync(() => {
  return metadataStore.getSiteMergedMetadata(userInfo.site, "levelRequirements", []);
}, []);

const userInfoMetadata = computedAsync(() => {
  return metadataStore.getSiteMergedMetadata(userInfo.site, "userInfo");
}, undefined);

const matchedLevelRequirements = computed(() => {
  return userLevelRequirements.value?.find((r) => r.id === userInfo.levelId);
});

const levelName = computed(() => {
  if (!configStore.myDataTableControl.normalizeLevelName) {
    return userInfo.levelName;
  }

  return matchedLevelRequirements.value?.name ?? userInfo.levelName;
});

const nextLevelUnMet = computed(() => getNextLevelUnMet(userInfo, userLevelRequirements.value!));

const userLevelGroupType = computed<TLevelGroupType>(() => {
  if (matchedLevelRequirements.value?.groupType) {
    return matchedLevelRequirements.value.groupType;
  }

  return guessUserLevelGroupType(userInfo.levelName ?? "user");
});

const isDonorAccountKept = computed(() => {
  return userInfo.isDonor === true && userInfoMetadata.value?.donorConfig?.isAccountKept === true;
});

const levelTextClass = computed(() => {
  switch (userLevelGroupType.value) {
    case "vip":
      return "text-success";
    case "manager":
      return "text-primary";
    case "user":
      if (matchedLevelRequirements.value?.isKept || isDonorAccountKept.value) {
        return "text-info";
      }
      return "text-foreground";
    default:
      return "text-foreground";
  }
});

const userLevelGroupIcon = computed(() => {
  switch (userLevelGroupType.value) {
    case "vip":
      return Crown;
    case "manager":
      return ShieldCheck;
    default:
      return Award;
  }
});

const visibleLevelRequirements = computed(() => {
  if (!userLevelRequirements.value) return [];
  return userLevelRequirements.value.filter((userLevel) =>
    configStore.myDataTableControl.onlyShowUserLevelRequirement
      ? (userLevel.groupType !== "vip" && userLevel.groupType !== "manager") || userLevelGroupType.value !== "user"
      : true,
  );
});

const showPopover = computed(
  () =>
    configStore.myDataTableControl.showLevelRequirement &&
    userLevelRequirements.value &&
    userLevelRequirements.value.length > 0,
);
</script>

<template>
  <div v-if="userInfo.levelName" class="inline-flex flex-col items-start">
    <Popover v-if="showPopover">
      <PopoverTrigger as-child>
        <button
          type="button"
          :class="[
            'group/lvl inline-flex flex-col items-start text-left focus:outline-none',
            limitLevelNameTdWidth ? 'max-w-[32vw]' : '',
          ]"
        >
          <span
            :class="[
              'inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap transition-colors group-hover/lvl:underline decoration-dotted underline-offset-4',
              levelTextClass,
              limitLevelNameTdWidth ? 'max-w-full truncate' : '',
            ]"
          >
            <component :is="userLevelGroupIcon" class="size-3.5 shrink-0" />
            <span class="truncate">{{ levelName }}</span>
            <CheckCircle2
              v-if="
                configStore.myDataTableControl.showNextLevelInTable &&
                userLevelGroupType === 'user' &&
                isEmpty(nextLevelUnMet)
              "
              class="size-3.5 shrink-0 text-success"
            />
          </span>

          <div
            v-if="
              configStore.myDataTableControl.showNextLevelInTable &&
              userLevelGroupType === 'user' &&
              !isEmpty(nextLevelUnMet)
            "
            class="mt-0.5 text-muted-foreground"
          >
            <UserNextLevelUnMet
              :next-level-un-met="nextLevelUnMet"
              :show-next-level-name="false"
              :user-info="userInfo"
            />
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" class="w-[520px] max-w-[92vw] p-0">
        <div class="flex items-center justify-between border-b border-border px-3.5 py-2.5">
          <div class="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <component :is="userLevelGroupIcon" :class="['size-4', levelTextClass]" />
            <span>{{ t("MyData.UserLevelRequirementsTd.levelList") }}</span>
          </div>
          <Badge variant="secondary" class="text-[11px]">{{ levelName }}</Badge>
        </div>

        <div class="max-h-[420px] space-y-2 overflow-y-auto p-3">
          <div
            v-if="
              configStore.myDataTableControl.showNextLevelInDialog &&
              userLevelGroupType === 'user' &&
              !isEmpty(nextLevelUnMet)
            "
            class="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2"
          >
            <UserNextLevelUnMet :next-level-un-met="nextLevelUnMet" :user-info="userInfo" />
          </div>

          <div class="divide-y divide-border/70 rounded-lg border border-border">
            <div
              v-for="userLevel in visibleLevelRequirements"
              :key="userLevel.id"
              :class="[
                'flex items-start gap-2.5 px-3 py-2 text-xs transition-colors',
                userLevel.id === userInfo.levelId ? 'bg-primary/[0.06]' : 'hover:bg-muted/40',
              ]"
            >
              <CheckCircle2
                v-if="userLevel.id <= (userInfo.levelId ?? -1)"
                class="mt-0.5 size-3.5 shrink-0 text-success"
              />
              <XCircle v-else class="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50" />

              <div class="min-w-0 flex-1 space-y-1">
                <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    :class="['font-medium', userLevel.id === userInfo.levelId ? 'text-primary' : 'text-foreground']"
                  >
                    {{ userLevel.name }}
                  </span>
                  <UserLevelsComponent
                    :user-info="userInfo"
                    :level-requirement="userLevel"
                    :use-join-time-as-ref="true"
                  />
                </div>
                <p
                  v-if="userLevel.privilege"
                  class="truncate text-[11px] text-muted-foreground"
                  :title="userLevel.privilege"
                >
                  {{ userLevel.privilege }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>

    <span
      v-else
      :class="[
        'inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap',
        levelTextClass,
        limitLevelNameTdWidth ? 'max-w-[32vw] truncate' : '',
      ]"
      :title="limitLevelNameTdWidth ? levelName : undefined"
    >
      <component :is="userLevelGroupIcon" class="size-3.5 shrink-0" />
      <span class="truncate">{{ levelName }}</span>
    </span>
  </div>

  <span v-else class="text-xs text-muted-foreground">-</span>
</template>
