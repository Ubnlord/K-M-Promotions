// Temporary compatibility surface for the existing UI while it is migrated from AppDeploy.
export type AuthUser = { email: string };
type Result<T> = { data: T };
async function request<T>(path: string, method = "GET", body?: unknown): Promise<Result<T>> {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? { Accept: "application/json" } : { "Content-Type": "application/json", Accept: "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload: unknown = await response.json().catch((): unknown => ({}));
  const data = payload !== null && typeof payload === "object" ? payload as { error?: unknown } : {};
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Request failed");
  return { data: payload as T };
}
export const api = {
  get: <T = any>(path: string) => request<T>(path),
  post: <T = any>(path: string, body: unknown) => request<T>(path, "POST", body),
  put: <T = any>(path: string, body: unknown) => request<T>(path, "PUT", body),
  delete: <T = any>(path: string) => request<T>(path, "DELETE")
};
export const auth = {
  getUser: async (): Promise<AuthUser | null> => {
    try { const result = await request<{ user: AuthUser | null }>("/api/auth/me"); return result.data.user; }
    catch { return null; }
  },
  signIn: async (email: string, password: string): Promise<void> => {
    await request("/api/auth/login", "POST", { email, password });
  },
  signOut: async (): Promise<void> => {
    await request("/api/auth/logout", "POST", {});
  }
};
