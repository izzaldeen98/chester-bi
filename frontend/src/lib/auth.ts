const TOKEN_KEY = "chester-bi-token";
const USER_KEY  = "chester-bi-user";

export interface StoredUser {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  account_name: string;
  role: string;
  permissions: string[];
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function setUser(user: StoredUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getUser(): StoredUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as StoredUser; } catch { return null; }
}

export function clearUser(): void {
  localStorage.removeItem(USER_KEY);
}
