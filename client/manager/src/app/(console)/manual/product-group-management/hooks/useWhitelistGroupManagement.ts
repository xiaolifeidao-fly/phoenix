"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { message } from "@/utils/notify";
import {
  createWhitelistGroup,
  deleteWhitelistGroup,
  fetchWhitelistGroups,
  updateWhitelistGroup,
  type WhitelistGroupPayload,
  type WhitelistGroupRecord,
} from "../api/product-group.api";

export function useWhitelistGroupManagement(shopGroupId: number | null) {
  const requestSeqRef = useRef(0);
  const [whitelistGroups, setWhitelistGroups] = useState<WhitelistGroupRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    const seq = ++requestSeqRef.current;
    if (!shopGroupId) {
      setWhitelistGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const groups = await fetchWhitelistGroups(shopGroupId);
      if (seq === requestSeqRef.current) setWhitelistGroups(groups);
    } finally {
      if (seq === requestSeqRef.current) setLoading(false);
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
    async (whitelistGroupId: number | null, payload: WhitelistGroupPayload) => {
      await execute((groupId) =>
        whitelistGroupId === null
          ? createWhitelistGroup(groupId, payload)
          : updateWhitelistGroup(groupId, whitelistGroupId, payload),
      );
    },
    [execute],
  );

  const remove = useCallback(
    async (whitelistGroupId: number) => execute((groupId) => deleteWhitelistGroup(groupId, whitelistGroupId)),
    [execute],
  );

  useEffect(() => {
    setWhitelistGroups([]);
    void refresh().catch((error: unknown) => {
      message.error(error instanceof Error ? error.message : "加载白名单分组失败");
    });
    return () => { requestSeqRef.current += 1; };
  }, [refresh]);

  return { whitelistGroups, loading, submitting, refresh, save, remove };
}
