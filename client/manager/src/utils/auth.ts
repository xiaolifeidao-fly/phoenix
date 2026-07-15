"use client";

const AUTH_TOKEN_KEY = "phoenix_manager_token";
const AUTH_USER_KEY = "phoenix_manager_user";

export interface AuthUser {
  username: string;
  displayName?: string;
  roleName?: string;
}

function canUseBrowserStorage() {
  return typeof window !== "undefined";
}

export function getAuthToken() {
  if (!canUseBrowserStorage()) {
    return "";
  }
  return window.localStorage.getItem(AUTH_TOKEN_KEY) || window.sessionStorage.getItem(AUTH_TOKEN_KEY) || "";
}

export function setAuthToken(token: string, remember = true) {
  if (!canUseBrowserStorage()) {
    return;
  }
  clearAuthToken();
  const storage = remember ? window.localStorage : window.sessionStorage;
  storage.setItem(AUTH_TOKEN_KEY, token);
}

export function setAuthSession(token: string, user: AuthUser, remember = true) {
  if (!canUseBrowserStorage()) {
    return;
  }
  clearAuthToken();
  const storage = remember ? window.localStorage : window.sessionStorage;
  storage.setItem(AUTH_TOKEN_KEY, token);
  storage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export function getAuthUser(): AuthUser | null {
  if (!canUseBrowserStorage()) {
    return null;
  }

  const rawUser = window.localStorage.getItem(AUTH_USER_KEY) || window.sessionStorage.getItem(AUTH_USER_KEY);
  if (!rawUser) {
    return null;
  }

  try {
    const user = JSON.parse(rawUser) as Partial<AuthUser>;
    const username = user.username?.trim();
    if (!username) {
      return null;
    }

    return {
      username,
      displayName: user.displayName?.trim() || undefined,
      roleName: user.roleName?.trim() || undefined,
    };
  } catch {
    return null;
  }
}

export function clearAuthToken() {
  if (!canUseBrowserStorage()) {
    return;
  }
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_USER_KEY);
  window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
  window.sessionStorage.removeItem(AUTH_USER_KEY);
}

export function isAuthenticated() {
  return getAuthToken().trim().length > 0;
}
