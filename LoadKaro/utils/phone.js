/**
 * India MVP: OTP uses E.164 `+91` + 10-digit mobile.
 * `formattedPhone` is always `+91` concatenated with exactly 10 digits (after validation).
 */

/** @param {string} input */
function digitsOnly(input) {
  return input.replace(/\D/g, '');
}

/**
 * Validates and builds `+91` + 10 digits (per product requirement).
 * @param {string} phoneInput — e.g. "9876543210", "919876543210", "+91 98765 43210"
 * @returns {{ ok: true, formattedPhone: string, tenDigits: string } | { ok: false }}
 */
export function formatPhoneOtpIndia(phoneInput) {
  const raw = digitsOnly(phoneInput);
  let ten = null;

  if (raw.length === 10) {
    ten = raw;
  } else if (raw.length === 12 && raw.startsWith('91')) {
    ten = raw.slice(2);
  } else if (raw.length === 11 && raw.startsWith('0')) {
    ten = raw.slice(1);
  }

  if (!ten || ten.length !== 10 || !/^[6-9]\d{9}$/.test(ten)) {
    return { ok: false };
  }

  const formattedPhone = '+91' + ten;
  return { ok: true, formattedPhone, tenDigits: ten };
}

/** @deprecated use formatPhoneOtpIndia */
export function formatIndianPhoneE164(input) {
  const r = formatPhoneOtpIndia(input);
  if (!r.ok) return { ok: false, reason: 'invalid' };
  return { ok: true, e164: r.formattedPhone, tenDigits: r.tenDigits };
}
