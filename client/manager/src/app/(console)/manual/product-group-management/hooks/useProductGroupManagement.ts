"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchShopGroups, type ShopGroupRecord } from "../api/product-group.api";

export function useProductGroupManagement() {
  const [groups, setGroups] = useState<ShopGroupRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setGroups(await fetchShopGroups());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);

  return { groups, loading, refresh };
}
