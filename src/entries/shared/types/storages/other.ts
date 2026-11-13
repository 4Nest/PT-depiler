/**
 * 本处存放未使用 pinia 管理的其他 chrome.storage.local 使用到的存储结构类型
 */
import type { TSiteID } from "@ptd/site";
import type { IStoredUserInfo } from "./metadata.ts";

export type TUserInfoStorageSchema = Record<TSiteID, Record<string, IStoredUserInfo>>; // 用于存储用户信息
