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
  saveUserMiniSiteToFirestore,
  loadUserMiniSiteFromFirestore,
  createLocalUser,
  resetFirebasePassword,
  listUserMiniSitesFromServer,
  createUserMiniSiteOnServer,
  deleteUserMiniSiteFromServer
} from '../lib/firebase';
import { UserProfile, UserMiniSite, UserMiniSiteSummary } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<User>;
  signInWithEmail: (email: string, pass: string) => Promise<User>;
  signUpWithEmail: (email: string, pass: string, handle?: string) => Promise<User>;
  sendPasswordReset: (email: string) => Promise<void>;
  resetPassword: (oobCode: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
  updatePlan: (plan: 'free' | 'pro' | 'studio', isYearly?: boolean) => Promise<void>;
  saveMiniSite: (siteData: Partial<UserMiniSite>, siteId: string) => Promise<void>;
  loadMiniSite: (siteId: string) => Promise<UserMiniSite | null>;
  listMiniSites: () => Promise<UserMiniSiteSummary[]>;
  createMiniSite: (siteData: Partial<UserMiniSite>, siteId?: string) => Promise<UserMiniSite>;
  deleteMiniSite: (siteId: string) => Promise<void>;
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
      if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) return null;
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

  const resetPassword = useCallback(async (oobCode: string, password: string) => {
    await resetFirebasePassword(oobCode, password);
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
    if (plan !== 'free') throw new Error('PLAN_REQUIRES_BILLING_CONFIRMATION');
    const token = await user.getIdToken();
    const response = await fetch('/api/billing/activate-free', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, isYearly })
    });
    if (!response.ok) throw new Error('PLAN_UPDATE_FAILED');
    setProfile((prev) => (prev ? { ...prev, plan, isYearly, updatedAt: new Date().toISOString() } : null));
  }, [user]);

  const saveMiniSite = useCallback(async (siteData: Partial<UserMiniSite>, siteId: string) => {
    if (!siteId) throw new Error('SITE_ID_REQUIRED');
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
        // Local storage is a recovery copy, never a substitute for server acknowledgement.
        console.warn('Firestore save failed; a local recovery copy was retained.', err);
        throw err;
      }
    }
  }, [user]);

  const loadMiniSite = useCallback(async (siteId: string) => {
    if (!siteId) throw new Error('SITE_ID_REQUIRED');
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

  const listMiniSites = useCallback(async () => {
    if (!user) return [];
    if (auth.currentUser) {
      try {
        return await listUserMiniSitesFromServer(user.uid);
      } catch (error) {
        console.warn('Could not list sites from the server; checking local cache.', error);
      }
    }
    if (typeof window === 'undefined') return [];
    const prefix = `raloa_site_${user.uid}_`;
    const sites: UserMiniSiteSummary[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith(prefix)) continue;
      const id = key.slice(prefix.length);
      try {
        const site = JSON.parse(window.localStorage.getItem(key) || '{}');
        sites.push({ id, username: site.username || id, displayName: site.displayName || id, isPublished: site.isPublished === true, updatedAt: site.updatedAt });
      } catch (_) {}
    }
    return sites;
  }, [user]);

  const createMiniSite = useCallback(async (siteData: Partial<UserMiniSite>, siteId?: string) => {
    if (!user) throw new Error('AUTH_REQUIRED');
    if (auth.currentUser) return createUserMiniSiteOnServer(user.uid, siteData, siteId);
    const resolvedId = siteId || `site_${crypto.randomUUID()}`;
    await saveMiniSite(siteData, resolvedId);
    return { ...siteData, id: resolvedId, userId: user.uid } as UserMiniSite;
  }, [user, saveMiniSite]);

  const deleteMiniSite = useCallback(async (siteId: string) => {
    if (!user || !siteId) throw new Error('SITE_ID_REQUIRED');
    if (auth.currentUser) await deleteUserMiniSiteFromServer(user.uid, siteId);
    try { localStorage.removeItem(`raloa_site_${user.uid}_${siteId}`); } catch (_) {}
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
        resetPassword,
        logOut,
        updatePlan,
        saveMiniSite,
        loadMiniSite,
        listMiniSites,
        createMiniSite,
        deleteMiniSite,
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
