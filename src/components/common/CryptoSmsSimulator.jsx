import React, { useState } from 'react';
import { Smartphone, ShieldCheck, Copy, Check, Clock, Key, AlertCircle, X } from 'lucide-react';

export const CryptoSmsSimulator = ({
  otpRecord,
  onCopyOtp,
  onAutoVerify,
  onClose,
  title = 'Real-Phone Cryptographic SMS Gateway',
}) => {
  const [copied, setCopied] = useState(false);

  if (!otpRecord) return null;

  const handleCopy = () => {
    if (navigator.clipboard && otpRecord.otp) {
      try {
        navigator.clipboard.writeText(otpRecord.otp).catch(() => {});
      } catch (e) {
        // Headless or unfocused browser fallback
      }
    }
    if (onCopyOtp) {
      onCopyOtp(otpRecord.otp);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFillAndVerify = () => {
    handleCopy();
    if (onAutoVerify && otpRecord.otp) {
      onAutoVerify(otpRecord.otp);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full animate-in slide-in-from-bottom-5 fade-in duration-200">
      <div className="bg-stone-900/95 text-white rounded-2xl shadow-2xl border border-stone-700/80 p-4 backdrop-blur-md">
        {/* Gateway Header */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-stone-100 flex items-center gap-1.5">
                <span>{title}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              </h4>
              <span className="text-[10px] text-stone-400 block font-mono">
                SMS Delivered to: +91 {otpRecord.phoneNumber}
              </span>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-stone-400 hover:text-white hover:bg-stone-800"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* OTP Message Body */}
        <div className="p-3 rounded-xl bg-stone-950/80 border border-stone-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-stone-300">
              Your 6-Digit Cryptographic OTP:
            </span>
            <span className="text-[10px] font-mono text-amber-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Valid for {otpRecord.timer ?? 60}s
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="text-2xl font-mono font-black tracking-widest text-emerald-400 bg-stone-900 px-3 py-1.5 rounded-lg border border-emerald-500/30">
              {otpRecord.otp}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleCopy}
                className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs transition active:scale-95"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>

              {onAutoVerify && (
                <button
                  type="button"
                  id="btn-auto-fill-verify-otp"
                  onClick={handleFillAndVerify}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shadow-xs transition active:scale-95"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verify OTP</span>
                </button>
              )}
            </div>
          </div>

          {/* Cryptographic SHA-256 Hash Token for verification */}
          {otpRecord.cryptoHash && (
            <div className="pt-1.5 border-t border-stone-800/60 flex items-center justify-between text-[10px] text-stone-400 font-mono">
              <span className="flex items-center gap-1 text-stone-400 truncate max-w-[200px]">
                <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>Sig: {otpRecord.cryptoHash}</span>
              </span>
              <span className="text-emerald-400 font-semibold">WebCrypto AA</span>
            </div>
          )}
        </div>

        <p className="mt-2 text-[10px] text-stone-400 text-center">
          Strict authentication mode: login and account creation require phone verification.
        </p>
      </div>
    </div>
  );
};
