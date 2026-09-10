import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../services/endpoints';
import { setUnauthorizedHandler } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';
import { ROLES, ACCOUNT_STATUS } from '../utils/constants';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [platform, setPlatform] = useState(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  const clearSession = useCallback(() => {
    setUser(null);
    disconnectSocket();
    queryClient.clear();
  }, [queryClient]);

  // Restores the session from the httpOnly cookie on first load.
  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const res = await authApi.me();
        if (!active) return;
        setUser(res.data.user);
        setPlatform(res.data.platform);
        connectSocket();
      } catch {
        if (!active) return;
        setUser(null);
        try {
          const p = await authApi.platform();
          if (active) setPlatform(p.data);
        } catch {
          /* branding falls back to defaults */
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => clearSession());
  }, [clearSession]);

  const login = useCallback(
    async (credentials) => {
      const res = await authApi.login(credentials);
      setUser(res.data.user);
      connectSocket();
      return res.data.user;
    },
    []
  );

  const register = useCallback(async (payload) => {
    const res = await authApi.register(payload);
    return res.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const refreshUser = useCallback(async () => {
    const res = await authApi.me();
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const value = useMemo(() => {
    const role = user?.role ?? null;
    return {
      user,
      platform,
      loading,
      login,
      register,
      logout,
      refreshUser,
      setUser,
      isAuthenticated: Boolean(user),
      isTeacher: role === ROLES.TEACHER,
      isAssistant: role === ROLES.ASSISTANT,
      isStudent: role === ROLES.STUDENT,
      isStaff: role === ROLES.TEACHER || role === ROLES.ASSISTANT,
      isApproved: user?.status === ACCOUNT_STATUS.APPROVED,
      // The teacher owns the platform, so they implicitly hold every permission.
      can: (permission) =>
        role === ROLES.TEACHER ||
        (role === ROLES.ASSISTANT && (user?.permissions || []).includes(permission)),
    };
  }, [user, platform, loading, login, register, logout, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
