<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { CheckCircle2, Loader2, Radio, XCircle } from "lucide-vue-next";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui";

const { checkFn, resetTimeout = 3500 } = defineProps<{
  checkFn: () => Promise<boolean>;
  resetTimeout?: number;
}>();

const emits = defineEmits<{
  (e: "after:checkConnect", status: boolean): void;
}>();

const { t } = useI18n();

type ConnectState = "default" | "testing" | "success" | "error";
const state = ref<ConnectState>("default");
let resetTimer: ReturnType<typeof setTimeout> | null = null;

const buttonLabel = computed(() => {
  if (state.value === "success") return t("connectCheck.success");
  if (state.value === "error") return t("connectCheck.error");
  return t("connectCheck.default");
});

async function runCheck() {
  if (state.value === "testing") return;
  if (resetTimer) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }
  state.value = "testing";
  let ok = false;
  try {
    ok = Boolean(await checkFn());
    state.value = ok ? "success" : "error";
  } catch {
    ok = false;
    state.value = "error";
  } finally {
    emits("after:checkConnect", ok);
    if (resetTimeout > 0) {
      resetTimer = setTimeout(() => {
        if (state.value !== "testing") state.value = "default";
      }, resetTimeout);
    }
  }
}
</script>

<template>
  <Button
    type="button"
    variant="outline"
    :disabled="state === 'testing'"
    :class="
      cn(
        'w-full transition-colors',
        state === 'success' && 'border-success/45 bg-success/12 text-success hover:bg-success/18 hover:text-success',
        state === 'error' &&
          'border-destructive/45 bg-destructive/12 text-destructive hover:bg-destructive/18 hover:text-destructive',
      )
    "
    @click="runCheck"
  >
    <Loader2 v-if="state === 'testing'" class="size-4 shrink-0 animate-spin text-primary" />
    <CheckCircle2 v-else-if="state === 'success'" class="size-4 shrink-0" />
    <XCircle v-else-if="state === 'error'" class="size-4 shrink-0" />
    <Radio v-else class="size-4 shrink-0 text-primary" />
    <span class="truncate">{{ buttonLabel }}</span>
  </Button>
</template>
