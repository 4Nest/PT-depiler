/**
 * 存放一些不需要持久化（丢失没有关系的）的结构性数据，包括：
 * 1. 站点 favicon 缓存
 */

import type { DBSchema } from "idb";
import type { TSiteID as TSiteKey } from "@ptd/site";

export interface IPtdDBSchema extends DBSchema {
  favicon: {
    key: TSiteKey;
    value: string;
  };
}
