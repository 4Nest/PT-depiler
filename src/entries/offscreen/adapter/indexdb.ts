import { openDB } from "idb";
import { IPtdDBSchema } from "@/shared/types.ts";

export const ptdIndexDb = openDB<IPtdDBSchema>("ptd", 4, {
  upgrade(db) {
    if (!db.objectStoreNames.contains("favicon")) {
      db.createObjectStore("favicon");
    }
    const deprecatedStores = ["social_information", "download_history"] as const;
    const rawDb = db as unknown as {
      objectStoreNames: DOMStringList;
      deleteObjectStore: (name: string) => void;
    };
    for (const storeName of deprecatedStores) {
      if (rawDb.objectStoreNames.contains(storeName)) {
        rawDb.deleteObjectStore(storeName);
      }
    }
  },
});
