<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";

import { setBaseChildren } from "@/options/plugins/router.ts";
import { useConfigStore } from "@/options/stores/config.ts";
import { useRuntimeStore } from "@/options/stores/runtime.ts";

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const configStore = useConfigStore();
const runtimeStore = useRuntimeStore();

const setBaseTabs = setBaseChildren.map((x) => ({
  key: x.alias ?? x.path,
  route: x.name,
  icon: x.meta!.icon,
}));

const setTabRef = useTemplateRef<{ beforeSave?: () => Promise<void>; afterSave?: () => Promise<void> }>("setTabRef");

const activeTab = computed({
  get() {
    return route.name;
  },
  set(newRouteName) {
    router.push({ name: newRouteName });
  },
});

const showSaveButton = computed(() => {
  return route.meta?.usesGlobalSave !== false;
});

async function save() {
  await setTabRef.value?.beforeSave?.(); // 如果对应的 tab 有 afterSave 方法，则调用
  await configStore.$save();
  runtimeStore.showSnackbar(t("common.saveSuccess"), { color: "success" });
  await setTabRef.value?.afterSave?.(); // 如果对应的 tab 有 afterSave 方法，则调用
}
</script>

<template>
  <v-card>
    <v-tabs v-model="activeTab" color="primary" density="comfortable" class="border-b px-2" show-arrows>
      <v-tab v-for="tab in setBaseTabs" :key="tab.key as string" :value="tab.route" :prepend-icon="tab.icon as string">
        {{ t(`SetBase.tab.${tab.key}`) }}
      </v-tab>
    </v-tabs>
    <v-window v-model="activeTab">
      <v-card-text class="pa-4 pa-md-6">
        <router-view v-slot="{ Component }">
          <component :is="Component" ref="setTabRef" />
        </router-view>
      </v-card-text>
      <v-divider v-if="showSaveButton" />
      <v-card-actions v-if="showSaveButton" class="pa-4">
        <v-btn color="primary" prepend-icon="mdi-check-circle-outline" variant="flat" @click="save">
          {{ t("common.save") }}
        </v-btn>
      </v-card-actions>
    </v-window>
  </v-card>
</template>

<style scoped lang="scss"></style>
