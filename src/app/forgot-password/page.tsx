'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Container } from '../../components/layout/container';
import { useAuth } from '../../components/auth/AuthProvider';
import { LeafIcon } from '../../components/ui/icons';

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !email.trim()) {
      setError('Please enter your registered email address.');
      return;
    }
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await resetPassword(email);
      if (!res.success) {
        setError(res.error || 'Failed to send reset link. Please check the email entered.');
        setIsSubmitting(false);
        return;
      }

      setSuccess(true);
      setIsSubmitting(false);
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="py-12 sm:py-16 bg-gradient-to-b from-stone-50 via-emerald-50/20 to-stone-50 min-h-[calc(100vh-4rem)] flex items-center">
      <Container size="sm">
        <div className="w-full max-w-md mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex w-12 h-12 rounded-2xl bg-emerald-800 text-white items-center justify-center shadow-sm mb-4">
              <LeafIcon size={24} className="text-emerald-300" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
              Reset Password
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 mt-2">
              Enter your registered email address to receive password recovery instructions
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-white/90 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-stone-200/80 shadow-sm">
            {success ? (
              <div className="text-center space-y-4 py-2">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto text-xl">
                  ✉️
                </div>
                <h2 className="text-base font-bold text-stone-900">Reset Link Sent</h2>
                <p className="text-xs text-stone-600 leading-relaxed">
                  We&apos;ve dispatched a password reset link to{' '}
                  <span className="font-semibold text-stone-900">{email}</span>. Please check your inbox and follow the instructions.
                </p>
                <div className="pt-4">
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center py-2.5 px-6 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs transition-colors shadow-2xs"
                  >
                    Return to Sign In
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {error && (
                  <div
                    role="alert"
                    className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-800 flex items-start gap-2.5"
                  >
                    <span className="text-sm">⚠️</span>
                    <div className="flex-1">{error}</div>
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate className="space-y-4">
                  <div>
                    <label
                      htmlFor="reset-email"
                      className="block text-xs font-bold text-stone-800 uppercase tracking-wider mb-1.5"
                    >
                      Email Address
                    </label>
                    <input
                      id="reset-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="student@campus.edu"
                      disabled={isSubmitting}
                      className="w-full px-4 py-3 rounded-xl border border-stone-300 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-transparent text-sm transition-all min-h-[44px]"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3 px-4 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px]"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Sending reset link...</span>
                        </>
                      ) : (
                        <span>Send Reset Link</span>
                      )}
                    </button>
                  </div>
                </form>

                <div className="mt-6 pt-5 border-t border-stone-100 text-center">
                  <Link
                    href="/login"
                    className="text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors"
                  >
                    ← Back to Sign In
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </Container>
    </div>
  );
}
