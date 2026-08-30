// All paths are relative — Vite proxies /api/* to the backend in dev,
// and the production server should be configured to do the same.

import { getToken } from "./auth";
import { SourceInfo, CubeQuery } from "./cubeTypes";

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
  return handleResponse<{
    access_token: string;
    token_type: string;
    user: {
      id: string;
      username: string;
      email: string;
      first_name: string;
      last_name: string;
      account_name: string;
      role: string;
      permissions: string[];
    };
  }>(res);
}

export interface RegisterPayload {
  name: string;
  description: string;
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  examples?: string[];
}

export async function register(payload: RegisterPayload): Promise<{ message: string }> {
  const res = await fetch(`/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse<{ message: string }>(res);
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

// ── Dashboard config (save/load widget layout + data) ─────────────────────

export interface DashboardElementLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export interface DashboardElementMeta {
  title: string;
  query?: string;
  datasetId?: string;
  chartType?: string;
  chartConfig?: Record<string, string>;
  previewValue?: number | null;
  previewRows?: Record<string, unknown>[] | null;
  filterRule?: Record<string, unknown>;
}

export interface DashboardElement {
  id: string;
  layout: DashboardElementLayout;
  meta: DashboardElementMeta;
}

export interface DashboardConfig {
  version: string;
  name: string;
  gridRows?: number;
  backgroundColor?: string;
  elements: DashboardElement[];
}

export async function getDashboardConfig(dashboardId: string): Promise<DashboardConfig> {
  const res = await fetch(`/api/v1/dashboards/config/${dashboardId}`, {
    headers: { ...authHeaders() },
  });
  return handleResponse<DashboardConfig>(res);
}

export async function saveDashboardConfig(dashboardId: string, config: DashboardConfig): Promise<void> {
  const res = await fetch(`/api/v1/dashboards/config/${dashboardId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(config),
  });
  return handleResponse<void>(res);
}

// ── Models ─────────────────────────────────────────────────────────────────

export interface ModelResponse {
  id: string;
  name: string;
  location: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  is_active: boolean;
}

export async function getModels(): Promise<ModelResponse[]> {
  const res = await fetch(`/api/v1/models/list`, {
    headers: { ...authHeaders() },
  });
  return handleResponse<ModelResponse[]>(res);
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
  connection_attributes: Record<string, string | number>;
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

// Raw pass-through — the exact schema/table item shape returned by direct DB
// introspection (plain strings vs. `{name}` objects) isn't pinned down here;
// callers should normalize defensively rather than assume one shape.
export async function getConnectionSchemas(connectionId: string): Promise<unknown[]> {
  const res = await fetch(`/api/v1/connections/schemas?connection_id=${connectionId}`, {
    headers: { ...authHeaders() },
  });
  return handleResponse<unknown[]>(res);
}

export async function getSchemaTables(connectionId: string, schema: string): Promise<unknown[]> {
  const res = await fetch(
    `/api/v1/connections/schemas/tables?connection_id=${connectionId}&schema=${encodeURIComponent(schema)}`,
    { headers: { ...authHeaders() } },
  );
  return handleResponse<unknown[]>(res);
}

// ── Models (files) ───────────────────────────────────────────────────────

export interface DefinitionFile {
  file: string;
  location: string;
  definition_id: string | null;
}

export async function listModelFiles(modelId: string): Promise<DefinitionFile[]> {
  const res = await fetch(`/api/v1/models/list-files?model_id=${modelId}`, {
    headers: { ...authHeaders() },
  });
  return handleResponse<DefinitionFile[]>(res);
}

export async function saveDefinitionFile(definitionId: string, content: string, filename: string): Promise<void> {
  const body = new FormData();
  body.append("definition_id", definitionId);
  body.append("file", new File([content], filename, { type: "text/plain" }));
  const res = await fetch(`/api/v1/definitions/save`, {
    method: "PUT",
    headers: { ...authHeaders() },
    body,
  });
  return handleResponse<void>(res);
}

export async function addDefinition(
  modelId: string,
  name: string,
  content: string,
  filename: string,
  description?: string,
): Promise<void> {
  const body = new FormData();
  body.append("name", name);
  body.append("model_id", modelId);
  if (description) body.append("description", description);
  body.append("file", new File([content], filename, { type: "text/plain" }));
  const res = await fetch(`/api/v1/definitions/add`, {
    method: "POST",
    headers: { ...authHeaders() },
    body,
  });
  return handleResponse<void>(res);
}

export async function loadModel(modelId: string): Promise<void> {
  const res = await fetch(`/api/v1/models/load-model?model_id=${modelId}`, {
    method: "POST",
    headers: { ...authHeaders() },
  });
  return handleResponse<void>(res);
}

export async function getDefinitionFileContent(definitionId: string): Promise<string> {
  const res = await fetch(`/api/v1/definitions/file-content?definition_id=${definitionId}`, {
    headers: { ...authHeaders() },
  });
  // Returns raw text
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.detail ?? `Request failed (${res.status})`);
  }
  const data = await res.json() as { content: string };
  return data.content;
}

export async function createModel(name: string, description?: string): Promise<void> {
  const body = new FormData();
  body.append("name", name);
  if (description) body.append("description", description);
  const res = await fetch(`/api/v1/models/create`, {
    method: "POST",
    headers: { ...authHeaders() },
    body,
  });
  return handleResponse<void>(res);
}

// ── Definitions / Models ────────────────────────────────────────────────────

export interface DefinitionRef {
  id: string;
  name: string;
  file_name: string;
}

export interface Model {
  id: string;
  name: string;
  definitions: DefinitionRef[];
}


export interface DefinitionSchema {
  sources: SourceInfo[];
}

export async function listModelsWithDefinitions(): Promise<Model[]> {
  const res = await fetch(`/api/v1/models/list-with-definitions`, {
    headers: { ...authHeaders() },
  });
  return handleResponse<Model[]>(res);
}

export async function getCompiledDefinition(definitionId: string): Promise<DefinitionSchema> {
  const res = await fetch(`/api/v1/definitions/get-compiled-definition?definition_id=${definitionId}`, {
    headers: { ...authHeaders() },
  });
  return handleResponse<DefinitionSchema>(res);
}

export async function runQuery(definitionId: string, query: CubeQuery): Promise<any> {
  const res = await fetch(
    `/api/v1/definitions/query?definition_id=${definitionId}&query=${encodeURIComponent(JSON.stringify(query))}`,
    { headers: { ...authHeaders() } },
  );
  return handleResponse<any>(res);
}


// ── Datasets ─────────────────────────────────────────────────────────────

export interface DatasetPublicResponse {
  id: string;
  name: string;
  description: string | null;
  source: string;
  definition: DatasetDefinition;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

export interface DatasetUpdate {
  name?: string;
  description?: string;
  source?: string;
  aggregation_fields?: string[];
  group_by_fields?: string[];
  filters?: Record<string, unknown>;
  havings?: Record<string, unknown>;
  calculated_fields?: unknown[];
  order_by_fields?: Record<string, string>;
  limit?: number;
  limit_enabled?: boolean;
  cube_query?: CubeQuery;
  sql_query?: string;
  definition_id?: string;
}

export interface DatasetCreate {
  name: string;
  description?: string;
  source: string;
  aggregation_fields: string[];
  group_by_fields?: string[];
  filters?: Record<string, unknown>;
  havings?: Record<string, unknown>;
  calculated_fields?: unknown[];
  order_by_fields?: Record<string, string>;
  limit?: number;
  limit_enabled?: boolean;
  cube_query: CubeQuery;
  sql_query?: string;
}

export interface DatasetDefinition {
  id: string;
  name: string;
  model: DatasetModel;
}
export interface DatasetModel {
  id: string;
  name: string;
}
export interface DatasetDetailedResponse {
  id: string;
  name: string;
  source: string;
  aggregation_fields: string[];
  group_by_fields: string[] | null;
  filters: unknown;
  havings: unknown;
  calculated_fields: unknown[] | null;
  order_by_fields: Record<string, string> | null;
  limit: number;
  limit_enabled: boolean;
  cube_query: CubeQuery;
  sql_query: string;
  definition: DatasetDefinition;
  description: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

export async function getDatasets(): Promise<DatasetPublicResponse[]> {
  const res = await fetch(`/api/v1/datasets/list`, {
    headers: { ...authHeaders() },
  });
  return handleResponse<DatasetPublicResponse[]>(res);
}

export async function getDataset(datasetId: string): Promise<DatasetDetailedResponse> {
  const res = await fetch(`/api/v1/datasets/get?id=${datasetId}`, {
    headers: { ...authHeaders() },
  });
  return handleResponse<DatasetDetailedResponse>(res);
}

export async function createDataset(definitionId: string, data: DatasetCreate): Promise<void> {
  const res = await fetch(`/api/v1/datasets/create?definition_id=${definitionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  return handleResponse<void>(res);
}

export async function updateDataset(datasetId: string, data: DatasetUpdate): Promise<void> {
  const res = await fetch(`/api/v1/datasets/update?dataset_id=${datasetId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  return handleResponse<void>(res);
}

export async function deleteDataset(datasetId: string): Promise<void> {
  const res = await fetch(`/api/v1/datasets/delete?dataset_id=${datasetId}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  return handleResponse<void>(res);
}

// ── Files ──────────────────────────────────────────────────────────────────

export interface FilePublicResponse {
  id: string;
  name: string;
  description: string | null;
  path: string;
  extension: string;
  file_size: number;
  file_name: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

export async function getFiles(): Promise<FilePublicResponse[]> {
  const res = await fetch(`/api/v1/files/list`, {
    headers: { ...authHeaders() },
  });
  return handleResponse<FilePublicResponse[]>(res);
}

export async function createFile(name: string, file: globalThis.File, description?: string): Promise<void> {
  const body = new FormData();
  body.append("name", name);
  if (description) body.append("description", description);
  body.append("file", file);

  const res = await fetch(`/api/v1/files/create`, {
    method: "POST",
    headers: { ...authHeaders() },
    body,
  });
  return handleResponse<void>(res);
}

/** Bulk uploads name each record after its own filename (extension stripped) — no separate "Name" field to fill in. */
export function baseFileName(fileName: string): string {
  return fileName.replace(/\.[^./\\]+$/, "") || fileName;
}

export interface FileUploadOutcome {
  file: globalThis.File;
  error?: string;
}

/** Uploads each file sequentially (the backend takes one file per request) and
 * keeps going on individual failures, reporting a per-file outcome instead of
 * throwing — a partial batch failure still leaves the successful ones saved. */
export async function createFiles(
  files: globalThis.File[],
  description?: string,
  onProgress?: (done: number, total: number) => void,
): Promise<FileUploadOutcome[]> {
  const outcomes: FileUploadOutcome[] = [];
  for (const file of files) {
    try {
      await createFile(baseFileName(file.name), file, description);
      outcomes.push({ file });
    } catch (e: any) {
      outcomes.push({ file, error: e.message ?? "Upload failed." });
    }
    onProgress?.(outcomes.length, files.length);
  }
  return outcomes;
}

export async function deleteFile(fileId: string): Promise<void> {
  const res = await fetch(`/api/v1/files/delete?file_id=${fileId}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  return handleResponse<void>(res);
}

export interface FileSchemaColumn {
  name: string;
  type: string;
}

export interface FileSchemaResponse {
  format: string;
  sample_row_count: number;
  columns: FileSchemaColumn[];
}

export async function getFileSchema(fileId: string): Promise<FileSchemaResponse> {
  const res = await fetch(`/api/v1/files/schema?file_id=${fileId}`, {
    headers: { ...authHeaders() },
  });
  return handleResponse<FileSchemaResponse>(res);
}

