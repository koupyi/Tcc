import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { authApi, AuthUser } from "../api/auth";
import { apiClient, ApiError } from "../api/client";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextType {
  user: AuthUser | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function getStoredRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeTokens(accessToken: string, refreshToken: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } catch {
    // Storage unavailable — tokens will not persist across reloads
  }
}

function clearTokens(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // Ignore
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const initialized = useRef(false);

  // Bootstrap: check existing token and restore session
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const token = getStoredToken();
    if (!token) {
      setStatus("unauthenticated");
      return;
    }

    apiClient.setToken(token);

    authApi
      .me()
      .then((response) => {
        if (response.success && response.data?.user) {
          setUser(response.data.user);
          setStatus("authenticated");
        } else {
          clearTokens();
          apiClient.setToken(null);
          setStatus("unauthenticated");
        }
      })
      .catch(() => {
        // Token expired or invalid — try refresh
        const refreshToken = getStoredRefreshToken();
        if (refreshToken) {
          authApi
            .refresh(refreshToken)
            .then((refreshResponse) => {
              if (refreshResponse.success && refreshResponse.data) {
                const { accessToken: newAccess, refreshToken: newRefresh } = refreshResponse.data;
                storeTokens(newAccess, newRefresh);
                apiClient.setToken(newAccess);
                return authApi.me();
              }
              throw new Error("Refresh failed");
            })
            .then((meResponse) => {
              if (meResponse.success && meResponse.data?.user) {
                setUser(meResponse.data.user);
                setStatus("authenticated");
              } else {
                throw new Error("Me failed after refresh");
              }
            })
            .catch(() => {
              clearTokens();
              apiClient.setToken(null);
              setStatus("unauthenticated");
            });
        } else {
          clearTokens();
          apiClient.setToken(null);
          setStatus("unauthenticated");
        }
      });
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await authApi.login({ email, password });
      if (response.success && response.data) {
        const { user: userData, accessToken, refreshToken } = response.data;
        storeTokens(accessToken, refreshToken);
        apiClient.setToken(accessToken);
        setUser(userData);
        setStatus("authenticated");
        return { success: true };
      }
      return { success: false, error: response.message || "Erro ao fazer login" };
    } catch (err) {
      const apiErr = err as ApiError;
      return { success: false, error: apiErr.message || "Erro ao fazer login" };
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await authApi.register({ email, password, name });
      if (response.success && response.data) {
        const { user: userData, accessToken, refreshToken } = response.data;
        storeTokens(accessToken, refreshToken);
        apiClient.setToken(accessToken);
        setUser(userData);
        setStatus("authenticated");
        return { success: true };
      }
      return { success: false, error: response.message || "Erro ao criar conta" };
    } catch (err) {
      const apiErr = err as ApiError;
      return { success: false, error: apiErr.message || "Erro ao criar conta" };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const refreshToken = getStoredRefreshToken();
      await authApi.logout(refreshToken || undefined);
    } catch {
      // Logout best-effort — clear local state regardless
    } finally {
      clearTokens();
      apiClient.setToken(null);
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        status,
        isAuthenticated: status === "authenticated",
        isLoading: status === "loading",
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
