import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { supabaseApi } from '@/lib/supabaseApi';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings] = useState(null);

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data?.session?.user) {
        setUser(null);
        setIsAuthenticated(false);
        return null;
      }
      const profileUser = await supabaseApi.auth.me();
      setUser(profileUser);
      setIsAuthenticated(true);
      return profileUser;
    } catch (error) {
      console.error('[AUTH] Supabase auth check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({ type: 'unknown', message: error?.message || 'Authentication failed.' });
      return null;
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  const checkAppState = useCallback(async () => checkUserAuth(), [checkUserAuth]);

  useEffect(() => {
    let mounted = true;
    checkUserAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      if (!session?.user) {
        setUser(null);
        setIsAuthenticated(false);
        setAuthChecked(true);
        setIsLoadingAuth(false);
        return;
      }
      try {
        const profileUser = await supabaseApi.auth.me();
        if (!mounted) return;
        setUser(profileUser);
        setIsAuthenticated(true);
        setAuthError(null);
      } catch (error) {
        if (!mounted) return;
        setUser(null);
        setIsAuthenticated(false);
        setAuthError({ type: 'unknown', message: error?.message || 'Unable to load your profile.' });
      } finally {
        if (mounted) {
          setAuthChecked(true);
          setIsLoadingAuth(false);
        }
      }
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, [checkUserAuth]);

  const logout = useCallback(async () => {
    await supabaseApi.auth.logout();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const navigateToLogin = useCallback(() => {
    supabaseApi.auth.redirectToLogin();
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
