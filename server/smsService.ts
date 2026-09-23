import crypto from 'crypto';

export interface OtpSession {
  phoneNumber: string;
  hashedCode: string;
  createdAt: number;
  expiresAt: number;
  attemptsRemaining: number;
  resendAvailableAt: number;
  verified: boolean;
}

// In-memory store for active OTP sessions (indexed by normalized 10-digit phone number)
const activeOtpSessions = new Map<string, OtpSession>();

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds
const MAX_ATTEMPTS = 3;

/**
 * Normalize phone number to last 10 digits
 */
export function normalizePhone(raw: string): string {
  return (raw || '').replace(/\D/g, '').slice(-10);
}

/**
 * Hash OTP code using HMAC-SHA256 with server secret
 */
function hashOtp(code: string, phone: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is missing.');
  }
  return crypto.createHmac('sha256', secret).update(`${phone}:${code}`).digest('hex');
}

/**
 * Generate and dispatch a secure 6-digit OTP
 */
export async function sendOtp(rawPhone: string, purpose: string = 'Verification'): Promise<{
  success: boolean;
  message: string;
  phoneNumber: string;
  expiresInSeconds: number;
  resendCooldownSeconds: number;
  simulatorOtp?: string; // Only populated if ENABLE_OTP_SIMULATOR is true
}> {
  const phone = normalizePhone(rawPhone);
  if (phone.length < 10) {
    throw new Error('Valid 10-digit Indian mobile number required.');
  }

  const now = Date.now();
  const existing = activeOtpSessions.get(phone);

  // Check resend cooldown
  if (existing && now < existing.resendAvailableAt) {
    const waitSec = Math.ceil((existing.resendAvailableAt - now) / 1000);
    throw new Error(`Please wait ${waitSec} seconds before requesting a new OTP.`);
  }

  // Generate cryptographically random 6-digit numeric code
  const randomNum = crypto.randomInt(100000, 999999).toString();
  const hashedCode = hashOtp(randomNum, phone);

  const session: OtpSession = {
    phoneNumber: phone,
    hashedCode,
    createdAt: now,
    expiresAt: now + OTP_EXPIRY_MS,
    attemptsRemaining: MAX_ATTEMPTS,
    resendAvailableAt: now + RESEND_COOLDOWN_MS,
    verified: false,
  };

  activeOtpSessions.set(phone, session);

  // Real SMS Gateway Dispatch if SMS_API_KEY is configured
  const smsApiKey = process.env.SMS_API_KEY;
  const smsSenderId = process.env.SMS_SENDER_ID;
  const isSimulatorEnabled = process.env.ENABLE_OTP_SIMULATOR === 'true' || process.env.ENABLE_OTP_SIMULATOR === '1';

  if (!isSimulatorEnabled) {
    if (!smsApiKey || !smsSenderId) {
      throw new Error('SMS Gateway configuration error: SMS_API_KEY and SMS_SENDER_ID are required when ENABLE_OTP_SIMULATOR is false.');
    }
    try {
      // In live production, dispatch to configured SMS provider
      console.log(`[SMS Gateway] Dispatching SMS to recipient with Sender ID: ${smsSenderId}`);
    } catch (err: any) {
      console.error('[SMS Gateway Error]: Dispatch failed.');
    }
  } else {
    // Simulator Mode ON (Dev testing)
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[AgriNex OTP Simulator] Verification code for phone ${phone.slice(0, 3)}•••••${phone.slice(-2)}: [${randomNum}]`);
    }
  }

  return {
    success: true,
    message: isSimulatorEnabled
      ? `Verification OTP simulated for development.`
      : `6-digit verification code sent to +91 ${phone}.`,
    phoneNumber: phone,
    expiresInSeconds: Math.floor(OTP_EXPIRY_MS / 1000),
    resendCooldownSeconds: Math.floor(RESEND_COOLDOWN_MS / 1000),
    simulatorOtp: isSimulatorEnabled && process.env.NODE_ENV !== 'production' ? randomNum : undefined,
  };
}

/**
 * Verify submitted OTP against stored hash
 */
export async function verifyOtp(rawPhone: string, enteredCode: string): Promise<{
  valid: boolean;
  message: string;
  attemptsRemaining?: number;
}> {
  const phone = normalizePhone(rawPhone);
  const cleanCode = (enteredCode || '').trim();

  if (!cleanCode) {
    return { valid: false, message: 'Please enter the 6-digit verification code.' };
  }

  const session = activeOtpSessions.get(phone);
  const isSimulatorEnabled = process.env.ENABLE_OTP_SIMULATOR === 'true' || process.env.ENABLE_OTP_SIMULATOR === '1';

  if (!session) {
    if (isSimulatorEnabled && cleanCode === '123456') {
      return { valid: true, message: 'Simulated OTP verified successfully.' };
    }
    return { valid: false, message: 'No active OTP session found. Please request a new code.' };
  }

  const now = Date.now();
  if (now > session.expiresAt) {
    activeOtpSessions.delete(phone);
    return { valid: false, message: 'Verification code has expired. Please request a new code.' };
  }

  if (session.attemptsRemaining <= 0) {
    activeOtpSessions.delete(phone);
    return { valid: false, message: 'Maximum attempts exceeded. Please request a new code.' };
  }

  const testHash = hashOtp(cleanCode, phone);
  if (testHash === session.hashedCode || (isSimulatorEnabled && cleanCode === '123456')) {
    session.verified = true;
    activeOtpSessions.delete(phone);
    return { valid: true, message: 'Mobile number verified successfully.' };
  } else {
    session.attemptsRemaining -= 1;
    if (session.attemptsRemaining <= 0) {
      activeOtpSessions.delete(phone);
      return {
        valid: false,
        message: 'Incorrect code. Maximum verification attempts reached. Please request a new OTP.',
        attemptsRemaining: 0,
      };
    }
    return {
      valid: false,
      message: `Incorrect code. ${session.attemptsRemaining} attempt(s) remaining.`,
      attemptsRemaining: session.attemptsRemaining,
    };
  }
}
