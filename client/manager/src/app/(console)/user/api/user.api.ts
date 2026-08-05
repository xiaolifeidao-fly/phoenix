"use client";

import { getData, getPage, instance, unwrapApiResponse, type ApiResponse } from "@/utils/axios";

export class UserRecord {
  id!: number;

  name = "";

  username = "";

  email = "";

  phone = "";

  department = "";

  role = "member";

  status = "active";

  remark = "";

  tineUserId = "";

  tineNickname = "";

  tineBalance?: number;

  tineCurrency = "CNY";

  password = "";

  originPassword = "";

  secretKey = "";

  pubToken = "";

  banCount = 0;

  accountId?: number;

  accountStatus = "";

  balanceAmount = "0";

  tenantUserId?: number;

  tenantId?: number;

  tenantName = "";

  roles: UserRoleBinding[] = [];

  tenants: UserTenantBinding[] = [];

  lastLoginTime?: string;

  updatedTime?: string;

  createdTime?: string;
}

export class UserStats {
  visibleUsers = 0;

  accountCount = 0;

  privilegedUsers = 0;

  recentLoginUsers = 0;

  activeUsers = 0;
}

export interface UserListQuery extends Record<string, string | number | undefined> {
  pageIndex?: number;
  pageSize?: number;
  search?: string;
  role?: string;
  status?: string;
}

export interface UserPayload {
  name: string;
  username: string;
  email?: string;
  phone?: string;
  department?: string;
  role: string;
  status: string;
  remark?: string;
  tineUserId?: string;
  tineNickname?: string;
  tineBalance?: number;
  tineCurrency?: string;
  password?: string;
  originPassword?: string;
  secretKey?: string;
  pubToken?: string;
  banCount?: number;
}

export async function fetchUsers(query: UserListQuery) {
  return getPage(UserRecord, "/users", {
    pageIndex: query.pageIndex,
    pageSize: query.pageSize,
    search: query.search,
    role: query.role,
    status: query.status,
  });
}

export async function fetchUserStats() {
  return getData(UserStats, "/users/stats");
}

export async function fetchUserDetail(id: number) {
  return getData(UserRecord, `/users/${id}`);
}

export async function createUser(payload: UserPayload) {
  const response = await instance.post<ApiResponse<UserRecord>>("/users", payload);
  return unwrapApiResponse(response.data);
}

export async function updateUser(id: number, payload: Partial<UserPayload>) {
  const response = await instance.put<ApiResponse<UserRecord>>(`/users/${id}`, payload);
  return unwrapApiResponse(response.data);
}

export async function deleteUser(id: number) {
  const response = await instance.delete<ApiResponse<{ deleted: boolean }>>(`/users/${id}`);
  return unwrapApiResponse(response.data);
}

export class TenantOption {
  id!: number;

  name = "";

  code = "";
}

export class RoleOption {
  id!: number;

  name = "";

  code = "";
}

export interface UserRoleBinding {
  id: number;
  roleId: number;
  roleName: string;
  roleCode: string;
}

export interface UserTenantBinding {
  id: number;
  tenantId: number;
  tenantName: string;
}

export interface TenantUserPayload {
  userId: number;
  tenantId: number;
}

export interface AccountPayload {
  userId: number;
  accountStatus?: string;
  balanceAmount?: string;
}

export class AccountRechargeDetail {
  id!: number;

  accountId!: number;

  amount = "0";

  balanceAmount = "0";

  operator = "";

  type = "";

  description = "";

  businessId = "";

  createdTime = "";
}

export async function fetchTenantOptions() {
  return getPage(TenantOption, "/tenants", { pageIndex: 1, pageSize: 200 });
}

export async function fetchRoleOptions() {
  return getPage(RoleOption, "/roles", { pageIndex: 1, pageSize: 1000 });
}

export async function saveUserRoleBindings(userId: number, roleIds: number[]) {
  const response = await instance.put<ApiResponse<UserRoleBinding[]>>(`/users/${userId}/roles`, { roleIds });
  return unwrapApiResponse(response.data);
}

export async function saveUserTenantBindings(userId: number, tenantIds: number[]) {
  const response = await instance.put<ApiResponse<UserTenantBinding[]>>(`/users/${userId}/tenants`, { tenantIds });
  return unwrapApiResponse(response.data);
}

export async function createTenantUser(payload: TenantUserPayload) {
  const response = await instance.post<ApiResponse<{ id: number }>>("/tenant-users", payload);
  return unwrapApiResponse(response.data);
}

export async function updateTenantUser(id: number, payload: Partial<TenantUserPayload>) {
  const response = await instance.put<ApiResponse<{ id: number }>>(`/tenant-users/${id}`, payload);
  return unwrapApiResponse(response.data);
}

export async function deleteTenantUser(id: number) {
  const response = await instance.delete<ApiResponse<{ deleted: boolean }>>(`/tenant-users/${id}`);
  return unwrapApiResponse(response.data);
}

export async function createAccount(payload: AccountPayload) {
  const response = await instance.post<ApiResponse<{ id: number }>>("/accounts", payload);
  return unwrapApiResponse(response.data);
}

export async function updateAccount(id: number, payload: Partial<AccountPayload>) {
  const response = await instance.put<ApiResponse<{ id: number }>>(`/accounts/${id}`, payload);
  return unwrapApiResponse(response.data);
}

export async function rechargeAccount(accountId: number, amount: number, givenScale: number) {
  const response = await instance.post<ApiResponse<{ message: string }>>(
    `/accounts/${accountId}/recharge`,
    { amount, givenScale },
  );
  return unwrapApiResponse(response.data);
}

export async function fetchAccountRechargeDetails(accountId: number, pageIndex: number, pageSize: number) {
  return getPage(AccountRechargeDetail, "/account-details", {
    accountId,
    type: "PAY,GIVEN",
    pageIndex,
    pageSize,
  });
}
