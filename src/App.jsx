import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/common/Navbar';
import { AuthPage } from './components/auth/AuthPage';
import { FarmerDashboard } from './components/farmer/FarmerDashboard';
import { BuyerDashboard } from './components/buyer/BuyerDashboard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { CartDrawer } from './components/buyer/CartDrawer';
import { NotificationDrawer } from './components/common/NotificationDrawer';
import { LiveMapModal } from './components/common/LiveMapModal';
import { DisputeModal } from './components/common/DisputeModal';
import { ProfileModal } from './components/common/ProfileModal';
import { SettingsModal } from './components/common/SettingsModal';
import { OfflineIndicator } from './components/common/OfflineIndicator';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { ErrorBoundary } from './components/common/ErrorBoundary';

const AppContent = () => {
  const {
    currentUser,
    selectedOrderForTracking,
    setSelectedOrderForTracking,
    toastMessage,
  } = useApp();

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('profile');
  const [disputeOrder, setDisputeOrder] = useState(null);

  const handleOpenSettings = (tab = 'profile') => {
    setSettingsTab(tab);
    setIsSettingsOpen(true);
  };

  // If user is not authenticated, show Email & Password Auth Page
  if (!currentUser) {
    return <AuthPage />;
  }

  const renderDashboard = () => {
    switch (currentUser.role) {
      case 'FARMER':
      case 'FPO':
        return (
          <FarmerDashboard
            onOpenLiveMap={(order) => setSelectedOrderForTracking(order)}
          />
        );
      case 'BUYER':
        return (
          <BuyerDashboard
            onOpenCart={() => setIsCartOpen(true)}
            onOpenLiveMap={(order) => setSelectedOrderForTracking(order)}
            onOpenDisputeModal={(order) => setDisputeOrder(order)}
          />
        );
      case 'ADMIN':
        return (
          <AdminDashboard
            onOpenLiveMap={(order) => setSelectedOrderForTracking(order)}
          />
        );
      default:
        return (
          <BuyerDashboard
            onOpenCart={() => setIsCartOpen(true)}
            onOpenLiveMap={(order) => setSelectedOrderForTracking(order)}
            onOpenDisputeModal={(order) => setDisputeOrder(order)}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col font-sans">
      {/* Top Navigation */}
      <Navbar
        onOpenCart={() => setIsCartOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenSettings={handleOpenSettings}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {renderDashboard()}
      </main>

      {/* Profile Modal (Read Only) */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />

      {/* Settings Modal (Edit Profile, Edit Bank Details, Language, Logout) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        initialTab={settingsTab}
      />

      {/* Modals and Drawers */}
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

      <NotificationDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />

      {selectedOrderForTracking && (
        <LiveMapModal
          order={selectedOrderForTracking}
          onClose={() => setSelectedOrderForTracking(null)}
        />
      )}

      {disputeOrder && (
        <DisputeModal
          order={disputeOrder}
          onClose={() => setDisputeOrder(null)}
        />
      )}

      <OfflineIndicator />

      {/* Toast Overlay */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-stone-900 text-white shadow-2xl border border-stone-700 animate-in slide-in-from-bottom-2 text-xs">
          {toastMessage.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          ) : toastMessage.type === 'info' ? (
            <Info className="w-4 h-4 text-blue-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <div>
            <span className="font-bold block text-stone-100">{toastMessage.title}</span>
            <span className="text-stone-300 text-[11px]">{toastMessage.message}</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white py-6 mt-12 text-stone-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="font-bold text-stone-800">AgriNex Digital Agricultural Marketplace</span>
            <p className="text-[11px] text-stone-400 mt-0.5">
              Direct Farm ↔ Consumer Trade • Zero Intermediary Exploitation
            </p>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Progressive Web App</span>
            <span>•</span>
            <span>Payment Settlement Engine</span>
            <span>•</span>
            <span>GPS Route Optimization</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}
