import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { generateCryptographicOtp, verifyCryptographicOtp } from '../../services/cryptoAuthService';
import { GoogleMapsLocationPicker } from '../common/GoogleMapsLocationPicker';
import { AddAddressPicker } from '../common/AddAddressPicker';
import { CryptoSmsSimulator } from '../common/CryptoSmsSimulator';
import {
  Sprout,
  User,
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  Phone,
  MapPin,
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  X,
  KeyRound,
  Users,
  ShieldAlert,
  Award,
  Sparkles,
  Truck,
} from 'lucide-react';

export const validateStrongPassword = (pass = '') => {
  const minLength = pass.length >= 8;
  const hasUpper = /[A-Z]/.test(pass);
  const hasLower = /[a-z]/.test(pass);
  const hasNumber = /[0-9]/.test(pass);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(pass);

  const isValid = minLength && hasUpper && hasLower && hasNumber && hasSpecial;
  const missing = [];
  if (!minLength) missing.push('min 8 characters');
  if (!hasUpper) missing.push('1 uppercase letter (A-Z)');
  if (!hasLower) missing.push('1 lowercase letter (a-z)');
  if (!hasNumber) missing.push('1 number (0-9)');
  if (!hasSpecial) missing.push('1 special symbol (!@#$%^&*)');

  return {
    isValid,
    minLength,
    hasUpper,
    hasLower,
    hasNumber,
    hasSpecial,
    errorMsg: missing.length > 0 ? `Strong password requirement: Must contain ${missing.join(', ')}.` : '',
  };
};

const PasswordStrengthChecklist = ({ password }) => {
  const validation = validateStrongPassword(password);
  const items = [
    { label: '8+ Characters', ok: validation.minLength },
    { label: 'Uppercase (A-Z)', ok: validation.hasUpper },
    { label: 'Lowercase (a-z)', ok: validation.hasLower },
    { label: 'Number (0-9)', ok: validation.hasNumber },
    { label: 'Symbol (!@#$)', ok: validation.hasSpecial },
  ];

  return (
    <div className="mt-1.5 p-2 rounded-xl bg-stone-50 border border-stone-200 text-[10px] space-y-1">
      <div className="flex items-center justify-between text-stone-600 font-medium">
        <span>Password Requirements:</span>
        <span className={validation.isValid ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
          {validation.isValid ? '✓ Strong' : 'Mandatory Criteria'}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
        {items.map((it) => (
          <span
            key={it.label}
            className={`flex items-center gap-1 ${
              it.ok ? 'text-emerald-700 font-bold' : 'text-stone-400'
            }`}
          >
            {it.ok ? '✓' : '○'} {it.label}
          </span>
        ))}
      </div>
    </div>
  );
};

export const AuthPage = () => {
  const {
    loginWithPhoneOrEmail,
    loginWithGoogle,
    completeGoogleProfile,
    resetPasswordWithPhone,
    registerUser,
    users,
    setCurrentUserId,
    showToast,
  } = useApp();

  // Selected role tab: 'FARMER' | 'BUYER' | 'ADMIN'
  const [selectedRole, setSelectedRole] = useState('FARMER');
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // Sign in fields - strictly empty, no random/pre-filled values!
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Strict Login 2FA OTP state
  const [pendingLoginUser, setPendingLoginUser] = useState(null);
  const [loginActiveOtpRecord, setLoginActiveOtpRecord] = useState(null);
  const [loginEnteredOtp, setLoginEnteredOtp] = useState('');
  const [loginOtpTimer, setLoginOtpTimer] = useState(0);

  // Registration Mode for Farmer: 'INDIVIDUAL' or 'FPO'
  const [farmerAccountType, setFarmerAccountType] = useState('INDIVIDUAL'); // 'INDIVIDUAL' | 'FPO'

  // Sign In Mode for Farmer: 'FPO_LEADER' or 'INDIVIDUAL'
  const [farmerLoginType, setFarmerLoginType] = useState('FPO_LEADER'); // 'FPO_LEADER' | 'INDIVIDUAL'

  // Standard Personal Details (all strictly empty by default)
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [location, setLocation] = useState('');
  const [coordinates, setCoordinates] = useState(null);
  const [organization, setOrganization] = useState('');

  // Cryptographic OTP Verification State for Registration
  const [activeOtpRecord, setActiveOtpRecord] = useState(null);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpTimer, setOtpTimer] = useState(0);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);

  // FPO-Specific State (Farmer Producer Organization)
  const [fpoLegalName, setFpoLegalName] = useState('');
  const [fpoCin, setFpoCin] = useState('');
  const [fpoOfficeAddress, setFpoOfficeAddress] = useState('');
  const [fpoOfficeCoords, setFpoOfficeCoords] = useState(null);

  // FPO Leader (Special Personal Details - Used for Daily Login)
  const [fpoLeaderName, setFpoLeaderName] = useState('');
  const [fpoLeaderDesignation, setFpoLeaderDesignation] = useState('Managing Director');
  const [fpoLeaderPhone, setFpoLeaderPhone] = useState('');
  const [fpoLeaderPassword, setFpoLeaderPassword] = useState('');
  const [fpoLeaderGovtId, setFpoLeaderGovtId] = useState('');
  const [fpoLeaderOtpRecord, setFpoLeaderOtpRecord] = useState(null);
  const [fpoLeaderEnteredOtp, setFpoLeaderEnteredOtp] = useState('');
  const [fpoLeaderOtpTimer, setFpoLeaderOtpTimer] = useState(0);
  const [isFpoLeaderVerified, setIsFpoLeaderVerified] = useState(false);

  // FPO Member Farmers (Group of Farmers)
  const [fpoMembers, setFpoMembers] = useState([
    {
      id: 1,
      name: '',
      phone: '',
      landAcres: '',
      primaryCrops: '',
      isVerified: false,
      enteredOtp: '',
      otpRecord: null,
      otpTimer: 0,
    },
    {
      id: 2,
      name: '',
      phone: '',
      landAcres: '',
      primaryCrops: '',
      isVerified: false,
      enteredOtp: '',
      otpRecord: null,
      otpTimer: 0,
    },
    {
      id: 3,
      name: '',
      phone: '',
      landAcres: '',
      primaryCrops: '',
      isVerified: false,
      enteredOtp: '',
      otpRecord: null,
      otpTimer: 0,
    },
  ]);

  // Floating Real-Phone SMS Simulator active record
  const [floatingSmsRecord, setFloatingSmsRecord] = useState(null);

  // Forgot Password State
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotOtpRecord, setForgotOtpRecord] = useState(null);
  const [forgotOtpTimer, setForgotOtpTimer] = useState(0);
  const [isForgotVerified, setIsForgotVerified] = useState(false);
  const [newResetPassword, setNewResetPassword] = useState('');

  // Real Google OAuth Architecture State
  const [showGoogleUnavailableModal, setShowGoogleUnavailableModal] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // First-Time Google Signup Profile Completion Modal State
  const [showGoogleCompleteProfileModal, setShowGoogleCompleteProfileModal] = useState(false);
  const [googleNewUserData, setGoogleNewUserData] = useState(null); // { tempToken, identity: { email, name, sub, picture } }
  const [googleRole, setGoogleRole] = useState('BUYER'); // 'FARMER' | 'BUYER'
  const [googlePhone, setGooglePhone] = useState('');
  const [googleOtp, setGoogleOtp] = useState('');
  const [googleProfileOtpRecord, setGoogleProfileOtpRecord] = useState(null);
  const [googleOtpTimer, setGoogleOtpTimer] = useState(0);
  const [isGooglePhoneVerified, setIsGooglePhoneVerified] = useState(false);
  const [googleAddress, setGoogleAddress] = useState('');
  const [googleCoords, setGoogleCoords] = useState(null);
  const [googleStructuredLocation, setGoogleStructuredLocation] = useState(null);
  const [googleCanManageTransport, setGoogleCanManageTransport] = useState(false);
  const [googleProfileError, setGoogleProfileError] = useState('');
  const [isSubmittingGoogleProfile, setIsSubmittingGoogleProfile] = useState(false);

  const handleGoogleSignInClick = async () => {
    setIsGoogleLoading(true);
    try {
      const result = await loginWithGoogle(selectedRole);
      if (result && !result.configured) {
        setShowGoogleUnavailableModal(true);
      } else if (result && result.configured && result.clientId) {
        if (window.google?.accounts?.id) {
          window.google.accounts.id.initialize({
            client_id: result.clientId,
            callback: async (response) => {
              if (response.credential) {
                const authRes = await loginWithGoogle(selectedRole, response.credential);
                if (authRes && authRes.isNewUser) {
                  setGoogleNewUserData({
                    tempToken: authRes.tempToken,
                    identity: authRes.googleIdentity,
                  });
                  setGoogleRole(selectedRole === 'ADMIN' ? 'BUYER' : selectedRole);
                  setGooglePhone('');
                  setGoogleOtp('');
                  setIsGooglePhoneVerified(false);
                  setGoogleAddress('');
                  setGoogleCoords(null);
                  setGoogleStructuredLocation(null);
                  setGoogleProfileError('');
                  setShowGoogleCompleteProfileModal(true);
                }
              }
            },
          });
          window.google.accounts.id.prompt();
        } else {
          const redirectUri = window.location.origin;
          const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
            result.clientId
          )}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=id_token&scope=openid%20profile%20email&nonce=${Date.now()}`;
          window.open(authUrl, 'google_oauth_popup', 'width=500,height=600');
        }
      }
    } catch (e) {
      setShowGoogleUnavailableModal(true);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSendGoogleProfileOtp = async () => {
    const clean = (googlePhone || '').replace(/\D/g, '');
    if (!clean || clean.length < 10) {
      setGoogleProfileError('Please enter a valid 10-digit mobile phone number.');
      return;
    }
    setGoogleProfileError('');
    try {
      apiFetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: clean, purpose: 'Google Account Setup' }),
      }).catch(() => {});

      const rec = await generateCryptographicOtp(clean);
      setGoogleProfileOtpRecord(rec);
      setGoogleOtpTimer(60);
      setGoogleOtp('');
      setIsGooglePhoneVerified(false);
      setFloatingSmsRecord({ ...rec, timer: 60 });
      showToast('OTP Dispatched', `Verification code sent to +91 ${clean}.`);
    } catch (err) {
      setGoogleProfileError(err.message || 'Failed to dispatch OTP.');
    }
  };

  const handleVerifyGoogleProfileOtp = async () => {
    if (!googleProfileOtpRecord) {
      setGoogleProfileError('OTP session has expired. Please send a new code.');
      return;
    }
    const result = await verifyCryptographicOtp(googleOtp, googleProfileOtpRecord);
    if (result.valid) {
      setIsGooglePhoneVerified(true);
      setGoogleProfileError('');
      setFloatingSmsRecord(null);
      showToast('Phone Verified', 'Mobile phone authenticated successfully.');
    } else {
      setGoogleProfileError(result.error || 'Invalid OTP code.');
    }
  };

  const handleCompleteGoogleProfileSubmit = async (e) => {
    e.preventDefault();
    setGoogleProfileError('');

    const clean = (googlePhone || '').replace(/\D/g, '');
    if (!clean || clean.length < 10) {
      setGoogleProfileError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!isGooglePhoneVerified) {
      setGoogleProfileError('Mobile phone verification is mandatory before completing registration.');
      return;
    }
    if (!googleAddress.trim()) {
      setGoogleProfileError('Please provide or detect your physical address.');
      return;
    }

    setIsSubmittingGoogleProfile(true);
    try {
      const res = await completeGoogleProfile({
        tempToken: googleNewUserData.tempToken,
        role: googleRole,
        phone: clean,
        otp: googleOtp.trim(),
        location: googleAddress,
        coordinates: googleCoords,
        structuredLocation: googleStructuredLocation,
        canManageTransport: googleRole === 'FARMER' ? googleCanManageTransport : false,
      });

      if (res && res.success) {
        setShowGoogleCompleteProfileModal(false);
        setGoogleNewUserData(null);
      } else {
        setGoogleProfileError((res && (res.error || res.message)) || 'Failed to complete profile.');
      }
    } catch (err) {
      setGoogleProfileError(err.message || 'Failed to complete profile.');
    } finally {
      setIsSubmittingGoogleProfile(false);
    }
  };

  const [errorMessage, setErrorMessage] = useState('');

  // Countdowns for active OTPs
  useEffect(() => {
    let interval = null;
    if (otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => {
          if (prev <= 1) {
            setActiveOtpRecord(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpTimer]);

  useEffect(() => {
    let interval = null;
    if (fpoLeaderOtpTimer > 0) {
      interval = setInterval(() => {
        setFpoLeaderOtpTimer((prev) => {
          if (prev <= 1) {
            setFpoLeaderOtpRecord(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [fpoLeaderOtpTimer]);

  useEffect(() => {
    let interval = null;
    if (loginOtpTimer > 0) {
      interval = setInterval(() => {
        setLoginOtpTimer((prev) => {
          if (prev <= 1) {
            setLoginActiveOtpRecord(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [loginOtpTimer]);

  useEffect(() => {
    let interval = null;
    if (forgotOtpTimer > 0) {
      interval = setInterval(() => {
        setForgotOtpTimer((prev) => {
          if (prev <= 1) {
            setForgotOtpRecord(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [forgotOtpTimer]);

  useEffect(() => {
    let interval = null;
    if (googleOtpTimer > 0) {
      interval = setInterval(() => {
        setGoogleOtpTimer((prev) => {
          if (prev <= 1) {
            setGoogleProfileOtpRecord(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [googleOtpTimer]);

  // Handle switching Role Tabs
  const handleRoleChange = (role) => {
    setSelectedRole(role);
    setErrorMessage('');
    // Ensure all fields stay empty - NO random value injections!
    setLoginIdentifier('');
    setLoginPassword('');
    setIsPhoneVerified(false);
    setActiveOtpRecord(null);
    setEnteredOtp('');
    setOtpTimer(0);
    setFloatingSmsRecord(null);
  };

  // --- Cryptographic OTP Handlers ---

  // 1. Standard Registration OTP
  const handleSendRegistrationOtp = async () => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setErrorMessage('Please enter a valid 10-digit mobile phone number first.');
      return;
    }
    setErrorMessage('');
    try {
      const record = await generateCryptographicOtp(cleanPhone);
      setActiveOtpRecord(record);
      setOtpTimer(60);
      setEnteredOtp('');
      setIsPhoneVerified(false);
      setFloatingSmsRecord({ ...record, timer: 60 });
      showToast('Cryptographic OTP Dispatched', `6-digit security code sent to +91 ${cleanPhone}.`);
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const handleVerifyRegistrationOtp = async () => {
    if (!activeOtpRecord) {
      setErrorMessage('OTP session has expired. Please request a new OTP.');
      return;
    }
    const result = await verifyCryptographicOtp(enteredOtp, activeOtpRecord);
    if (result.valid) {
      setIsPhoneVerified(true);
      setErrorMessage('');
      setFloatingSmsRecord(null);
      showToast('Phone Verified', 'Real phone verified via cryptographic SHA-256 token!');
    } else {
      setErrorMessage(result.error || 'Verification failed. Please try again.');
    }
  };

  // 2. FPO Leader OTP
  const handleSendFpoLeaderOtp = async () => {
    const cleanPhone = fpoLeaderPhone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setErrorMessage('Please enter a valid 10-digit phone number for FPO Leader.');
      return;
    }
    setErrorMessage('');
    try {
      const record = await generateCryptographicOtp(cleanPhone);
      setFpoLeaderOtpRecord(record);
      setFpoLeaderOtpTimer(60);
      setFpoLeaderEnteredOtp('');
      setIsFpoLeaderVerified(false);
      setFloatingSmsRecord({ ...record, timer: 60 });
      showToast('Leader OTP Sent', `Verification code sent to FPO Leader phone (+91 ${cleanPhone}).`);
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const handleVerifyFpoLeaderOtp = async () => {
    if (!fpoLeaderOtpRecord) {
      setErrorMessage('Leader OTP has expired. Please request a new code.');
      return;
    }
    const result = await verifyCryptographicOtp(fpoLeaderEnteredOtp, fpoLeaderOtpRecord);
    if (result.valid) {
      setIsFpoLeaderVerified(true);
      setErrorMessage('');
      setFloatingSmsRecord(null);
      showToast('Leader Verified', 'FPO Leader verified successfully!');
    } else {
      setErrorMessage(result.error || 'Invalid code.');
    }
  };

  // 3. FPO Member Farmers OTP
  const handleSendMemberOtp = async (memberIndex) => {
    const member = fpoMembers[memberIndex];
    const cleanPhone = (member.phone || '').replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setErrorMessage(`Please enter a valid 10-digit phone for Farmer #${memberIndex + 1}.`);
      return;
    }
    setErrorMessage('');
    try {
      const record = await generateCryptographicOtp(cleanPhone);
      setFpoMembers((prev) => {
        const next = [...prev];
        next[memberIndex] = {
          ...next[memberIndex],
          otpRecord: record,
          otpTimer: 60,
          enteredOtp: '',
          isVerified: false,
        };
        return next;
      });
      setFloatingSmsRecord({ ...record, timer: 60 });
      showToast('Member OTP Dispatched', `Code sent to Farmer #${memberIndex + 1} (+91 ${cleanPhone}).`);
    } catch (err) {
      setErrorMessage(err.message);
    }
  };

  const handleVerifyMemberOtp = async (memberIndex) => {
    const member = fpoMembers[memberIndex];
    if (!member.otpRecord) {
      setErrorMessage(`OTP expired for Farmer #${memberIndex + 1}. Please resend.`);
      return;
    }
    const result = await verifyCryptographicOtp(member.enteredOtp, member.otpRecord);
    if (result.valid) {
      setFpoMembers((prev) => {
        const next = [...prev];
        next[memberIndex] = { ...next[memberIndex], isVerified: true };
        return next;
      });
      setErrorMessage('');
      setFloatingSmsRecord(null);
      showToast('Farmer Verified', `Farmer #${memberIndex + 1} verified via cryptographic OTP!`);
    } else {
      setErrorMessage(result.error || 'Verification failed.');
    }
  };

  const handleAddFpoMember = () => {
    if (fpoMembers.length >= 10) {
      showToast('Limit Reached', 'Maximum 10 member farmers per initial FPO registration batch.', 'info');
      return;
    }
    setFpoMembers((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        name: '',
        phone: '',
        landAcres: '',
        primaryCrops: '',
        isVerified: false,
        enteredOtp: '',
        otpRecord: null,
        otpTimer: 0,
      },
    ]);
  };

  const handleRemoveFpoMember = (indexToRemove) => {
    if (fpoMembers.length <= 2) {
      showToast('Minimum Required', 'An FPO requires at least 2 member farmers.', 'error');
      return;
    }
    setFpoMembers((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Dynamic Member Farmer Count Handler based on user request:
  // "if the fpo option is enabled it should represent the personal details for every formar based on number of the formar"
  const handleSetFpoMemberCount = (targetCount) => {
    const count = Math.max(2, Math.min(12, Number(targetCount) || 2));
    setFpoMembers((prev) => {
      const next = [];
      for (let i = 0; i < count; i++) {
        if (prev[i]) {
          next.push(prev[i]);
        } else {
          next.push({
            id: i + 1,
            name: '',
            phone: '',
            landAcres: '',
            primaryCrops: '',
            isVerified: false,
            enteredOtp: '',
            otpRecord: null,
            otpTimer: 0,
          });
        }
      }
      return next;
    });
  };



  // --- Daily Sign-In Step (Direct Phone & Password Authentication) ---
  // Mandatory requirement: "the daily loging must be based on the phone number of the fpo leader phone number and his pasward"
  const handleInitiateSignIn = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!loginIdentifier.trim() || !loginPassword) {
      setErrorMessage('All login credentials are mandatory. Please enter phone number and password.');
      return;
    }

    const res = await loginWithPhoneOrEmail(loginIdentifier, loginPassword, selectedRole);
    if (!res || (typeof res === 'object' && !res.success)) {
      const msg = (typeof res === 'object' && res.error) ? res.error : 'Authentication failed. Please verify your credentials or register a new account.';
      setErrorMessage(msg);
    }
  };

  // Optional 2FA Challenge via OTP
  const handleRequestLoginOtp = async () => {
    if (!loginIdentifier.trim()) {
      setErrorMessage('Please enter your mobile phone number to request an OTP.');
      return;
    }
    const clean = loginIdentifier.trim().toLowerCase();
    const cleanPhone = loginIdentifier.replace(/[\s\-\(\)\+]/g, '').slice(-10);

    const matchedUser = users.find((u) => {
      const uEmail = (u.email || '').toLowerCase();
      const uPhone = (u.phone || '').replace(/\D/g, '').slice(-10);
      const uLeaderPhone = u.fpoLeader ? (u.fpoLeader.phone || '').replace(/\D/g, '').slice(-10) : '';
      return (
        (clean && uEmail === clean) ||
        (cleanPhone.length >= 10 && (uPhone === cleanPhone || uLeaderPhone === cleanPhone))
      );
    });

    if (!matchedUser) {
      setErrorMessage('No registered account found with this phone number.');
      return;
    }

    const targetPhone = matchedUser.isFpo && matchedUser.fpoLeader
      ? matchedUser.fpoLeader.phone
      : matchedUser.phone || '9876543210';

    try {
      const record = await generateCryptographicOtp(targetPhone);
      setPendingLoginUser(matchedUser);
      setLoginActiveOtpRecord(record);
      setLoginOtpTimer(60);
      setLoginEnteredOtp('');
      setFloatingSmsRecord({ ...record, timer: 60 });
      showToast('Strict 2FA Challenge', `Cryptographic OTP sent to registered phone (+91 ${record.phoneNumber}).`);
    } catch (err) {
      setErrorMessage(err.message || 'Could not dispatch cryptographic OTP.');
    }
  };

  const handleConfirmLoginOtp = async (e) => {
    e.preventDefault();
    if (!loginActiveOtpRecord || !pendingLoginUser) {
      setErrorMessage('Login session expired. Please sign in again.');
      return;
    }

    const result = await verifyCryptographicOtp(loginEnteredOtp, loginActiveOtpRecord);
    if (result.valid) {
      setCurrentUserId(pendingLoginUser.id);
      setPendingLoginUser(null);
      setLoginActiveOtpRecord(null);
      setFloatingSmsRecord(null);
      const displayName = pendingLoginUser.isFpo
        ? (pendingLoginUser.organization || pendingLoginUser.name)
        : pendingLoginUser.name;
      const roleLabel = pendingLoginUser.role === 'BUYER' ? 'Consumer' : pendingLoginUser.isFpo ? 'FPO Portal' : pendingLoginUser.role;
      showToast('Welcome Back', `Successfully authenticated as ${displayName} (${roleLabel})`);
    } else {
      setErrorMessage(result.error || 'Incorrect OTP code.');
    }
  };

  // --- Mandatory Registration Submission ---
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    // Rule: "there is an manditory condation to fill all the personal details before the user creates an account and logins"
    if (selectedRole === 'FARMER' && farmerAccountType === 'FPO') {
      // 1. Validate FPO Entity details
      if (!fpoLegalName.trim()) {
        setErrorMessage('Mandatory field missing: FPO / Organization Legal Name.');
        return;
      }
      if (!fpoCin.trim()) {
        setErrorMessage('Mandatory field missing: FPO Registration / CIN Number.');
        return;
      }
      if (!fpoOfficeAddress.trim()) {
        setErrorMessage('Mandatory field missing: FPO Registered Office & Goods Storage Location.');
        return;
      }

      // 2. Validate FPO Leader Personal Details
      if (!fpoLeaderName.trim()) {
        setErrorMessage('Mandatory field missing: FPO Leader Full Name.');
        return;
      }
      if (!fpoLeaderPhone.trim()) {
        setErrorMessage('Mandatory field missing: FPO Leader Phone Number (used for daily login).');
        return;
      }
      const fpoPassValidation = validateStrongPassword(fpoLeaderPassword);
      if (!fpoPassValidation.isValid) {
        setErrorMessage(`FPO Leader Password is not strong enough. ${fpoPassValidation.errorMsg}`);
        return;
      }
      if (!fpoLeaderGovtId.trim()) {
        setErrorMessage('Mandatory field missing: FPO Leader Aadhaar / Govt ID number.');
        return;
      }
      if (!isFpoLeaderVerified) {
        setErrorMessage('FPO Leader phone number must be verified via Cryptographic OTP.');
        return;
      }

      // 3. Validate every member farmer in FPO
      for (let i = 0; i < fpoMembers.length; i++) {
        const m = fpoMembers[i];
        if (!m.name.trim()) {
          setErrorMessage(`Mandatory field missing: Full Name for Member Farmer #${i + 1}.`);
          return;
        }
        if (!m.phone.trim()) {
          setErrorMessage(`Mandatory field missing: Phone Number for Member Farmer #${i + 1}.`);
          return;
        }
        if (!m.landAcres.trim()) {
          setErrorMessage(`Mandatory field missing: Landholding (Acres) for Member Farmer #${i + 1}.`);
          return;
        }
        if (!m.primaryCrops.trim()) {
          setErrorMessage(`Mandatory field missing: Primary Crops for Member Farmer #${i + 1}.`);
          return;
        }
        if (!m.isVerified) {
          setErrorMessage(`Member Farmer #${i + 1} (${m.name}) must be verified via Cryptographic OTP.`);
          return;
        }
      }

      // Register FPO Account
      const success = await registerUser({
        name: fpoLegalName,
        email: `${fpoLeaderPhone.replace(/\D/g, '')}@fpo.agrinex.com`,
        password: fpoLeaderPassword,
        phone: fpoLeaderPhone,
        role: 'FARMER',
        location: fpoOfficeAddress,
        coordinates: fpoOfficeCoords || { lat: 16.3067, lng: 80.4365 },
        organization: fpoLegalName,
        isFpo: true,
        fpoCin: fpoCin,
        fpoLeader: {
          name: fpoLeaderName,
          designation: fpoLeaderDesignation,
          phone: fpoLeaderPhone,
          password: fpoLeaderPassword,
          govtId: fpoLeaderGovtId,
        },
        fpoMembers: fpoMembers.map((m) => ({
          id: m.id,
          name: m.name,
          phone: m.phone,
          landAcres: m.landAcres,
          primaryCrops: m.primaryCrops,
          verified: true,
        })),
      });

      if (!success) {
        setErrorMessage('FPO Registration could not be completed.');
      }
      return;
    }

    // Individual Farmer / Consumer / Admin Registration
    if (!name.trim()) {
      setErrorMessage('Mandatory field missing: Full Name.');
      return;
    }
    if (!phone.trim()) {
      setErrorMessage('Mandatory field missing: Phone Number.');
      return;
    }

    let verified = isPhoneVerified;
    // Auto-verify if user already typed the 6-digit OTP into the input
    if (!verified && activeOtpRecord && enteredOtp.length === 6) {
      const vResult = await verifyCryptographicOtp(enteredOtp, activeOtpRecord);
      if (vResult.valid) {
        setIsPhoneVerified(true);
        verified = true;
      } else {
        setErrorMessage(vResult.error || 'Invalid 6-digit OTP code.');
        return;
      }
    }

    // Auto-dispatch OTP if not yet sent
    if (!verified) {
      if (!activeOtpRecord) {
        await handleSendRegistrationOtp();
        setErrorMessage('A 6-digit verification code has been dispatched to your mobile. Please enter the OTP below.');
        return;
      } else {
        setErrorMessage('Please enter the 6-digit verification code delivered to your mobile phone.');
        return;
      }
    }

    const passValidation = validateStrongPassword(password);
    if (!passValidation.isValid) {
      setErrorMessage(`Password is not strong enough. ${passValidation.errorMsg}`);
      return;
    }
    if (!email.trim()) {
      setErrorMessage('Mandatory field missing: Email Address.');
      return;
    }

    // Operating or delivery location
    const effectiveLocation = location.trim() || (selectedRole === 'BUYER' ? 'Banjara Hills, Hyderabad, Telangana' : 'Guntur Rural, Andhra Pradesh');

    // Organization name: Optional for Buyers/Consumers
    if (selectedRole !== 'BUYER' && !organization.trim()) {
      setErrorMessage('Mandatory field missing: Farm / Business / Entity Name.');
      return;
    }

    const effectiveOrg = organization.trim() || (selectedRole === 'BUYER' ? `${name.trim()} (Direct Consumer)` : `${name.trim()}'s Farm`);

    const regResult = await registerUser({
      name: name.trim(),
      email: email.trim(),
      password,
      phone: phone.trim(),
      role: selectedRole,
      location: effectiveLocation,
      coordinates: coordinates || (selectedRole === 'BUYER' ? { lat: 17.385, lng: 78.4867 } : { lat: 16.3067, lng: 80.4365 }),
      organization: effectiveOrg,
      buyerType: selectedRole === 'BUYER' ? 'Consumer' : undefined,
      isFpo: false,
    });

    if (regResult && typeof regResult === 'object' && !regResult.success) {
      setErrorMessage(regResult.error || 'Registration could not be completed.');
    } else if (!regResult) {
      setErrorMessage('Registration could not be completed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col justify-center py-10 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white shadow-lg shadow-emerald-700/20 mb-3">
          <Sprout className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-stone-900 font-heading">
          Agri<span className="text-emerald-600">Nex</span>
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-stone-600">
          Digital Agricultural Marketplace • Direct Farm ↔ Buyer Trade
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-xl px-4 sm:px-0">
        <div className="bg-white py-8 px-5 sm:px-8 shadow-xl rounded-2xl border border-stone-200">
          {/* Role Tabs */}
          <div className="mb-6">
            <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block mb-2 text-center">
              Select Portal Dashboard
            </span>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-stone-100 rounded-xl border border-stone-200">
              <button
                type="button"
                id="tab-role-farmer"
                onClick={() => handleRoleChange('FARMER')}
                className={`py-2 px-2 text-center rounded-lg text-xs font-bold transition flex flex-col items-center gap-1 ${
                  selectedRole === 'FARMER'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
                }`}
              >
                <Sprout className="w-3.5 h-3.5" />
                <span>Farmer / FPO</span>
              </button>

              <button
                type="button"
                id="tab-role-consumer"
                onClick={() => handleRoleChange('BUYER')}
                className={`py-2 px-2 text-center rounded-lg text-xs font-bold transition flex flex-col items-center gap-1 ${
                  selectedRole === 'BUYER'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Buyer / Consumer</span>
              </button>

              <button
                type="button"
                id="tab-role-admin"
                onClick={() => handleRoleChange('ADMIN')}
                className={`py-2 px-2 text-center rounded-lg text-xs font-bold transition flex flex-col items-center gap-1 ${
                  selectedRole === 'ADMIN'
                    ? 'bg-purple-700 text-white shadow-sm'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Admin</span>
              </button>
            </div>
          </div>

          {/* Mode Switcher: Sign In vs Create Account */}
          <div className="flex items-center justify-between border-b border-stone-100 pb-3 mb-5">
            <div>
              <h2 className="text-sm font-bold text-stone-800">
                {isRegisterMode
                  ? `Create New ${selectedRole === 'BUYER' ? 'Buyer / Consumer' : selectedRole === 'FARMER' ? 'Farmer / FPO' : 'Admin'} Account`
                  : `Sign In to ${selectedRole === 'BUYER' ? 'Buyer / Consumer' : selectedRole === 'FARMER' ? 'Farmer / FPO' : 'Admin'} Portal`}
              </h2>
              {!isRegisterMode && selectedRole === 'FARMER' && (
                <p className="text-[11px] text-stone-500 mt-0.5">
                  FPO Leaders: Login daily with your Leader Mobile Phone & Password.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setIsRegisterMode(!isRegisterMode);
                setErrorMessage('');
                setPendingLoginUser(null);
                setLoginActiveOtpRecord(null);
                setIsPhoneVerified(false);
              }}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition underline underline-offset-2"
            >
              {isRegisterMode ? 'Existing user? Sign In' : 'Create new account'}
            </button>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{errorMessage}</span>
              </div>
              {isRegisterMode && errorMessage.toLowerCase().includes('already exists') && (
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisterMode(false);
                    setLoginIdentifier(phone || email);
                    setErrorMessage('');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] shrink-0 transition"
                >
                  Sign In Now
                </button>
              )}
            </div>
          )}

          {/* Strict Login 2FA Cryptographic Challenge Modal */}
          {pendingLoginUser && loginActiveOtpRecord && (
            <div className="mb-6 p-4 rounded-2xl bg-emerald-50/80 border-2 border-emerald-500 shadow-md space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <h4 className="font-bold text-xs text-stone-900">
                    Strict Two-Factor Cryptographic Phone Verification
                  </h4>
                </div>
                <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">
                  Valid for: {loginOtpTimer}s
                </span>
              </div>

              <p className="text-xs text-stone-600">
                To confirm genuine ownership, enter the 6-digit cryptographic verification code delivered to{' '}
                <strong>+91 {loginActiveOtpRecord.phoneNumber}</strong>.
              </p>

              <form onSubmit={handleConfirmLoginOtp} className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    required
                    placeholder="Enter 6-digit OTP"
                    value={loginEnteredOtp}
                    onChange={(e) => setLoginEnteredOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3 py-2 text-sm font-mono tracking-widest text-center rounded-xl border border-stone-300 focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0 transition"
                  >
                    Verify & Login
                  </button>
                </div>
                <div className="flex items-center justify-between text-[11px] text-stone-500">
                  <span>Sign-in is granted strictly after OTP verification.</span>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingLoginUser(null);
                      setLoginActiveOtpRecord(null);
                    }}
                    className="text-stone-600 underline"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ======================= REGISTRATION FLOW ======================= */}
          {isRegisterMode ? (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              {/* If Farmer role: Toggle between Individual Farmer vs FPO */}
              {selectedRole === 'FARMER' && (
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                  <label className="block text-xs font-bold text-stone-800">
                    Select Farmer Account Category *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFarmerAccountType('INDIVIDUAL')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                        farmerAccountType === 'INDIVIDUAL'
                          ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                          : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      <User className="w-4 h-4" />
                      <span>Individual Farmer</span>
                    </button>
                    <button
                      type="button"
                      id="btn-select-fpo-type"
                      onClick={() => setFarmerAccountType('FPO')}
                      className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                        farmerAccountType === 'FPO'
                          ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                          : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      <span>Farmer Producer Org (FPO)</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-stone-500">
                    {farmerAccountType === 'FPO'
                      ? 'FPO: Register a group of farmers under an official leader. Daily login is via the FPO Leader phone & password.'
                      : 'Individual: Direct single-farm producer account.'}
                  </p>
                </div>
              )}

              {/* A. FPO REGISTRATION VIEW */}
              {selectedRole === 'FARMER' && farmerAccountType === 'FPO' ? (
                <div className="space-y-5">
                  {/* 1. FPO Legal Entity Information */}
                  <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/70 space-y-3">
                    <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-emerald-600" />
                      <span>1. FPO Legal Entity Details *</span>
                    </h3>

                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">
                        FPO / Organization Legal Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Sahyadri Farmers Producer Co. Ltd"
                        value={fpoLegalName}
                        onChange={(e) => setFpoLegalName(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">
                        Registration / CIN / Society Number *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. CIN: U01409MH2021PTC123456"
                        value={fpoCin}
                        onChange={(e) => setFpoCin(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 bg-white"
                      />
                    </div>

                    <div>
                      <GoogleMapsLocationPicker
                        label="FPO Central Office & Goods Aggregation Warehouse *"
                        value={fpoOfficeAddress}
                        coordinates={fpoOfficeCoords}
                        placeholder="Enter warehouse address or acquire current GPS coordinates"
                        onChange={(addr, coords) => {
                          setFpoOfficeAddress(addr);
                          if (coords) setFpoOfficeCoords(coords);
                        }}
                        helperText="Physical address where FPO goods are aggregated and ready for logistics dispatch."
                      />
                    </div>
                  </div>

                  {/* 2. FPO Leader Personal Details (SPECIAL SECTION) */}
                  <div className="p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-emerald-700" />
                        <span>2. FPO Leader Personal Details (Primary Login Account) *</span>
                      </h3>
                      {isFpoLeaderVerified && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Leader Verified
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-emerald-800">
                      <strong>Daily Login Mandate:</strong> Daily sign-in to the FPO portal will strictly be based on the FPO Leader's phone number and password entered here.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">
                          Leader Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Enter official leader name"
                          value={fpoLeaderName}
                          onChange={(e) => setFpoLeaderName(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">
                          Official Designation *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Managing Director / President / CEO"
                          value={fpoLeaderDesignation}
                          onChange={(e) => setFpoLeaderDesignation(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">
                          Leader Mobile Phone (Daily Login ID) *
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="tel"
                            required
                            disabled={isFpoLeaderVerified}
                            placeholder="e.g. 9876543210"
                            value={fpoLeaderPhone}
                            onChange={(e) => {
                              setFpoLeaderPhone(e.target.value);
                              setIsFpoLeaderVerified(false);
                            }}
                            className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white"
                          />
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={handleSendFpoLeaderOtp}
                              disabled={isFpoLeaderVerified || fpoLeaderOtpTimer > 0}
                              className="px-2.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-[11px] shrink-0 disabled:opacity-50"
                            >
                              {fpoLeaderOtpTimer > 0 ? `${fpoLeaderOtpTimer}s` : 'Send OTP'}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">
                          Leader Password (Daily Login Password) *
                        </label>
                        <input
                          type="password"
                          required
                          placeholder="Min 8 chars, uppercase, number & symbol"
                          value={fpoLeaderPassword}
                          onChange={(e) => setFpoLeaderPassword(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white"
                        />
                        {fpoLeaderPassword && <PasswordStrengthChecklist password={fpoLeaderPassword} />}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-stone-700 mb-1">
                        Leader Aadhaar / Official Govt ID Number *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Enter official Aadhaar or Govt ID number"
                        value={fpoLeaderGovtId}
                        onChange={(e) => setFpoLeaderGovtId(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white"
                      />
                    </div>

                    {/* Leader OTP verification box */}
                    {fpoLeaderOtpRecord && !isFpoLeaderVerified && (
                      <div className="p-3 rounded-xl bg-white border border-emerald-300 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-stone-800">
                            Enter 6-Digit Cryptographic Code sent to Leader:
                          </span>
                          <span className="text-[10px] text-amber-700 font-bold">
                            {fpoLeaderOtpTimer}s remaining
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            maxLength={6}
                            placeholder="••••••"
                            value={fpoLeaderEnteredOtp}
                            onChange={(e) => setFpoLeaderEnteredOtp(e.target.value.replace(/\D/g, ''))}
                            className="w-full px-3 py-2 text-xs font-mono tracking-widest rounded-xl border border-stone-200"
                          />
                          <button
                            type="button"
                            onClick={handleVerifyFpoLeaderOtp}
                            disabled={fpoLeaderEnteredOtp.length !== 6}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                          >
                            Verify Leader Phone
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 3. FPO Member Farmers Section */}
                  <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/70 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-200">
                      <div>
                        <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-emerald-600" />
                          <span>3. Member Farmers Details & Phone OTP Verification *</span>
                        </h3>
                        <p className="text-[11px] text-stone-500 mt-0.5">
                          Specify the total number of farmers in this FPO cluster. Personal details and OTP verification are required for every individual farmer.
                        </p>
                      </div>
                    </div>

                    {/* DYNAMIC NUMBER OF FARMERS SELECTOR */}
                    <div className="p-3 rounded-xl bg-white border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <label className="block text-xs font-bold text-stone-800 mb-0.5">
                          Total Number of Member Farmers ({fpoMembers.length})
                        </label>
                        <p className="text-[10px] text-stone-500">
                          Adjust the count to generate personal detail cards for each member farmer.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center border border-stone-200 rounded-lg overflow-hidden bg-stone-50">
                          <button
                            type="button"
                            onClick={() => handleSetFpoMemberCount(fpoMembers.length - 1)}
                            disabled={fpoMembers.length <= 2}
                            className="px-3 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-200 disabled:opacity-40 transition"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={2}
                            max={12}
                            value={fpoMembers.length}
                            onChange={(e) => handleSetFpoMemberCount(e.target.value)}
                            className="w-12 text-center text-xs font-bold bg-white py-1.5 border-x border-stone-200 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleSetFpoMemberCount(fpoMembers.length + 1)}
                            disabled={fpoMembers.length >= 12}
                            className="px-3 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-200 disabled:opacity-40 transition"
                          >
                            +
                          </button>
                        </div>

                        <div className="hidden sm:flex items-center gap-1 text-[11px]">
                          {[2, 3, 5, 8].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => handleSetFpoMemberCount(preset)}
                              className={`px-2 py-1 rounded font-semibold transition ${
                                fpoMembers.length === preset
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                              }`}
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {fpoMembers.map((member, idx) => (
                        <div
                          key={member.id}
                          className={`p-3.5 rounded-xl border transition ${
                            member.isVerified
                              ? 'border-emerald-300 bg-emerald-50/40'
                              : 'border-stone-200 bg-white'
                          } space-y-2.5`}
                        >
                          <div className="flex items-center justify-between pb-1 border-b border-stone-100">
                            <span className="font-bold text-xs text-stone-800 flex items-center gap-1.5">
                              <span>Farmer #{idx + 1}</span>
                              {member.isVerified ? (
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded-md flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  OTP Verified
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded-md">
                                  Verification Required
                                </span>
                              )}
                            </span>
                            {fpoMembers.length > 2 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveFpoMember(idx)}
                                className="text-[11px] text-red-600 hover:text-red-700 font-semibold"
                              >
                                Remove
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] font-medium text-stone-600 mb-0.5">
                                Farmer Full Name *
                              </label>
                              <input
                                type="text"
                                required
                                placeholder="e.g. Suresh Gowda"
                                value={member.name}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setFpoMembers((prev) => {
                                    const next = [...prev];
                                    next[idx] = { ...next[idx], name: val };
                                    return next;
                                  });
                                }}
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-200 bg-white"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-medium text-stone-600 mb-0.5">
                                Mobile Phone Number *
                              </label>
                              <div className="flex gap-1.5">
                                <input
                                  type="tel"
                                  required
                                  disabled={member.isVerified}
                                  placeholder="e.g. 9845012345"
                                  value={member.phone}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setFpoMembers((prev) => {
                                      const next = [...prev];
                                      next[idx] = { ...next[idx], phone: val, isVerified: false };
                                      return next;
                                    });
                                  }}
                                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-200 bg-white"
                                />
                                <div className="flex gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleSendMemberOtp(idx)}
                                    disabled={member.isVerified || (member.otpTimer && member.otpTimer > 0)}
                                    className="px-2.5 py-1 text-[10px] font-bold bg-stone-900 text-white rounded-lg disabled:opacity-50"
                                  >
                                    {member.otpTimer > 0 ? `${member.otpTimer}s` : 'Send OTP'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] font-medium text-stone-600 mb-0.5">
                                Landholding (Acres) *
                              </label>
                              <input
                                type="text"
                                required
                                placeholder="e.g. 5.5 Acres"
                                value={member.landAcres}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setFpoMembers((prev) => {
                                    const next = [...prev];
                                    next[idx] = { ...next[idx], landAcres: val };
                                    return next;
                                  });
                                }}
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-200 bg-white"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-medium text-stone-600 mb-0.5">
                                Primary Crops *
                              </label>
                              <input
                                type="text"
                                required
                                placeholder="e.g. Tomatoes, Chilli, Rice"
                                value={member.primaryCrops}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setFpoMembers((prev) => {
                                    const next = [...prev];
                                    next[idx] = { ...next[idx], primaryCrops: val };
                                    return next;
                                  });
                                }}
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-200 bg-white"
                              />
                            </div>
                          </div>

                          {/* Member OTP verification input */}
                          {member.otpRecord && !member.isVerified && (
                            <div className="p-2 bg-amber-50/80 rounded-lg border border-amber-200 flex items-center gap-2">
                              <input
                                type="text"
                                maxLength={6}
                                placeholder="Enter 6-digit OTP"
                                value={member.enteredOtp}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, '');
                                  setFpoMembers((prev) => {
                                    const next = [...prev];
                                    next[idx] = { ...next[idx], enteredOtp: val };
                                    return next;
                                  });
                                }}
                                className="w-full px-2 py-1 text-xs font-mono tracking-widest rounded border border-stone-300 bg-white text-center"
                              />
                              <button
                                type="button"
                                onClick={() => handleVerifyMemberOtp(idx)}
                                disabled={member.enteredOtp.length !== 6}
                                className="px-3 py-1 bg-emerald-600 text-white rounded text-[11px] font-bold shrink-0 disabled:opacity-50"
                              >
                                Verify Phone
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* B. INDIVIDUAL FARMER / CONSUMER / ADMIN REGISTRATION VIEW */
                <div className="space-y-4">
                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Full Name *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        required
                        placeholder="Enter your full official name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 bg-white"
                      />
                    </div>
                  </div>

                  {/* Phone with Cryptographic OTP */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-stone-700">
                        Mobile Phone Number *
                      </label>
                      {isPhoneVerified && (
                        <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Phone Verified
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                        <input
                          type="tel"
                          required
                          disabled={isPhoneVerified}
                          placeholder="e.g. 9876543210"
                          value={phone}
                          onChange={(e) => {
                            setPhone(e.target.value);
                            setIsPhoneVerified(false);
                          }}
                          className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border focus:ring-2 focus:outline-none ${
                            isPhoneVerified
                              ? 'border-emerald-300 bg-emerald-50/50 text-emerald-900'
                              : 'border-stone-200 focus:ring-emerald-500 bg-white'
                          }`}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSendRegistrationOtp}
                        disabled={isPhoneVerified || otpTimer > 0}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1 ${
                          isPhoneVerified
                            ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
                            : otpTimer > 0
                            ? 'bg-stone-100 text-stone-500 cursor-not-allowed border border-stone-200'
                            : 'bg-stone-900 hover:bg-stone-800 text-white shadow-xs'
                        }`}
                      >
                        {otpTimer > 0 ? (
                          <>
                            <Clock className="w-3.5 h-3.5 text-stone-400" />
                            <span>{otpTimer}s</span>
                          </>
                        ) : activeOtpRecord ? (
                          <>
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Resend</span>
                          </>
                        ) : (
                          <span>Send OTP</span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 6-Digit Cryptographic OTP block */}
                  {activeOtpRecord && !isPhoneVerified && (
                    <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold text-stone-700">
                          Enter 6-Digit Cryptographic Code *
                        </label>
                        <span className="text-[10px] text-stone-500">
                          {otpTimer > 0 ? (
                            <span className="text-amber-700 font-semibold">Valid for: {otpTimer}s</span>
                          ) : (
                            <span className="text-red-600 font-semibold">Code Expired</span>
                          )}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <KeyRound className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                          <input
                            type="text"
                            maxLength={6}
                            placeholder="••••••"
                            value={enteredOtp}
                            onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                            className="w-full pl-9 pr-3 py-2 text-xs font-mono tracking-widest rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleVerifyRegistrationOtp}
                          disabled={enteredOtp.length !== 6 || otpTimer === 0}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition shrink-0"
                        >
                          Verify OTP
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Password */}
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Password *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                      <input
                        type="password"
                        required
                        placeholder="Min 8 chars, uppercase, number & symbol"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 bg-white"
                      />
                    </div>
                    {password && <PasswordStrengthChecklist password={password} />}
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Email Address *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        required
                        placeholder="user@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 bg-white"
                      />
                    </div>
                  </div>

                  {/* Google Maps Location & Physical Goods Location */}
                  <div>
                    <GoogleMapsLocationPicker
                      label={selectedRole === 'BUYER' ? 'Delivery Address (Apartment, House, Mandi, or City) *' : 'Physical Street Address & Farm Goods Location *'}
                      value={location}
                      coordinates={coordinates}
                      placeholder={selectedRole === 'BUYER' ? 'Enter delivery address or detect current location via GPS' : 'Enter physical address or auto-detect with GPS'}
                      onChange={(addr, coords) => {
                        setLocation(addr);
                        if (coords) setCoordinates(coords);
                      }}
                      helperText={selectedRole === 'BUYER' ? 'Fresh farm orders will be dispatched directly to this delivery address.' : 'Goods and produce are verified at this physical location for optimal dispatch routing.'}
                    />
                  </div>

                  {/* Farm / Entity Name */}
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      {selectedRole === 'FARMER'
                        ? 'Farm / Orchard Name *'
                        : selectedRole === 'BUYER'
                        ? 'Delivery / Household Entity Name (Optional)'
                        : 'Department Name *'}
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        required={selectedRole !== 'BUYER'}
                        placeholder={
                          selectedRole === 'FARMER'
                            ? 'e.g. Green Valley Organic Agro Farm'
                            : selectedRole === 'BUYER'
                            ? 'e.g. Home Delivery / Metro Retail (Optional)'
                            : 'e.g. AgriNex Trust & Safety Operations'
                        }
                        value={organization}
                        onChange={(e) => setOrganization(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                id="btn-auth-register-submit"
                className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold text-white shadow-md transition active:scale-98 ${
                  selectedRole === 'ADMIN'
                    ? 'bg-purple-700 hover:bg-purple-800'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                <span>
                  {selectedRole === 'FARMER' && farmerAccountType === 'FPO'
                    ? 'Complete FPO Group Registration'
                    : 'Create Account & Proceed'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            /* ======================= SIGN IN FLOW ======================= */
            <form onSubmit={handleInitiateSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  {selectedRole === 'FARMER'
                    ? 'Mobile Phone Number (or FPO Leader Phone) *'
                    : 'Mobile Phone Number (or Email) *'}
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    placeholder={
                      selectedRole === 'FARMER'
                        ? 'Enter registered phone or FPO Leader phone'
                        : 'Enter your registered phone or email'
                    }
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-stone-700">
                    Password *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(true);
                      setErrorMessage('');
                    }}
                    className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 transition"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    placeholder="Enter your account password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                id="btn-auth-login-submit"
                className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white shadow-md transition active:scale-98 ${
                  selectedRole === 'ADMIN'
                    ? 'bg-purple-700 hover:bg-purple-800'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                <span>Sign In with Phone & Password</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              {/* Social Login: Google Account */}
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-stone-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-2 text-stone-400">or sign in with</span>
                </div>
              </div>

              <button
                type="button"
                id="btn-google-sign-in"
                disabled={isGoogleLoading}
                onClick={handleGoogleSignInClick}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-bold shadow-2xs transition active:scale-98 disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.02 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>{isGoogleLoading ? 'Connecting to Google...' : 'Sign in with Google'}</span>
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Floating Real-Phone SMS Simulator Notification */}
      {floatingSmsRecord && (
        <CryptoSmsSimulator
          otpRecord={floatingSmsRecord}
          onCopyOtp={(code) => {
            if (activeOtpRecord) setEnteredOtp(code);
            if (fpoLeaderOtpRecord) setFpoLeaderEnteredOtp(code);
            if (loginActiveOtpRecord) setLoginEnteredOtp(code);
            if (forgotOtpRecord) setForgotOtp(code);
            if (googleProfileOtpRecord) setGoogleOtp(code);
          }}
          onAutoVerify={async (code) => {
            if (activeOtpRecord) {
              setEnteredOtp(code);
              const res = await verifyCryptographicOtp(code, activeOtpRecord);
              if (res.valid) {
                setIsPhoneVerified(true);
                setErrorMessage('');
                setFloatingSmsRecord(null);
                showToast('Phone Verified', 'Mobile phone authenticated successfully.');
              }
            } else if (fpoLeaderOtpRecord) {
              setFpoLeaderEnteredOtp(code);
              const res = await verifyCryptographicOtp(code, fpoLeaderOtpRecord);
              if (res.valid) {
                setIsFpoLeaderVerified(true);
                setErrorMessage('');
                setFloatingSmsRecord(null);
                showToast('FPO Leader Verified', 'Leader phone verified.');
              }
            } else if (loginActiveOtpRecord && pendingLoginUser) {
              setLoginEnteredOtp(code);
              const res = await verifyCryptographicOtp(code, loginActiveOtpRecord);
              if (res.valid) {
                setCurrentUserId(pendingLoginUser.id);
                setPendingLoginUser(null);
                setLoginActiveOtpRecord(null);
                setFloatingSmsRecord(null);
                showToast('Welcome Back', `Authenticated as ${pendingLoginUser.name}`);
              }
            } else if (googleProfileOtpRecord) {
              setGoogleOtp(code);
              const res = await verifyCryptographicOtp(code, googleProfileOtpRecord);
              if (res.valid) {
                setIsGooglePhoneVerified(true);
                setGoogleProfileError('');
                setFloatingSmsRecord(null);
                showToast('Phone Verified', 'Mobile phone authenticated for Google account.');
              }
            }
          }}
          onClose={() => setFloatingSmsRecord(null)}
        />
      )}

      {/* MODAL: Forgot Password */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-stone-200 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-stone-900 text-sm">Reset Your Password</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false);
                  setIsForgotVerified(false);
                  setErrorMessage('');
                }}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!isForgotVerified) {
                  setErrorMessage('Please verify your phone number with the OTP first.');
                  return;
                }
                const resetPassVal = validateStrongPassword(newResetPassword);
                if (!resetPassVal.isValid) {
                  setErrorMessage(`New password is not strong enough. ${resetPassVal.errorMsg}`);
                  return;
                }
                const success = resetPasswordWithPhone(forgotPhone, newResetPassword);
                if (success) {
                  setShowForgotPassword(false);
                  setLoginIdentifier(forgotPhone);
                  setLoginPassword(newResetPassword);
                  setForgotPhone('');
                  setForgotOtp('');
                  setIsForgotVerified(false);
                }
              }}
              className="mt-4 space-y-3 text-xs"
            >
              <div>
                <label className="block font-medium text-stone-700 mb-1">
                  Registered Phone Number
                </label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    required
                    disabled={isForgotVerified}
                    placeholder="e.g. 9876543210"
                    value={forgotPhone}
                    onChange={(e) => setForgotPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const rec = await generateCryptographicOtp(forgotPhone);
                        setForgotOtpRecord(rec);
                        setForgotOtpTimer(60);
                        setFloatingSmsRecord({ ...rec, timer: 60 });
                        showToast('Reset OTP Sent', `Code dispatched to +91 ${rec.phoneNumber}.`);
                      } catch (err) {
                        setErrorMessage(err.message);
                      }
                    }}
                    disabled={isForgotVerified || forgotOtpTimer > 0}
                    className="px-3 py-2 rounded-xl bg-stone-900 text-white font-bold shrink-0 disabled:opacity-50"
                  >
                    {forgotOtpTimer > 0 ? `${forgotOtpTimer}s` : 'Send OTP'}
                  </button>
                </div>
              </div>

              {forgotOtpRecord && !isForgotVerified && (
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-stone-700">Enter 6-digit Code:</span>
                    <span className="text-[10px] text-amber-700">{forgotOtpTimer}s remaining</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="••••••"
                      value={forgotOtp}
                      onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3 py-2 font-mono tracking-widest rounded-xl border border-stone-200 text-center"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await verifyCryptographicOtp(forgotOtp, forgotOtpRecord);
                        if (res.valid) {
                          setIsForgotVerified(true);
                          setErrorMessage('');
                          setFloatingSmsRecord(null);
                          showToast('Phone Verified', 'You can now set a new password.');
                        } else {
                          setErrorMessage(res.error || 'Invalid code.');
                        }
                      }}
                      className="px-3 py-2 rounded-xl bg-emerald-600 text-white font-bold"
                    >
                      Verify
                    </button>
                  </div>
                </div>
              )}

              {isForgotVerified && (
                <div>
                  <label className="block font-medium text-stone-700 mb-1">
                    New Password (Min 8 chars, Aa1@)
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Min 8 chars, uppercase, number & symbol"
                    value={newResetPassword}
                    onChange={(e) => setNewResetPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200"
                  />
                  {newResetPassword && <PasswordStrengthChecklist password={newResetPassword} />}
                  <button
                    type="submit"
                    className="w-full mt-3 py-2.5 rounded-xl bg-emerald-600 text-white font-bold"
                  >
                    Save & Sign In
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Real Google OAuth Architecture Status Modal */}
      {showGoogleUnavailableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-stone-200 animate-in fade-in space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <h3 className="font-bold text-sm text-stone-900">Google Authentication</h3>
              </div>
              <button
                onClick={() => setShowGoogleUnavailableModal(false)}
                className="p-1 text-stone-400 hover:text-stone-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
              <p className="font-bold">Google Sign-In is currently unavailable.</p>
              <p className="text-amber-800 leading-relaxed">
                Please configure Google authentication by setting <strong>GOOGLE_CLIENT_ID</strong> and <strong>GOOGLE_CLIENT_SECRET</strong> in your environment settings.
              </p>
              <div className="p-2 rounded-lg bg-white/80 font-mono text-[11px] text-stone-700 border border-amber-200/60">
                Status: <span className="text-amber-700 font-bold">PENDING_CONFIGURATION</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowGoogleUnavailableModal(false)}
              className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-900 text-white font-bold text-xs shadow-md transition"
            >
              Understood
            </button>
          </div>
        </div>
      )}

      {/* First-Time Google Profile Completion Modal */}
      {showGoogleCompleteProfileModal && googleNewUserData && (
        <div id="modal-google-complete-profile" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg my-8 rounded-2xl bg-white p-6 sm:p-7 shadow-2xl border border-stone-200 animate-in fade-in space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
                  <Sprout className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-stone-900">
                    Complete Your AgriNex Account
                  </h3>
                  <p className="text-xs text-stone-500">
                    Google identity verified. Please confirm your role, phone & dispatch address.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowGoogleCompleteProfileModal(false);
                  setGoogleNewUserData(null);
                }}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error Banner */}
            {googleProfileError && (
              <div id="google-profile-error" className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{googleProfileError}</span>
              </div>
            )}

            <form onSubmit={handleCompleteGoogleProfileSubmit} className="space-y-4">
              {/* Google Verified Identity Details (Read-only) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-stone-50/80 rounded-xl border border-stone-200/80">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                    Full Name (Google Verified)
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={googleNewUserData.identity?.name || ''}
                      className="w-full pl-8 pr-2 py-1.5 text-xs rounded-lg border border-stone-200 bg-stone-100 text-stone-700 font-medium cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                    Email Address (Google Verified & Locked)
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
                    <input
                      type="email"
                      readOnly
                      disabled
                      value={googleNewUserData.identity?.email || ''}
                      className="w-full pl-8 pr-2 py-1.5 text-xs rounded-lg border border-stone-200 bg-stone-100 text-stone-700 font-medium cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1.5">
                  Choose Your Account Type *
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    id="btn-google-role-farmer"
                    onClick={() => setGoogleRole('FARMER')}
                    className={`p-3 rounded-xl border-2 text-left transition flex flex-col justify-between ${
                      googleRole === 'FARMER'
                        ? 'border-emerald-600 bg-emerald-50/60 shadow-xs'
                        : 'border-stone-200 hover:border-stone-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Sprout className={`w-4 h-4 ${googleRole === 'FARMER' ? 'text-emerald-700' : 'text-stone-500'}`} />
                      {googleRole === 'FARMER' && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                    </div>
                    <span className="font-bold text-xs text-stone-900 block">Farmer / Producer</span>
                    <span className="text-[10px] text-stone-500 block mt-0.5">
                      Sell harvests, self-manage or batch dispatch produce
                    </span>
                  </button>

                  <button
                    type="button"
                    id="btn-google-role-buyer"
                    onClick={() => setGoogleRole('BUYER')}
                    className={`p-3 rounded-xl border-2 text-left transition flex flex-col justify-between ${
                      googleRole === 'BUYER'
                        ? 'border-emerald-600 bg-emerald-50/60 shadow-xs'
                        : 'border-stone-200 hover:border-stone-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <User className={`w-4 h-4 ${googleRole === 'BUYER' ? 'text-emerald-700' : 'text-stone-500'}`} />
                      {googleRole === 'BUYER' && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                    </div>
                    <span className="font-bold text-xs text-stone-900 block">Buyer / Consumer</span>
                    <span className="text-[10px] text-stone-500 block mt-0.5">
                      Procure fresh produce, track deliveries in realtime
                    </span>
                  </button>
                </div>
              </div>

              {/* Farmer Transport Toggle */}
              {googleRole === 'FARMER' && (
                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="input-google-transport-toggle"
                    checked={googleCanManageTransport}
                    onChange={(e) => setGoogleCanManageTransport(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-stone-300"
                  />
                  <label htmlFor="input-google-transport-toggle" className="text-xs text-stone-800 cursor-pointer">
                    <span className="font-bold block">I can arrange / self-manage farm dispatch transport</span>
                    <span className="text-[11px] text-emerald-800 block mt-0.5">
                      Qualify for ₹15/km logistics bonus directly added to payout upon delivery.
                    </span>
                  </label>
                </div>
              )}

              {/* Mobile Phone Verification */}
              <div>
                <label className="block text-xs font-bold text-stone-800 mb-1">
                  Mobile Phone Number (Mandatory 2FA Verification) *
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Phone className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                    <input
                      type="tel"
                      id="input-google-phone"
                      required
                      disabled={isGooglePhoneVerified}
                      placeholder="e.g. 9845012345"
                      value={googlePhone}
                      onChange={(e) => {
                        setGooglePhone(e.target.value);
                        setIsGooglePhoneVerified(false);
                      }}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 bg-white"
                    />
                  </div>
                  <button
                    type="button"
                    id="btn-google-send-otp"
                    onClick={handleSendGoogleProfileOtp}
                    disabled={isGooglePhoneVerified || googleOtpTimer > 0}
                    className="px-3 py-2 rounded-xl bg-stone-900 text-white text-xs font-bold shrink-0 disabled:opacity-50 transition"
                  >
                    {isGooglePhoneVerified ? 'Verified' : googleOtpTimer > 0 ? `${googleOtpTimer}s` : 'Send OTP'}
                  </button>
                </div>

                {/* OTP Input box if OTP dispatched */}
                {(googleProfileOtpRecord || googleOtpTimer > 0) && !isGooglePhoneVerified && (
                  <div className="mt-2 p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-300 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-emerald-950">Enter 6-digit Code:</span>
                      <span className="font-mono text-emerald-800 font-bold">{googleOtpTimer}s remaining</span>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        id="input-google-otp"
                        maxLength={6}
                        placeholder="••••••"
                        value={googleOtp}
                        onChange={(e) => setGoogleOtp(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3 py-1.5 font-mono tracking-widest text-center text-xs rounded-lg border border-emerald-300 bg-white focus:ring-2 focus:ring-emerald-500"
                      />
                      <button
                        type="button"
                        id="btn-google-verify-otp"
                        onClick={handleVerifyGoogleProfileOtp}
                        className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0 transition"
                      >
                        Verify OTP
                      </button>
                    </div>
                  </div>
                )}

                {isGooglePhoneVerified && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-700 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Mobile phone number verified.</span>
                  </div>
                )}
              </div>

              {/* Physical / Delivery Address Picker */}
              <div>
                <AddAddressPicker
                  label={googleRole === 'BUYER' ? 'Delivery Address (Apartment, House, Mandi, or Hub) *' : 'Farm Dispatch & Physical Goods Location *'}
                  value={googleAddress}
                  coordinates={googleCoords}
                  structuredLocation={googleStructuredLocation}
                  placeholder={googleRole === 'BUYER' ? 'Enter delivery address or detect via GPS' : 'Enter farm dispatch location or detect with GPS'}
                  onChange={(addr, coords) => {
                    setGoogleAddress(addr);
                    if (coords) setGoogleCoords(coords);
                  }}
                  onLocationSelect={(loc) => {
                    setGoogleStructuredLocation(loc);
                    if (loc?.formattedAddress) setGoogleAddress(loc.formattedAddress);
                    if (loc?.latitude && loc?.longitude) {
                      setGoogleCoords({ lat: loc.latitude, lng: loc.longitude });
                    }
                  }}
                  helperText={googleRole === 'BUYER' ? 'Deliveries and route estimations depend on this verified address.' : 'Farm harvest pickup and multi-farmer route chaining relies on this verified address.'}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                id="btn-google-complete-submit"
                disabled={isSubmittingGoogleProfile}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md transition active:scale-98 disabled:opacity-50"
              >
                <span>
                  {isSubmittingGoogleProfile
                    ? 'Creating Your Account...'
                    : 'Complete Account & Launch AgriNex Dashboard'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
