'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: 'user' | 'admin';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      console.log('[AuthProvider] Fetching user...'); // Debug
      const res = await fetch('/api/auth/me');
      console.log('[AuthProvider] Response status:', res.status); // Debug
      if (res.ok) {
        const data = await res.json();
        console.log('[AuthProvider] User loaded:', data.user.email); // Debug
        setUser(data.user);
      } else {
        console.log('[AuthProvider] Not authenticated'); // Debug
        setUser(null);
      }
    } catch (error) {
      console.error('[AuthProvider] Error fetching user:', error); // Debug
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      console.log('Logging out...'); // Debug log
      await fetch('/api/auth/logout', { method: 'POST' });
      console.log('Logout successful, redirecting...'); // Debug log
    } catch (error) {
      console.error('Logout error:', error); // Debug log
    } finally {
      setUser(null);
      window.location.href = '/login';
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ user, loading, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
