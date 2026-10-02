'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Container } from '../../components/layout/container';
import { useAuth } from '../../components/auth/AuthProvider';
import { validateRegisterForm } from '../../lib/types/auth';
import { LeafIcon } from '../../components/ui/icons';

export default function RegisterPage() {
  const router = useRouter();
  const { register, user } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Authenticated user redirect: auto-route to dashboard if session already active
  React.useEffect(() => {
    if (user) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const validation = validateRegisterForm({
      email,
      password,
      confirmPassword,
      displayName,
    });

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});
    setIsSubmitting(true);

    try {
      const res = await register(email, password, displayName);
      if (!res.success) {
        setServerError(res.error || 'Failed to create account. Please try again.');
        setIsSubmitting(false);
        return;
      }

      // On successful registration, guide user to complete nutrition profile
      router.push('/onboarding');
    } catch {
      setServerError('An unexpected network error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="py-12 sm:py-16 bg-gradient-to-b from-stone-50 via-emerald-50/20 to-stone-50 min-h-[calc(100vh-4rem)] flex items-center">
      <Container size="sm">
        <div className="w-full max-w-md mx-auto">
          {/* Brand Header */}
          <div className="text-center mb-8">
            <div className="inline-flex w-12 h-12 rounded-2xl bg-emerald-800 text-white items-center justify-center shadow-sm mb-4">
              <LeafIcon size={24} className="text-emerald-300" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
              Join Track-a-Bite
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 mt-2">
              Create your account to personalize your daily nutrition insights
            </p>
          </div>

          {/* Registration Card */}
          <div className="bg-white/90 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-stone-200/80 shadow-sm">
            {serverError && (
              <div
                role="alert"
                className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-800 flex items-start gap-2.5"
              >
                <span className="text-sm">⚠️</span>
                <div className="flex-1">{serverError}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {/* Optional Name */}
              <div>
                <label
                  htmlFor="register-name"
                  className="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-1.5"
                >
                  Name <span className="text-stone-400 font-normal lowercase">(optional)</span>
                </label>
                <input
                  id="register-name"
                  name="displayName"
                  type="text"
                  autoComplete="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Aarav Sharma"
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 rounded-xl border border-stone-300 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-transparent text-sm transition-all min-h-[44px]"
                />
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="register-email"
                  className="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-1.5"
                >
                  Email Address
                </label>
                <input
                  id="register-email"
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
                  aria-describedby={errors.email ? 'register-email-error' : undefined}
                  placeholder="student@campus.edu"
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 rounded-xl border border-stone-300 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-transparent text-sm transition-all min-h-[44px]"
                />
                {errors.email && (
                  <p id="register-email-error" className="text-xs text-red-600 font-medium mt-1">
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="register-password"
                  className="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-1.5"
                >
                  Password
                </label>
                <input
                  id="register-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                  }}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'register-password-error' : undefined}
                  placeholder="At least 6 characters"
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 rounded-xl border border-stone-300 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-transparent text-sm transition-all min-h-[44px]"
                />
                {errors.password && (
                  <p id="register-password-error" className="text-xs text-red-600 font-medium mt-1">
                    {errors.password}
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label
                  htmlFor="register-confirm-password"
                  className="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-1.5"
                >
                  Confirm Password
                </label>
                <input
                  id="register-confirm-password"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: '' }));
                  }}
                  aria-invalid={Boolean(errors.confirmPassword)}
                  aria-describedby={errors.confirmPassword ? 'register-confirm-error' : undefined}
                  placeholder="Re-enter your password"
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 rounded-xl border border-stone-300 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-transparent text-sm transition-all min-h-[44px]"
                />
                {errors.confirmPassword && (
                  <p id="register-confirm-error" className="text-xs text-red-600 font-medium mt-1">
                    {errors.confirmPassword}
                  </p>
                )}
              </div>

              {/* Submit CTA */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px]"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Creating your account...</span>
                    </>
                  ) : (
                    <span>Create Account</span>
                  )}
                </button>
              </div>
            </form>

            {/* Footer Link */}
            <div className="mt-6 pt-5 border-t border-stone-100 text-center">
              <p className="text-xs text-stone-600">
                Already have an account?{' '}
                <Link
                  href="/login"
                  className="font-bold text-emerald-800 hover:text-emerald-900 hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
