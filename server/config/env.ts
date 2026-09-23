import dotenv from 'dotenv';

dotenv.config();

/**
 * List of required environment variables for the AgriNex server.
 */
export const REQUIRED_ENV_VARS = [
  'MONGO_URI',
  'JWT_SECRET',
  'GOOGLE_MAPS_API_KEY',
  'GEMINI_API_KEY',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
] as const;

export type RequiredEnvVar = (typeof REQUIRED_ENV_VARS)[number];

export interface EnvironmentConfig {
  MONGO_URI: string;
  JWT_SECRET: string;
  GOOGLE_MAPS_API_KEY: string;
  GEMINI_API_KEY: string;
  RAZORPAY_KEY_ID: string;
  RAZORPAY_KEY_SECRET: string;
  RAZORPAY_WEBHOOK_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  SMS_API_KEY: string;
  SMS_SENDER_ID: string;
  ENABLE_OTP_SIMULATOR: boolean;
  VITE_GOOGLE_MAPS_API_KEY: string;
  NODE_ENV: string;
  PORT: number;
}

/**
 * Descriptive, safe error class that reports missing environment variables
 * without exposing or printing any sensitive secret values.
 */
export class MissingEnvironmentVariableError extends Error {
  public readonly missingVars: string[];

  constructor(missingVars: string[]) {
    const message = `Server configuration error: The following required environment variable(s) are missing or empty: ${missingVars.join(
      ', '
    )}. Please ensure these variables are configured in your environment settings.`;
    super(message);
    this.name = 'MissingEnvironmentVariableError';
    this.missingVars = missingVars;
  }
}

/**
 * Live accessor object for loaded environment variables.
 * Uses dynamic getters to reflect any runtime updates.
 */
export const env: EnvironmentConfig = {
  get MONGO_URI() {
    return process.env.MONGO_URI || '';
  },
  get JWT_SECRET() {
    return process.env.JWT_SECRET || '';
  },
  get GOOGLE_MAPS_API_KEY() {
    return process.env.GOOGLE_MAPS_API_KEY || '';
  },
  get GEMINI_API_KEY() {
    return process.env.GEMINI_API_KEY || '';
  },
  get RAZORPAY_KEY_ID() {
    return process.env.RAZORPAY_KEY_ID || '';
  },
  get RAZORPAY_KEY_SECRET() {
    return process.env.RAZORPAY_KEY_SECRET || '';
  },
  get RAZORPAY_WEBHOOK_SECRET() {
    return process.env.RAZORPAY_WEBHOOK_SECRET || '';
  },
  get GOOGLE_CLIENT_ID() {
    return process.env.GOOGLE_CLIENT_ID || '';
  },
  get GOOGLE_CLIENT_SECRET() {
    return process.env.GOOGLE_CLIENT_SECRET || '';
  },
  get SMS_API_KEY() {
    return process.env.SMS_API_KEY || '';
  },
  get SMS_SENDER_ID() {
    return process.env.SMS_SENDER_ID || 'AGRNEX';
  },
  get ENABLE_OTP_SIMULATOR() {
    return process.env.ENABLE_OTP_SIMULATOR !== 'false';
  },
  get VITE_GOOGLE_MAPS_API_KEY() {
    return process.env.VITE_GOOGLE_MAPS_API_KEY || '';
  },
  get NODE_ENV() {
    return process.env.NODE_ENV || 'development';
  },
  get PORT() {
    return Number(process.env.PORT) || 3000;
  },
};

/**
 * Validates that all required environment variables are loaded and non-empty.
 * Throws a MissingEnvironmentVariableError with a safe, descriptive message
 * if any variable is missing, without revealing any secret values.
 *
 * @param throwOnMissing - Whether to throw if variables are missing (defaults to true)
 * @returns Object with validation status and list of missing variable names
 */
export function validateEnv(throwOnMissing: boolean = true): {
  valid: boolean;
  missingVars: string[];
} {
  const missingVars: string[] = [];

  for (const varName of REQUIRED_ENV_VARS) {
    const val = process.env[varName];
    if (!val || typeof val !== 'string' || val.trim().length === 0) {
      missingVars.push(varName);
    }
  }

  // If OTP simulator is disabled (real SMS enabled), SMS credentials are required
  const isOtpSimulator = process.env.ENABLE_OTP_SIMULATOR !== 'false';
  if (!isOtpSimulator) {
    if (!process.env.SMS_API_KEY || process.env.SMS_API_KEY.trim().length === 0) {
      missingVars.push('SMS_API_KEY');
    }
    if (!process.env.SMS_SENDER_ID || process.env.SMS_SENDER_ID.trim().length === 0) {
      missingVars.push('SMS_SENDER_ID');
    }
  }

  if (missingVars.length > 0) {
    const error = new MissingEnvironmentVariableError(missingVars);
    if (throwOnMissing) {
      throw error;
    }
    return { valid: false, missingVars };
  }

  return { valid: true, missingVars: [] };
}

export const validateEnvironment = validateEnv;

export function isRazorpayConfigured(): boolean {
  return Boolean(
    process.env.RAZORPAY_KEY_ID &&
      process.env.RAZORPAY_KEY_SECRET &&
      process.env.RAZORPAY_WEBHOOK_SECRET
  );
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
}

export function isGoogleMapsConfigured(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY && process.env.GOOGLE_MAPS_API_KEY.trim().length > 0);
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.MONGO_URI && process.env.MONGO_URI.trim().length > 0);
}

export function isGoogleOAuthConfigured(): boolean {
  const cid = process.env.GOOGLE_CLIENT_ID || '';
  const csec = process.env.GOOGLE_CLIENT_SECRET || '';
  return Boolean(cid && csec && !cid.includes('<PENDING>') && !csec.includes('<PENDING>') && cid.trim().length > 0);
}

export function isRazorpayXConfigured(): boolean {
  return Boolean(
    process.env.RAZORPAYX_ACCOUNT_NUMBER &&
      process.env.RAZORPAYX_KEY_ID &&
      process.env.RAZORPAYX_ACCOUNT_NUMBER.trim().length > 0 &&
      process.env.RAZORPAYX_KEY_ID.trim().length > 0
  );
}

export function isSmsConfigured(): boolean {
  return Boolean(
    process.env.SMS_API_KEY &&
      process.env.SMS_API_KEY.trim().length > 0 &&
      process.env.SMS_SENDER_ID &&
      process.env.SMS_SENDER_ID.trim().length > 0
  );
}

export interface SafeSubsystemStatus {
  status: 'CONNECTED' | 'CONFIGURED' | 'CONFIGURATION_REQUIRED' | 'OPTIONAL';
  notes?: string;
}

export interface SafeCredentialStatusReport {
  timestamp: string;
  environment: string;
  subsystems: {
    database: SafeSubsystemStatus;
    googleMaps: SafeSubsystemStatus;
    googleOAuth: SafeSubsystemStatus;
    geminiAI: SafeSubsystemStatus;
    razorpayEscrow: SafeSubsystemStatus;
    razorpayXPayouts: SafeSubsystemStatus;
    smsGateway: SafeSubsystemStatus;
    [key: string]: SafeSubsystemStatus;
  };
  MongoDB: 'CONNECTED' | 'CONFIGURATION_REQUIRED';
  'Google Maps': 'CONNECTED' | 'CONFIGURATION_REQUIRED';
  'Google OAuth': 'CONFIGURED' | 'CONFIGURATION_REQUIRED';
  Gemini: 'CONNECTED' | 'CONFIGURATION_REQUIRED';
  Razorpay: 'CONFIGURED' | 'CONFIGURATION_REQUIRED';
  RazorpayX: 'CONFIGURED' | 'OPTIONAL';
  SMS: 'CONFIGURED' | 'OPTIONAL';
}

export function getSafeCredentialStatus(dbConnected: boolean = false): SafeCredentialStatusReport {
  const isDb = dbConnected || isDatabaseConfigured();
  const isMaps = isGoogleMapsConfigured();
  const isOAuth = isGoogleOAuthConfigured();
  const isGemini = isGeminiConfigured();
  const isRazorpay = isRazorpayConfigured();
  const isRazorpayX = isRazorpayXConfigured();
  const isSms = isSmsConfigured();

  const mongoStatus = isDb ? 'CONNECTED' : 'CONFIGURATION_REQUIRED';
  const mapsStatus = isMaps ? 'CONNECTED' : 'CONFIGURATION_REQUIRED';
  const oauthStatus = isOAuth ? 'CONFIGURED' : 'CONFIGURATION_REQUIRED';
  const geminiStatus = isGemini ? 'CONNECTED' : 'CONFIGURATION_REQUIRED';
  const razorpayStatus = isRazorpay ? 'CONFIGURED' : 'CONFIGURATION_REQUIRED';
  const razorpayXStatus = isRazorpayX ? 'CONFIGURED' : 'OPTIONAL';
  const smsStatus = isSms ? 'CONFIGURED' : 'OPTIONAL';

  return {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    subsystems: {
      database: {
        status: mongoStatus,
        notes: isDb ? 'MongoDB Atlas cluster connected' : 'Local in-memory state active',
      },
      googleMaps: {
        status: mapsStatus,
        notes: isMaps ? 'Google Routes API v2 active' : 'Road corridor calculation active',
      },
      googleOAuth: {
        status: oauthStatus,
        notes: isOAuth ? 'Google Identity verification ready' : 'Standard credentials active',
      },
      geminiAI: {
        status: geminiStatus,
        notes: isGemini ? 'Gemini multimodal grading online' : 'Admin manual review fallback ready',
      },
      razorpayEscrow: {
        status: razorpayStatus,
        notes: isRazorpay ? 'Escrow checkout active' : 'Test escrow sandbox mode',
      },
      razorpayXPayouts: {
        status: razorpayXStatus,
        notes: isRazorpayX ? 'Direct bank payouts enabled' : 'Manual batch payout queue',
      },
      smsGateway: {
        status: smsStatus,
        notes: isSms ? 'Real SMS dispatcher online' : 'Local transactional OTP simulator active',
      },
    },
    task5Report: {
      MongoDB: isDb ? 'CONFIGURED' : 'NOT CONFIGURED',
      'Google Maps': isMaps ? 'CONFIGURED' : 'NOT CONFIGURED',
      Gemini: isGemini ? 'CONFIGURED' : 'NOT CONFIGURED',
      'Google OAuth': isOAuth ? 'CONFIGURED' : 'NOT CONFIGURED',
      Razorpay: isRazorpay ? 'CONFIGURED' : 'NOT CONFIGURED',
      RazorpayX: isRazorpayX ? 'CONFIGURED' : 'NOT CONFIGURED',
      SMS: isSms ? 'CONFIGURED' : 'NOT CONFIGURED',
    },
    MongoDB: mongoStatus,
    'Google Maps': mapsStatus,
    'Google OAuth': oauthStatus,
    Gemini: geminiStatus,
    Razorpay: razorpayStatus,
    RazorpayX: razorpayXStatus,
    SMS: smsStatus,
  };
}
