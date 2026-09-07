import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import type { User, AuthResponse } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  googleClientId: string;
  isManager: boolean;
  isInventoryOwner: boolean;
  isAuthenticated: boolean;
  loginWithGoogle: (credential: string) => Promise<void>;
  devLogin: (role: 'manager' | 'inventory_owner', email?: string, name?: string, holder_id?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'shelv_token';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [googleClientId, setGoogleClientId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Set default axios Authorization header
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }

  const applyAuthResponse = (data: AuthResponse) => {
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem(TOKEN_KEY, data.token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/api/auth/me`);
      setUser(res.data.user);
    } catch (err: any) {
      if (err.response?.status === 401) {
        logout();
      }
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        // 1. Fetch public Google Client ID configuration
        try {
          const cfgRes = await axios.get(`${API_BASE_URL}/api/auth/config`);
          if (cfgRes.data?.googleClientId) {
            setGoogleClientId(cfgRes.data.googleClientId);
          }
        } catch (e) {
          console.warn('[Auth] Could not fetch server auth config');
        }

        // 2. If token exists, validate session
        const storedToken = localStorage.getItem(TOKEN_KEY);
        if (storedToken) {
          axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          const meRes = await axios.get(`${API_BASE_URL}/api/auth/me`);
          setUser(meRes.data.user);
          setToken(storedToken);
        }
      } catch (err) {
        console.warn('[Auth] Stored session invalid or expired, logging out');
        localStorage.removeItem(TOKEN_KEY);
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const loginWithGoogle = async (credential: string) => {
    setIsLoading(true);
    try {
      const res = await axios.post<AuthResponse>(`${API_BASE_URL}/api/auth/google`, { credential });
      applyAuthResponse(res.data);
    } finally {
      setIsLoading(false);
    }
  };

  const devLogin = async (
    role: 'manager' | 'inventory_owner',
    email?: string,
    name?: string,
    holder_id?: string
  ) => {
    setIsLoading(true);
    try {
      const res = await axios.post<AuthResponse>(`${API_BASE_URL}/api/auth/dev-login`, {
        role,
        email,
        name,
        holder_id,
      });
      applyAuthResponse(res.data);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
    setToken(null);
  };

  const isManager = user?.role === 'manager';
  const isInventoryOwner = user?.role === 'inventory_owner';
  const isAuthenticated = Boolean(user && token);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        googleClientId,
        isManager,
        isInventoryOwner,
        isAuthenticated,
        loginWithGoogle,
        devLogin,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
