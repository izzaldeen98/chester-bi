const BASE_URL = '/api/v1'

function getToken(): string | null {
  return localStorage.getItem('access_token')
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  const token = getToken()
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: defaultHeaders,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Request failed')
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface CurrentUser {
  id: string
  username: string
  email?: string
  first_name: string
  last_name: string
  account_name: string
  role: string
  permissions: string[]
}

export interface TokenResponse {
  access_token: string
  token_type: string
  user: CurrentUser
}

export async function login(username: string, password: string): Promise<TokenResponse> {
  const body = new URLSearchParams({ username, password })
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Login failed')
  }
  return res.json()
}

export interface OwnerCreate {
  name: string
  description: string
  username: string
  email: string
  password: string
  first_name: string
  last_name: string
}

export async function register(data: OwnerCreate): Promise<void> {
  await request<void>('POST', '/auth/register', data)
}

export async function setPassword(username: string, accountName: string, password: string): Promise<void> {
  const params = new URLSearchParams({ username, account_name: accountName, password })
  const res = await fetch(`${BASE_URL}/auth/set-password?${params.toString()}`, { method: 'PUT' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Failed to set password')
  }
}

// ── Users ─────────────────────────────────────────────────────────────────────

export interface UserPublicResponse {
  id: string
  username: string
  first_name: string
  last_name: string
  is_active: boolean
  role: string
  email?: string
  permissions?: string[]
  created_at: string
  updated_at: string
}

export interface UserCreate {
  username: string
  first_name: string
  last_name: string
  password?: string
  permissions?: string[]
}

export interface UserUpdate {
  email?: string
  username?: string
  first_name?: string
  last_name?: string
  role?: string
  is_active?: boolean
  is_password_set?: boolean
  permissions?: string[]
}

export const usersApi = {
  list: () => request<UserPublicResponse[]>('GET', '/users/list'),
  create: (data: UserCreate) => request<void>('POST', '/users/create', data),
  update: (userId: string, data: UserUpdate) =>
    request<void>('PUT', `/users/update?user_id=${userId}`, data),
}

// ── Dashboards ────────────────────────────────────────────────────────────────

export interface DashboardPublicResponse {
  id: string
  name: string
  description: string
  created_at: string
  updated_at: string
  created_by: string
  updated_by: string
  config_file: string
}

export interface DashboardCreate {
  name: string
  description: string
}

export const dashboardsApi = {
  list: () => request<DashboardPublicResponse[]>('GET', '/dashboards/list'),
  get: (id: string) => request<DashboardPublicResponse>('GET', `/dashboards/get?dashboard_id=${id}`),
  create: (data: DashboardCreate) => request<void>('POST', '/dashboards/create', data),
}

// ── Connections ───────────────────────────────────────────────────────────────

export interface ConnectionAttributes {
  host: string
  port: string
  database: string
  username: string
  password: string
}

export interface ConnectionCreate {
  name: string
  description?: string
  type: string
  connection_attributes: ConnectionAttributes
}

export interface ConnectionUpdate {
  name?: string
  description?: string
  connection_attributes?: Partial<ConnectionAttributes>
}

export interface ConnectionPublicResponse {
  id: string
  name: string
  type: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string
  updated_by: string
}

export const connectionsApi = {
  list:   ()                                           => request<ConnectionPublicResponse[]>('GET',    '/connections/list'),
  create: (data: ConnectionCreate)                     => request<void>('POST',   '/connections/create', data),
  update: (id: string, data: ConnectionUpdate)         => request<ConnectionPublicResponse>('PUT', `/connections/update?connection_id=${id}`, data),
  delete: (id: string)                                 => request<void>('DELETE', `/connections/delete?connection_id=${id}`),
  test:   (id: string)                                 => request<void>('GET',    `/connections/test-connection?connection_id=${id}`),
}

// ── Packages ──────────────────────────────────────────────────────────────────

export interface PackageResponse {
  id: string
  name: string
  location: string
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string
  updated_by: string
}

export interface PackageFile {
  file: string
  location: string
  model_id?: string | null
}

async function formRequest<T>(path: string, body: FormData, method: 'POST' | 'PUT' = 'POST'): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Request failed')
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const packagesApi = {
  list:      ()                                         => request<PackageResponse[]>('GET', '/packages/list'),
  get:       (id: string)                               => request<PackageResponse>('GET', `/packages/get?package_id=${id}`),
  listFiles: (id: string)                               => request<PackageFile[]>('GET', `/packages/list-files?package_id=${id}`),
  create:    (name: string, description?: string)       => {
    const body = new FormData()
    body.append('name', name)
    if (description) body.append('description', description)
    return formRequest<void>('/packages/create', body)
  },
}

// ── Semantic Models ───────────────────────────────────────────────────────────

export const semanticModelsApi = {
  add: (name: string, packageId: string, file: File, description?: string) => {
    const body = new FormData()
    body.append('name', name)
    body.append('package_id', packageId)
    body.append('file', file)
    if (description) body.append('description', description)
    return formRequest<void>('/semantic-models/add', body)
  },
  save: (modelId: string, content: string, fileName: string) => {
    const body = new FormData()
    body.append('model_id', modelId)
    body.append('file', new File([content], fileName, { type: 'text/plain' }))
    return formRequest<void>('/semantic-models/save', body, 'PUT')
  },
  getContent: (modelId: string) =>
    request<{ content: string }>('GET', `/semantic-models/file-content?model_id=${modelId}`),
}
