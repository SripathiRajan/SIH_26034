import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { OfficerUser } from '../types';
import { api } from '../api/client';
import { appStorage } from '../services/storage';

interface AuthContextType {
  currentUser: OfficerUser | null;
  token: string | null;
  isLoading: boolean;
  login: (identifier: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  loginDemo: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: OfficerUser | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  token: null,
  isLoading: true,
  login: async () => ({ success: false }),
  loginDemo: async () => {},
  logout: async () => {},
  setUser: () => {},
});

const AUTH_USER_KEY = 'praman_auth_user';
const AUTH_TOKEN_KEY = 'praman_auth_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<OfficerUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadStoredAuth() {
      try {
        const storedUser = await appStorage.getItem(AUTH_USER_KEY);
        const storedToken = await appStorage.getItem(AUTH_TOKEN_KEY);

        if (storedToken) {
          setToken(storedToken);
          api.setAuthToken(storedToken);
        }
        if (storedUser) {
          setCurrentUser(JSON.parse(storedUser));
        }
      } catch (err) {
        console.warn('[AuthContext] Error loading stored credentials:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadStoredAuth();
  }, []);

  const login = async (identifier: string, pass: string) => {
    const res = await api.login(identifier, pass);
    if (res.success && res.user) {
      setCurrentUser(res.user);
      if (res.token) {
        setToken(res.token);
        api.setAuthToken(res.token);
        await appStorage.setItem(AUTH_TOKEN_KEY, res.token);
      }
      await appStorage.setItem(AUTH_USER_KEY, JSON.stringify(res.user));
      return { success: true };
    }
    return { success: false, error: res.error || 'Authentication failed' };
  };

  const loginDemo = async () => {
    try {
      const res = await api.login('admin', 'Praman!2026');
      if (res.success && res.user) {
        setCurrentUser(res.user);
        if (res.token) {
          setToken(res.token);
          api.setAuthToken(res.token);
          await appStorage.setItem(AUTH_TOKEN_KEY, res.token);
        }
        await appStorage.setItem(AUTH_USER_KEY, JSON.stringify(res.user));
        return;
      }
    } catch {
      // Backend offline or unreachable — continue with local demo officer
    }

    const demoOfficer: OfficerUser = {
      id: 'officer-demo',
      name: 'Insp. R. Sharma',
      role: 'officer',
      department: 'Legal Metrology Dept, Delhi',
      zone: 'North Zone',
      badgeId: 'LM-DL-8821',
    };
    setCurrentUser(demoOfficer);
    await appStorage.setItem(AUTH_USER_KEY, JSON.stringify(demoOfficer));
  };

  const logout = async () => {
    setCurrentUser(null);
    setToken(null);
    api.setAuthToken(null);
    await appStorage.removeItem(AUTH_USER_KEY);
    await appStorage.removeItem(AUTH_TOKEN_KEY);
  };

  const setUser = (user: OfficerUser | null) => {
    setCurrentUser(user);
    if (user) {
      appStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    } else {
      appStorage.removeItem(AUTH_USER_KEY);
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, token, isLoading, login, loginDemo, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
