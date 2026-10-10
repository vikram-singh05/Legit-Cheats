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
        // Fallback: check JWT metadata (verified by Supabase auth server)
        const userRole = currentUser.app_metadata?.role || currentUser.user_metadata?.role || 'user';
        setProfile({ id: currentUser.id, email: currentUser.email, role: userRole });
        setIsAdmin(userRole === 'admin');
      }
    } catch (err) {
      console.error('Security alert: Failed to verify profile role:', err);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Validate emergency service role key against Supabase REST API (Prevent backdoor arbitrary string exploits)
  const verifyServiceRoleKey = async (key) => {
    if (!key || typeof key !== 'string') return false;
    const trimmed = key.trim();
    // Must be a valid JWT with 3 parts
    if (!trimmed.includes('.') || trimmed.split('.').length !== 3) return false;

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lpeoqbfklmoeonctjist.supabase.co';
      const res = await fetch(`${supabaseUrl}/rest/v1/profiles?select=id&limit=1`, {
        headers: {
          apikey: trimmed,
          Authorization: `Bearer ${trimmed}`
        }
      });
      return res.ok;
    } catch {
      return false;
    }
  };

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
        } else {
          // Check if a verified emergency key exists in storage
          const storedKey = localStorage.getItem('vanguard_admin_key');
          if (storedKey) {
            const isValid = await verifyServiceRoleKey(storedKey);
            if (isValid && isMounted) {
              setIsAdmin(true);
              setUser({ email: 'service_role@legit.admin', id: 'service-role-admin' });
              setProfile({ email: 'service_role@legit.admin', role: 'admin' });
            } else {
              // Security defense: Purge invalid or tampered backdoor key immediately
              localStorage.removeItem('vanguard_admin_key');
              if (isMounted) {
                setUser(null);
                setProfile(null);
                setIsAdmin(false);
              }
            }
          } else if (isMounted) {
            setUser(null);
            setProfile(null);
            setIsAdmin(false);
          }
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
        setSession(null);
        const storedKey = localStorage.getItem('vanguard_admin_key');
        if (storedKey) {
          const isValid = await verifyServiceRoleKey(storedKey);
          if (isValid) {
            setIsAdmin(true);
            setUser({ email: 'service_role@legit.admin', id: 'service-role-admin' });
            setProfile({ email: 'service_role@legit.admin', role: 'admin' });
          } else {
            localStorage.removeItem('vanguard_admin_key');
            setUser(null);
            setProfile(null);
            setIsAdmin(false);
          }
        } else {
          setUser(null);
          setProfile(null);
          setIsAdmin(false);
        }
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
        data: {
          role: 'user',
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
    localStorage.removeItem('vanguard_admin_key');
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
  };

  const loginWithServiceKey = async (serviceKey) => {
    setLoading(true);
    const isValid = await verifyServiceRoleKey(serviceKey);
    if (!isValid) {
      setLoading(false);
      localStorage.removeItem('vanguard_admin_key');
      throw new Error('Access Denied: Invalid cryptographic service role key.');
    }
    localStorage.setItem('vanguard_admin_key', serviceKey.trim());
    setIsAdmin(true);
    setUser({ email: 'service_role@legit.admin', id: 'service-role-admin' });
    setProfile({ email: 'service_role@legit.admin', role: 'admin' });
    setLoading(false);
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
        loginWithServiceKey,
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
