import React from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      id="banner-offline-alert"
      className="fixed bottom-4 left-4 right-4 md:right-auto md:max-w-md z-50 flex items-center gap-3 rounded-xl bg-amber-600 px-4 py-3 text-sm font-medium text-white shadow-xl shadow-amber-900/20 animate-in slide-in-from-bottom"
    >
      <div className="w-8 h-8 rounded-lg bg-amber-700/80 flex items-center justify-center shrink-0">
        <WifiOff className="w-4 h-4 text-amber-100" />
      </div>
      <div className="flex-1 text-xs">
        <span className="font-bold block text-white">Offline Mode Active</span>
        <span>You are offline. Some features (real-time tracking, payments) require an internet connection.</span>
      </div>
    </div>
  );
};
