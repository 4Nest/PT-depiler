<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { computedAsync } from "@vueuse/core";
import { cloneDeep } from "es-toolkit";
import {
  getBackupServer,
  getBackupServerMetaData,
  type IBackupMetadata,
  type IBackupRetention,
} from "@ptd/backupServer";
import { DEFAULT_BACKUP_RETENTION_SAMPLE_RULES, hasBackupRetentionToApply } from "@ptd/backupServer/utils.ts";
import { FilterX } from "lucide-vue-next";

import { BackupFields, type IBackupServerMetadata, type TBackupFields } from "@/shared/types.ts";
import { Badge, Button, Input, Label, Separator, Switch, Textarea, Tooltip } from "~/components/ui";
import ConnectCheckButton from "@/options/components/ConnectCheckButton.vue";

const { t } = useI18n();

const clientConfig = defineModel<IBackupServerMetadata>();
const emits = defineEmits<{
  (e: "update:configValid", value: boolean): void;
}>();

const hasRetention = computed(() => hasBackupRetentionToApply(clientConfig.value?.retention));

function createDefaultRetention(): IBackupRetention {
  return {
    time: { enabled: false, maxAge: 90 },
    count: { enabled: false, maxCount: 30 },
    sample: {
      enabled: false,
      rules: Object.fromEntries(
        Object.entries(DEFAULT_BACKUP_RETENTION_SAMPLE_RULES).map(([type, rule]) => [type, { ...rule }]),
      ),
    },
  };
}

const retentionDraft = ref<IBackupRetention>(createDefaultRetention());

function hasEnabledRetentionRule(value: IBackupRetention): boolean {
  return !!(
    (value.time?.enabled && (value.time.maxAge ?? 0) > 0) ||
    (value.count?.enabled && (value.count.maxCount ?? 0) > 0) ||
    (value.sample?.enabled &&
      Object.values(value.sample.rules ?? {}).some((rule) => rule && rule.interval > 0 && rule.horizon > 0))
  );
}

const retentionSampleRules = computed(() => Object.entries(retentionDraft.value.sample?.rules ?? {}));

let syncingFromConfig = false;
let lastSyncedRetention: string | undefined;

watch(
  () => clientConfig.value?.retention,
  (saved) => {
    syncingFromConfig = true;
    try {
      const draft = createDefaultRetention();
      retentionDraft.value = saved
        ? {
            time: { ...draft.time, ...saved.time },
            count: { ...draft.count, ...saved.count },
            sample: {
              ...draft.sample,
              ...saved.sample,
              rules: { ...draft.sample!.rules, ...saved.sample?.rules },
            },
          }
        : draft;
      lastSyncedRetention = JSON.stringify(retentionDraft.value);
    } finally {
      syncingFromConfig = false;
    }
  },
  { immediate: true },
);

watch(
  retentionDraft,
  (value) => {
    if (syncingFromConfig || !clientConfig.value) return;
    const nextRetention = hasEnabledRetentionRule(value) ? cloneDeep(value) : undefined;
    const nextSerialized = JSON.stringify(nextRetention ?? null);
    if (nextSerialized === lastSyncedRetention) return;
    lastSyncedRetention = nextSerialized;
    clientConfig.value.retention = nextRetention;
  },
  { deep: true },
);

function clearRetention() {
  retentionDraft.value = createDefaultRetention();
}

const retentionSummary = computed(() => {
  const retention = clientConfig.value?.retention;
  if (!hasBackupRetentionToApply(retention)) {
    return t("SetBackup.RetentionDialog.none");
  }

  const summary: string[] = [];
  if (retention?.time?.enabled && (retention.time.maxAge ?? 0) > 0) {
    summary.push(t("SetBackup.RetentionDialog.summary.time", { n: retention.time.maxAge }));
  }
  if (retention?.count?.enabled && (retention.count.maxCount ?? 0) > 0) {
    summary.push(t("SetBackup.RetentionDialog.summary.count", { n: retention.count.maxCount }));
  }
  if (retention?.sample?.enabled) {
    for (const [type, rule] of Object.entries(retention.sample.rules ?? {})) {
      if (rule && rule.interval > 0 && rule.horizon > 0) {
        summary.push(
          t("SetBackup.RetentionDialog.summary.sample", {
            type: t(`SetBackup.RetentionDialog.sample.type.${type}`),
            n: rule.horizon,
            interval: rule.interval,
          }),
        );
      }
    }
  }

  return summary.join(t("SetBackup.RetentionDialog.summary.separator"));
});

const clientMeta = computedAsync<IBackupMetadata<any>>(
  async () => {
    const clientType = clientConfig.value?.type;
    if (!clientType) {
      return { requiredField: [] } as IBackupMetadata<any>;
    }
    return await getBackupServerMetaData(clientType);
  },
  { requiredField: [] } as IBackupMetadata<any>,
);

const formValid = computed(() => Boolean(clientConfig.value?.name?.trim()));

function toggleBackupField(field: TBackupFields, checked: boolean) {
  if (!clientConfig.value) return;
  const current = clientConfig.value.backupFields ?? [];
  if (checked) {
    if (!current.includes(field)) {
      clientConfig.value.backupFields = [...current, field];
    }
  } else {
    clientConfig.value.backupFields = current.filter((f) => f !== field);
  }
}

async function checkConnect() {
  const clientType = clientConfig.value?.type;
  if (formValid.value && clientConfig.value && clientType) {
    const client = await getBackupServer(clientConfig.value);
    return await client.ping();
  }
  return false;
}
</script>

<template>
  <div v-if="clientConfig" class="space-y-5">
    <!-- 基本信息 -->
    <div class="space-y-2.5">
      <h4 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {{ t("common.basicInfo") }}
      </h4>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div class="space-y-1">
          <Label>{{ t("common.type") }}</Label>
          <Input v-model="clientConfig.type" disabled />
        </div>
        <div class="space-y-1">
          <Label for="backup-server-name">{{ t("SetDownloader.common.name") }}</Label>
          <Input id="backup-server-name" v-model="clientConfig.name" :placeholder="t('SetDownloader.common.name')" />
          <p v-if="!formValid" class="text-[11px] text-destructive">
            {{ t("SetDownloader.editor.nameTip") }}
          </p>
        </div>
        <div class="space-y-1">
          <Label>{{ t("SetDownloader.common.uid") }}{{ t("SetDownloader.editor.uidPlaceholder") }}</Label>
          <Input v-model="clientConfig.id" disabled class="font-mono text-xs" />
        </div>
      </div>
    </div>

    <Separator />

    <!-- 服务器配置 -->
    <div class="space-y-3">
      <h4 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {{ t("SetBackup.Editor.serverConfig") }}
      </h4>

      <div v-for="metaField in clientMeta.requiredField" :key="metaField.key" class="space-y-1">
        <template v-if="metaField.type === 'strings'">
          <Label>{{ metaField.name }}</Label>
          <Textarea
            :model-value="String(clientConfig.config[metaField.key! as string] ?? '')"
            :rows="3"
            @update:model-value="(v) => (clientConfig!.config[metaField.key! as string] = v)"
          />
          <p v-if="metaField.description" class="text-xs text-muted-foreground">{{ metaField.description }}</p>
        </template>

        <template v-else-if="metaField.type === 'string'">
          <Label>{{ metaField.name }}</Label>
          <Input
            :model-value="String(clientConfig.config[metaField.key! as string] ?? '')"
            @update:model-value="(v) => (clientConfig!.config[metaField.key! as string] = String(v))"
          />
          <p v-if="metaField.description" class="text-xs text-muted-foreground">{{ metaField.description }}</p>
        </template>

        <template v-else-if="metaField.type === 'boolean'">
          <label
            class="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-muted/25 px-3 py-2.5"
          >
            <div class="space-y-0.5">
              <div class="text-xs font-medium text-foreground">{{ metaField.name }}</div>
              <div v-if="metaField.description" class="text-xs text-muted-foreground">{{ metaField.description }}</div>
            </div>
            <Switch
              :model-value="Boolean(clientConfig.config[metaField.key! as string])"
              @update:model-value="(v) => (clientConfig!.config[metaField.key! as string] = v)"
            />
          </label>
        </template>
      </div>
    </div>

    <Separator />

    <!-- 备份配置 -->
    <div class="space-y-4">
      <h4 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {{ t("SetBackup.Editor.backupConfig") }}
      </h4>

      <!-- 备份内容 -->
      <div class="space-y-2">
        <Label>{{ t("SetBackup.Editor.backupFields") }}</Label>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label
            v-for="field in BackupFields"
            :key="field"
            class="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border bg-muted/25 px-3 py-2 text-xs font-medium text-foreground"
          >
            <span class="truncate">{{ t(`SetBackup.fields.${field}`) }}</span>
            <Switch
              :model-value="(clientConfig.backupFields ?? []).includes(field)"
              @update:model-value="(v) => toggleBackupField(field, v)"
            />
          </label>
        </div>
      </div>

      <!-- 自动备份间隔 -->
      <div class="space-y-1.5">
        <Label for="backup-interval">{{ t("SetBackup.Editor.backupInterval") }}</Label>
        <div class="flex max-w-xs items-center gap-2">
          <Input
            id="backup-interval"
            v-model.number="clientConfig.backupInterval"
            type="number"
            :min="0"
            :placeholder="t('SetBackup.Editor.backupIntervalField')"
            class="tabular-nums"
          />
          <span class="shrink-0 text-xs font-medium text-muted-foreground">h</span>
        </div>
        <p class="text-xs text-muted-foreground">{{ t("SetBackup.Editor.backupIntervalHint") }}</p>
      </div>

      <!-- 备份保留策略 -->
      <div class="space-y-2.5 rounded-lg border border-border bg-muted/20 p-3.5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs font-semibold text-foreground">{{ t("SetBackup.Editor.retention") }}</span>
            <Badge v-if="hasRetention" variant="success">{{ retentionSummary }}</Badge>
          </div>
          <Tooltip v-if="hasRetention" :content="t('SetBackup.Editor.clearRetention')" side="top">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              class="text-destructive hover:bg-destructive/10 hover:text-destructive"
              @click="clearRetention"
            >
              <FilterX class="size-3.5" />
            </Button>
          </Tooltip>
        </div>

        <p class="text-xs text-muted-foreground">{{ t("SetBackup.RetentionDialog.tip") }}</p>

        <div class="space-y-3 pt-1">
          <!-- 按时间期限 -->
          <div class="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
            <label class="flex cursor-pointer items-center gap-2.5 text-xs font-medium text-foreground">
              <Switch v-model="retentionDraft.time!.enabled" />
              <span>{{ t("SetBackup.RetentionDialog.time.title") }}</span>
            </label>
            <div class="flex items-center gap-2">
              <Input
                v-model.number="retentionDraft.time!.maxAge"
                :disabled="!retentionDraft.time!.enabled"
                :min="1"
                type="number"
                class="w-28 tabular-nums"
              />
              <span class="text-xs text-muted-foreground">{{ t("SetBackup.RetentionDialog.daySuffix") }}</span>
            </div>
          </div>

          <!-- 按数量 -->
          <div class="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
            <label class="flex cursor-pointer items-center gap-2.5 text-xs font-medium text-foreground">
              <Switch v-model="retentionDraft.count!.enabled" />
              <span>{{ t("SetBackup.RetentionDialog.count.title") }}</span>
            </label>
            <div class="flex items-center gap-2">
              <Input
                v-model.number="retentionDraft.count!.maxCount"
                :disabled="!retentionDraft.count!.enabled"
                :min="1"
                type="number"
                class="w-28 tabular-nums"
              />
              <span class="text-xs text-muted-foreground">{{ t("SetBackup.RetentionDialog.countSuffix") }}</span>
            </div>
          </div>

          <!-- 按时间窗口采样 -->
          <div class="space-y-2.5 border-t border-border/60 pt-3">
            <label class="flex cursor-pointer items-center gap-2.5 text-xs font-medium text-foreground">
              <Switch v-model="retentionDraft.sample!.enabled" />
              <span>{{ t("SetBackup.RetentionDialog.sample.title") }}</span>
            </label>
            <p class="text-xs text-muted-foreground">{{ t("SetBackup.RetentionDialog.sample.hint") }}</p>

            <div class="space-y-2" :class="{ 'pointer-events-none opacity-55': !retentionDraft.sample!.enabled }">
              <div class="grid grid-cols-12 items-center gap-2 text-[11px] font-medium text-muted-foreground">
                <div class="col-span-3" />
                <div class="col-span-4">{{ t("SetBackup.RetentionDialog.sample.horizon") }}</div>
                <div class="col-span-5">{{ t("SetBackup.RetentionDialog.sample.interval") }}</div>
              </div>
              <div
                v-for="[type, rule] in retentionSampleRules"
                :key="type"
                class="grid grid-cols-12 items-center gap-2"
              >
                <div class="col-span-3 text-xs font-medium text-foreground">
                  {{ t(`SetBackup.RetentionDialog.sample.type.${type}`) }}
                </div>
                <div class="col-span-4">
                  <Input
                    v-model.number="rule.horizon"
                    :disabled="!retentionDraft.sample!.enabled"
                    :min="0"
                    type="number"
                    class="tabular-nums"
                  />
                </div>
                <div class="col-span-5 flex items-center gap-1.5">
                  <Input
                    v-model.number="rule.interval"
                    :disabled="!retentionDraft.sample!.enabled"
                    :min="0"
                    type="number"
                    class="tabular-nums"
                  />
                  <span class="shrink-0 text-xs text-muted-foreground">
                    {{ t("SetBackup.RetentionDialog.daySuffix") }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ConnectCheckButton
      :check-fn="checkConnect"
      :reset-timeout="3000"
      @after:check-connect="() => emits('update:configValid', formValid && true)"
    />
  </div>
</template>
