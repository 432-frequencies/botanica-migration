import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';
import { resolveDisplayName } from '@/lib/displayName';

const AuthContext = createContext();

function buildAuthUser(sessionUser) {
  if (!sessionUser) return null;
  return {
    email: sessionUser.email,
    full_name: resolveDisplayName({
      fullName: sessionUser.user_metadata?.full_name,
      email: sessionUser.email,
    }),
    id: sessionUser.id,
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    let mounted = true;

    const applySession = (session) => {
      if (!mounted) return;

      const nextUser = buildAuthUser(session?.user);
      setUser(nextUser);
      setIsAuthenticated(Boolean(nextUser));
      setIsLoadingAuth(false);
    };

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        applySession(session);
      })
      .catch(() => {
        applySession(null);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const logout = async (redirectUrl) => {
    try {
      await supabase.auth.signOut();
    } catch {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
    } finally {
      window.location.replace(redirectUrl || '/login');
    }
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      // Stubs pour compatibilité avec les composants existants
      isLoadingPublicSettings: false,
      authError: null,
      appPublicSettings: null,
      logout,
      navigateToLogin,
      checkAppState: () => {},
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
