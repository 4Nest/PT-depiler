<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { EResultParseStatus } from "@ptd/site";
import { AlertCircle, CheckCircle2, HelpCircle, KeyRound, Loader2, SearchX, UserX } from "lucide-vue-next";
import { Badge } from "~/components/ui";

const { status } = defineProps<{
  status: EResultParseStatus;
}>();

const { t } = useI18n();
</script>

<template>
  <Badge v-if="status === EResultParseStatus.waiting" variant="info">
    <Loader2 class="size-3 animate-spin" />
    {{ t("resultParseStatus.waiting") }}
  </Badge>
  <Badge v-else-if="status === EResultParseStatus.working" variant="info">
    <Loader2 class="size-3 animate-spin" />
    {{ t("resultParseStatus.working") }}
  </Badge>
  <Badge v-else-if="status === EResultParseStatus.success" variant="success">
    <CheckCircle2 class="size-3" />
    {{ t("resultParseStatus.success") }}
  </Badge>
  <Badge v-else-if="status === EResultParseStatus.parseError" variant="destructive">
    <AlertCircle class="size-3" />
    {{ t("resultParseStatus.parseError") }}
  </Badge>
  <Badge v-else-if="status === EResultParseStatus.passParse" variant="secondary">
    {{ t("resultParseStatus.passParse") }}
  </Badge>
  <Badge v-else-if="status === EResultParseStatus.CFBlocked" variant="warning">
    <AlertCircle class="size-3" />
    {{ t("resultParseStatus.CFBlocked") }}
  </Badge>
  <Badge v-else-if="status === EResultParseStatus.needLogin" variant="destructive">
    <KeyRound class="size-3" />
    {{ t("resultParseStatus.needLogin") }}
  </Badge>
  <Badge v-else-if="status === EResultParseStatus.noResults" variant="outline">
    <SearchX class="size-3" />
    {{ t("resultParseStatus.noResults") }}
  </Badge>
  <Badge v-else-if="status === EResultParseStatus.noUserInput" variant="warning">
    <UserX class="size-3" />
    {{ t("resultParseStatus.noUserInput") }}
  </Badge>
  <Badge v-else variant="secondary">
    <HelpCircle class="size-3" />
    {{ t("resultParseStatus.unknownError") }}
  </Badge>
</template>
