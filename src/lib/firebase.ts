import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  User
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  serverTimestamp,
  getDocs,
  query,
  where,
  limit
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserProfile, UserMiniSite, ContactInquiry } from '../types';

// Initialize Firebase App instance safely (prevent duplicate initialization)
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Initialize Firestore Database with provisioned custom Database ID if specified
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Configure Google OAuth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

/**
 * Sign in with Google Popup
 */
export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  await syncUserProfile(user);
  return user;
}

/**
 * Sign in with Email and Password
 */
export async function signInWithEmail(email: string, pass: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, pass);
  await syncUserProfile(cred.user);
  return cred.user;
}

/**
 * Sign up with Email and Password
 */
export async function signUpWithEmail(email: string, pass: string): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email, pass);
  await syncUserProfile(cred.user);
  return cred.user;
}

/**
 * Send password reset email
 */
export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

/**
 * Sign out current user
 */
export async function logOut(): Promise<void> {
  await signOut(auth);
}

/**
 * Retrieve user profile document from Firestore
 */
export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const userDocRef = doc(db, 'users', uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }
}

/**
 * Synchronize / create user profile document in Firestore
 */
export async function syncUserProfile(
  user: User,
  customData: Partial<UserProfile> = {}
): Promise<UserProfile> {
  const userDocRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userDocRef);

  if (!snap.exists()) {
    const newProfile: UserProfile = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || user.email?.split('@')[0] || 'Creator',
      photoURL: user.photoURL || null,
      plan: 'free',
      isYearly: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...customData
    };
    await setDoc(userDocRef, newProfile);
    return newProfile;
  } else {
    const existing = snap.data() as UserProfile;
    const updatedProfile: UserProfile = {
      ...existing,
      email: user.email ?? existing.email,
      displayName: user.displayName ?? existing.displayName,
      photoURL: user.photoURL ?? existing.photoURL,
      updatedAt: new Date().toISOString(),
      ...customData
    };
    await setDoc(userDocRef, updatedProfile, { merge: true });
    return updatedProfile;
  }
}

/**
 * Update user subscription plan tier in Firestore
 */
export async function updateUserPlan(
  uid: string,
  plan: 'free' | 'pro' | 'studio',
  isYearly: boolean = false
): Promise<void> {
  const userDocRef = doc(db, 'users', uid);
  await setDoc(
    userDocRef,
    {
      plan,
      isYearly,
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );
}

/**
 * Save user mini-site in Firestore under users/{userId}/sites/{siteId}
 */
export async function saveUserMiniSiteToFirestore(
  userId: string,
  siteData: Partial<UserMiniSite>,
  siteId: string = 'default'
): Promise<void> {
  const siteDocRef = doc(db, 'users', userId, 'sites', siteId);
  await setDoc(
    siteDocRef,
    {
      ...siteData,
      id: siteId,
      userId,
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );
}

/**
 * Load user mini-site from Firestore
 */
export async function loadUserMiniSiteFromFirestore(
  userId: string,
  siteId: string = 'default'
): Promise<UserMiniSite | null> {
  try {
    const siteDocRef = doc(db, 'users', userId, 'sites', siteId);
    const snap = await getDoc(siteDocRef);
    if (snap.exists()) {
      return snap.data() as UserMiniSite;
    }
    return null;
  } catch (error) {
    console.error('Error loading mini-site from Firestore:', error);
    return null;
  }
}

/**
 * Record contact inquiry in Firestore
 */
export async function saveContactMessage(inquiry: ContactInquiry): Promise<string> {
  const colRef = collection(db, 'contacts');
  const docRef = await addDoc(colRef, {
    ...inquiry,
    createdAt: new Date().toISOString()
  });
  return docRef.id;
}

export async function saveNewsletterSubscription(email: string): Promise<string> {
  const docRef = await addDoc(collection(db, 'newsletter_subscribers'), {
    email: email.trim().toLowerCase(),
    createdAt: new Date().toISOString()
  });
  return docRef.id;
}
