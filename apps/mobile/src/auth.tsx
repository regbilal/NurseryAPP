import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { api, loadBaseUrl, setToken } from './api';
import { setAppLanguage } from './i18n';

type User = {
  id: string;
  email: string;
  fullName: string;
  role: 'Admin' | 'Educator' | 'Parent';
  preferredLanguage: string;
  classroomId?: string;
  nurseryId: string;
};

type Ctx = {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setLanguage: (lang: string) => Promise<void>;
};

const AuthContext = createContext<Ctx>(null as any);

async function storeGet(key: string) {
  if (Platform.OS === 'web') return localStorage.getItem(key);
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}
async function storeSet(key: string, value: string) {
  if (Platform.OS === 'web') localStorage.setItem(key, value);
  else await SecureStore.setItemAsync(key, value);
}
async function storeDel(key: string) {
  if (Platform.OS === 'web') localStorage.removeItem(key);
  else await SecureStore.deleteItemAsync(key);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      await loadBaseUrl();
      const t = await storeGet('token');
      if (t) {
        setToken(t);
        try {
          const me = await api('/api/me');
          setUser({ ...me, role: me.role });
          await setAppLanguage(me.preferredLanguage);
        } catch {
          setToken(null);
        }
      }
      setReady(true);
    })();
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      user,
      ready,
      login: async (email, password) => {
        const res = await api('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        await storeSet('token', res.token);
        setToken(res.token);
        setUser(res.user);
        await setAppLanguage(res.user.preferredLanguage);
      },
      logout: async () => {
        await storeDel('token');
        setToken(null);
        setUser(null);
      },
      setLanguage: async (lang) => {
        await setAppLanguage(lang);
        if (user) {
          await api('/api/auth/language', { method: 'PATCH', body: JSON.stringify({ language: lang }) });
          setUser({ ...user, preferredLanguage: lang });
        }
      },
    }),
    [user, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
