import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import {
  auth,
  signInWithGoogle as fbSignInWithGoogle,
  signInWithEmail as fbSignInWithEmail,
  signUpWithEmail as fbSignUpWithEmail,
  sendPasswordReset as fbSendPasswordReset,
  logOut as fbLogOut,
  fetchUserProfile,
  syncUserProfile,
  updateUserPlan,
  saveUserMiniSiteToFirestore,
  loadUserMiniSiteFromFirestore,
  createLocalUser
} from '../lib/firebase';
import { UserProfile, UserMiniSite } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<User>;
  signInWithEmail: (email: string, pass: string) => Promise<User>;
  signUpWithEmail: (email: string, pass: string, handle?: string) => Promise<User>;
  sendPasswordReset: (email: string) => Promise<void>;
  logOut: () => Promise<void>;
  updatePlan: (plan: 'free' | 'pro' | 'studio', isYearly?: boolean) => Promise<void>;
  saveMiniSite: (siteData: Partial<UserMiniSite>, siteId?: string) => Promise<void>;
  loadMiniSite: (siteId?: string) => Promise<UserMiniSite | null>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    if (!auth.currentUser) {
      setProfile(null);
      return;
    }
    const prof = await fetchUserProfile(auth.currentUser.uid);
    setProfile(prof);
  }, []);

  useEffect(() => {
    const getCachedLocalUser = (): User | null => {
      if (typeof window === 'undefined') return null;
      const raw = localStorage.getItem('raloa_local_user');
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.email) {
          return createLocalUser(parsed.email, parsed.displayName);
        }
      } catch (_) {}
      return null;
    };

    const localUser = getCachedLocalUser();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      const activeUser = currentUser || getCachedLocalUser();
      setUser(activeUser);
      if (activeUser) {
        try {
          const userProf = await syncUserProfile(activeUser);
          setProfile(userProf);
        } catch (err) {
          console.error('Error synchronizing user profile on auth change:', err);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    if (localUser && !auth.currentUser) {
      setUser(localUser);
      syncUserProfile(localUser)
        .then(setProfile)
        .catch(() => {})
        .finally(() => setLoading(false));
    }

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const loggedUser = await fbSignInWithGoogle();
    const prof = await syncUserProfile(loggedUser);
    setUser(loggedUser);
    setProfile(prof);
    return loggedUser;
  }, []);

  const signInWithEmail = useCallback(async (email: string, pass: string) => {
    const loggedUser = await fbSignInWithEmail(email, pass);
    const prof = await syncUserProfile(loggedUser);
    setUser(loggedUser);
    setProfile(prof);
    return loggedUser;
  }, []);

  const signUpWithEmail = useCallback(async (email: string, pass: string, handle?: string) => {
    const loggedUser = await fbSignUpWithEmail(email, pass, handle);
    const prof = await syncUserProfile(loggedUser, handle ? { handle } : {});
    setUser(loggedUser);
    setProfile(prof);
    return loggedUser;
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    await fbSendPasswordReset(email);
  }, []);

  const logOut = useCallback(async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } catch (_) {}
    try {
      await fbLogOut();
    } catch (_) {}
    setUser(null);
    setProfile(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('raloa_local_user');
      window.location.href = '/';
    }
  }, []);

  const updatePlan = useCallback(async (plan: 'free' | 'pro' | 'studio', isYearly: boolean = false) => {
    if (!user) throw new Error('AUTH_REQUIRED');
    await updateUserPlan(user.uid, plan, isYearly);
    setProfile((prev) => (prev ? { ...prev, plan, isYearly, updatedAt: new Date().toISOString() } : null));
  }, [user]);

  const saveMiniSite = useCallback(async (siteData: Partial<UserMiniSite>, siteId: string = 'default') => {
    if (!user) return;
    // Always persist to local cache for resilient offline & local dev support
    try {
      localStorage.setItem(`raloa_site_${user.uid}_${siteId}`, JSON.stringify(siteData));
      if (siteData.username) {
        localStorage.setItem(`raloa_studio_site_${siteData.username}`, JSON.stringify(siteData));
      }
    } catch (_) {}

    // Only attempt Firestore write if real Firebase Auth session is active
    if (auth.currentUser) {
      try {
        await saveUserMiniSiteToFirestore(user.uid, siteData, siteId);
      } catch (err: any) {
        // If permission is denied (e.g. during local dev or rules mismatch), don't crash autosave
        if (err?.code === 'permission-denied' || err?.message?.includes('Missing or insufficient permissions')) {
          console.warn('Firestore permissions denied for saveMiniSite; saved to local storage fallback instead.');
          return;
        }
        throw err;
      }
    }
  }, [user]);

  const loadMiniSite = useCallback(async (siteId: string = 'default') => {
    if (!user) return null;
    let firestoreData: UserMiniSite | null = null;
    if (auth.currentUser) {
      try {
        firestoreData = await loadUserMiniSiteFromFirestore(user.uid, siteId);
      } catch (err) {
        console.warn('Could not load site from Firestore; checking local cache fallback:', err);
      }
    }
    if (firestoreData) return firestoreData;

    try {
      const cached = localStorage.getItem(`raloa_site_${user.uid}_${siteId}`);
      if (cached) return JSON.parse(cached);
    } catch (_) {}
    return null;
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        sendPasswordReset,
        logOut,
        updatePlan,
        saveMiniSite,
        loadMiniSite,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
