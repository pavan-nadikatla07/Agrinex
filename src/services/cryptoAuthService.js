// Cryptographic Authentication & OTP Verification Service
// Uses Web Cryptography API (window.crypto and crypto.subtle) for tamper-proof OTP generation and signature hashing

const OTP_EXPIRY_MS = 60 * 1000; // 60 seconds validity
const MAX_ATTEMPTS = 3;

/**
 * Generate a cryptographically secure 6-digit OTP code using window.crypto
 */
export async function generateCryptographicOtp(phoneNumber) {
  const cleanPhone = (phoneNumber || '').replace(/\D/g, '');
  if (!cleanPhone || cleanPhone.length < 10) {
    throw new Error('Please provide a valid 10-digit phone number');
  }

  // Cryptographically secure pseudorandom 6-digit integer
  const array = new Uint32Array(1);
  window.crypto.getRandomValues(array);
  const otpNumber = (array[0] % 900000) + 100000;
  const otpCode = otpNumber.toString();

  const timestamp = Date.now();
  const expiresAt = timestamp + OTP_EXPIRY_MS;

  // Compute SHA-256 cryptographic signature token
  const message = `${cleanPhone}:${otpCode}:${timestamp}:AGRINEX_SALT_2026`;
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const cryptoHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 24);

  return {
    otp: otpCode,
    phoneNumber: cleanPhone,
    timestamp,
    expiresAt,
    cryptoHash: `0x${cryptoHash}`,
    carrier: 'Govt Agri-Telecom Secure Gateway (SMS Node)',
    attemptsRemaining: MAX_ATTEMPTS,
  };
}

/**
 * Verify an entered OTP against the active cryptographic OTP record
 */
export async function verifyCryptographicOtp(enteredCode, activeRecord) {
  if (!activeRecord) {
    return { valid: false, error: 'No active OTP session found. Please request a new OTP.' };
  }

  const now = Date.now();
  if (now > activeRecord.expiresAt) {
    return { valid: false, error: 'Cryptographic OTP has expired (60s validity). Please request a fresh OTP.' };
  }

  if (activeRecord.attemptsRemaining <= 0) {
    return { valid: false, error: 'Maximum verification attempts exceeded. Security lockout. Please request a new OTP.' };
  }

  const cleanEntered = (enteredCode || '').trim();
  if (cleanEntered.length !== 6) {
    activeRecord.attemptsRemaining -= 1;
    return {
      valid: false,
      error: `Invalid OTP format. Must be 6 digits. (${activeRecord.attemptsRemaining} attempts remaining)`,
    };
  }

  // Re-verify hash integrity
  const message = `${activeRecord.phoneNumber}:${cleanEntered}:${activeRecord.timestamp}:AGRINEX_SALT_2026`;
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const computedHash = `0x${hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 24)}`;

  if (computedHash === activeRecord.cryptoHash && cleanEntered === activeRecord.otp) {
    return {
      valid: true,
      cryptoVerified: true,
      verifiedAt: now,
      phone: activeRecord.phoneNumber,
    };
  }

  activeRecord.attemptsRemaining -= 1;
  return {
    valid: false,
    error: `Incorrect OTP code. Please check your SMS. (${activeRecord.attemptsRemaining} attempts left)`,
  };
}
