import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase.ts';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors.ts';
import {
  adminSeedSampleCatalogAndKB,
  createTechnicianProfile,
  createUserProfile,
  getTechnicianProfile,
  getUserProfile,
  listVerifiedTechnicians,
  updateUserProfileDoc,
} from '../services/firestoreService.ts';
import type { ApplianceSlug, TechnicianProfile, UserProfile, UserRole } from '../types/domain.ts';

const BOOTSTRAPPED_ADMIN_EMAIL = 'prajwalm1122@gmail.com';

interface PendingRegistrationMeta {
  displayName: string;
  role: 'customer' | 'technician';
  phone?: string;
  address?: string;
  serviceArea?: string;
  experienceYears?: number;
  serviceCategories?: ApplianceSlug[];
  skills?: string[];
  bio?: string;
}

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  technicianProfile: TechnicianProfile | null;
  loading: boolean;
  needsEmailVerification: boolean;
  isSuspended: boolean;
  authError: string | null;
  clearAuthError: () => void;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (params: {
    email: string;
    password: string;
    displayName: string;
    role: 'customer' | 'technician';
    phone?: string;
    address?: string;
    serviceArea?: string;
    experienceYears?: number;
    serviceCategories?: ApplianceSlug[];
    skills?: string[];
    bio?: string;
  }) => Promise<{ requiresVerification: boolean }>;
  loginWithGoogle: (preferredRole?: 'customer' | 'technician') => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshVerificationStatus: () => Promise<boolean>;
  updateProfileFields: (updates: {
    displayName: string;
    phone?: string;
    address?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  getAuthToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function pendingKey(uid: string): string {
  return `fixmate_pending_profile_${uid}`;
}

function readPendingMeta(uid: string): PendingRegistrationMeta | null {
  try {
    const raw = localStorage.getItem(pendingKey(uid));
    return raw ? (JSON.parse(raw) as PendingRegistrationMeta) : null;
  } catch {
    return null;
  }
}

function writePendingMeta(uid: string, meta: PendingRegistrationMeta): void {
  try {
    localStorage.setItem(pendingKey(uid), JSON.stringify(meta));
  } catch {
    // ignore storage errors
  }
}

function clearPendingMeta(uid: string): void {
  try {
    localStorage.removeItem(pendingKey(uid));
  } catch {
    // ignore
  }
}

export function mapFirebaseAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please verify your credentials or reset your password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Please sign in instead.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters long.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in popup was closed before completion.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not yet enabled in Firebase Console -> Authentication -> Sign-in method. You can enable it there or use Google Sign-In immediately.';
    default:
      return err instanceof Error ? err.message : 'Authentication request failed.';
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [technicianProfile, setTechnicianProfile] = useState<TechnicianProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [verificationTick, setVerificationTick] = useState(0);
  const directorySyncAttemptedRef = useRef(false);

  const ensureFirestoreProfile = useCallback(
    async (user: User, preferredRole?: 'customer' | 'technician') => {
      if (!user.emailVerified) return;

      const pending = readPendingMeta(user.uid);
      const existingUser = await getUserProfile(user.uid);

      const isBootstrappedAdmin =
        user.email === BOOTSTRAPPED_ADMIN_EMAIL && user.emailVerified;

      const resolvedRole: UserRole =
        existingUser?.role ??
        (isBootstrappedAdmin ? 'admin' : pending?.role ?? preferredRole ?? 'customer');

      if (!existingUser) {
        await createUserProfile({
          uid: user.uid,
          displayName:
            pending?.displayName || user.displayName || user.email?.split('@')[0] || 'FixMate User',
          email: user.email || '',
          role: resolvedRole,
          phone: pending?.phone,
          address: pending?.address,
          photoURL: user.photoURL || undefined,
        });
      }

      if (resolvedRole === 'technician') {
        const existingTech = await getTechnicianProfile(user.uid);
        if (!existingTech) {
          await createTechnicianProfile({
            uid: user.uid,
            displayName:
              pending?.displayName ||
              existingUser?.displayName ||
              user.displayName ||
              user.email?.split('@')[0] ||
              'Technician',
            bio: pending?.bio || '',
            serviceCategories:
              pending?.serviceCategories && pending.serviceCategories.length > 0
                ? pending.serviceCategories
                : ['refrigerator', 'washing_machine'],
            skills:
              pending?.skills && pending.skills.length > 0
                ? pending.skills
                : ['Fault Diagnostics', 'Component Replacement'],
            experienceYears: pending?.experienceYears ?? 2,
            serviceArea: pending?.serviceArea || 'Local Metro Area',
          });
        }
      }

      if (isBootstrappedAdmin) {
        try {
          const existingVerified = await listVerifiedTechnicians();
          const hasAllDirectoryTechs = ['tech_arjun_nair', 'tech_meera_kulkarni', 'tech_vikram_deshmukh', 'tech_rohan_iyer'].every(
            (id) => existingVerified.some((t) => t.uid === id)
          );
          if (!hasAllDirectoryTechs) {
            await adminSeedSampleCatalogAndKB();
          }
        } catch (seedErr) {
          console.warn('Automatic catalog initialization skipped:', seedErr);
        }
      }

      clearPendingMeta(user.uid);
    },
    []
  );

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    let unsubTech: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }
      if (unsubTech) {
        unsubTech();
        unsubTech = null;
      }

      setFirebaseUser(user);

      if (!user) {
        setProfile(null);
        setTechnicianProfile(null);
        setLoading(false);
        return;
      }

      if (!user.emailVerified) {
        setProfile(null);
        setTechnicianProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const userDocRef = doc(db, 'users', user.uid);
      unsubProfile = onSnapshot(
        userDocRef,
        async (snap) => {
          if (!snap.exists()) {
            try {
              await ensureFirestoreProfile(user);
            } catch (err) {
              console.error('Auto-provisioning profile failed:', err);
              setLoading(false);
            }
            return;
          }

          const userData = snap.data() as UserProfile;
          setProfile(userData);

          if (
            userData.role === 'admin' &&
            user.email === BOOTSTRAPPED_ADMIN_EMAIL &&
            !directorySyncAttemptedRef.current
          ) {
            directorySyncAttemptedRef.current = true;
            void listVerifiedTechnicians()
              .then((existing) => {
                const hasAll = ['tech_arjun_nair', 'tech_meera_kulkarni', 'tech_vikram_deshmukh', 'tech_rohan_iyer'].every(
                  (id) => existing.some((t) => t.uid === id)
                );
                if (!hasAll) {
                  return adminSeedSampleCatalogAndKB();
                }
                return undefined;
              })
              .catch((syncErr) => {
                console.warn('Directory background sync skipped:', syncErr);
              });
          }

          if (userData.role === 'technician' && !unsubTech) {
            unsubTech = onSnapshot(
              doc(db, 'technicians', user.uid),
              (techSnap) => {
                setTechnicianProfile(
                  techSnap.exists() ? (techSnap.data() as TechnicianProfile) : null
                );
              },
              (err) => handleFirestoreError(err, OperationType.GET, `technicians/${user.uid}`)
            );
          } else if (userData.role !== 'technician') {
            setTechnicianProfile(null);
          }

          setLoading(false);
        },
        (error) => {
          setLoading(false);
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        }
      );
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
      if (unsubTech) unsubTech();
    };
  }, [ensureFirestoreProfile, verificationTick]);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  }, []);

  const registerWithEmail: AuthContextValue['registerWithEmail'] = useCallback(async (params) => {
    setAuthError(null);
    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        params.email.trim(),
        params.password
      );
      await updateProfile(cred.user, { displayName: params.displayName.trim() });
      writePendingMeta(cred.user.uid, {
        displayName: params.displayName.trim(),
        role: params.role,
        phone: params.phone,
        address: params.address,
        serviceArea: params.serviceArea,
        experienceYears: params.experienceYears,
        serviceCategories: params.serviceCategories,
        skills: params.skills,
        bio: params.bio,
      });

      await sendEmailVerification(cred.user);
      return { requiresVerification: !cred.user.emailVerified };
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  }, []);

  const loginWithGoogle = useCallback(
    async (preferredRole?: 'customer' | 'technician') => {
      setAuthError(null);
      try {
        const cred = await signInWithPopup(auth, googleProvider);
        if (preferredRole) {
          writePendingMeta(cred.user.uid, {
            displayName: cred.user.displayName || 'FixMate User',
            role: preferredRole,
          });
        }
        await ensureFirestoreProfile(cred.user, preferredRole);
      } catch (err) {
        const msg = mapFirebaseAuthError(err);
        setAuthError(msg);
        throw new Error(msg);
      }
    },
    [ensureFirestoreProfile]
  );

  const sendPasswordReset = useCallback(async (email: string) => {
    setAuthError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    if (!auth.currentUser) return;
    setAuthError(null);
    try {
      await sendEmailVerification(auth.currentUser);
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    }
  }, []);

  const refreshVerificationStatus = useCallback(async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    await reload(auth.currentUser);
    await auth.currentUser.getIdToken(true);
    const refreshed = auth.currentUser;
    if (refreshed.emailVerified) {
      await ensureFirestoreProfile(refreshed);
      setFirebaseUser(refreshed);
      setVerificationTick((tick) => tick + 1);
      return true;
    }
    return false;
  }, [ensureFirestoreProfile]);

  const updateProfileFields = useCallback(
    async (updates: { displayName: string; phone?: string; address?: string }) => {
      if (!auth.currentUser) throw new Error('Not authenticated.');
      await updateProfile(auth.currentUser, { displayName: updates.displayName });
      await updateUserProfileDoc(auth.currentUser.uid, updates);
    },
    []
  );

  const logout = useCallback(async () => {
    setAuthError(null);
    await signOut(auth);
  }, []);

  const getAuthToken = useCallback(async () => {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken();
  }, []);

  const needsEmailVerification = Boolean(firebaseUser && !firebaseUser.emailVerified);
  const isSuspended =
    profile?.accountStatus === 'suspended' ||
    technicianProfile?.verificationStatus === 'suspended';

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        technicianProfile,
        loading,
        needsEmailVerification,
        isSuspended,
        authError,
        clearAuthError,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        sendPasswordReset,
        resendVerificationEmail,
        refreshVerificationStatus,
        updateProfileFields,
        logout,
        getAuthToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
