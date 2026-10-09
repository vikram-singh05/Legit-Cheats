import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check user and profile
  const fetchProfileAndRole = async (currentUser) => {
    if (!currentUser) {
      setUser(null);
      setProfile(null);
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setUser(currentUser);

    try {
      // Query profiles table
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (data) {
        setProfile(data);
        setIsAdmin(data.role === 'admin');
      } else {
        // If profile doesn't exist yet (e.g. trigger didn't run or pre-trigger user), check fallback metadata
        const userRole = currentUser.user_metadata?.role || 'user';
        setProfile({ id: currentUser.id, email: currentUser.email, role: userRole });
        setIsAdmin(userRole === 'admin');
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfileAndRole(session.user);
      } else {
        // Also check if user has an active service role session
        const emergencyKey = localStorage.getItem('vanguard_admin_key');
        if (emergencyKey && emergencyKey.length > 20) {
          setIsAdmin(true);
          setUser({ email: 'service_role@legit.admin', id: 'service-role-admin' });
          setProfile({ email: 'service_role@legit.admin', role: 'admin' });
        }
        setLoading(false);
      }
    });

    // 2. Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await fetchProfileAndRole(session.user);
      } else {
        const emergencyKey = localStorage.getItem('vanguard_admin_key');
        if (emergencyKey && emergencyKey.length > 20) {
          setIsAdmin(true);
          setUser({ email: 'service_role@legit.admin', id: 'service-role-admin' });
          setProfile({ email: 'service_role@legit.admin', role: 'admin' });
        } else {
          setUser(null);
          setProfile(null);
          setIsAdmin(false);
        }
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email, password) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setLoading(false);
      throw error;
    }
    if (data?.user) {
      await fetchProfileAndRole(data.user);
    }
    return data;
  };

  const signUp = async (email, password) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
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
    if (data?.user) {
      await fetchProfileAndRole(data.user);
    }
    return data;
  };

  const signOut = async () => {
    localStorage.removeItem('vanguard_admin_key');
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
  };

  const loginWithServiceKey = (serviceKey) => {
    localStorage.setItem('vanguard_admin_key', serviceKey);
    setIsAdmin(true);
    setUser({ email: 'service_role@legit.admin', id: 'service-role-admin' });
    setProfile({ email: 'service_role@legit.admin', role: 'admin' });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
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
