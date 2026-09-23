import React from 'react';
import { useApp } from '../../context/AppContext';
import { X, Bell, Check, ShieldCheck, Truck, ShoppingBag, AlertTriangle } from 'lucide-react';

export const NotificationDrawer = ({ isOpen, onClose }) => {
  const { notifications, triggerNotification } = useApp();

  if (!isOpen) return null;

  const getIcon = (type) => {
    switch (type) {
      case 'escrow':
        return <ShieldCheck className="w-4 h-4 text-emerald-600" />;
      case 'logistics':
        return <Truck className="w-4 h-4 text-blue-600" />;
      case 'alert':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      default:
        return <ShoppingBag className="w-4 h-4 text-purple-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-2xs animate-in fade-in">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl border-l border-stone-200 flex flex-col">
          {/* Drawer Header */}
          <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-stone-900 text-sm">Real-time Notifications</h3>
                <p className="text-[11px] text-stone-500">
                  Live updates for Orders, Payments, Logistics & Quality
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-stone-400 hover:text-stone-700 rounded-md"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {notifications.length === 0 ? (
              <div className="text-center py-12 text-stone-400 text-xs">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <span>No notifications yet.</span>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/70 hover:bg-stone-50 transition text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-white shadow-2xs border border-stone-200">
                        {getIcon(n.type)}
                      </div>
                      <span className="font-bold text-stone-900">{n.title}</span>
                    </div>
                    <span className="text-[10px] text-stone-400">{n.timestamp}</span>
                  </div>
                  <p className="text-stone-600 pl-8 leading-relaxed">{n.message}</p>
                  {n.orderId && (
                    <div className="pl-8 pt-1">
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/50">
                        Order #{n.orderId}
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Drawer Footer */}
          <div className="p-3 border-t border-stone-200 bg-stone-50 text-center">
            <span className="text-[11px] text-stone-500">
              AgriNex Real-time Notification Engine • Multi-Role Broadcasting
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
