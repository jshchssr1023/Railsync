'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, LoginResponse, ApiResponse } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  getAccessToken: () => string | null;
}

interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  organization?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACCESS_TOKEN_KEY = 'railsync_access_token';
const REFRESH_TOKEN_KEY = 'railsync_refresh_token';
const USER_KEY = 'railsync_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem(USER_KEY);
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);

    if (storedUser && accessToken) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        clearAuthData();
      }
    }
    setIsLoading(false);
  }, []);

  const clearAuthData = () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  };

  const saveAuthData = (data: LoginResponse) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setUser(data.user);
  };

  const getAccessToken = useCallback(() => {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data: ApiResponse<LoginResponse> = await response.json();

      if (!response.ok || !data.success || !data.data) {
        throw new Error(data.error || 'Login failed');
      }

      saveAuthData(data.data);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (registerData: RegisterData) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registerData),
      });

      const data: ApiResponse<LoginResponse> = await response.json();

      if (!response.ok || !data.success || !data.data) {
        throw new Error(data.error || 'Registration failed');
      }

      saveAuthData(data.data);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    const token = getAccessToken();
    if (token) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      } catch {
        // Ignore errors - clear local state anyway
      }
    }
    clearAuthData();
  };

  const refreshToken = async () => {
    const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!storedRefreshToken) {
      clearAuthData();
      throw new Error('No refresh token available');
    }

    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: storedRefreshToken }),
      });

      const data: ApiResponse<{ access_token: string; refresh_token: string }> = await response.json();

      if (!response.ok || !data.success || !data.data) {
        clearAuthData();
        throw new Error('Token refresh failed');
      }

      localStorage.setItem(ACCESS_TOKEN_KEY, data.data.access_token);
      localStorage.setItem(REFRESH_TOKEN_KEY, data.data.refresh_token);
    } catch {
      clearAuthData();
      throw new Error('Token refresh failed');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshToken,
        getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook for making authenticated API requests
export function useAuthFetch() {
  const { getAccessToken, refreshToken, logout } = useAuth();

  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      const token = getAccessToken();

      const headers = new Headers(options.headers);
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      let response = await fetch(url, { ...options, headers });

      // If unauthorized, try to refresh token
      if (response.status === 401 && token) {
        try {
          await refreshToken();
          const newToken = getAccessToken();
          headers.set('Authorization', `Bearer ${newToken}`);
          response = await fetch(url, { ...options, headers });
        } catch {
          await logout();
          throw new Error('Session expired. Please log in again.');
        }
      }

      return response;
    },
    [getAccessToken, refreshToken, logout]
  );

  return authFetch;
}
