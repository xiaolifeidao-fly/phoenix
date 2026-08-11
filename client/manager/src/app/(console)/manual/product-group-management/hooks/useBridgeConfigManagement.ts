"use client";

import { useCallback, useEffect, useState } from "react";
import {
  activateBridgeConfig,
  createBridgeConfig,
  deleteBridgeConfig,
  disableBridgeConfig,
  fetchBridgeConfigs,
  resetBridgeConfigStatistics,
  updateBridgeConfig,
  type BridgeConfigPayload,
  type BridgeConfigRecord,
} from "../api/product-group.api";

export function useBridgeConfigManagement(shopGroupId: number | null) {
  const [configs, setConfigs] = useState<BridgeConfigRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    if (!shopGroupId) {
      setConfigs([]);
      return;
    }
    setLoading(true);
    try {
      setConfigs(await fetchBridgeConfigs(shopGroupId));
    } finally {
      setLoading(false);
    }
  }, [shopGroupId]);

  const execute = useCallback(
    async (action: (groupId: number) => Promise<unknown>) => {
      if (!shopGroupId) {
        throw new Error("请先选择商品分组");
      }
      setSubmitting(true);
      try {
        await action(shopGroupId);
        await refresh();
      } finally {
        setSubmitting(false);
      }
    },
    [refresh, shopGroupId],
  );

  const save = useCallback(
    async (bridgeConfigId: number | null, payload: BridgeConfigPayload) => {
      await execute((groupId) =>
        bridgeConfigId === null
          ? createBridgeConfig(groupId, payload)
          : updateBridgeConfig(groupId, bridgeConfigId, payload),
      );
    },
    [execute],
  );

  const remove = useCallback(
    async (bridgeConfigId: number) => execute((groupId) => deleteBridgeConfig(groupId, bridgeConfigId)),
    [execute],
  );

  const setActive = useCallback(
    async (bridgeConfigId: number, active: boolean) =>
      execute((groupId) =>
        active ? activateBridgeConfig(groupId, bridgeConfigId) : disableBridgeConfig(groupId, bridgeConfigId),
      ),
    [execute],
  );

  const resetStatistics = useCallback(
    async (bridgeConfigId: number) => execute((groupId) => resetBridgeConfigStatistics(groupId, bridgeConfigId)),
    [execute],
  );

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);

  return { configs, loading, submitting, refresh, save, remove, setActive, resetStatistics };
}
