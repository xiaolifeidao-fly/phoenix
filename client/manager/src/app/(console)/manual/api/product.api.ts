"use client";

import { getDataList, instance, unwrapApiResponse, type ApiResponse } from "@/utils/axios";

export class ManualProductTypeRecord {
  id = 0;

  name = "";

  code = "";

  shopGroupId = 0;

  status = "";
}

export class ManualProductRecord {
  id = 0;

  name = "";

  code = "";

  score = 0;

  status = "";

  shopGroupId = 0;

  shopTypeModelList: ManualProductTypeRecord[] = [];

  createdTime?: string;

  updatedTime?: string;
}

export interface ManualProductListQuery {
  pageIndex?: number;
  pageSize?: number;
  code?: string;
  name?: string;
  status?: string;
  shopGroupId?: number;
  shopTypeCode?: string;
}

export interface ManualProductPayload {
  shopGroupId: number;
  name: string;
  code: string;
  score: number;
  status?: string;
  shopTypeCodeList?: string[];
}

export async function fetchManualProductTypes() {
  return getDataList(ManualProductTypeRecord, "/barry/product-types", {
    pageIndex: 1,
    pageSize: 500,
  });
}

export async function fetchManualProducts(query?: ManualProductListQuery) {
  return getDataList(ManualProductRecord, "/barry/product-categories", {
    pageIndex: 1,
    pageSize: 500,
    ...query,
  } as Record<string, string | number | undefined>);
}

export async function createManualProduct(payload: ManualProductPayload) {
  const response = await instance.post<ApiResponse<ManualProductRecord | null>>("/barry/product-categories", payload);
  return unwrapApiResponse(response.data);
}

export async function updateManualProduct(id: number, payload: ManualProductPayload) {
  const response = await instance.put<ApiResponse<ManualProductRecord | null>>(`/barry/product-categories/${id}`, payload);
  return unwrapApiResponse(response.data);
}

export async function deleteManualProduct(id: number) {
  const response = await instance.delete<ApiResponse<ManualProductRecord | null>>(`/barry/product-categories/${id}`);
  return unwrapApiResponse(response.data);
}

export async function expireManualProduct(id: number) {
  const response = await instance.put<ApiResponse<ManualProductRecord | null>>(`/barry/product-categories/${id}/expire`);
  return unwrapApiResponse(response.data);
}

export async function activateManualProduct(id: number) {
  const response = await instance.put<ApiResponse<ManualProductRecord | null>>(`/barry/product-categories/${id}/active`);
  return unwrapApiResponse(response.data);
}
