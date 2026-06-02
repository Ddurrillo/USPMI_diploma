export type UserRole = "admin" | "director" | "technologist" | "operator" | "user" | "guest";

export interface AuthUser {
  username: string;
  role: UserRole;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const TOKEN_KEY = "authToken";
const USER_KEY = "user";

function decodeJwtPayload(token: string): Record<string, unknown> {
  const [, payload] = token.split(".");
  if (!payload) return {};
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const json = decodeURIComponent(
    atob(normalized)
      .split("")
      .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
      .join(""),
  );
  return JSON.parse(json);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getCurrentUser(): AuthUser | null {
  const rawUser = localStorage.getItem(USER_KEY);
  if (rawUser) {
    try {
      return JSON.parse(rawUser) as AuthUser;
    } catch {
      localStorage.removeItem(USER_KEY);
    }
  }

  const token = getToken();
  if (!token) return null;

  try {
    const payload = decodeJwtPayload(token);
    const user = {
      username: String(payload.Username ?? payload.username ?? ""),
      role: String(payload.Role ?? payload.role ?? "operator") as UserRole,
    };
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  } catch {
    clearSession();
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function login(username: string, password: string): Promise<AuthUser> {
  const response = await fetch(`${API_BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Username: username, Password: password }),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  const data = (await response.json()) as { token: string };
  localStorage.setItem(TOKEN_KEY, data.token);

  const payload = decodeJwtPayload(data.token);
  const user = {
    username: String(payload.Username ?? username),
    role: String(payload.Role ?? "operator") as UserRole,
  };
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);

  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (response.status === 401) {
    clearSession();
    window.location.assign("/login");
    throw new Error("Session expired");
  }
  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }
  if (response.status === 204) return undefined as T;

  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export function buildWsUrl(path: string): string {
  const token = getToken();
  const base = API_BASE || window.location.origin;
  const url = new URL(path, base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  if (token) url.searchParams.set("token", token);
  return url.toString();
}

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json();
    return String(data.error ?? data.message ?? response.statusText);
  } catch {
    return response.statusText || "Request failed";
  }
}
