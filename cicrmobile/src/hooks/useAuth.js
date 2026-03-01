import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { getMe } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    try {
      const stored = await SecureStore.getItemAsync('token');
      if (stored) {
        setToken(stored);
        const res = await getMe();
        setUser(res.data?.result || res.data);
      }
    } catch {
      await SecureStore.deleteItemAsync('token');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const signIn = useCallback(async (tokenValue, profileData) => {
    await SecureStore.setItemAsync('token', tokenValue);
    setToken(tokenValue);
    setUser(profileData?.result || profileData);
  }, []);

  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync('token');
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await getMe();
      setUser(res.data?.result || res.data);
    } catch {
      // silent
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, signIn, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export default function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
