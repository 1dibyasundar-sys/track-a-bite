/**
 * Diagnostic Logger Service (Phase 9.5)
 *
 * Centralized, structured diagnostics for Track-a-Bite.
 * - Categorizes errors and events with consistent labels.
 * - Automatically redacts passwords, tokens, API keys, and sensitive profile metrics in production.
 * - Formats clear, actionable diagnostics in development mode.
 */

export type DiagnosticCategory =
  | 'AUTH_ERROR'
  | 'FIRESTORE_ERROR'
  | 'GEMINI_ERROR'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'SYNC_ERROR'
  | 'EXPORT_ERROR'
  | 'HYDRATION_ERROR'
  | 'ANALYTICS_ERROR'
  | 'UI_ERROR'
  | 'REACT_ERROR';

export interface DiagnosticEvent {
  category: DiagnosticCategory;
  message: string;
  context?: Record<string, unknown>;
  originalError?: unknown;
  timestamp?: string;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'refreshtoken',
  'accesstoken',
  'gemini_api_key',
  'api_key',
  'apikey',
  'secret',
  'authorization',
  'bearer',
  'credential',
]);

/**
 * Recursively redacts sensitive keys from context objects.
 */
function sanitizeContext(obj: unknown, depth = 0): unknown {
  if (depth > 4 || obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeContext(item, depth + 1));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('password') || lowerKey.includes('secret')) {
      sanitized[key] = '[REDACTED]';
    } else if (lowerKey === 'email' && typeof value === 'string') {
      // Partial email mask: u***@domain.com
      const parts = value.split('@');
      sanitized[key] = parts.length === 2 ? `${parts[0].slice(0, 1)}***@${parts[1]}` : '[REDACTED]';
    } else {
      sanitized[key] = sanitizeContext(value, depth + 1);
    }
  }
  return sanitized;
}

export class DiagnosticLogger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  public log(category: DiagnosticCategory, message: string, context?: Record<string, unknown>): void {
    const sanitized = context ? (sanitizeContext(context) as Record<string, unknown>) : undefined;
    const timestamp = new Date().toISOString();

    if (this.isDevelopment) {
      console.log(`[${timestamp}] [${category}] ${message}`, sanitized || '');
    }
  }

  public warn(category: DiagnosticCategory, message: string, context?: Record<string, unknown>): void {
    const sanitized = context ? (sanitizeContext(context) as Record<string, unknown>) : undefined;
    const timestamp = new Date().toISOString();

    if (this.isDevelopment) {
      console.warn(`[${timestamp}] [${category}] ${message}`, sanitized || '');
    } else {
      // Production: concise, non-sensitive warning
      console.warn(`[${category}] ${message}`);
    }
  }

  public error(
    category: DiagnosticCategory,
    message: string,
    originalError?: unknown,
    context?: Record<string, unknown>
  ): void {
    const sanitized = context ? (sanitizeContext(context) as Record<string, unknown>) : undefined;
    const timestamp = new Date().toISOString();

    if (this.isDevelopment) {
      console.error(`[${timestamp}] [${category}] ${message}`, originalError || '', sanitized || '');
    } else {
      // Production: sanitized message without internal stack traces or secrets
      const errMessage = (originalError as Error)?.message || 'An internal error occurred';
      console.error(`[${category}] ${message}: ${errMessage}`);
    }
  }
}

export const diagnosticLogger = new DiagnosticLogger();
