import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  User,
  Mail,
  Phone,
  MapPin,
  Building2,
  CreditCard,
  CheckCircle2,
  ShieldCheck,
  Calendar,
  Lock,
} from 'lucide-react';

export const ProfileModal = ({ isOpen, onClose }) => {
  const { currentUser } = useApp();

  if (!isOpen || !currentUser) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-stone-200 animate-in fade-in">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white flex items-center justify-center text-lg font-bold shadow-md shadow-emerald-700/20">
              {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-stone-900 text-base">{currentUser.name}</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wide">
                  {currentUser.role === 'BUYER' ? 'Consumer' : currentUser.role}
                </span>
              </div>
              <span className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Verified AgriNex Member (Read-Only Profile)
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

        {/* Read Only Details */}
        <div className="mt-4 space-y-4 text-xs">
          {/* Identity Card */}
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3">
            <h4 className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
              Personal & Account Information
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] text-stone-400 block mb-0.5">Full Name</span>
                <span className="font-bold text-stone-900 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-stone-400" />
                  {currentUser.name || 'Not specified'}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-stone-400 block mb-0.5">Email Address</span>
                <span className="font-medium text-stone-800 flex items-center gap-1.5 truncate">
                  <Mail className="w-3.5 h-3.5 text-stone-400" />
                  {currentUser.email || 'Not specified'}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-stone-400 block mb-0.5">Verified Phone</span>
                <span className="font-medium text-stone-800 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-stone-400" />
                  {currentUser.phone || 'Not specified'}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-stone-400 block mb-0.5">Operating Location</span>
                <span className="font-medium text-stone-800 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-stone-400" />
                  {currentUser.location || 'India'}
                </span>
              </div>

              <div className="sm:col-span-2">
                <span className="text-[10px] text-stone-400 block mb-0.5">
                  Farm / Enterprise / Entity
                </span>
                <span className="font-medium text-stone-800 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-stone-400" />
                  {currentUser.organization || 'Direct Producer / Consumer'}
                </span>
              </div>
            </div>
          </div>

          {/* Payment & Bank Settlement Account Card */}
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-bold text-stone-400 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                <span>Direct Bank & Payment History Account</span>
              </h4>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Active Settlement
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] text-stone-400 block mb-0.5">Bank Name</span>
                <span className="font-medium text-stone-800">
                  {currentUser.bankAccount?.bankName || 'XXXX Bank'}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-stone-400 block mb-0.5">Account Number</span>
                <span className="font-mono font-bold text-stone-900">
                  {currentUser.bankAccount?.accountNumber || 'XXXXXXXXXXXX'}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-stone-400 block mb-0.5">IFSC Code</span>
                <span className="font-mono text-stone-800">
                  {currentUser.bankAccount?.ifsc || 'XXXX000XXXX'}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-stone-400 block mb-0.5">UPI ID</span>
                <span className="font-mono text-stone-800">
                  {currentUser.bankAccount?.upiId || 'XXXXXX@XXXX'}
                </span>
              </div>
            </div>
          </div>

          {/* Security & Access Level */}
          <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
              <div>
                <span className="font-bold text-emerald-950 block">KYC & Digital Trade Tier</span>
                <span className="text-[11px] text-emerald-800">
                  Direct Payment & Verified Logistics Enabled
                </span>
              </div>
            </div>
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-200/70 px-2 py-1 rounded-md">
              Tier 1 Full Access
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-5 pt-3 border-t border-stone-100 flex items-center justify-between">
          <span className="text-[11px] text-stone-400">
            Need to edit? Use <strong>Settings</strong> in top navigation.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition shadow-xs"
          >
            Close Profile
          </button>
        </div>
      </div>
    </div>
  );
};
