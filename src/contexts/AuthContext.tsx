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
  loadUserMiniSiteFromFirestore
} from '../lib/firebase';
import { UserProfile, UserMiniSite } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<User>;
  signInWithEmail: (email: string, pass: string) => Promise<User>;
  signUpWithEmail: (email: string, pass: string) => Promise<User>;
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
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userProf = await syncUserProfile(currentUser);
          setProfile(userProf);
        } catch (err) {
          console.error('Error synchronizing user profile on auth change:', err);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

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

  const signUpWithEmail = useCallback(async (email: string, pass: string) => {
    const loggedUser = await fbSignUpWithEmail(email, pass);
    const prof = await syncUserProfile(loggedUser);
    setUser(loggedUser);
    setProfile(prof);
    return loggedUser;
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    await fbSendPasswordReset(email);
  }, []);

  const logOut = useCallback(async () => {
    await fbLogOut();
    setUser(null);
    setProfile(null);
  }, []);

  const updatePlan = useCallback(async (plan: 'free' | 'pro' | 'studio', isYearly: boolean = false) => {
    if (!user) throw new Error('AUTH_REQUIRED');
    await updateUserPlan(user.uid, plan, isYearly);
    setProfile((prev) => (prev ? { ...prev, plan, isYearly, updatedAt: new Date().toISOString() } : null));
  }, [user]);

  const saveMiniSite = useCallback(async (siteData: Partial<UserMiniSite>, siteId: string = 'default') => {
    if (!user) return;
    await saveUserMiniSiteToFirestore(user.uid, siteData, siteId);
  }, [user]);

  const loadMiniSite = useCallback(async (siteId: string = 'default') => {
    if (!user) return null;
    return await loadUserMiniSiteFromFirestore(user.uid, siteId);
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
