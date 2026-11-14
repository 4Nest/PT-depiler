import { onMessage } from "@/messages.ts";
import { fixAllStoredUserInfo } from "./utils/fixer.ts";

import "./utils/base.ts";
import "./utils/cookies.ts";
import { resetOffscreenDocument } from "./utils/offscreen.ts";
import "./utils/alarms.ts";
import "./utils/webRequest.ts";

// 监听 点击图标 事件
chrome.action.onClicked.addListener(async () => {
  await chrome.runtime.openOptionsPage();
});

chrome.runtime.onInstalled.addListener(() => {
  console.debug("[PTD] Installed!");

  // 确保扩展升级或重新加载后销毁旧版 Offscreen 进程并加载最新构建脚本
  resetOffscreenDocument().catch(() => {});

  // 修复存储中的坏数据
  fixAllStoredUserInfo().catch();
});

onMessage("ping", async ({ data }) => {
  console.log("ping", data);
  return data ?? "pong";
});
