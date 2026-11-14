import { sendMessage } from "@/messages.ts";
import type {
  IMoviePilotConfig,
  IMoviePilotHttpRequestOptions,
  IMoviePilotHttpResponse,
} from "@/shared/types/storages/config.ts";
// @ts-ignore
import { openMpConfigModal, startMpEngine, stopMpEngine, syncMpEngineConfig } from "./engine.js";

const bridge = {
  httpRequest(options: IMoviePilotHttpRequestOptions): Promise<IMoviePilotHttpResponse> {
    return sendMessage("moviePilotHttpRequest", options);
  },
  saveConfigPatch(patch: Partial<IMoviePilotConfig>): Promise<IMoviePilotConfig> {
    return sendMessage("updateMoviePilotConfig", patch);
  },
  mteamHookUrl: chrome.runtime.getURL("js/mp-mteam-hook.js"),
};

let engineMounted = false;

export function mountOrUpdateMoviePilot(config: Partial<IMoviePilotConfig> = {}) {
  if (!engineMounted) {
    engineMounted = true;
    startMpEngine(bridge, config);
  } else {
    syncMpEngineConfig(config);
  }
}

export function unmountMoviePilot() {
  engineMounted = false;
  stopMpEngine();
}

export function openMoviePilotModal() {
  openMpConfigModal();
}
