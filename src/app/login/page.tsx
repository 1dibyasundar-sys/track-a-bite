'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Container } from '../../components/layout/container';
import { useAuth } from '../../components/auth/AuthProvider';
import { profileStorageService } from '../../lib/services/profileStorageService';
import { validateLoginForm } from '../../lib/types/auth';
import { LeafIcon } from '../../components/ui/icons';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');

  const { login, user } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Authenticated user redirect: auto-route away if session already exists
  React.useEffect(() => {
    if (user) {
      if (redirectParam && redirectParam.startsWith('/')) {
        router.replace(redirectParam);
      } else {
        router.replace('/dashboard');
      }
    }
  }, [user, redirectParam, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const validation = validateLoginForm({ email, password });
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});
    setIsSubmitting(true);

    try {
      const res = await login(email, password);
      if (!res.success) {
        setServerError(res.error || 'Failed to sign in. Please check your credentials.');
        setIsSubmitting(false);
        return;
      }

      // Successful login flow
      if (redirectParam && redirectParam.startsWith('/')) {
        router.push(redirectParam);
      } else if (profileStorageService.hasCompletedOnboarding()) {
        router.push('/scan');
      } else {
        router.push('/onboarding');
      }
    } catch {
      setServerError('An unexpected network error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="inline-flex w-12 h-12 rounded-2xl bg-emerald-800 text-white items-center justify-center shadow-sm mb-4">
          <LeafIcon size={24} className="text-emerald-300" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-stone-900 dark:text-stone-100 tracking-tight">
          Welcome back
        </h1>
        <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-2">
          Sign in to your Track-a-Bite student nutrition account
        </p>
      </div>

      {/* Login Card */}
      <div className="bg-white/90 dark:bg-[#131d16]/90 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-stone-200/80 dark:border-[#23382b] shadow-sm">
        {serverError && (
          <div
            role="alert"
            className="mb-5 p-3.5 rounded-xl bg-red-50 dark:bg-rose-950/40 border border-red-200 dark:border-rose-900/60 text-xs font-medium text-red-800 dark:text-rose-300 flex items-start gap-2.5"
          >
            <span className="text-sm">⚠️</span>
            <div className="flex-1">{serverError}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Email */}
          <div>
            <label
              htmlFor="login-email"
              className="block text-xs font-bold text-stone-800 dark:text-stone-200 uppercase tracking-wider mb-1.5"
            >
              Email Address
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
              }}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'login-email-error' : undefined}
              placeholder="student@campus.edu"
              disabled={isSubmitting}
              className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-[#23382b] bg-white dark:bg-[#19271e] text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-transparent text-sm transition-all min-h-[44px]"
            />
            {errors.email && (
              <p id="login-email-error" className="text-xs text-red-600 dark:text-rose-400 font-medium mt-1">
                {errors.email}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="login-password"
                className="block text-xs font-bold text-stone-800 dark:text-stone-200 uppercase tracking-wider"
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs font-semibold text-emerald-800 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
              }}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'login-password-error' : undefined}
              placeholder="••••••••"
              disabled={isSubmitting}
              className="w-full px-4 py-3 rounded-xl border border-stone-300 dark:border-[#23382b] bg-white dark:bg-[#19271e] text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-transparent text-sm transition-all min-h-[44px]"
            />
            {errors.password && (
              <p id="login-password-error" className="text-xs text-red-600 dark:text-rose-400 font-medium mt-1">
                {errors.password}
              </p>
            )}
          </div>

          {/* Submit CTA */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-xl bg-emerald-800 dark:bg-emerald-700 hover:bg-emerald-900 dark:hover:bg-emerald-600 text-white font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px]"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </div>
        </form>

        {/* Footer Link */}
        <div className="mt-6 pt-5 border-t border-stone-100 dark:border-[#23382b] text-center">
          <p className="text-xs text-stone-600 dark:text-stone-400">
            Don&apos;t have an account yet?{' '}
            <Link
              href="/register"
              className="font-bold text-emerald-800 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 hover:underline"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="py-12 sm:py-16 bg-gradient-to-b from-stone-50 via-emerald-50/20 to-stone-50 dark:from-[#0c130e] dark:via-[#131d16] dark:to-[#0c130e] min-h-[calc(100vh-4rem)] flex items-center">
      <Container size="sm">
        <Suspense
          fallback={
            <div className="py-20 text-center">
              <div className="w-8 h-8 border-3 border-emerald-700 dark:border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">Loading sign in...</p>
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </Container>
    </div>
  );
}
