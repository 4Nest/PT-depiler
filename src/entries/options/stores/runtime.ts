import { defineStore } from "pinia";
import { toast } from "vue-sonner";
import type { IRuntimePiniaStorageSchema, ISearchData, SnackbarMessageOptions } from "@/shared/types.ts";

const initialSearchData: () => ISearchData = () => ({
  isSearching: false,
  startAt: 0,
  endAt: 0,
  searchKey: "",
  searchPlanKey: "default",
  searchPlan: {},
  searchResult: [],
});

export const useRuntimeStore = defineStore("runtime", {
  persist: {
    storage: sessionStorage,
    key: "__ptd_runtime_store",
  },
  persistWebExt: false,
  state: (): IRuntimePiniaStorageSchema => ({
    search: initialSearchData(),
    userInfo: {
      flushPlan: {},
    },
    uiGlobalSnackbar: [],
  }),

  getters: {
    searchCostTime(state) {
      const plans = Object.values(state.search.searchPlan).filter((plan) => plan.startAt);

      if (plans.length === 0) {
        return 0;
      }

      const now = Date.now();
      const startTimes = plans.map((plan) => plan.startAt!);
      const endTimes = plans.map((plan) => plan.endAt || (plan.costTime ? plan.startAt! + plan.costTime : now));

      const earliestStart = Math.min(...startTimes);
      const latestEnd = Math.max(...endTimes);

      return latestEnd - earliestStart;
    },

    isUserInfoFlush(state) {
      return Object.values(state.userInfo.flushPlan).some((v) => v);
    },
  },

  actions: {
    resetSearchData() {
      this.search = initialSearchData();
    },

    showSnackbar(text: string, options: SnackbarMessageOptions = {}) {
      const duration = typeof options.timeout === "number" && options.timeout > 0 ? options.timeout : 3500;
      const color = options.color ?? "info";
      if (color === "success" || color === "green") {
        toast.success(text, { duration });
      } else if (color === "error" || color === "red" || color === "destructive") {
        toast.error(text, { duration });
      } else if (color === "warning" || color === "amber" || color === "orange") {
        toast.warning(text, { duration });
      } else {
        toast.info(text, { duration });
      }
    },
  },
});
