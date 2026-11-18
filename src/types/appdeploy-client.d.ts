declare module '@appdeploy/client' {
  export type AuthUser = { email: string };
  export const api: {
    get<T = any>(path: string): Promise<{ data: T }>;
    post<T = any>(path: string, body: unknown): Promise<{ data: T }>;
    put<T = any>(path: string, body: unknown): Promise<{ data: T }>;
    delete<T = any>(path: string): Promise<{ data: T }>;
  };
  export const auth: {
    getUser(): Promise<AuthUser | null>;
    signInWithRedirect(): Promise<void>;
    signOut(): Promise<void>;
  };
}
