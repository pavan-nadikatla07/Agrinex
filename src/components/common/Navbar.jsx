import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PWAInstallButton } from './PWAInstallButton';
import { getCurrentCoordinates, reverseGeocodeLocation } from '../../services/locationService';
import {
  Sprout,
  User,
  ShoppingCart,
  Bell,
  Settings,
  Globe,
  MapPin,
  Navigation,
  LogOut,
  Loader2,
  CheckCircle2,
  X,
  AlertCircle,
} from 'lucide-react';

export const Navbar = ({
  onOpenCart,
  onOpenNotifications,
  onOpenProfile,
  onOpenSettings,
}) => {
  const {
    currentUser,
    cart,
    notifications,
    orders,
    language,
    supportedLanguages,
    logout,
    updateUserLocation,
    showToast,
    t,
  } = useApp();

  const [isLocating, setIsLocating] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const currentLangObj = supportedLanguages?.find((l) => l.code === language) || supportedLanguages?.[0];

  if (!currentUser) return null;

  const isConsumer = currentUser.role === 'BUYER';

  // Live Location Detection using Device GPS + Google Maps Reverse Geocoding
  const handleAcquireCurrentLocation = async () => {
    setIsLocating(true);
    try {
      showToast('Detecting Live Location', 'Connecting to device GPS for live coordinates...');
      const coords = await getCurrentCoordinates();
      const geoResult = await reverseGeocodeLocation(coords.lat, coords.lng);
      if (!geoResult || !geoResult.formattedAddress) {
        throw new Error('Could not resolve physical address for current coordinates.');
      }

      await updateUserLocation({
        location: geoResult.formattedAddress,
        coordinates: { lat: coords.lat, lng: coords.lng },
        structuredLocation: geoResult,
      });

      showToast(
        'Authoritative Location Updated',
        `Real location verified: ${geoResult.formattedAddress}. All dispatch, delivery, and radar calculations will now use this position.`
      );
    } catch (err) {
      console.warn('Geolocation acquisition error:', err);
      showToast(
        'Location Detection Notice',
        err.message || 'Location permission required to detect real device position.',
        'error'
      );
    } finally {
      setIsLocating(false);
    }
  };

  const handleConfirmLogout = () => {
    setShowLogoutConfirm(false);
    logout();
  };

  // Format concise location string for navbar pill
  const conciseLocation = currentUser.location
    ? currentUser.location.split(',').slice(0, 2).join(',').trim()
    : 'Current Location';

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center text-white shadow-md shadow-emerald-700/20">
              <Sprout className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-tight text-stone-900 font-heading">
                  Agri<span className="text-emerald-600">Nex</span>
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wide">
                  Direct Trade
                </span>
              </div>
              <p className="text-[11px] text-stone-500 hidden sm:block">
                Digital Agricultural Marketplace
              </p>
            </div>
          </div>

          {/* User Identity Pill in Header */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-700 text-xs">
            <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px] font-bold">
              {currentUser.name?.charAt(0) || 'U'}
            </div>
            <span className="font-bold text-stone-900 truncate max-w-[120px]">{currentUser.name}</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-stone-200 text-stone-700 uppercase">
              {currentUser.role === 'BUYER' ? 'Consumer' : currentUser.role}
            </span>
          </div>

          {/* Right Tools & Badges */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* PWA Install Button */}
            <PWAInstallButton />

            {/* Cart Icon (ONLY for Consumer) */}
            {isConsumer && (
              <button
                id="btn-navbar-cart"
                onClick={onOpenCart}
                className="relative p-2 rounded-xl text-stone-600 hover:bg-stone-100 hover:text-stone-900 border border-transparent hover:border-stone-200 transition"
                title={t('cart', 'Cart')}
              >
                <ShoppingCart className="w-5 h-5" />
                {cartItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                    {cart.length}
                  </span>
                )}
              </button>
            )}

            {/* Notifications Icon */}
            <button
              id="btn-navbar-notifications"
              onClick={onOpenNotifications}
              className="relative p-2 rounded-xl text-stone-600 hover:bg-stone-100 hover:text-stone-900 border border-transparent hover:border-stone-200 transition"
              title={t('notifications', 'Notifications')}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Language Option Trigger */}
            <button
              id="btn-navbar-language"
              onClick={() => onOpenSettings('language')}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-semibold transition shadow-2xs"
              title={`Display Language: ${currentLangObj?.nativeName || 'English'} (${currentLangObj?.name})`}
            >
              <Globe className="w-4 h-4 text-emerald-600" />
              <span className="font-bold">{currentLangObj?.nativeName || 'English'}</span>
            </button>

            {/* Profile Option (Read Only) */}
            <button
              id="btn-navbar-profile"
              onClick={onOpenProfile}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-semibold transition shadow-2xs"
              title="View Profile (Read Only)"
            >
              <User className="w-4 h-4 text-emerald-700" />
              <span className="hidden md:inline">{t('profile', 'Profile')}</span>
            </button>

            {/* Settings Option */}
            <button
              id="btn-navbar-settings"
              onClick={() => onOpenSettings('profile')}
              className="hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-semibold transition shadow-2xs"
              title="Account Settings (Edit Profile, Bank Details, Language)"
            >
              <Settings className="w-4 h-4 text-stone-600" />
              <span className="hidden md:inline">{t('settings', 'Settings')}</span>
            </button>

            {/* DIVIDER BETWEEN TOOLS AND USER SESSION ACTIONS */}
            <div className="h-6 w-px bg-stone-200 mx-0.5 sm:mx-1" />

            {/* =============================================================== */}
            {/* CURRENT LOCATION OPTION (Real Live Location via Google Maps/GPS) */}
            {/* Placed DIRECTLY beside the Logout option for ALL users */}
            {/* =============================================================== */}
            <button
              id="btn-navbar-current-location"
              type="button"
              disabled={isLocating}
              onClick={handleAcquireCurrentLocation}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-bold transition shadow-2xs group ${
                isLocating
                  ? 'border-emerald-400 bg-emerald-100/70 text-emerald-900 cursor-wait'
                  : 'border-emerald-300 bg-emerald-50/90 hover:bg-emerald-100 hover:border-emerald-400 text-emerald-950 active:scale-98'
              }`}
              title={`Real Current Location: ${currentUser.location || 'Click to detect real location via Google Maps / Device GPS'}`}
            >
              {isLocating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700 shrink-0" />
              ) : (
                <Navigation className="w-3.5 h-3.5 text-emerald-700 shrink-0 group-hover:rotate-45 transition-transform" />
              )}
              <div className="flex flex-col text-left leading-none">
                <span className="text-[9px] text-emerald-800 font-medium hidden sm:block">Current Location</span>
                <span className="truncate max-w-[90px] sm:max-w-[130px] md:max-w-[160px] text-[11px]">
                  {isLocating ? 'Acquiring GPS...' : conciseLocation}
                </span>
              </div>
            </button>

            {/* =============================================================== */}
            {/* LOGOUT OPTION (Directly beside Current Location for ALL users) */}
            {/* =============================================================== */}
            <button
              id="btn-navbar-logout"
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition shadow-2xs active:scale-98"
              title="Sign out of your AgriNex account"
            >
              <LogOut className="w-3.5 h-3.5 text-red-600 shrink-0" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* MODAL: Confirmation for Logout */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                  <LogOut className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-stone-900">Confirm Sign Out</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Are you sure you want to end your current session as <strong>{currentUser.name}</strong> ({currentUser.role})?
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-semibold transition"
              >
                Stay Signed In
              </button>
              <button
                type="button"
                id="btn-confirm-navbar-logout"
                onClick={handleConfirmLogout}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs transition"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
