// All paths are relative — Vite proxies /api/* to the backend in dev,
// and the production server should be configured to do the same.

import { getToken } from "./auth";

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (Array.isArray(data?.detail)) {
      throw new Error(data.detail.map((d: any) => d.msg).join(", "));
    }
    throw new Error(data?.detail ?? `Request failed (${res.status})`);
  }
  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface UserPublicResponse {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  role: string;
  email?: string;
  permissions?: any;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface UserCreate {
  username: string;
  first_name: string;
  last_name: string;
  password?: string;
}

export interface UserUpdate {
  email?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  permissions?: string[];
  is_active?: boolean;
}

// ── Auth ───────────────────────────────────────────────────────────────────

export async function login(username: string, password: string) {
  const body = new URLSearchParams({ username, password });
  const res = await fetch(`/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return handleResponse<{ access_token: string; token_type: string }>(res);
}

// ── Users ──────────────────────────────────────────────────────────────────

export async function getUsers(): Promise<UserPublicResponse[]> {
  const res = await fetch(`/api/v1/users/list`, {
    headers: { ...authHeaders() },
  });
  return handleResponse<UserPublicResponse[]>(res);
}

export async function createUser(data: UserCreate): Promise<void> {
  const res = await fetch(`/api/v1/users/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  return handleResponse<void>(res);
}

export async function updateUser(userId: string, data: UserUpdate): Promise<void> {
  const res = await fetch(`/api/v1/users/update?user_id=${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  return handleResponse<void>(res);
}

export async function deleteUser(userId: string): Promise<void> {
  const res = await fetch(`/api/v1/users/delete?user_id=${userId}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  return handleResponse<void>(res);
}

// ── Dashboards ─────────────────────────────────────────────────────────────

export interface DashboardPublicResponse {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  config_file: string;
}

export interface DashboardCreate {
  name: string;
  description: string;
}

export interface DashboardUpdate {
  name?: string;
  description?: string;
  config_file?: string;
}

export async function getDashboards(): Promise<DashboardPublicResponse[]> {
  const res = await fetch(`/api/v1/dashboards/list`, {
    headers: { ...authHeaders() },
  });
  return handleResponse<DashboardPublicResponse[]>(res);
}

export async function createDashboard(data: DashboardCreate): Promise<void> {
  const res = await fetch(`/api/v1/dashboards/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  return handleResponse<void>(res);
}

export async function updateDashboard(dashboardId: string, data: DashboardUpdate): Promise<void> {
  const res = await fetch(`/api/v1/dashboards/update?dashboard_id=${dashboardId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  return handleResponse<void>(res);
}

export async function deleteDashboard(dashboardId: string): Promise<void> {
  const res = await fetch(`/api/v1/dashboards/delete?dashboard_id=${dashboardId}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  return handleResponse<void>(res);
}

// ── Packages ───────────────────────────────────────────────────────────────

export interface PackageResponse {
  id: string;
  name: string;
  location: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  is_active: boolean;
}

export async function getPackages(): Promise<PackageResponse[]> {
  const res = await fetch(`/api/v1/packages/list`, {
    headers: { ...authHeaders() },
  });
  return handleResponse<PackageResponse[]>(res);
}

// ── Connections ────────────────────────────────────────────────────────────

export interface ConnectionPublicResponse {
  id: string;
  type: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  is_active: boolean;
}

export interface ConnectionDetailedResponse {
  id: string;
  type: string;
  name: string;
  description?: string;
  host: string;
  port: number;
  database: string;
  username: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

export interface ConnectionCreate {
  name: string;
  type: string;
  description?: string;
  connection_attributes: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  };
}

export interface ConnectionUpdate {
  name?: string;
  description?: string;
  connection_attributes?: {
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
  };
}

export async function getConnections(): Promise<ConnectionPublicResponse[]> {
  const res = await fetch(`/api/v1/connections/list`, {
    headers: { ...authHeaders() },
  });
  return handleResponse<ConnectionPublicResponse[]>(res);
}

export async function getConnection(connectionId: string): Promise<ConnectionDetailedResponse> {
  const res = await fetch(`/api/v1/connections/get?connection_id=${connectionId}`, {
    headers: { ...authHeaders() },
  });
  return handleResponse<ConnectionDetailedResponse>(res);
}

export async function createConnection(data: ConnectionCreate): Promise<void> {
  const res = await fetch(`/api/v1/connections/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  return handleResponse<void>(res);
}

export async function updateConnection(connectionId: string, data: ConnectionUpdate): Promise<ConnectionPublicResponse> {
  const res = await fetch(`/api/v1/connections/update?connection_id=${connectionId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  return handleResponse<ConnectionPublicResponse>(res);
}

export async function deleteConnection(connectionId: string): Promise<void> {
  const res = await fetch(`/api/v1/connections/delete?connection_id=${connectionId}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  return handleResponse<void>(res);
}

export async function testConnection(connectionId: string): Promise<void> {
  const res = await fetch(`/api/v1/connections/test-connection?connection_id=${connectionId}`, {
    headers: { ...authHeaders() },
  });
  return handleResponse<void>(res);
}

// ── Packages ───────────────────────────────────────────────────────────────

export async function createPackage(name: string, description?: string): Promise<void> {
  const body = new FormData();
  body.append("name", name);
  if (description) body.append("description", description);
  const res = await fetch(`/api/v1/packages/create`, {
    method: "POST",
    headers: { ...authHeaders() },
    body,
  });
  return handleResponse<void>(res);
}
