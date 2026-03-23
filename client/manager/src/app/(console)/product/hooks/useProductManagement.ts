"use client";

import { useEffect, useState } from "react";
import {
  createProduct,
  deleteProduct,
  fetchProducts,
  updateProduct,
  type ShopListQuery,
  type ShopPayload,
  type ShopRecord,
} from "../api/product.api";

const PRODUCT_MANAGEMENT_CACHE_KEY = "phoenix_manager_product_management_cache_v1";

const defaultQuery: Required<ShopListQuery> = {
  pageIndex: 1,
  pageSize: 10,
  code: "",
  name: "",
};

interface ProductManagementCache {
  products: ShopRecord[];
  total: number;
  query: Required<ShopListQuery>;
}

export function useProductManagement() {
  const [products, setProducts] = useState<ShopRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState<Required<ShopListQuery>>(defaultQuery);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const refresh = async (nextQuery?: Partial<ShopListQuery>) => {
    const mergedQuery = { ...query, ...nextQuery };
    setLoading(true);
    try {
      const result = await fetchProducts(mergedQuery);
      setProducts(result.data);
      setTotal(result.total);
      setQuery(mergedQuery);
      if (typeof window !== "undefined") {
        const payload: ProductManagementCache = {
          products: result.data,
          total: result.total,
          query: mergedQuery,
        };
        window.sessionStorage.setItem(PRODUCT_MANAGEMENT_CACHE_KEY, JSON.stringify(payload));
      }
    } finally {
      setLoading(false);
    }
  };

  const saveProduct = async (id: number | null, payload: ShopPayload) => {
    setSubmitting(true);
    try {
      if (id === null) {
        await createProduct(payload);
      } else {
        await updateProduct(id, payload);
      }
      await refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const removeProduct = async (id: number) => {
    setSubmitting(true);
    try {
      await deleteProduct(id);
      const nextPage =
        products.length === 1 && query.pageIndex > 1 ? query.pageIndex - 1 : query.pageIndex;
      await refresh({ pageIndex: nextPage });
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      void refresh();
      return;
    }

    try {
      const rawValue = window.sessionStorage.getItem(PRODUCT_MANAGEMENT_CACHE_KEY);
      if (rawValue) {
        const parsed = JSON.parse(rawValue) as ProductManagementCache;
        setProducts(parsed.products ?? []);
        setTotal(parsed.total ?? 0);
        setQuery(parsed.query ?? defaultQuery);
        return;
      }
    } catch {
      window.sessionStorage.removeItem(PRODUCT_MANAGEMENT_CACHE_KEY);
    }

    void refresh();
  }, []);

  return {
    products,
    total,
    query,
    loading,
    submitting,
    refresh,
    saveProduct,
    removeProduct,
  };
}
