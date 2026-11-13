<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { AlertTriangle, Loader2, Trash2 } from "lucide-vue-next";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui";

type TDeleteId = any;
type ConfirmDeleteFn = (toDeleteId: TDeleteId) => Promise<void> | void;

const showDialog = defineModel<boolean>({ default: false });

const { toDeleteIds, confirmDelete: confirmDeleteFn } = defineProps<{
  toDeleteIds: TDeleteId[];
  confirmDelete: ConfirmDeleteFn;
}>();

const emits = defineEmits<{
  (e: "allDelete"): void;
}>();

const { t } = useI18n();
const isDeleting = ref(false);

async function handleConfirm() {
  isDeleting.value = true;
  try {
    await Promise.allSettled(toDeleteIds.map((id) => confirmDeleteFn(id)));
    showDialog.value = false;
    emits("allDelete");
  } finally {
    isDeleting.value = false;
  }
}
</script>

<template>
  <Dialog v-model="showDialog" @after-open="isDeleting = false">
    <DialogContent class="max-w-md" :prevent-outside-close="isDeleting" :hide-close="isDeleting">
      <DialogHeader>
        <DialogTitle class="text-destructive">
          <AlertTriangle class="size-4 text-destructive" />
          {{ t("common.dialog.title.confirmAction") }}
        </DialogTitle>
        <DialogDescription>
          {{ t("common.dialog.deleteText", [toDeleteIds.length]) }}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" :disabled="isDeleting" @click="showDialog = false">
          {{ t("common.dialog.cancel") }}
        </Button>
        <Button variant="destructive" :disabled="isDeleting" @click="handleConfirm">
          <Loader2 v-if="isDeleting" class="size-4 animate-spin" />
          <Trash2 v-else class="size-4" />
          {{ t("common.dialog.ok") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
