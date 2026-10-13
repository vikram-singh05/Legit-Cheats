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
  // --- SECURITY: Only trust roles from profiles table, app_metadata (server-writable), or designated admin config ---
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

    const userEmail = (currentUser.email || '').trim().toLowerCase();
    const adminEmails = [
      'jangravikram3105@gmail.com',
      ...(import.meta.env.VITE_ADMIN_EMAILS
        ? import.meta.env.VITE_ADMIN_EMAILS.split(',').map(e => e.trim().toLowerCase())
        : [])
    ].filter(Boolean);

    const isDesignatedAdmin = Boolean(userEmail && adminEmails.includes(userEmail));

    try {
      // Query profiles table directly from authenticated Supabase session
      let { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      // If user is a designated admin email, ensure database role is 'admin' via RPC
      if (isDesignatedAdmin && (!data || data.role !== 'admin')) {
        try {
          await supabase.rpc('make_user_admin', { target_email: userEmail });
          const { data: refreshedProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .maybeSingle();
          if (refreshedProfile) {
            data = refreshedProfile;
          }
        } catch (syncErr) {
          console.warn('Admin self-healing sync warning:', syncErr);
        }
      }

      if (!error && data) {
        const adminStatus = data.role === 'admin' || isDesignatedAdmin;
        setProfile({ ...data, role: adminStatus ? 'admin' : data.role });
        setIsAdmin(adminStatus);
      } else {
        // Fallback to app_metadata or designated admin check
        const serverRole = isDesignatedAdmin ? 'admin' : (currentUser.app_metadata?.role || 'user');
        setProfile({ id: currentUser.id, email: currentUser.email, role: serverRole });
        setIsAdmin(serverRole === 'admin' || isDesignatedAdmin);
      }
    } catch (err) {
      console.error('Security alert: Failed to verify profile role:', err);
      setIsAdmin(isDesignatedAdmin);
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

  // --- SECURITY: Send password reset link to user's registered email ---
  const resetPassword = async (email) => {
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/login?mode=reset-password`,
    });
    if (error) throw error;
    return data;
  };

  // --- SECURITY: Update password for authenticated or recovery session ---
  const updatePassword = async (newPassword) => {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
    return data;
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
        resetPassword,
        updatePassword,
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
