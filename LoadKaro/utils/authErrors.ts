import { strings } from '../constants/strings';

/** Map Supabase / Postgres errors to user-facing copy. */
export function getAuthErrorMessage(error: unknown): string {
  const raw =
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
      ? (error as { message: string }).message
      : '';

  const msg = raw || strings.generic_error;

  if (/invalid|expired|token|otp/i.test(msg) && /otp|sms|phone/i.test(msg)) {
    return strings.invalid_otp;
  }
  if (/duplicate|unique|already exists|23505/i.test(msg)) {
    return strings.duplicate_phone;
  }
  if (/role|mandatory|required|null value|23502/i.test(msg)) {
    return strings.missing_role;
  }

  return msg;
}
