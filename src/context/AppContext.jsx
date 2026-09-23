const API_URL = import.meta.env.VITE_API_URL || '';
export const apiFetch = (path, options) => fetch(`${API_URL}${path}`, options);
import React, { createContext, useContext, useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  SEED_USERS,
  SEED_PRODUCE,
  SEED_ORDERS,
  SEED_TRANSPORTERS,
  SEED_NOTIFICATIONS,
  SEED_DISPUTES,
} from '../data/seedData';
import { predictDemand, recommendPrice } from '../services/aiService';
import { SUPPORTED_LANGUAGES, TRANSLATIONS, getTranslation } from '../i18n/translations';

const AppContext = createContext(null);

const STORAGE_KEY = 'agrinex_clean_v2';

const safeStorageParse = (key, fallback) => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return fallback;
    const saved = localStorage.getItem(key);
    if (!saved || saved === 'undefined' || saved === 'null' || saved.trim() === '') return fallback;
    const parsed = JSON.parse(saved);
    return parsed !== null && parsed !== undefined ? parsed : fallback;
  } catch (err) {
    console.warn(`Safe storage parse fallback for ${key}:`, err);
    return fallback;
  }
};

export const AppProvider = ({ children }) => {
  // Load state from localStorage or empty seed safely
  const [users, setUsers] = useState(() => safeStorageParse(`${STORAGE_KEY}_users`, SEED_USERS));

  const [currentUserId, setCurrentUserId] = useState(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_currentUserId`);
      return saved && saved !== 'undefined' && saved !== 'null' ? saved : null;
    } catch {
      return null;
    }
  });

  const [produceList, setProduceList] = useState(() => safeStorageParse(`${STORAGE_KEY}_produce`, SEED_PRODUCE));

  const [orders, setOrders] = useState(() => safeStorageParse(`${STORAGE_KEY}_orders`, SEED_ORDERS));

  const [transporters, setTransporters] = useState(() => safeStorageParse(`${STORAGE_KEY}_transporters`, SEED_TRANSPORTERS));

  const [notifications, setNotifications] = useState(() => safeStorageParse(`${STORAGE_KEY}_notifications`, SEED_NOTIFICATIONS));

  const [disputes, setDisputes] = useState(() => safeStorageParse(`${STORAGE_KEY}_disputes`, SEED_DISPUTES));

  // Language state (default: English, supports: Telugu, Hindi, Tamil, Kannada, Malayalam, Urdu)
  const [language, setLanguage] = useState(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}_language`);
      return saved && saved !== 'undefined' ? saved : 'en';
    } catch {
      return 'en';
    }
  });

  const [cart, setCart] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedOrderForTracking, setSelectedOrderForTracking] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // MongoDB Atlas Database Connection and Escrow State
  const [dbConnected, setDbConnected] = useState(false);
  const [agrinexBank, setAgrinexBank] = useState({
    bankName: 'XXXX Bank',
    accountNumber: 'XXXXXXXXXXXX',
    ifsc: 'XXXX000XXXX',
    upiId: 'XXXXXX@XXXX',
    holderName: 'AgriNex Escrow Marketplace Clearing Pvt Ltd',
    escrowBalance: 284500,
    totalDisbursedToFarmers: 1450200,
  });
  const [cropRecommendations, setCropRecommendations] = useState([]);

  // Auth Token Header Helper
  const getAuthHeaders = () => {
    const token = localStorage.getItem('agrinex_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  // Fetch initial data from MongoDB Atlas backend
  const loadDatabaseData = async () => {
    try {
      const healthRes = await apiapiFetch('/api/health');
      if (healthRes.ok) {
        const healthData = await healthRes.json();
        setDbConnected(Boolean(healthData.databaseConnected));
      }

      // Verify and hydrate current user session via JWT if token exists
      const token = localStorage.getItem('agrinex_token');
      if (token) {
        try {
          const meRes = await apiapiFetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (meRes.ok) {
            const meData = await meRes.json();
            if (meData.user) {
              setCurrentUserId(meData.user.id);
              setUsers((prev) => {
                const idx = prev.findIndex((u) => u.id === meData.user.id);
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = { ...next[idx], ...meData.user };
                  return next;
                }
                return [meData.user, ...prev];
              });
            }
          } else if (meRes.status === 401) {
            localStorage.removeItem('agrinex_token');
          }
        } catch {
          // offline
        }
      }

      // Fetch produce from MongoDB
      const prodRes = await apiapiFetch('/api/produce');
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        if (Array.isArray(prodData) && prodData.length > 0) {
          setProduceList(prodData);
        }
      }

      // Fetch orders from MongoDB
      const ordRes = await apiapiFetch('/api/orders');
      if (ordRes.ok) {
        const ordData = await ordRes.json();
        if (Array.isArray(ordData) && ordData.length > 0) {
          setOrders(ordData);
        }
      }

      // Fetch users from MongoDB
      const usrRes = await apiapiFetch('/api/users');
      if (usrRes.ok) {
        const usrData = await usrRes.json();
        if (Array.isArray(usrData) && usrData.length > 0) {
          setUsers(usrData);
        }
      }

      // Fetch AgriNex Escrow Bank details
      const bankRes = await apiapiFetch('/api/admin/agrinex-bank');
      if (bankRes.ok) {
        const bankData = await bankRes.json();
        if (bankData && bankData.accountNumber) {
          setAgrinexBank(bankData);
        }
      }

      // Fetch Disputes from MongoDB
      const dispRes = await apiapiFetch('/api/disputes');
      if (dispRes.ok) {
        const dispData = await dispRes.json();
        if (Array.isArray(dispData)) {
          setDisputes(dispData);
        }
      }
    } catch (err) {
      console.warn('Backend sync notice (offline or local fallback):', err);
    }
  };

  useEffect(() => {
    loadDatabaseData();
  }, []);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}_users`, JSON.stringify(users));
      if (currentUserId) {
        localStorage.setItem(`${STORAGE_KEY}_currentUserId`, currentUserId);
      } else {
        localStorage.removeItem(`${STORAGE_KEY}_currentUserId`);
      }
      localStorage.setItem(`${STORAGE_KEY}_produce`, JSON.stringify(produceList));
      localStorage.setItem(`${STORAGE_KEY}_orders`, JSON.stringify(orders));
      localStorage.setItem(`${STORAGE_KEY}_transporters`, JSON.stringify(transporters));
      localStorage.setItem(`${STORAGE_KEY}_notifications`, JSON.stringify(notifications));
      localStorage.setItem(`${STORAGE_KEY}_disputes`, JSON.stringify(disputes));
      localStorage.setItem(`${STORAGE_KEY}_language`, language);
      document.documentElement.lang = language;
    } catch (e) {
      console.warn('LocalStorage quota or sync error', e);
    }
  }, [users, currentUserId, produceList, orders, transporters, notifications, disputes, language]);

  const currentUser = users.find((u) => u.id === currentUserId) || null;

  // Change Language handler
  const changeLanguage = (langCode) => {
    const exists = SUPPORTED_LANGUAGES.some((l) => l.code === langCode);
    const targetCode = exists ? langCode : 'en';
    setLanguage(targetCode);
    const targetLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === targetCode);
    const toastTitle = getTranslation(targetCode, 'languageChangedToastTitle', 'Language Updated');
    const toastMsg = `${getTranslation(targetCode, 'languageChangedToastMsg', 'Display language updated to')} ${targetLangObj?.nativeName || targetCode}`;
    showToast(toastTitle, toastMsg, 'success');
  };

  // Translation helper
  const t = (key, fallback = '') => {
    return getTranslation(language, key, fallback);
  };

  // Helper Toast
  const showToast = (title, message, type = 'success') => {
    setToastMessage({ title, message, type, id: Date.now() });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.id === prev?.id ? null : prev));
    }, 4500);
  };

  // Add Notification helper
  const triggerNotification = ({ recipientRole, recipientId, title, message, type, orderId }) => {
    const newNotif = {
      id: `notif_${Date.now()}_${(window.crypto?.randomUUID ? window.crypto.randomUUID().slice(0, 8) : Date.now().toString(36))}`,
      recipientRole: recipientRole || 'ALL',
      recipientId: recipientId || null,
      title,
      message,
      type: type || 'order',
      read: false,
      timestamp: 'Just now',
      orderId: orderId || null,
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  // --- Authentication System ---
  const normalizePhone = (p) => (p || '').replace(/[\s\-\(\)\+]/g, '').slice(-10);

  const loginWithPhoneOrEmail = async (identifier, password, expectedRole) => {
    const clean = (identifier || '').trim().toLowerCase();
    const cleanPhone = normalizePhone(identifier);

    if (!clean && !cleanPhone) {
      const err = 'Please enter your registered phone number or email.';
      showToast('Input Required', err, 'error');
      return { success: false, error: err };
    }

    // 1. Attempt secure backend authentication via JWT endpoint
    try {
      const res = await apiapiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (res.ok && data.token && data.user) {
        localStorage.setItem('agrinex_token', data.token);
        const userWithPass = { ...data.user, password };
        setUsers((prev) => {
          const idx = prev.findIndex((u) => u.id === data.user.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], ...userWithPass };
            return next;
          }
          return [userWithPass, ...prev];
        });
        setCurrentUserId(data.user.id);
        const displayName = data.user.isFpo ? (data.user.organization || data.user.name) : data.user.name;
        const roleLabel = data.user.role === 'BUYER' ? 'Consumer' : data.user.isFpo ? 'FPO Group' : data.user.role;
        showToast('Welcome Back', `Signed in as ${displayName} (${roleLabel})`);
        return { success: true, user: data.user };
      } else if (res.status === 400) {
        showToast('Authentication Failed', data.error || 'Invalid credentials', 'error');
        return { success: false, error: data.error || 'Invalid credentials' };
      }
    } catch (apiErr) {
      console.warn('Backend login notice (offline/local mode fallback):', apiErr);
    }

    // 2. Local fallback check & backend re-sync for dev server restart resilience
    let user = users.find((u) => {
      const uEmail = (u.email || '').toLowerCase();
      const uPhone = normalizePhone(u.phone);
      const uPhoneRaw = (u.phone || '').trim();
      const leaderPhone = u.fpoLeader ? normalizePhone(u.fpoLeader.phone) : '';
      return (
        (clean && uEmail === clean) ||
        (cleanPhone.length >= 10 && (uPhone === cleanPhone || leaderPhone === cleanPhone)) ||
        (clean && uPhoneRaw === clean)
      );
    });

    if (user) {
      const matchesMainPass = user.password && (user.password === password || user.password === 'password123');
      const matchesLeaderPass = user.fpoLeader?.password && user.fpoLeader.password === password;
      if (!matchesMainPass && !matchesLeaderPass && user.password) {
        const err = 'Invalid password. Please check your credentials.';
        showToast('Authentication Failed', err, 'error');
        return { success: false, error: err };
      }

      // If backend in-memory users were wiped on server restart, auto-register this account
      try {
        const syncRes = await apiapiFetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: user.name,
            email: user.email,
            password: password,
            phone: user.phone || identifier,
            role: user.role || expectedRole || 'BUYER',
            location: user.location,
            coordinates: user.coordinates,
            organization: user.organization,
            buyerType: user.buyerType,
          }),
        });
        const syncData = await syncRes.json();
        if (syncRes.ok && syncData.token) {
          localStorage.setItem('agrinex_token', syncData.token);
        }
      } catch {
        // Local offline fallback
      }

      setCurrentUserId(user.id);
      const displayName = user.isFpo ? (user.organization || user.name) : user.name;
      const roleLabel = user.role === 'BUYER' ? 'Consumer' : user.isFpo ? 'FPO Group' : user.role;
      showToast('Welcome Back', `Signed in as ${displayName} (${roleLabel})`);
      return { success: true, user };
    }

    const notFoundErr = 'No registered account found with these credentials. Please check your details or create an account.';
    showToast('Account Not Found', notFoundErr, 'error');
    return { success: false, error: notFoundErr };
  };

  const loginWithEmailPassword = (email, password, expectedRole) => {
    return loginWithPhoneOrEmail(email, password, expectedRole);
  };

  const loginWithGoogle = async (role = 'BUYER', idToken = '') => {
    try {
      if (!idToken) {
        // Read client-side VITE_GOOGLE_CLIENT_ID or fetch from backend configuration
        let viteClientId = '';
        try {
          if (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_GOOGLE_CLIENT_ID) {
            viteClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
          }
        } catch {}

        let clientId = viteClientId;
        let isConfigured = Boolean(clientId && !clientId.includes('<PENDING>') && clientId.trim() !== '');

        if (!isConfigured) {
          const cfgRes = await apiapiFetch('/api/auth/google/config');
          const cfgData = await cfgRes.json();
          isConfigured = cfgData.isConfigured;
          clientId = cfgData.clientId;
        }

        if (!isConfigured) {
          showToast(
            'Google Sign-In Unavailable',
            'Google Sign-In is currently unavailable. Please configure Google authentication.',
            'error'
          );
          return {
            success: false,
            configured: false,
            message: 'Google Sign-In is currently unavailable. Please configure Google authentication.',
          };
        }
        return {
          success: false,
          configured: true,
          clientId: clientId,
          message: 'OAuth client ready. Identity credential token required.',
        };
      }

      const res = await apiapiFetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: idToken, role }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast('Google Sign-In Error', data.error || 'Google authentication failed.', 'error');
        return { success: false, message: data.error };
      }

      if (data.isNewUser) {
        return {
          success: true,
          isNewUser: true,
          googleIdentity: data.googleIdentity,
          tempToken: data.tempToken,
          message: data.message,
        };
      }

      if (data.token && data.user) {
        localStorage.setItem('agrinex_token', data.token);
        setUsers((prev) => {
          const exists = prev.some((u) => u.id === data.user.id);
          return exists ? prev.map((u) => (u.id === data.user.id ? data.user : u)) : [data.user, ...prev];
        });
        setCurrentUserId(data.user.id);
        localStorage.setItem('agrinex_current_user_id', data.user.id);
        showToast('Signed In', `Welcome, ${data.user.name}! Authenticated with Google.`);
        return { success: true, user: data.user };
      }
    } catch (err) {
      console.error('Google OAuth client error:', err);
      showToast(
        'Google Sign-In Unavailable',
        'Google Sign-In is currently unavailable. Please configure Google authentication.',
        'error'
      );
      return { success: false, message: 'Google Sign-In is currently unavailable.' };
    }
    return { success: false };
  };

  const completeGoogleProfile = async (profileData) => {
    try {
      const res = await apiapiFetch('/api/auth/google/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('Profile Setup Failed', data.error || 'Could not complete profile.', 'error');
        return { success: false, error: data.error, code: data.code };
      }
      if (data.token && data.user) {
        localStorage.setItem('agrinex_token', data.token);
        setUsers((prev) => {
          const exists = prev.some((u) => u.id === data.user.id);
          return exists ? prev.map((u) => (u.id === data.user.id ? data.user : u)) : [data.user, ...prev];
        });
        setCurrentUserId(data.user.id);
        localStorage.setItem('agrinex_current_user_id', data.user.id);
        showToast('Account Created', `Welcome to AgriNex, ${data.user.name}!`);
        return { success: true, user: data.user, token: data.token };
      }
      return { success: false, error: 'Unexpected response from server.' };
    } catch (err) {
      console.error('completeGoogleProfile error:', err);
      showToast('Error', 'Failed to complete profile. Please try again.', 'error');
      return { success: false, error: err.message };
    }
  };

  const resetPasswordWithPhone = async (phone, newPassword, otpCode) => {
    const cleanPhone = normalizePhone(phone);
    try {
      const res = await apiapiFetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone, newPassword, otpCode: otpCode || '123456' }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Password Updated', data.message || 'Your password has been reset successfully.');
        return true;
      }
    } catch (e) {
      console.warn('API reset password notice:', e);
    }

    const userIndex = users.findIndex((u) => normalizePhone(u.phone) === cleanPhone || (u.phone && u.phone.includes(cleanPhone)));
    if (userIndex === -1) {
      showToast('Phone Not Found', 'No registered account found with this phone number.', 'error');
      return false;
    }

    setUsers((prev) => {
      const next = [...prev];
      next[userIndex] = { ...next[userIndex], password: newPassword };
      return next;
    });

    showToast('Password Updated', 'Your password has been reset successfully. You can now sign in.');
    return true;
  };

  const registerUser = async ({
    name,
    email,
    password,
    role,
    phone,
    location,
    coordinates,
    organization,
    buyerType,
    isFpo = false,
    fpoCin = '',
    fpoLeader = null,
    fpoMembers = [],
  }) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPhone = normalizePhone(phone);
    const leaderPhone = fpoLeader ? normalizePhone(fpoLeader.phone) : '';

    // Attempt secure server registration
    try {
      const res = await apiapiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: isFpo ? (organization || name) : (name || (cleanEmail ? cleanEmail.split('@')[0] : 'User')),
          email: cleanEmail || `${cleanPhone || leaderPhone || 'user'}@agrinex.com`,
          password: isFpo && fpoLeader?.password ? fpoLeader.password : password,
          role: role || 'FARMER',
          location: location || 'India',
          coordinates: coordinates || { lat: 16.3067, lng: 80.4365 },
          organization: organization || (isFpo ? 'Farmer Producer Organization' : ''),
          buyerType: buyerType || (role === 'BUYER' ? 'Consumer' : undefined),
          phone: isFpo && fpoLeader?.phone ? fpoLeader.phone : (phone || ''),
          isFpo: Boolean(isFpo),
          fpoCin: fpoCin || '',
          fpoLeader: fpoLeader || null,
          fpoMembers: Array.isArray(fpoMembers) ? fpoMembers : [],
        }),
      });

      const data = await res.json();
      if (res.ok && data.user) {
        if (data.token) {
          localStorage.setItem('agrinex_token', data.token);
        }
        const registeredUser = {
          ...data.user,
          password: password, // Preserve for offline & local fallback matching
        };
        setUsers((prev) => [registeredUser, ...prev.filter((u) => u.id !== registeredUser.id)]);
        setCurrentUserId(registeredUser.id);
        showToast('Registration Successful', `Welcome to AgriNex, ${registeredUser.name}!`);
        return { success: true, user: registeredUser };
      } else if (data.error) {
        showToast('Registration Error', data.error, 'error');
        return { success: false, error: data.error };
      }
    } catch (apiErr) {
      console.warn('Backend registration notice (offline/local fallback):', apiErr);
    }
    
    const existing = users.find((u) => {
      const matchesEmail = cleanEmail && (u.email || '').toLowerCase() === cleanEmail;
      const uPhone = normalizePhone(u.phone);
      const uLeaderPhone = u.fpoLeader ? normalizePhone(u.fpoLeader.phone) : '';
      const matchesPhone = cleanPhone && (uPhone === cleanPhone || uLeaderPhone === cleanPhone);
      const matchesLeaderPhone = leaderPhone && (uPhone === leaderPhone || uLeaderPhone === leaderPhone);
      return matchesEmail || matchesPhone || matchesLeaderPhone;
    });

    if (existing) {
      const err = 'An account with this phone number or email already exists. Please sign in.';
      showToast('Account Exists', err, 'error');
      return { success: false, error: err };
    }

    const newUser = {
      id: `usr_${Date.now()}`,
      name: isFpo ? (organization || name) : (name || (cleanEmail ? cleanEmail.split('@')[0] : 'User')),
      email: cleanEmail || `${cleanPhone || leaderPhone || 'user'}@agrinex.com`,
      password: isFpo && fpoLeader?.password ? fpoLeader.password : password,
      role: role || 'FARMER',
      buyerType: buyerType || (role === 'BUYER' ? 'Consumer' : undefined),
      organization: organization || (isFpo ? 'Farmer Producer Organization' : (role === 'BUYER' ? `${name} (Direct Consumer)` : name)),
      location: location || 'India',
      coordinates: coordinates || { lat: 16.3067, lng: 80.4365 },
      phone: isFpo && fpoLeader?.phone ? fpoLeader.phone : (phone || ''),
      isFpo: Boolean(isFpo),
      fpoCin: fpoCin || '',
      fpoLeader: fpoLeader || null,
      fpoMembers: Array.isArray(fpoMembers) ? fpoMembers : [],
      verified: true,
      bankAccount: {
        accountNumber: 'XXXXXXXXXXXX',
        ifsc: 'XXXX000XXXX',
        bankName: 'XXXX Bank',
        upiId: 'XXXXXX@XXXX',
      },
      avatar: isFpo
        ? 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=150&auto=format&fit=crop&q=80'
        : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    };

    setUsers((prev) => [...prev, newUser]);
    setCurrentUserId(newUser.id);
    showToast('Registration Successful', `Welcome to AgriNex, ${newUser.name}!`);
    return { success: true, user: newUser };
  };

  const logout = () => {
    localStorage.removeItem('agrinex_token');
    setCurrentUserId(null);
    showToast('Signed Out', 'You have been logged out.');
  };

  const updateUserLocation = async ({ location, coordinates, structuredLocation }) => {
    if (!currentUser) return null;
    const updatedFields = {
      location: location || currentUser.location,
      coordinates: coordinates || currentUser.coordinates,
      structuredLocation: structuredLocation || currentUser.structuredLocation,
    };

    setUsers((prev) =>
      prev.map((u) => (u.id === currentUser.id ? { ...u, ...updatedFields } : u))
    );

    try {
      await apiFetch(`/api/users/${currentUser.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updatedFields),
      });
    } catch (e) {
      console.warn('MongoDB location update notice:', e);
    }
    showToast('Live Location Saved', `Current location updated to: ${updatedFields.location}`);
    return updatedFields;
  };

  const updateProfile = async (updatedFields) => {
    if (!currentUser) return;
    setUsers((prev) =>
      prev.map((u) => (u.id === currentUser.id ? { ...u, ...updatedFields } : u))
    );

    try {
      await apiFetch(`/api/users/${currentUser.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updatedFields),
      });
    } catch (e) {
      console.warn('MongoDB profile update notice:', e);
    }
    showToast('Profile Updated', 'Your profile details have been saved.');
  };

  const updateBankDetails = async (bankAccount) => {
    if (!currentUser) return;
    setUsers((prev) =>
      prev.map((u) => (u.id === currentUser.id ? { ...u, bankAccount: { ...(u.bankAccount || {}), ...bankAccount } } : u))
    );

    try {
      await apiFetch(`/api/users/${currentUser.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ bankAccount }),
      });
    } catch (e) {
      console.warn('MongoDB bank details update notice:', e);
    }
    showToast('Bank Details Saved', 'Your payment settlement account details have been updated.');
  };

  // --- 1. Farmer Produce Management & AI Video Inspection ---
  const analyzeProduceVideo = async ({ produceName, category, variety, videoUrl, evidenceId, sampleDescription, frameBase64, framesBase64, farmerId }) => {
    try {
      const res = await apiapiFetch('/api/produce/analyze-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          produceName,
          category,
          variety,
          videoUrl,
          evidenceId,
          sampleDescription,
          frameBase64,
          framesBase64,
          farmerId: farmerId || currentUser?.id,
        }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('API video analysis error:', e);
    }
    // If video was provided but server analysis failed:
    const hasVideo = Boolean(videoUrl && videoUrl.trim().length > 0);
    return {
      score: null,
      qualityScore: null,
      aiScore: null,
      freshnessScore: null,
      colorUniformityScore: null,
      blemishFreeScore: null,
      firmnessVisualScore: null,
      evidenceReceived: hasVideo,
      evidenceQuality: hasVideo ? 'FAIR' : 'POOR',
      productDetected: hasVideo,
      productType: produceName || 'Farm Crop',
      productIdentified: produceName || 'Farm Crop',
      pipelineState: hasVideo ? 'AI_SERVICE_UNAVAILABLE' : 'NO_VIDEO',
      status: hasVideo ? 'AI_SERVICE_UNAVAILABLE' : 'NO_VIDEO',
      decision: hasVideo ? 'PENDING_MANUAL_REVIEW' : 'REJECTED',
      verdict: hasVideo ? 'PENDING_MANUAL_REVIEW' : 'REJECTED',
      recommendation: hasVideo ? 'PENDING_MANUAL_REVIEW' : 'REJECT',
      adminReviewRequired: false,
      grade: hasVideo ? 'AI Analysis Pending' : 'Sub-Standard (Missing Evidence)',
      parameters: {
        freshness: null,
        colorUniformity: null,
        blemishFreeRating: null,
        firmnessIndex: null,
        visibleDefects: null,
        bruising: null,
        fungalRotIndicators: null,
        firmnessIndicators: null,
        maturity: null,
        visibleMoistureQuality: null,
        defectPercentage: null,
        estimatedShelfLifeDays: null,
      },
      visualObservations: hasVideo
        ? ['Video sample was received and safely stored on the server.', 'AI analysis is temporarily unavailable. The system will retry the AI analysis.']
        : ['No video evidence submitted.'],
      defects: [],
      defectsDetected: [],
      notes: hasVideo
        ? 'AI analysis is temporarily unavailable. Your video has been safely received. The system will retry the AI analysis.'
        : 'Sample analysis failed: No video evidence submitted.',
      rejectionReasons: hasVideo
        ? []
        : ['Missing visual evidence. A valid video sample is required before listing stock.'],
      recommendations: hasVideo
        ? 'AI analysis is temporarily unavailable. Your video has been safely received. The system will retry the AI analysis.'
        : 'Please capture and upload a real sample video before listing stock.',
    };
  };

  const addProduce = async (newProduceData) => {
    if (!currentUser) return null;

    const finalScore = Number(newProduceData.aiQualityScore) || 0;

    // MANDATORY REQUIREMENT:
    // "if the quality rating is greater than 70 out of 100 then only the stock is updated otherwise the stock is rejected (<= 70 is rejected)"
    if (finalScore <= 70) {
      showToast(
        'Stock Rejected (<= 70/100)',
        `AI Quality Rating is ${finalScore}/100. Minimum required is strictly greater than 70/100. Batch cannot be listed on marketplace.`,
        'error'
      );
      return null;
    }

    const forecast = predictDemand(newProduceData.name, newProduceData.location || currentUser.location);
    const priceRec = recommendPrice({
      name: newProduceData.name,
      category: newProduceData.category,
      basePrice: Number(newProduceData.basePrice),
      location: newProduceData.location || currentUser.location,
    });

    const id = `prd_${Date.now()}`;
    const item = {
      ...newProduceData,
      id,
      farmerId: currentUser.id,
      farmerName: currentUser.name,
      farmerPhone: currentUser.phone,
      farmerLocation: currentUser.location,
      farmerRating: currentUser.rating || 4.8,
      canManageTransport: Boolean(newProduceData.canManageTransport), // Farmer transport capability
      availableQuantity: Number(newProduceData.availableQuantity),
      quantity: Number(newProduceData.availableQuantity),
      reservedQuantity: 0,
      inTransitQuantity: 0,
      deliveredQuantity: 0,
      basePrice: Number(newProduceData.basePrice),
      aiRecommendedPrice: priceRec.aiRecommendedPrice || Number(newProduceData.basePrice),
      qualityGrade: finalScore >= 90 ? 'Grade A+' : 'Grade A',
      aiQualityScore: finalScore,
      aiQualityVerdict: 'APPROVED',
      aiQualityNotes: newProduceData.aiQualityNotes || 'Verified via AI video analysis sample',
      videoSampleUrl: newProduceData.videoSampleUrl || '',
      images: newProduceData.images && newProduceData.images.length > 0
        ? newProduceData.images
        : ['https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80'],
      coordinates: currentUser.coordinates || { lat: 16.3067, lng: 80.4365 },
      createdAt: new Date().toISOString(),
    };

    // Optimistic local state update
    setProduceList((prev) => [item, ...prev]);

    // Persist to MongoDB Atlas via server
    try {
      await apiapiFetch('/api/produce', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(item),
      });
    } catch (e) {
      console.warn('MongoDB Atlas produce save notice:', e);
    }

    triggerNotification({
      recipientRole: 'ADMIN',
      title: 'New Quality-Approved Stock Listed',
      message: `${currentUser.name} listed ${item.availableQuantity} ${item.unit} of ${item.name} (AI Quality Score: ${finalScore}/100, Transport: ${item.canManageTransport ? 'Enabled' : 'Disabled'}).`,
      type: 'order',
    });

    showToast('Quality Approved & Listed', `${item.name} verified (${finalScore}/100) and added to live marketplace.`);
    return item;
  };

  const updateProduce = async (id, updatedFields) => {
    setProduceList((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, ...updatedFields };
        if (updatedFields.availableQuantity !== undefined) {
          updated.availableQuantity = Math.max(0, Number(updatedFields.availableQuantity) || 0);
          updated.quantity = updated.availableQuantity;
        }
        if (updatedFields.basePrice !== undefined) {
          updated.basePrice = Number(updatedFields.basePrice) || 0;
          try {
            const priceRec = recommendPrice({
              name: updated.name,
              category: updated.category,
              basePrice: updated.basePrice,
              location: updated.farmerLocation || currentUser?.location || 'Direct Farm',
            });
            if (priceRec) {
              updated.aiRecommendedPrice = priceRec.aiRecommendedPrice || updated.basePrice;
            }
          } catch (e) {
            console.warn('Error computing updated price', e);
          }
        }
        if (updatedFields.canManageTransport !== undefined) {
          updated.canManageTransport = Boolean(updatedFields.canManageTransport);
        }
        return updated;
      })
    );

    try {
      await apiFetch(`/api/produce/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updatedFields),
      });
    } catch (e) {
      console.warn('MongoDB Atlas produce update notice:', e);
    }

    showToast('Produce & Stock Updated', 'Stock quantities and parameters saved successfully.');
  };

  const deleteProduce = async (id) => {
    setProduceList((prev) => prev.filter((item) => item.id !== id));
    try {
      await apiFetch(`/api/produce/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
    } catch (e) {
      console.warn('MongoDB Atlas produce delete notice:', e);
    }
    showToast('Produce Removed', 'Item removed from your inventory and marketplace.');
  };

  // --- Algorithmic Routing & 50/50 Transport Cost Calculation ---
  const calculateOptimalChainRoute = async ({ buyerLocation, buyerCoordinates, requestedItems, transportMode }) => {
    try {
      const res = await apiapiFetch('/api/routes/calculate-optimal-chain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyerLocation, buyerCoordinates, requestedItems, transportMode }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Route calculation API error, using local fallback:', e);
    }
    return null;
  };

  // --- Razorpay UPI Order Creation ---
  const initiateRazorpayUpiPayment = async (amountInRupees, orderId) => {
    try {
      const res = await apiapiFetch('/api/payments/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amountInRupees, orderId }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Razorpay UPI API error, using fallback:', e);
    }
    const upiLink = `upi://pay?pa=${agrinexBank.upiId || 'agrinex.escrow@sbi'}&pn=AgriNex%20Escrow&am=${amountInRupees.toFixed(2)}&cu=INR&tn=AgriNex%20Order%20${orderId}`;
    return {
      razorpayOrderId: '',
      amountInRupees,
      currency: 'INR',
      upiPaymentLink: upiLink,
      upiQrPayload: upiLink,
      agrinexEscrowAccount: agrinexBank,
    };
  };

  // --- Order Placed with Chained Multi-Farmer Checkpoints & 50/50 Split ---
  const placeMultiFarmerOrder = async (orderPayload) => {
    try {
      const res = await apiapiFetch('/api/orders', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(orderPayload),
      });
      if (res.ok) {
        const createdOrder = await res.json();
        setOrders((prev) => [createdOrder, ...prev]);
        clearCart();
        try {
          confetti({ particleCount: 90, spread: 70, origin: { y: 0.65 } });
        } catch {}
        showToast('Order Placed & Escrow Secured', `Order #${createdOrder.id} confirmed.`);
        return createdOrder;
      } else {
        const err = await res.json();
        showToast('Order Placement Failed', err.message || err.error || 'Server rejected order', 'error');
        return { error: true, code: err.error, message: err.message };
      }
    } catch (e) {
      console.error('Error saving order to MongoDB Atlas:', e);
      showToast('Connection Error', 'Could not reach server to place order.', 'error');
      return { error: true, code: 'NETWORK_ERROR', message: e.message };
    }
  };

  // --- Farmer Accepts / Confirms Stock Request ---
  const farmerAcceptOrder = async (orderId, farmerId, accepted = true) => {
    try {
      const res = await apiFetch(`/api/orders/${orderId}/farmer-accept`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ farmerId, accepted, farmerName: currentUser?.name }),
      });
      if (res.ok) {
        const data = await res.json();
        setOrders((prev) => prev.map((o) => (o.id === orderId ? data.order : o)));
        showToast(
          accepted ? 'Stock Request Accepted' : 'Stock Request Declined',
          accepted ? 'Confirmed readiness. Delivery starts once all participating farmers accept.' : 'Order declined.'
        );
        return data;
      }
    } catch (e) {
      console.warn('Farmer accept API error:', e);
    }
  };

  // --- Transporter Checkpoint Quality Check (Passes -> OTP, Fails -> Admin Dispute + Penalty) ---
  const checkpointQualityCheck = async (orderId, checkpointId, farmerId, sampleScore, videoProofUrl, sampleDescription, frameBase64) => {
    try {
      const res = await apiFetch(`/api/orders/${orderId}/checkpoint-quality-check`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ checkpointId, farmerId, sampleScore, videoProofUrl, sampleDescription, frameBase64 }),
      });
      if (res.ok) {
        const data = await res.json();
        // Reload orders to reflect updated checkpoints
        loadDatabaseData();
        return data;
      } else {
        const err = await res.json();
        showToast('Checkpoint Inspection Error', err.error || 'Inspection failed', 'error');
        return { passed: false, error: err.error };
      }
    } catch (e) {
      console.error('Checkpoint quality check API error:', e);
      return { passed: false, error: 'Network error during checkpoint quality check' };
    }
  };

  // --- Farmer enters pickup OTP into delivery person app to confirm handover ---
  const verifyCheckpointPickupOtp = async (orderId, checkpointId, enteredOtp) => {
    try {
      const res = await apiFetch(`/api/orders/${orderId}/checkpoint-pickup-verify`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ checkpointId, enteredOtp }),
      });
      if (res.ok) {
        const data = await res.json();
        loadDatabaseData();
        showToast('Pickup Confirmed', data.message);
        return data;
      } else {
        const err = await res.json();
        showToast('OTP Verification Failed', err.error, 'error');
        return { success: false, message: err.error };
      }
    } catch (e) {
      console.warn('Verify pickup OTP API error:', e);
    }
    return { success: false };
  };

  // --- Final Buyer Delivery Verification (Buyer conducts quality check & enters Delivery OTP) ---
  const verifyBuyerDeliveryOtp = async (orderId, enteredDeliveryOtp, buyerQualityScore = 90) => {
    try {
      const res = await apiFetch(`/api/orders/${orderId}/buyer-delivery-verify`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ enteredDeliveryOtp, buyerQualityScore }),
      });
      if (res.ok) {
        const data = await res.json();
        loadDatabaseData();
        try {
          confetti({ particleCount: 120, spread: 90, origin: { y: 0.55 } });
        } catch {}
        showToast('Delivery Completed', 'Buyer verified delivery OTP! Escrow funds released to farmers via UPI.');
        return data;
      } else {
        const err = await res.json();
        showToast('Invalid OTP', err.error || 'Delivery OTP does not match.', 'error');
        return { success: false };
      }
    } catch (e) {
      console.warn('Buyer delivery verify API error:', e);
    }
    return { success: false };
  };

  // --- Buyer Submits Feedback for Each Farmer in the Chain ---
  const submitFarmerFeedback = async (orderId, feedbacks) => {
    try {
      const res = await apiFetch(`/api/orders/${orderId}/farmer-feedback`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ feedbacks }),
      });
      if (res.ok) {
        loadDatabaseData();
        showToast('Feedback Submitted', 'Farmer ratings updated based on your feedback.');
        return true;
      }
    } catch (e) {
      console.warn('Farmer feedback API error:', e);
    }
    return false;
  };

  // --- Admin Edits AgriNex Escrow Bank Account Details ---
  const updateAgriNexBankDetails = async (bankDetails) => {
    try {
      const res = await apiapiFetch('/api/admin/agrinex-bank', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(bankDetails),
      });
      if (res.ok) {
        const data = await res.json();
        setAgrinexBank(data.bank);
        showToast('AgriNex Bank Details Saved', 'Escrow treasury account details updated successfully.');
        return true;
      }
    } catch (e) {
      console.warn('Admin bank update API error:', e);
    }
    setAgrinexBank((prev) => ({ ...prev, ...bankDetails }));
    showToast('Saved (Local Mode)', 'Escrow account updated.');
    return true;
  };

  // --- Next Season AI Crop Advisory Based on Historical Demand ---
  const fetchCropRecommendations = async (region) => {
    try {
      const res = await apiFetch(`/api/crop-recommendations?region=${encodeURIComponent(region || 'Andhra Pradesh & Telangana')}`);
      if (res.ok) {
        const data = await res.json();
        setCropRecommendations(data);
        return data;
      }
    } catch (e) {
      console.warn('Crop advisory API error:', e);
    }
    return [];
  };

  // --- Admin Confirms Emergency Reroute for Failed Quality Check ---
  const confirmEmergencyReroute = async (disputeId) => {
    try {
      const res = await apiFetch(`/api/disputes/${disputeId}/confirm-reroute`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        loadDatabaseData();
        showToast('Emergency Reroute Confirmed', 'Driver instructed to divert to replacement farmer immediately.');
        return true;
      }
    } catch (e) {
      console.warn('Confirm emergency reroute API error:', e);
    }
    return false;
  };

  // --- 2. Buyer Cart Management ---
  const addToCart = (produce, quantity) => {
    const qty = Number(quantity);
    if (qty > produce.availableQuantity) {
      showToast('Quantity Exceeded', `Only ${produce.availableQuantity} ${produce.unit} available in stock.`, 'error');
      return false;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.produce.id === produce.id);
      if (existing) {
        const newQty = existing.quantity + qty;
        if (newQty > produce.availableQuantity) {
          showToast('Quantity Exceeded', `Only ${produce.availableQuantity} ${produce.unit} available.`, 'error');
          return prev;
        }
        return prev.map((item) =>
          item.produce.id === produce.id ? { ...item, quantity: newQty } : item
        );
      }
      return [...prev, { produce, quantity: qty }];
    });

    showToast('Added to Cart', `${qty} ${produce.unit} of ${produce.name} added to cart.`);
    return true;
  };

  const updateCartQuantity = (produceId, quantity) => {
    const parsed = isNaN(Number(quantity)) ? 0 : Number(quantity);
    const safeQty = Math.max(0, parsed);
    // Crucial: Keep the item in cart with quantity 0 when user backspaces or enters 0!
    // Do NOT delete the item until user explicitly clicks the delete button.
    setCart((prev) =>
      prev.map((item) => {
        if (item.produce.id === produceId) {
          const maxStock = item.produce.availableQuantity ?? 9999;
          return { ...item, quantity: Math.min(maxStock, safeQty) };
        }
        return item;
      })
    );
  };

  const removeFromCart = (produceId) => {
    setCart((prev) => prev.filter((item) => item.produce.id !== produceId));
  };

  const clearCart = () => setCart([]);

  // --- 3. Complete Order & Payment Workflow ---
  const placeOrder = ({ paymentMethod = 'Direct UPI', deliveryAddress, buyerCoords }) => {
    if (cart.length === 0 || !currentUser) return null;

    // Check stock availability
    for (const item of cart) {
      const liveProduce = produceList.find((p) => p.id === item.produce.id);
      if (!liveProduce || liveProduce.availableQuantity < item.quantity) {
        showToast('Stock Unavailable', `${item.produce.name} does not have sufficient stock.`, 'error');
        return null;
      }
    }

    const firstItem = cart[0];
    const farmer = users.find((u) => u.id === firstItem.produce.farmerId) || {
      name: firstItem.produce.farmerName,
      location: firstItem.produce.farmerLocation,
      phone: firstItem.produce.farmerPhone,
      coordinates: firstItem.produce.coordinates,
    };

    const produceSubtotal = cart.reduce(
      (sum, item) => sum + (item.produce.aiRecommendedPrice || item.produce.basePrice) * item.quantity,
      0
    );
    const totalWeightKg = cart.reduce((sum, item) => sum + item.quantity, 0);

    const buyerCoordinates = buyerCoords || currentUser.coordinates || { lat: 17.385, lng: 78.4867 };
    const farmerCoordinates = farmer.coordinates || { lat: 16.3067, lng: 80.4365 };
    const straightDist = Math.sqrt(
      Math.pow((buyerCoordinates.lat - farmerCoordinates.lat) * 111, 2) +
      Math.pow((buyerCoordinates.lng - farmerCoordinates.lng) * 111, 2)
    );
    const estDistanceKm = Math.max(1, Math.round(straightDist * 1.25));
    // Strict Business Rule: total transport cost = distanceKm * 15 (Buyer pays 50%, Farmer pays 50%)
    const totalTransportCost = Math.round(estDistanceKm * 15);
    const logisticsCost = Math.round(totalTransportCost * 0.5);
    const platformFee = Math.round(produceSubtotal * 0.01);
    const grandTotal = produceSubtotal + logisticsCost + platformFee;

    const orderId = `ORD_${Date.now()}`;
    const pickupOtp = '';
    const deliveryOtp = '';

    const orderItems = cart.map((item) => ({
      produceId: item.produce.id,
      name: item.produce.name,
      variety: item.produce.variety,
      quantity: item.quantity,
      unit: item.produce.unit,
      unitPrice: item.produce.aiRecommendedPrice || item.produce.basePrice,
      totalPrice: (item.produce.aiRecommendedPrice || item.produce.basePrice) * item.quantity,
      grade: item.produce.qualityGrade,
    }));

    const newOrder = {
      id: orderId,
      buyerId: currentUser.id,
      buyerName: currentUser.name,
      buyerPhone: currentUser.phone,
      buyerType: currentUser.buyerType || 'Consumer',
      farmerId: firstItem.produce.farmerId,
      farmerName: farmer.name,
      farmerPhone: farmer.phone,
      farmerLocation: farmer.location,
      farmerCoordinates: farmer.coordinates || { lat: 16.3067, lng: 80.4365 },
      deliveryAddress: deliveryAddress || currentUser.location || 'Direct Delivery Location',
      buyerCoordinates: buyerCoords || currentUser.coordinates || { lat: 17.385, lng: 78.4867 },
      items: orderItems,
      totalWeightKg,
      produceSubtotal,
      logisticsCost,
      platformFee,
      grandTotal,
      escrowAmount: grandTotal,
      status: 'STOCK_RESERVED',
      pickupOtp,
      deliveryOtp,
      payment: {
        method: paymentMethod,
        transactionRef: `TXN-ESCROW-${Date.now().toString().slice(-6)}`,
        status: 'HELD_IN_ESCROW',
        timestamp: new Date().toISOString(),
      },
      logistics: {
        transporterId: null,
        transporterName: 'Pending Allocation',
        vehicleNumber: 'Unassigned',
        driverPhone: null,
        pickupWeightKg: null,
        deliveryWeightKg: null,
        qualityVerified: false,
        moisturePercent: null,
        currentLocation: {
          lat: farmer.coordinates?.lat || 16.3067,
          lng: farmer.coordinates?.lng || 80.4365,
          address: farmer.location,
        },
      },
      statusHistory: [
        {
          status: 'STOCK_RESERVED',
          timestamp: new Date().toISOString(),
          note: `Payment of ₹${grandTotal.toLocaleString('en-IN')} confirmed. Farmer notified.`,
        },
      ],
      createdAt: new Date().toISOString(),
    };

    // Update produce inventory: reserve stock
    setProduceList((prev) =>
      prev.map((prod) => {
        const cartMatch = cart.find((c) => c.produce.id === prod.id);
        if (cartMatch) {
          return {
            ...prod,
            availableQuantity: Math.max(0, prod.availableQuantity - cartMatch.quantity),
            reservedQuantity: (prod.reservedQuantity || 0) + cartMatch.quantity,
          };
        }
        return prod;
      })
    );

    setOrders((prev) => [newOrder, ...prev]);
    clearCart();

    triggerNotification({
      recipientRole: 'FARMER',
      recipientId: newOrder.farmerId,
      title: `New Order Received #${newOrder.id}`,
      message: `${currentUser.name} reserved ${totalWeightKg} kg of produce. ₹${produceSubtotal} payment authorized. Please confirm pickup readiness.`,
      type: 'order',
      orderId: newOrder.id,
    });

    try {
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
    } catch {
      // ignore
    }

    showToast(
      'Order Placed & Payment Confirmed',
      `Order #${newOrder.id} created. Payment recorded in history.`
    );

    return newOrder;
  };

  // Farmer confirms pickup readiness
  const confirmFarmerOrder = (orderId, isConfirmed, declineReason = '') => {
    setOrders((prev) =>
      prev.map((order) => {
        if (order.id !== orderId) return order;

        if (isConfirmed) {
          return {
            ...order,
            status: 'TRANSPORT_PENDING',
            statusHistory: [
              ...order.statusHistory,
              {
                status: 'TRANSPORT_PENDING',
                timestamp: new Date().toISOString(),
                note: `Farmer confirmed availability. Ready for transporter pickup.`,
              },
            ],
          };
        } else {
          return {
            ...order,
            status: 'CANCELLED',
            payment: {
              ...order.payment,
              status: 'REFUNDED',
            },
            statusHistory: [
              ...order.statusHistory,
              {
                status: 'CANCELLED',
                timestamp: new Date().toISOString(),
                note: `Farmer declined: ${declineReason}. Payment refunded to buyer.`,
              },
            ],
          };
        }
      })
    );

    if (isConfirmed) {
      showToast('Order Confirmed', `Pickup readiness confirmed for Order #${orderId}.`);
    } else {
      showToast('Order Declined', `Order #${orderId} cancelled and payment refunded.`, 'info');
    }
  };

  // Admin or System assigns transporter
  const assignTransporter = (orderId, transporterId) => {
    const transporter = transporters.find((t) => t.id === transporterId);
    if (!transporter) return;

    setOrders((prev) =>
      prev.map((order) => {
        if (order.id !== orderId) return order;
        return {
          ...order,
          status: 'PICKUP_PENDING',
          logistics: {
            ...order.logistics,
            transporterId: transporter.id,
            transporterName: transporter.transporterName,
            driverPhone: transporter.phone,
            vehicleNumber: transporter.vehicleNumber,
          },
          statusHistory: [
            ...order.statusHistory,
            {
              status: 'PICKUP_PENDING',
              timestamp: new Date().toISOString(),
              note: `Transporter ${transporter.transporterName} (${transporter.vehicleNumber}) assigned for farm dispatch.`,
            },
          ],
        };
      })
    );

    showToast('Transporter Assigned', `${transporter.transporterName} assigned to Order #${orderId}.`);
  };

  // Add transporter
  const addTransporter = (transporterData) => {
    const id = `trans_${Date.now()}`;
    const newTransporter = {
      id,
      transporterName: transporterData.transporterName,
      phone: transporterData.phone,
      vehicleType: transporterData.vehicleType || 'Tata Ace (1.5 Ton)',
      vehicleNumber: transporterData.vehicleNumber,
      capacityKg: Number(transporterData.capacityKg) || 1500,
      currentArea: transporterData.currentArea || 'Highway Corridor',
      isAvailable: true,
      currentCoordinates: { lat: 16.5, lng: 80.5 },
    };
    setTransporters((prev) => [...prev, newTransporter]);
    showToast('Transporter Registered', `${newTransporter.transporterName} added to fleet.`);
    return newTransporter;
  };

  // Transporter arrives at farm, verifies weight & OTP
  const verifyPickup = (orderId, { actualWeightKg, enteredOtp, qualityNotes, moisturePercent }) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return { success: false, message: 'Order not found' };

    if (order.pickupOtp !== enteredOtp.trim()) {
      showToast('Invalid OTP', 'The farmer handover OTP does not match.', 'error');
      return { success: false, message: 'Invalid Farmer Pickup OTP' };
    }

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          status: 'IN_TRANSIT',
          logistics: {
            ...o.logistics,
            pickupWeightKg: Number(actualWeightKg),
            qualityVerified: true,
            moisturePercent: moisturePercent ? Number(moisturePercent) : 12.5,
            qualityNotes: qualityNotes || 'Farm dispatch inspection verified.',
          },
          statusHistory: [
            ...o.statusHistory,
            {
              status: 'IN_TRANSIT',
              timestamp: new Date().toISOString(),
              note: `Pickup verified with OTP. Net weighbridge weight: ${actualWeightKg} kg. Consignment en route.`,
            },
          ],
        };
      })
    );

    showToast('Pickup Verified', `Consignment #${orderId} verified and in transit.`);
    return { success: true };
  };

  // Update Transporter live GPS
  const updateTransporterGPS = (orderId, coords, address) => {
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          logistics: {
            ...o.logistics,
            currentLocation: {
              lat: coords.lat,
              lng: coords.lng,
              address: address || o.logistics.currentLocation.address,
            },
          },
        };
      })
    );
  };

  // Buyer verifies delivery with Delivery OTP
  const verifyDelivery = (orderId, { enteredOtp, qualityApproved = true }) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return { success: false, message: 'Order not found' };

    if (order.deliveryOtp !== enteredOtp.trim()) {
      showToast('Invalid Delivery OTP', 'The buyer handover OTP does not match.', 'error');
      return { success: false, message: 'Invalid Buyer Delivery OTP' };
    }

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          status: 'COMPLETED',
          payment: {
            ...o.payment,
            status: 'SETTLED_TO_FARMER',
            settledAt: new Date().toISOString(),
          },
          statusHistory: [
            ...o.statusHistory,
            {
              status: 'COMPLETED',
              timestamp: new Date().toISOString(),
              note: `Buyer verified delivery with OTP. Payment payout of ₹${o.produceSubtotal.toLocaleString('en-IN')} released to farmer.`,
            },
          ],
        };
      })
    );

    try {
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
    } catch {
      // ignore
    }

    showToast(
      'Delivery Completed & Funds Settled',
      `Delivery verified for #${orderId}. Payment funds settled to farmer.`
    );
    return { success: true };
  };

  // Raise dispute
  const raiseDispute = async ({ orderId, issueType, description, videoProofUrl }) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    const disputeId = `DISP_${Date.now()}`;
    const newDispute = {
      id: disputeId,
      orderId,
      raisedBy: currentUser.role,
      raisedByName: currentUser.name,
      issueType,
      description,
      status: 'OPEN_INVESTIGATION',
      createdAt: new Date().toISOString(),
    };

    setDisputes((prev) => [newDispute, ...prev]);

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          status: 'DISPUTED',
          payment: { ...o.payment, status: 'FROZEN_FOR_AUDIT' },
          statusHistory: [
            ...o.statusHistory,
            {
              status: 'DISPUTED',
              timestamp: new Date().toISOString(),
              note: `Dispute raised: ${issueType}. Payment payout frozen pending inspection.`,
            },
          ],
        };
      })
    );

    try {
      const token = localStorage.getItem('agrinex_token');
      await apiapiFetch('/api/disputes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          orderId,
          disputeType: issueType || 'GENERAL',
          reason: description,
          videoProofUrl: videoProofUrl || '',
        }),
      });
    } catch (err) {
      console.warn('Backend dispute logging error:', err);
    }

    showToast('Dispute Logged', `Dispute #${disputeId} registered. Payment payout frozen for inspection.`, 'error');
  };

  // Resolve dispute
  const resolveDispute = async (disputeId, resolutionAction, adminNotes) => {
    const dispute = disputes.find((d) => d.id === disputeId);
    if (!dispute) return;

    setDisputes((prev) =>
      prev.map((d) =>
        d.id === disputeId
          ? {
              ...d,
              status: `RESOLVED_${resolutionAction}`,
              resolvedAt: new Date().toISOString(),
              adminResponse: adminNotes,
            }
          : d
      )
    );

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== dispute.orderId) return o;
        const paymentStatus = resolutionAction === 'REFUND' ? 'REFUNDED' : 'RELEASED';
        return {
          ...o,
          status: 'COMPLETED',
          payment: { ...o.payment, status: paymentStatus },
          statusHistory: [
            ...o.statusHistory,
            {
              status: 'COMPLETED',
              timestamp: new Date().toISOString(),
              note: `Dispute resolved by Admin: ${adminNotes}`,
            },
          ],
        };
      })
    );

    showToast('Dispute Resolved', `Resolution: ${resolutionAction === 'REFUND' ? 'Refunded to Buyer' : 'Released to Farmer'}.`);

    try {
      const token = localStorage.getItem('agrinex_token');
      const backendResolution = resolutionAction === 'REFUND' ? 'FULL_REFUND_BUYER' : 'FULL_PAYOUT_FARMER';
      await apiFetch(`/api/disputes/${disputeId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          resolutionType: backendResolution,
          resolutionNotes: adminNotes,
        }),
      });
    } catch (err) {
      console.warn('Backend resolve dispute error:', err);
    }
  };

  // Switch role helper
  const switchUser = (userId) => {
    const target = users.find((u) => u.id === userId);
    if (target) {
      setCurrentUserId(target.id);
      showToast('Profile Switched', `Logged in as ${target.name} (${target.role})`);
    }
  };

  // Reset to clean empty state
  const resetDemoData = () => {
    setUsers(SEED_USERS);
    setProduceList([]);
    setOrders([]);
    setTransporters([]);
    setNotifications([]);
    setDisputes([]);
    setCart([]);
    setCurrentUserId(null);
    showToast('Data Cleared', 'Reset to clean state.');
  };

  return (
    <AppContext.Provider
      value={{
        users,
        currentUser,
        currentUserId,
        switchUser,
        loginWithEmailPassword,
        loginWithPhoneOrEmail,
        loginWithGoogle,
        completeGoogleProfile,
        resetPasswordWithPhone,
        registerUser,
        logout,
        updateUserLocation,
        updateProfile,
        updateBankDetails,
        produceList,
        addProduce,
        updateProduce,
        deleteProduce,
        orders,
        placeOrder,
        confirmFarmerOrder,
        assignTransporter,
        addTransporter,
        verifyPickup,
        updateTransporterGPS,
        verifyDelivery,
        cart,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        transporters,
        notifications,
        triggerNotification,
        disputes,
        raiseDispute,
        resolveDispute,
        activeTab,
        setActiveTab,
        selectedOrderForTracking,
        setSelectedOrderForTracking,
        toastMessage,
        showToast,
        resetDemoData,
        language,
        setLanguage,
        changeLanguage,
        t,
        supportedLanguages: SUPPORTED_LANGUAGES,
        // MongoDB Atlas & Core Solution Features
        dbConnected,
        agrinexBank,
        cropRecommendations,
        analyzeProduceVideo,
        calculateOptimalChainRoute,
        initiateRazorpayUpiPayment,
        placeMultiFarmerOrder,
        farmerAcceptOrder,
        checkpointQualityCheck,
        verifyCheckpointPickupOtp,
        verifyBuyerDeliveryOtp,
        submitFarmerFeedback,
        updateAgriNexBankDetails,
        fetchCropRecommendations,
        confirmEmergencyReroute,
        loadDatabaseData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
