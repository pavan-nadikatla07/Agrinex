import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { getCurrentCoordinates, reverseGeocodeLocation } from '../../services/locationService';
import {
  X,
  User,
  Settings,
  CreditCard,
  LogOut,
  CheckCircle2,
  Building2,
  Phone,
  Mail,
  MapPin,
  Save,
  AlertTriangle,
  Globe,
  Check,
  Navigation,
  Loader2,
  Activity,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

export const SettingsModal = ({ isOpen, onClose, initialTab = 'profile' }) => {
  const {
    currentUser,
    updateProfile,
    updateUserLocation,
    updateBankDetails,
    logout,
    language,
    changeLanguage,
    supportedLanguages,
    t,
    showToast,
  } = useApp();

  const [activeTab, setActiveTab] = useState(initialTab); // 'profile' | 'bank' | 'language' | 'system' | 'logout'
  const [isLocating, setIsLocating] = useState(false);
  const [systemHealth, setSystemHealth] = useState(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);

  const fetchSystemHealth = async () => {
    setIsLoadingHealth(true);
    try {
      const res = await fetch('/api/system/health-status');
      if (res.ok) {
        const data = await res.json();
        setSystemHealth(data);
      }
    } catch (err) {
      console.warn('Failed to load system health status:', err);
    } finally {
      setIsLoadingHealth(false);
    }
  };

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  useEffect(() => {
    if (isOpen && activeTab === 'system') {
      fetchSystemHealth();
    }
  }, [isOpen, activeTab]);

  // Edit Profile fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [organization, setOrganization] = useState('');

  // Edit Bank Details fields
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [upiId, setUpiId] = useState('');
  const [holderName, setHolderName] = useState('');

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '');
      setEmail(currentUser.email || '');
      setPhone(currentUser.phone || '');
      setLocation(currentUser.location || '');
      setOrganization(currentUser.organization || '');

      setBankName(currentUser.bankAccount?.bankName || '');
      setAccountNumber(currentUser.bankAccount?.accountNumber || '');
      setIfsc(currentUser.bankAccount?.ifsc || '');
      setUpiId(currentUser.bankAccount?.upiId || '');
      setHolderName(currentUser.bankAccount?.holderName || currentUser.name || '');
    }
  }, [currentUser, isOpen]);

  if (!isOpen || !currentUser) return null;

  const handleSaveProfile = (e) => {
    e.preventDefault();
    updateProfile({
      name,
      email,
      phone,
      location,
      organization,
    });
    onClose();
  };

  const handleSaveBank = (e) => {
    e.preventDefault();
    updateBankDetails({
      bankName,
      accountNumber,
      ifsc,
      upiId,
      holderName,
    });
    onClose();
  };

  const handleLogoutConfirm = () => {
    onClose();
    logout();
  };

  const activeLangObj = supportedLanguages?.find((l) => l.code === language) || supportedLanguages?.[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-stone-200 animate-in fade-in my-8 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-800 flex items-center justify-center">
              <Settings className="w-5 h-5 text-stone-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-stone-900 text-base">
                  {t('accountSettings', 'Account Settings')}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <Globe className="w-3 h-3 text-emerald-700" />
                  <span>{activeLangObj?.nativeName || 'English'}</span>
                </span>
              </div>
              <span className="text-xs text-stone-500">
                {t('settingsDescription', 'Manage profile info, bank settlement details, language preferences, or logout')}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation (5 Tabs) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 p-1 bg-stone-100 rounded-xl my-4 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`py-2 px-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeTab === 'profile'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <User className="w-3.5 h-3.5 text-emerald-600" />
            <span>{t('editProfile', 'Edit Profile')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bank')}
            className={`py-2 px-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeTab === 'bank'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5 text-blue-600" />
            <span>{t('editBank', 'Edit Bank')}</span>
          </button>

          <button
            type="button"
            id="tab-settings-language"
            onClick={() => setActiveTab('language')}
            className={`py-2 px-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeTab === 'language'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-emerald-600" />
            <span>{t('languageTab', 'Language')}</span>
          </button>

          <button
            type="button"
            id="tab-settings-system"
            onClick={() => setActiveTab('system')}
            className={`py-2 px-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeTab === 'system'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-indigo-600" />
            <span>APIs & Status</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('logout')}
            className={`py-2 px-2 rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeTab === 'logout'
                ? 'bg-white text-red-600 shadow-xs'
                : 'text-stone-600 hover:text-red-600'
            }`}
          >
            <LogOut className="w-3.5 h-3.5 text-red-500" />
            <span>{t('logoutTab', 'Logout')}</span>
          </button>
        </div>

        {/* TAB 1: Edit Profile */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="space-y-3.5 text-xs">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                {t('fullNameLabel', 'Full Name / Organization Name')} *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                {t('phoneLabel', 'Phone Number')}
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                {t('emailLabel', 'Email Address')}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                {t('locationLabel', 'Location / City')}
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Guntur, Andhra Pradesh"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                {t('enterpriseLabel', 'Farm / Enterprise Name')}
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="e.g. Green Valley Agro"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-stone-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 font-semibold"
              >
                {t('cancel', 'Cancel')}
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{t('saveProfileBtn', 'Save Profile Changes')}</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: Edit Bank Details */}
        {activeTab === 'bank' && (
          <form onSubmit={handleSaveBank} className="space-y-3.5 text-xs">
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs">
              <p className="font-semibold">{t('bankNoticeTitle', 'Direct Payment & Settlement Account')}</p>
              <p className="text-[11px] text-blue-700 mt-0.5">
                {t('bankNoticeDesc', 'Bank credentials are used for direct payouts, verified weighbridge disbursements, and payment history.')}
              </p>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                {t('bankAccountHolder', 'Account Holder Name')}
              </label>
              <input
                type="text"
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
                placeholder="Name as printed on passbook / cheque"
                className="w-full px-3 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                {t('bankName', 'Bank Name')}
              </label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. State Bank of India"
                className="w-full px-3 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  {t('bankAccountNumber', 'Bank Account Number')}
                </label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="e.g. 10023456789"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  {t('bankIfsc', 'IFSC Code')}
                </label>
                <input
                  type="text"
                  value={ifsc}
                  onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                  placeholder="e.g. SBIN0001234"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono uppercase"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                {t('bankUpi', 'UPI ID (Virtual Payment Address)')}
              </label>
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="e.g. name@okhdfcbank"
                className="w-full px-3 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
              />
            </div>

            <div className="pt-3 border-t border-stone-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 font-semibold"
              >
                {t('cancel', 'Cancel')}
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{t('saveBankBtn', 'Save Bank Details')}</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: Language Options */}
        {activeTab === 'language' && (
          <div className="space-y-4 text-xs">
            {/* Active Language Highlight Banner */}
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-50 to-emerald-100/50 border border-emerald-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-lg shadow-sm">
                  {activeLangObj?.flag || '🌐'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-stone-900 text-sm">
                      {activeLangObj?.nativeName} ({activeLangObj?.name})
                    </span>
                    {activeLangObj?.isDefault && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200/70 text-emerald-900">
                        {t('defaultBadge', 'Default')}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    {t('currentLanguageBanner', 'You are currently browsing AgriNex in')}{' '}
                    <strong>{activeLangObj?.nativeName}</strong>
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] shadow-2xs">
                {t('activeLanguage', 'Active')}
              </span>
            </div>

            {/* Instruction Description */}
            <div>
              <h4 className="font-bold text-stone-900 text-sm">
                {t('chooseLanguage', 'Display Language Preferences')}
              </h4>
              <p className="text-stone-500 text-[11px] mt-0.5">
                {t(
                  'chooseLanguageDesc',
                  'Select your preferred regional language. Default is English, with full support for Telugu, Hindi, Tamil, Kannada, Malayalam, and Urdu.'
                )}
              </p>
            </div>

            {/* 7 Languages Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {supportedLanguages?.map((lang) => {
                const isSelected = language === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    id={`btn-select-lang-${lang.code}`}
                    onClick={() => changeLanguage(lang.code)}
                    className={`text-left p-3.5 rounded-xl border-2 transition-all flex flex-col justify-between group ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'border-stone-200 bg-white hover:border-emerald-300 hover:bg-stone-50/80'
                    }`}
                  >
                    <div className="flex items-start justify-between w-full mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{lang.flag}</span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-stone-900 text-sm">
                              {lang.nativeName}
                            </span>
                            {lang.isDefault && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-stone-200 text-stone-700">
                                Default
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-stone-500 font-medium">
                            {lang.name} • {lang.region}
                          </span>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center transition ${
                          isSelected
                            ? 'bg-emerald-600 text-white'
                            : 'border-2 border-stone-300 group-hover:border-emerald-500'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>

                    {/* Regional Script Sample / Greeting */}
                    <div
                      className={`p-2 rounded-lg text-[11px] transition ${
                        isSelected
                          ? 'bg-white/90 text-emerald-950 border border-emerald-200'
                          : 'bg-stone-50 text-stone-600 border border-stone-100'
                      }`}
                      dir={lang.dir || 'ltr'}
                    >
                      <span className="font-semibold block">{lang.greeting}</span>
                      <span className="text-[10px] text-stone-400 block mt-0.5 truncate">
                        {lang.sample}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
              <span className="text-[11px] text-stone-400">
                Language updates immediately across all screens and local storage.
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition"
              >
                {t('close', 'Done')}
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: APIs & System Status */}
        {activeTab === 'system' && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <div>
                  <h4 className="font-bold text-stone-900 text-sm">System & Credential Health</h4>
                  <p className="text-[11px] text-stone-500">
                    Safe non-secret status of platform integrations. Zero secrets exposed.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={fetchSystemHealth}
                disabled={isLoadingHealth}
                className="px-3 py-1.5 rounded-lg border border-stone-300 hover:bg-white text-stone-700 font-semibold flex items-center gap-1.5 transition text-[11px]"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHealth ? 'animate-spin text-emerald-600' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {isLoadingHealth && !systemHealth ? (
              <div className="py-8 flex flex-col items-center justify-center text-stone-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                <span className="text-xs">Checking integration services...</span>
              </div>
            ) : systemHealth ? (
              <div className="space-y-2.5">
                {[
                  {
                    key: 'database',
                    name: 'MongoDB Atlas Database',
                    desc: 'Primary state persistence for users, orders, and produce',
                    data: systemHealth.subsystems?.database,
                  },
                  {
                    key: 'googleMaps',
                    name: 'Google Maps & Routes API (v2)',
                    desc: 'Live road routing, GPS geocoding, and ₹15/km corridor optimization',
                    data: systemHealth.subsystems?.googleMaps,
                  },
                  {
                    key: 'googleOAuth',
                    name: 'Google Identity OAuth Sign-In',
                    desc: 'One-tap verified authentication for farmers and buyers',
                    data: systemHealth.subsystems?.googleOAuth,
                  },
                  {
                    key: 'geminiAI',
                    name: 'Gemini Multimodal Quality Vision',
                    desc: 'Harvest visual inspection with strict >70 quality approval threshold',
                    data: systemHealth.subsystems?.geminiAI,
                  },
                  {
                    key: 'razorpayEscrow',
                    name: 'Razorpay Escrow Gateway',
                    desc: 'Buyer checkout, signature verification, and secure fund holding',
                    data: systemHealth.subsystems?.razorpayEscrow,
                  },
                  {
                    key: 'razorpayXPayouts',
                    name: 'RazorpayX Direct Payouts',
                    desc: 'Instant delivery-confirmed automated farmer bank disbursements',
                    data: systemHealth.subsystems?.razorpayXPayouts,
                  },
                  {
                    key: 'smsGateway',
                    name: 'SMS & OTP Dispatcher',
                    desc: 'Transactional dispatch notifications and delivery confirmation OTPs',
                    data: systemHealth.subsystems?.smsGateway,
                  },
                ].map((item) => {
                  const status = item.data?.status || 'UNKNOWN';
                  const isGood = status === 'CONNECTED' || status === 'CONFIGURED';
                  const isOptional = status === 'OPTIONAL';
                  const isAmber = status === 'CONFIGURATION_REQUIRED';

                  return (
                    <div
                      key={item.key}
                      className="p-3 bg-white rounded-xl border border-stone-200 hover:border-stone-300 transition space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-stone-900 text-xs">{item.name}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isGood
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : isAmber
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : isOptional
                              ? 'bg-stone-100 text-stone-600 border-stone-200'
                              : 'bg-stone-50 text-stone-500 border-stone-200'
                          }`}
                        >
                          {status}
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500 leading-tight">{item.desc}</p>
                      {item.data?.notes && (
                        <p className="text-[10px] text-stone-400 italic pt-0.5">{item.data.notes}</p>
                      )}
                    </div>
                  );
                })}

                <div className="p-2.5 bg-emerald-50/60 rounded-lg border border-emerald-200/60 text-[11px] text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    AgriNex operates with safe offline/in-memory fallbacks when optional credentials are being provisioned.
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 text-center text-stone-500 text-xs">
                Could not retrieve live health status. Server may be compiling.
              </div>
            )}
          </div>
        )}

        {/* TAB 5: Logout */}
        {activeTab === 'logout' && (
          <div className="py-4 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <LogOut className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-stone-900 text-base">
                {t('signOutTitle', 'Sign Out of AgriNex?')}
              </h4>
              <p className="text-xs text-stone-500 max-w-xs mx-auto mt-1">
                You are currently signed in as <strong>{currentUser.name}</strong> ({currentUser.role}).{' '}
                {t('signOutDesc', 'Are you sure you want to end your session?')}
              </p>
            </div>
            {/* Current Authoritative User Location Displayed beside Logout */}
            <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-600 max-w-sm mx-auto space-y-2 text-left">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Authoritative User Location</span>
                </span>
                <button
                  type="button"
                  id="btn-settings-update-location"
                  disabled={isLocating}
                  onClick={async () => {
                    setIsLocating(true);
                    try {
                      showToast('Acquiring Location', 'Detecting device GPS coordinates...');
                      const coords = await getCurrentCoordinates();
                      const geo = await reverseGeocodeLocation(coords.lat, coords.lng);
                      if (geo?.formattedAddress) {
                        await updateUserLocation({
                          location: geo.formattedAddress,
                          coordinates: { lat: coords.lat, lng: coords.lng },
                          structuredLocation: geo,
                        });
                      }
                    } catch (err) {
                      showToast('Location Notice', err.message || 'Could not acquire GPS.', 'error');
                    } finally {
                      setIsLocating(false);
                    }
                  }}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 transition"
                >
                  {isLocating ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Locating...</span>
                    </>
                  ) : (
                    <>
                      <Navigation className="w-3 h-3" />
                      <span>Update GPS</span>
                    </>
                  )}
                </button>
              </div>
              <p className="font-semibold text-stone-900 text-xs leading-snug">
                {currentUser.location || 'Location not configured'}
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-stone-200 text-stone-700 text-xs font-semibold hover:bg-stone-50 transition"
              >
                {t('staySignedIn', 'Stay Signed In')}
              </button>
              <button
                type="button"
                onClick={handleLogoutConfirm}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm transition"
              >
                {t('yesSignOut', 'Yes, Sign Out')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
