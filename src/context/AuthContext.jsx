import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Authenticate and fetch user profile with strict role validation
  // --- SECURITY: Only trust roles from profiles table or app_metadata (server-writable only) ---
  const fetchProfileAndRole = useCallback(async (currentUser) => {
    if (!currentUser) {
      setUser(null);
      setSession(null);
      setProfile(null);
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setUser(currentUser);

    try {
      // Query profiles table directly from authenticated Supabase session
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (!error && data) {
        setProfile(data);
        setIsAdmin(data.role === 'admin');
      } else {
        // --- SECURITY FIX (HIGH-04): Only read role from app_metadata (server-writable) ---
        // NEVER read from user_metadata.role — users can modify their own user_metadata
        const serverRole = currentUser.app_metadata?.role || 'user';
        setProfile({ id: currentUser.id, email: currentUser.email, role: serverRole });
        setIsAdmin(serverRole === 'admin');
      }
    } catch (err) {
      console.error('Security alert: Failed to verify profile role:', err);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // 1. Restore persistent session on load
    const initSession = async () => {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (currentSession?.user) {
          if (isMounted) setSession(currentSession);
          await fetchProfileAndRole(currentSession.user);
        } else if (isMounted) {
          // --- SECURITY FIX (CRIT-03): Removed localStorage service role key mechanism ---
          // Admin access now ONLY flows through Supabase auth + profile/app_metadata role checks
          setUser(null);
          setProfile(null);
          setIsAdmin(false);
        }
      } catch (err) {
        console.error('Session initialization error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initSession();

    // 2. Real-time persistent auth listener (Synchronizes login/logout across tabs)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;

      if (newSession?.user) {
        setSession(newSession);
        await fetchProfileAndRole(newSession.user);
      } else {
        // --- SECURITY FIX (CRIT-03): No more localStorage service role key check ---
        setSession(null);
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfileAndRole]);

  const signIn = async (email, password) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      setLoading(false);
      throw error;
    }
    if (data?.session) {
      setSession(data.session);
    }
    if (data?.user) {
      await fetchProfileAndRole(data.user);
    }
    return data;
  };

  const signUp = async (email, password) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/profile`,
        data: {
          // --- SECURITY: Do NOT set role in user_metadata; it's user-writable ---
          // Admin role should only be set via Supabase SQL: UPDATE auth.users SET raw_app_meta_data = ...
        },
      },
    });
    if (error) {
      setLoading(false);
      throw error;
    }
    if (data?.session) {
      setSession(data.session);
    }
    if (data?.user) {
      await fetchProfileAndRole(data.user);
    }
    return data;
  };

  const signOut = async () => {
    // --- SECURITY FIX (CRIT-03): Clean up any legacy service role keys ---
    try { localStorage.removeItem('vanguard_admin_key'); } catch (_) {}
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isAdmin,
        loading,
        signIn,
        signUp,
        signOut,
        // --- SECURITY FIX (CRIT-03): Removed loginWithServiceKey from context ---
        // Admin access is now exclusively through Supabase auth + profile role
        refreshProfile: () => fetchProfileAndRole(user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
