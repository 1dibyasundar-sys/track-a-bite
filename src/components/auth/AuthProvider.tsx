'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthUser, AuthStatus, AuthActionResult } from '../../lib/types/auth';
import { firebaseAuthService } from '../../lib/services/firebaseAuthService';
import {
  userProfileService,
  mealHistoryService,
  firestoreMealHistoryService,
  hydrationStorageService,
} from '../../lib/services';

export interface AuthContextType {
  user: AuthUser | null;
  status: AuthStatus;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthActionResult>;
  register: (email: string, password: string, displayName?: string) => Promise<AuthActionResult>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<AuthActionResult>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Idempotency guard: prevent duplicate migrations during the same authenticated session
const migratedUsers = new Set<string>();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    const unsubscribe = firebaseAuthService.subscribeToAuthState(async (authUser) => {
      setUser(authUser);
      setStatus(authUser ? 'authenticated' : 'unauthenticated');

      if (authUser) {
        try {
          await userProfileService.syncAuthenticatedProfile(authUser);
        } catch (err) {
          console.warn('[AuthProvider] Profile synchronization notice:', err);
        }

        // Phase 8.2 & 8.3: Migrate completed local scans to cloud once per authenticated session
        if (!migratedUsers.has(authUser.uid)) {
          migratedUsers.add(authUser.uid);
          try {
            const localMeals = await mealHistoryService.getRecentMeals();
            if (localMeals && localMeals.length > 0) {
              const realLocalMeals = localMeals.filter(m => !m.id.startsWith('mock-meal-'));
              if (realLocalMeals.length > 0) {
                await firestoreMealHistoryService.migrateLocalMeals(authUser.uid, realLocalMeals);
              }
            }
          } catch (err) {
            console.warn('[AuthProvider] Local meals migration notice:', err);
          }
        }
      } else {
        userProfileService.cleanupSubscription();
        firestoreMealHistoryService.cleanupSubscriptions();
      }
    });

    return () => {
      unsubscribe();
      userProfileService.cleanupSubscription();
      firestoreMealHistoryService.cleanupSubscriptions();
    };
  }, []);

  const login = async (email: string, password: string): Promise<AuthActionResult> => {
    return await firebaseAuthService.signIn(email, password);
  };

  const register = async (
    email: string,
    password: string,
    displayName?: string
  ): Promise<AuthActionResult> => {
    return await firebaseAuthService.signUp(email, password, displayName);
  };

  const logout = async (): Promise<void> => {
    userProfileService.cleanupSubscription();
    firestoreMealHistoryService.cleanupSubscriptions();
    userProfileService.clearProfile();
    hydrationStorageService.clearAll();
    if (typeof mealHistoryService.clearHistory === 'function') {
      await mealHistoryService.clearHistory();
    }
    migratedUsers.clear();
    await firebaseAuthService.signOut();
    setUser(null);
    setStatus('unauthenticated');
  };

  const resetPassword = async (email: string): Promise<AuthActionResult> => {
    return await firebaseAuthService.sendPasswordReset(email);
  };

  const value: AuthContextType = {
    user,
    status,
    loading: status === 'loading',
    isAuthenticated: status === 'authenticated',
    login,
    register,
    logout,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
