import { createContext, useState, useMemo, useCallback, useEffect } from 'react';
import api from '../api/api';
import { hasStaffRole } from '../utils/roles';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('recruit_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      api.get(`/api/auth/me/${user.userId}`)
        .then(res => {
          const fresh = res.data || res;
          setUser(fresh);
          localStorage.setItem('recruit_user', JSON.stringify(fresh));
        })
        .catch(err => {
          if (err?.status === 401) {
            localStorage.removeItem('recruit_user');
            setUser(null);
          }
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/api/auth/login', { email, password });
    const data = res.data || res;
    setUser(data);
    localStorage.setItem('recruit_user', JSON.stringify(data));
    return data;
  }, []);

  const signup = useCallback(async (name, email, password) => {
    const res = await api.post('/api/auth/signup', { name, email, password });
    const data = res.data || res;
    setUser(data);
    localStorage.setItem('recruit_user', JSON.stringify(data));
    return data;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('recruit_user');
    localStorage.removeItem('recruit_org');
  }, []);

  const isRecruiter = useMemo(() => {
    if (!user) return false;
    return hasStaffRole(user.memberships);
  }, [user]);

  const firstOrgId = useMemo(() => {
    if (!user?.memberships?.length) return null;
    return user.memberships[0].orgId;
  }, [user]);

  const refreshUser = useCallback(async () => {
    try {
      const userId = user?.userId;
      if (!userId) return;
      const res = await api.get(`/api/auth/me/${userId}`);
      const fresh = res.data || res;
      setUser(fresh);
      localStorage.setItem('recruit_user', JSON.stringify(fresh));
    } catch {
      // silently fail
    }
  }, [user?.userId]);

  const value = useMemo(() => ({
    user, login, signup, logout, refreshUser, loading, isRecruiter, firstOrgId
  }), [user, login, signup, logout, refreshUser, loading, isRecruiter, firstOrgId]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
