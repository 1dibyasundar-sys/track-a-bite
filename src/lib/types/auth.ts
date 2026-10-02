/**
 * Authentication Domain Model (Phase 7.2)
 *
 * Isolated application domain types for user authentication.
 * Maps Firebase user representations to pure application models.
 */

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}

export interface FirestoreUserDocument {
  uid: string;
  email: string | null;
  displayName: string | null;
  createdAt: unknown;
  updatedAt: unknown;
  onboardingCompleted: boolean;
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthActionResult {
  success: boolean;
  error?: string;
  user?: AuthUser;
}

export interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  displayName?: string;
}

export interface LoginFormData {
  email: string;
  password: string;
}

export interface ForgotPasswordFormData {
  email: string;
}

export interface AuthValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Validates registration form fields prior to submission.
 */
export function validateRegisterForm(data: Partial<RegisterFormData>): AuthValidationResult {
  const errors: Record<string, string> = {};

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email || !data.email.trim()) {
    errors.email = 'Email address is required.';
  } else if (!emailRegex.test(data.email.trim())) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!data.password) {
    errors.password = 'Password is required.';
  } else if (data.password.length < 6) {
    errors.password = 'Password must be at least 6 characters.';
  }

  if (!data.confirmPassword) {
    errors.confirmPassword = 'Confirm your password.';
  } else if (data.password !== data.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validates login form fields prior to submission.
 */
export function validateLoginForm(data: Partial<LoginFormData>): AuthValidationResult {
  const errors: Record<string, string> = {};

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email || !data.email.trim()) {
    errors.email = 'Email address is required.';
  } else if (!emailRegex.test(data.email.trim())) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!data.password) {
    errors.password = 'Password is required.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Maps raw Firebase Auth error codes to friendly, non-technical error messages.
 */
export function mapAuthErrorCode(codeOrMessage?: string): string {
  if (!codeOrMessage) return 'An unexpected error occurred. Please try again.';

  const code = codeOrMessage.toLowerCase();

  if (code.includes('auth/invalid-credential') || code.includes('invalid-credential')) {
    return 'Email or password is incorrect.';
  }
  if (code.includes('auth/user-not-found') || code.includes('user-not-found')) {
    return 'No account found with this email.';
  }
  if (code.includes('auth/wrong-password') || code.includes('wrong-password')) {
    return 'Email or password is incorrect.';
  }
  if (code.includes('auth/email-already-in-use') || code.includes('email-already-in-use')) {
    return 'This email is already registered. Try signing in instead.';
  }
  if (code.includes('auth/weak-password') || code.includes('weak-password')) {
    return 'Password should be at least 6 characters.';
  }
  if (code.includes('auth/invalid-email') || code.includes('invalid-email')) {
    return 'Enter a valid email address.';
  }
  if (code.includes('auth/too-many-requests') || code.includes('too-many-requests')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (code.includes('auth/network-request-failed') || code.includes('network-request-failed')) {
    return 'Network connection failed. Please check your internet connection.';
  }
  if (code.includes('auth/user-disabled') || code.includes('user-disabled')) {
    return 'This account has been disabled. Please contact support.';
  }

  return 'Authentication failed. Please verify your credentials and try again.';
}
