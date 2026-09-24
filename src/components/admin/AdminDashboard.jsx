import React, { useState, useEffect } from 'react';
import { useApp, apiFetch } from '../../context/AppContext';
import {
  ShieldCheck,
  Package,
  Truck,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  MapPin,
  Clock,
  ExternalLink,
  PlusCircle,
  Users,
  Activity,
  DollarSign,
  RefreshCw,
  Database,
  Key,
  Server,
  FileText,
  Bell,
  Sparkles,
  Search,
  Check,
  X,
  Scale,
  Calendar,
  AlertCircle,
  Eye,
  Sliders,
  Send,
  Zap,
  Video,
} from 'lucide-react';
import { formatCurrency, formatNumber, formatDate, formatTime } from '../../utils/formatters';

export const AdminDashboard = ({ onOpenLiveMap }) => {
  const {
    currentUser,
    orders,
    produceList,
    transporters,
    addTransporter,
    assignTransporter,
    disputes,
    resolveDispute,
    users,
    showToast,
    getAuthHeaders,
  } = useApp();

  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Module States
  const [farmersList, setFarmersList] = useState([]);
  const [buyersList, setBuyersList] = useState([]);
  const [inventoryList, setInventoryList] = useState([]);
  const [inspectionsList, setInspectionsList] = useState([]);
  const [allOrdersList, setAllOrdersList] = useState([]);
  const [routesList, setRoutesList] = useState([]);
  const [paymentRecords, setPaymentRecords] = useState([]);
  const [payoutsList, setPayoutsList] = useState([]);
  const [ratingsList, setRatingsList] = useState([]);
  const [emergencyReplacements, setEmergencyReplacements] = useState([]);
  const [marketDataList, setMarketDataList] = useState([]);
  const [forecastsList, setForecastsList] = useState([]);
  const [recommendationsList, setRecommendationsList] = useState([]);
  const [adminNotifications, setAdminNotifications] = useState([]);
  const [systemSettings, setSystemSettings] = useState({
    transportRatePerKm: 15,
    minQualityThreshold: 70,
    otpSimulatorEnabled: true,
  });
  const [integrationHealth, setIntegrationHealth] = useState(null);
  const [auditLogsList, setAuditLogsList] = useState([]);
  const [escrowBankDetails, setEscrowBankDetails] = useState(null);

  // Modals & form state
  const [resolvingDisputeId, setResolvingDisputeId] = useState(null);
  const [resolutionAction, setResolutionAction] = useState('APPROVE_REPLACEMENT');
  const [adminNotes, setAdminNotes] = useState('');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastRole, setBroadcastRole] = useState('ALL');
  const [showAddTransporterForm, setShowAddTransporterForm] = useState(false);
  const [tName, setTName] = useState('');
  const [tPhone, setTPhone] = useState('');
  const [tVehicleType, setTVehicleType] = useState('Tata Ace (1.5 Ton)');
  const [tVehicleNum, setTVehicleNum] = useState('');
  const [tCapacity, setTCapacity] = useState('1500');
  const [tArea, setTArea] = useState('');
  const [selectedOrderIdForTransporter, setSelectedOrderIdForTransporter] = useState(null);
  const [selectedTransporterId, setSelectedTransporterId] = useState('');

  // AI Quality Inspection Override Modal State
  const [selectedInspectionForOverride, setSelectedInspectionForOverride] = useState(null);
  const [overrideVerdict, setOverrideVerdict] = useState('APPROVED');
  const [overrideScore, setOverrideScore] = useState(85);
  const [overrideReason, setOverrideReason] = useState('');
  const [isSubmittingOverride, setIsSubmittingOverride] = useState(false);
  const [inspectionFilter, setInspectionFilter] = useState('all');

  // Initial Data Fetch
  const fetchModuleData = async () => {
    setLoading(true);
    try {
      const headers = getAuthHeaders ? getAuthHeaders() : { 'Content-Type': 'application/json' };

      // Parallel fetch for active module datasets
      const [
        farmersRes,
        buyersRes,
        inventoryRes,
        inspectionsRes,
        routesRes,
        paymentsRes,
        payoutsRes,
        ratingsRes,
        replacementsRes,
        marketRes,
        forecastsRes,
        recommendationsRes,
        notificationsRes,
        settingsRes,
        healthRes,
        auditRes,
        bankRes,
      ] = await Promise.allSettled([
        apiFetch('/api/admin/farmers', { headers }).then((r) => (r.ok ? r.json() : [])),
        apiFetch('/api/admin/buyers', { headers }).then((r) => (r.ok ? r.json() : [])),
        apiFetch('/api/admin/inventory', { headers }).then((r) => (r.ok ? r.json() : [])),
        apiFetch('/api/admin/inspections', { headers }).then((r) => (r.ok ? r.json() : [])),
        apiFetch('/api/admin/routes', { headers }).then((r) => (r.ok ? r.json() : [])),
        apiFetch('/api/admin/payments', { headers }).then((r) => (r.ok ? r.json() : null)),
        apiFetch('/api/admin/payouts', { headers }).then((r) => (r.ok ? r.json() : [])),
        apiFetch('/api/admin/ratings', { headers }).then((r) => (r.ok ? r.json() : [])),
        apiFetch('/api/admin/emergency-replacements', { headers }).then((r) => (r.ok ? r.json() : [])),
        apiFetch('/api/admin/market-data', { headers }).then((r) => (r.ok ? r.json() : [])),
        apiFetch('/api/admin/forecasts', { headers }).then((r) => (r.ok ? r.json() : [])),
        apiFetch('/api/admin/crop-recommendations', { headers }).then((r) => (r.ok ? r.json() : [])),
        apiFetch('/api/admin/notifications', { headers }).then((r) => (r.ok ? r.json() : [])),
        apiFetch('/api/admin/system-settings', { headers }).then((r) => (r.ok ? r.json() : null)),
        apiFetch('/api/admin/integration-health', { headers }).then((r) => (r.ok ? r.json() : null)),
        apiFetch('/api/admin/audit-logs', { headers }).then((r) => (r.ok ? r.json() : [])),
        apiFetch('/api/admin/agrinex-bank', { headers }).then((r) => (r.ok ? r.json() : null)),
      ]);

      if (farmersRes.status === 'fulfilled' && farmersRes.value) setFarmersList(farmersRes.value);
      if (buyersRes.status === 'fulfilled' && buyersRes.value) setBuyersList(buyersRes.value);
      if (inventoryRes.status === 'fulfilled' && inventoryRes.value) setInventoryList(inventoryRes.value);
      if (inspectionsRes.status === 'fulfilled' && inspectionsRes.value) setInspectionsList(inspectionsRes.value);
      if (routesRes.status === 'fulfilled' && routesRes.value) setRoutesList(routesRes.value);
      if (paymentsRes.status === 'fulfilled' && paymentsRes.value) {
        setPaymentRecords(paymentsRes.value.records || []);
        if (paymentsRes.value.escrowBank) setEscrowBankDetails(paymentsRes.value.escrowBank);
      }
      if (payoutsRes.status === 'fulfilled' && payoutsRes.value) setPayoutsList(payoutsRes.value);
      if (ratingsRes.status === 'fulfilled' && ratingsRes.value) setRatingsList(ratingsRes.value);
      if (replacementsRes.status === 'fulfilled' && replacementsRes.value) setEmergencyReplacements(replacementsRes.value);
      if (marketRes.status === 'fulfilled' && marketRes.value) setMarketDataList(marketRes.value);
      if (forecastsRes.status === 'fulfilled' && forecastsRes.value) setForecastsList(forecastsRes.value);
      if (recommendationsRes.status === 'fulfilled' && recommendationsRes.value) setRecommendationsList(recommendationsRes.value);
      if (notificationsRes.status === 'fulfilled' && notificationsRes.value) setAdminNotifications(notificationsRes.value);
      if (settingsRes.status === 'fulfilled' && settingsRes.value) setSystemSettings(settingsRes.value);
      if (healthRes.status === 'fulfilled' && healthRes.value) setIntegrationHealth(healthRes.value);
      if (auditRes.status === 'fulfilled' && auditRes.value) setAuditLogsList(auditRes.value);
      if (bankRes.status === 'fulfilled' && bankRes.value) setEscrowBankDetails(bankRes.value);
    } catch (e) {
      console.warn('Admin dashboard fetch warning:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModuleData();
  }, []);

  // Action: Toggle Farmer Verification
  const handleToggleFarmerVerification = async (farmerId, currentStatus) => {
    try {
      const res = await fetch(`/api/admin/farmers/${farmerId}/verify`, {
        method: 'PUT',
        headers: getAuthHeaders ? getAuthHeaders() : { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verified: !currentStatus }),
      });
      if (res.ok) {
        showToast('Status Updated', `Farmer verification status updated.`);
        fetchModuleData();
      }
    } catch (err) {
      showToast('Action Failed', 'Could not update verification status.', 'error');
    }
  };

  // Action: Toggle Farmer Suspension
  const handleToggleFarmerSuspension = async (farmerId, isCurrentlySuspended) => {
    const nextStatus = isCurrentlySuspended ? 'ACTIVE' : 'SUSPENDED';
    const reason = window.prompt(
      isCurrentlySuspended
        ? 'Enter reason for reactivating this farmer account:'
        : 'Enter mandatory reason for suspending this farmer account:'
    );
    if (reason === null) return;
    try {
      const res = await fetch(`/api/admin/farmers/${farmerId}/status`, {
        method: 'PUT',
        headers: getAuthHeaders ? getAuthHeaders() : { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, reason: reason.trim() }),
      });
      if (res.ok) {
        showToast('Farmer Status Updated', `Farmer account marked as ${nextStatus}.`);
        fetchModuleData();
      } else {
        const err = await res.json();
        showToast('Action Failed', err.error || 'Server error', 'error');
      }
    } catch (err) {
      showToast('Action Failed', 'Could not update farmer status.', 'error');
    }
  };

  // Action: Admin Override Inspection Submit
  const handleAdminOverrideInspectionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedInspectionForOverride) return;
    if (!overrideReason.trim()) {
      showToast('Reason Required', 'Mandatory justification required for administrative audit compliance.', 'error');
      return;
    }
    setIsSubmittingOverride(true);
    try {
      const targetId = selectedInspectionForOverride.inspectionId || selectedInspectionForOverride.id || selectedInspectionForOverride._id;
      const res = await fetch(`/api/admin/inspections/${targetId}/override`, {
        method: 'POST',
        headers: getAuthHeaders ? getAuthHeaders() : { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verdict: overrideVerdict,
          qualityScore: Number(overrideScore),
          reason: overrideReason.trim(),
        }),
      });
      if (res.ok) {
        showToast('Inspection Overridden', `Inspection decision updated to ${overrideVerdict} (${overrideScore}/100).`);
        setSelectedInspectionForOverride(null);
        setOverrideReason('');
        fetchModuleData();
      } else {
        const err = await res.json();
        showToast('Override Failed', err.error || 'Server error', 'error');
      }
    } catch (err) {
      showToast('Override Error', err.message, 'error');
    } finally {
      setIsSubmittingOverride(false);
    }
  };

  // Action: Admin Directly Approves Inspection
  const handleAdminApproveInspection = async (ins, reason = '') => {
    try {
      const targetId = ins.inspectionId || ins.id || ins._id;
      const res = await fetch(`/api/admin/inspections/${targetId}/approve`, {
        method: 'POST',
        headers: getAuthHeaders ? getAuthHeaders() : { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || 'Visual evidence examined and approved by administrator.' }),
      });
      if (res.ok) {
        showToast('Stock Approved', 'Stock has been approved and is now visible in the marketplace.');
        fetchModuleData();
      } else {
        const err = await res.json();
        showToast('Approval Failed', err.error || 'Server error', 'error');
      }
    } catch (err) {
      showToast('Error', err.message, 'error');
    }
  };

  // Action: Admin Rejects Inspection & Penalizes Farmer Rating
  const handleAdminRejectInspection = async (ins) => {
    const reason = window.prompt(
      'Enter mandatory rejection reason for administrative audit and farmer rating penalty:',
      'Visual evidence confirms harvest does not meet commercial standards.'
    );
    if (!reason || !reason.trim()) {
      showToast('Reason Required', 'Rejection reason is mandatory.', 'error');
      return;
    }
    try {
      const targetId = ins.inspectionId || ins.id || ins._id;
      const res = await fetch(`/api/admin/inspections/${targetId}/reject`, {
        method: 'POST',
        headers: getAuthHeaders ? getAuthHeaders() : { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        showToast('Stock Rejected', data.message || 'Stock rejected and farmer rating penalized.', 'warning');
        fetchModuleData();
      } else {
        const err = await res.json();
        showToast('Rejection Failed', err.error || 'Server error', 'error');
      }
    } catch (err) {
      showToast('Error', err.message, 'error');
    }
  };

  // Action: Admin Retries AI Analysis on Preserved Evidence
  const handleAdminRetryAiInspection = async (ins) => {
    try {
      const targetId = ins.inspectionId || ins.id || ins._id;
      showToast('Retrying AI Analysis', 'Re-running Gemini Vision model on preserved evidence...', 'info');
      const res = await fetch(`/api/admin/inspections/${targetId}/retry-ai`, {
        method: 'POST',
        headers: getAuthHeaders ? getAuthHeaders() : { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        showToast('AI Analysis Complete', 'Inspection record updated with fresh analysis.');
        fetchModuleData();
      } else {
        const err = await res.json();
        showToast('Retry Failed', err.error || 'Server error', 'error');
      }
    } catch (err) {
      showToast('Error', err.message, 'error');
    }
  };

  // Action: Toggle Produce Status
  const handleToggleProduceStatus = async (produceId, currentStatus) => {
    const nextStatus = currentStatus === 'APPROVED' ? 'REJECTED' : 'APPROVED';
    try {
      const res = await fetch(`/api/admin/inventory/${produceId}/status`, {
        method: 'PUT',
        headers: getAuthHeaders ? getAuthHeaders() : { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, reason: 'Admin manual inspection override' }),
      });
      if (res.ok) {
        showToast('Produce Updated', `Produce batch marked as ${nextStatus}.`);
        fetchModuleData();
      }
    } catch (err) {
      showToast('Action Failed', 'Could not update produce status.', 'error');
    }
  };

  // Action: Send Broadcast Notification
  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastTitle || !broadcastMessage) return;
    try {
      const res = await apiFetch('/api/admin/notifications', {
        method: 'POST',
        headers: getAuthHeaders ? getAuthHeaders() : { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: broadcastTitle,
          message: broadcastMessage,
          recipientRole: broadcastRole,
          type: 'INFO',
        }),
      });
      if (res.ok) {
        showToast('Broadcast Sent', `Notification delivered to ${broadcastRole}.`);
        setBroadcastTitle('');
        setBroadcastMessage('');
        fetchModuleData();
      }
    } catch (e) {
      showToast('Failed to send notification', 'Network error', 'error');
    }
  };

  // Action: Save System Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/admin/system-settings', {
        method: 'PUT',
        headers: getAuthHeaders ? getAuthHeaders() : { 'Content-Type': 'application/json' },
        body: JSON.stringify(systemSettings),
      });
      if (res.ok) {
        showToast('Settings Saved', 'System configurations updated.');
        fetchModuleData();
      }
    } catch (e) {
      showToast('Failed to save settings', 'Network error', 'error');
    }
  };

  // Action: Add Transporter
  const handleAddTransporterSubmit = (e) => {
    e.preventDefault();
    if (!tName.trim() || !tVehicleNum.trim()) return;
    addTransporter({
      transporterName: tName.trim(),
      phone: tPhone.trim(),
      vehicleType: tVehicleType,
      vehicleNumber: tVehicleNum.trim(),
      capacityKg: Number(tCapacity),
      currentArea: tArea.trim() || 'Regional Transit Corridor',
    });
    setTName('');
    setTPhone('');
    setTVehicleNum('');
    setTArea('');
    setShowAddTransporterForm(false);
  };

  // Action: Assign Transporter
  const handleAssignSubmit = (e) => {
    e.preventDefault();
    if (!selectedOrderIdForTransporter || !selectedTransporterId) return;
    assignTransporter(selectedOrderIdForTransporter, selectedTransporterId);
    setSelectedOrderIdForTransporter(null);
    setSelectedTransporterId('');
  };

  // Action: Resolve Dispute
  const handleResolveDisputeSubmit = (e) => {
    e.preventDefault();
    if (!resolvingDisputeId) return;
    resolveDispute(resolvingDisputeId, resolutionAction, adminNotes);
    setResolvingDisputeId(null);
    setAdminNotes('');
  };

  // Metrics
  const openDisputes = disputes.filter((d) => d.status.includes('OPEN'));
  const totalVolumeKg = orders.reduce((sum, o) => sum + (o.totalWeightKg || 0), 0);
  const totalPaymentTurnover = orders.reduce((sum, o) => sum + (o.grandTotal || o.totalOrderAmount || 0), 0);
  const liveShipments = orders.filter((o) => o.status === 'IN_TRANSIT' || o.status === 'PICKUP_PENDING');

  // The 20 Required Modules Navigation Tabs
  const MODULES = [
    { id: 'overview', label: '1. Overview', icon: Activity },
    { id: 'farmers', label: '2. Farmers', icon: Users },
    { id: 'buyers', label: '3. Buyers', icon: Users },
    { id: 'inventory', label: '4. Inventory', icon: Package },
    { id: 'inspections', label: '5. Inspections', icon: ShieldCheck },
    { id: 'orders', label: '6. Orders', icon: FileText },
    { id: 'liveDeliveries', label: '7. Live Deliveries', icon: Truck },
    { id: 'routes', label: '8. Routes', icon: MapPin },
    { id: 'payments', label: '9. Payments', icon: DollarSign },
    { id: 'payouts', label: '10. Payouts', icon: TrendingUp },
    { id: 'ratings', label: '11. Ratings', icon: Sparkles },
    { id: 'disputes', label: '12. Disputes', icon: AlertTriangle },
    { id: 'emergencyReplacements', label: '13. Replacements', icon: RefreshCw },
    { id: 'marketData', label: '14. Market Data', icon: Scale },
    { id: 'forecasts', label: '15. Forecasts', icon: TrendingUp },
    { id: 'recommendations', label: '16. Crop Advisory', icon: Zap },
    { id: 'notifications', label: '17. Notifications', icon: Bell },
    { id: 'settings', label: '18. System Settings', icon: Sliders },
    { id: 'health', label: '19. API Health', icon: Server },
    { id: 'auditLogs', label: '20. Audit Logs', icon: FileText },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-950 via-stone-900 to-emerald-950 text-white shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-purple-800/40 border-2 border-purple-500/30 flex items-center justify-center text-white text-xl font-bold shadow-sm">
              <ShieldCheck className="w-8 h-8 text-purple-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold font-heading">Operations Command Center</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/30 text-purple-200 border border-purple-400/30 uppercase">
                  Platform Admin
                </span>
              </div>
              <p className="text-xs text-stone-300 mt-0.5">
                Marketplace Oversight • Strict ₹15/km Transport Audit • Direct Escrow Settlement
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchModuleData}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Overview Metric Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-white border border-stone-200 shadow-2xs">
          <span className="text-stone-500 text-xs block mb-1">Total Consignments</span>
          <span className="text-2xl font-black text-stone-900">{orders.length}</span>
          <span className="text-[10px] text-stone-500 block mt-1">
            {formatNumber(totalVolumeKg)} kg moved
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-stone-200 shadow-2xs">
          <span className="text-stone-500 text-xs block mb-1">Payment Turnover</span>
          <span className="text-2xl font-black text-emerald-700">
            {formatCurrency(totalPaymentTurnover)}
          </span>
          <span className="text-[10px] text-emerald-800 font-semibold block mt-1">
            Escrow held & disbursed
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-stone-200 shadow-2xs">
          <span className="text-stone-500 text-xs block mb-1">Live In-Transit</span>
          <span className="text-2xl font-black text-blue-600">{liveShipments.length}</span>
          <span className="text-[10px] text-blue-700 font-medium block mt-1">
            Active highway routes
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-stone-200 shadow-2xs">
          <span className="text-stone-500 text-xs block mb-1">Open Disputes</span>
          <span className="text-2xl font-black text-amber-600">{openDisputes.length}</span>
          <span className="text-[10px] text-stone-500 block mt-1">
            Quality/Arbitration pending
          </span>
        </div>
      </div>

      {/* 20 Modules Navigation Tabs Bar */}
      <div className="bg-white rounded-2xl border border-stone-200 p-2 shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {MODULES.map((m) => {
            const Icon = m.icon;
            const isSelected = activeTab === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setActiveTab(m.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition whitespace-nowrap ${
                  isSelected
                    ? 'bg-purple-900 text-white shadow-sm'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{m.label}</span>
                {m.id === 'disputes' && openDisputes.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-stone-950 font-black text-[9px]">
                    {openDisputes.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODULE 1: OVERVIEW */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-600" />
                    <span>Real-Time Consignment Flow</span>
                  </h3>
                  <span className="text-xs text-stone-500">{orders.length} Active Orders</span>
                </div>
                <div className="divide-y divide-stone-100">
                  {orders.slice(0, 5).map((o) => (
                    <div key={o.id} className="py-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-stone-900 flex items-center gap-2">
                          <span>#{o.id}</span>
                          <span className="text-stone-500 font-normal">• {o.buyerName}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-stone-700">
                            {o.transportMode === 'BUYER_TRANSPORT' ? "Buyer's Transit" : "Farmer's Transit"}
                          </span>
                        </div>
                        <div className="text-stone-500 text-[11px] mt-0.5">
                          {o.items?.length || 0} Crops • {o.totalWeightKg} kg • ₹{o.grandTotal || o.totalOrderAmount}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          o.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {o.status}
                        </span>
                        <button
                          onClick={() => onOpenLiveMap(o)}
                          className="text-[11px] text-purple-700 font-bold hover:underline block mt-1"
                        >
                          View Corridor
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Escrow Clearing Account Snapshot */}
              <div className="p-5 rounded-2xl bg-stone-900 text-white shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-400" />
                    <span className="font-bold text-sm">AgriNex Escrow Clearing Account</span>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-mono">100% Direct Settlement</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-stone-400 text-[11px] block">Current Escrow Balance</span>
                    <span className="text-lg font-bold text-emerald-400">
                      {formatCurrency(escrowBankDetails?.escrowBalance ?? 284500)}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-400 text-[11px] block">Total Disbursed to Farmers</span>
                    <span className="text-lg font-bold text-stone-200">
                      {formatCurrency(escrowBankDetails?.totalDisbursedToFarmers ?? 1450200)}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-400 text-[11px] block">Escrow UPI VPA</span>
                    <span className="text-xs font-mono font-bold text-purple-300">
                      {escrowBankDetails?.upiId || 'agrinex.escrow@sbi'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick System Status & Health */}
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-3">
                <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                  <Server className="w-4 h-4 text-emerald-600" />
                  <span>Platform System Status</span>
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-stone-50 border border-stone-100">
                    <span className="font-medium text-stone-700">MongoDB Atlas Cluster</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Connected
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-stone-50 border border-stone-100">
                    <span className="font-medium text-stone-700">Google Routes & Geocoding</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                      Operational
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-stone-50 border border-stone-100">
                    <span className="font-medium text-stone-700">Gemini AI Quality Vision</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                      Multi-Frame Active
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-xl bg-stone-50 border border-stone-100">
                    <span className="font-medium text-stone-700">Razorpay Escrow Gateway</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Ready
                    </span>
                  </div>
                </div>
              </div>

              {/* Recent Audit Trail */}
              <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-stone-700" />
                    <span>Recent Audit Events</span>
                  </h3>
                  <button onClick={() => setActiveTab('auditLogs')} className="text-[11px] text-purple-700 font-bold hover:underline">
                    All Logs
                  </button>
                </div>
                <div className="space-y-2 text-xs">
                  {auditLogsList.slice(0, 4).map((l) => (
                    <div key={l.id || l._id} className="p-2 rounded-xl bg-stone-50 border border-stone-100 text-[11px]">
                      <div className="font-bold text-stone-900">{l.action}</div>
                      <div className="text-stone-500">{new Date(l.timestamp).toLocaleTimeString()} • {l.adminName}</div>
                    </div>
                  ))}
                  {auditLogsList.length === 0 && (
                    <p className="text-stone-400 text-xs italic">No security audit events recorded yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODULE 2: FARMERS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'farmers' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-stone-900 text-sm">Registered Farmers & Producers</h3>
              <p className="text-xs text-stone-500">Manage KYC verification, produce catalog, and rating reputation</p>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
              <input
                type="text"
                placeholder="Search farmers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-stone-200 bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(farmersList.length > 0 ? farmersList : users.filter((u) => u.role === 'FARMER'))
              .filter((f) => !searchQuery || f.name?.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((f) => (
                <div key={f.id} className="p-4 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-stone-900 text-sm">{f.name}</h4>
                      <span className="text-[11px] text-stone-500">{f.location || 'Rural AP/TS Hub'}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      f.verified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {f.verified ? 'Verified KYC' : 'Pending Verification'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-stone-50 border border-stone-100 text-[11px]">
                    <div>
                      <span className="text-stone-400 block">Reputation Rating</span>
                      <span className="font-bold text-amber-600 flex items-center gap-1">
                        ★ {f.rating ? f.rating.toFixed(1) : '5.0'} ({f.ratingCount || 10} reviews)
                      </span>
                    </div>
                    <div>
                      <span className="text-stone-400 block">Phone</span>
                      <span className="font-mono text-stone-700">{f.phone || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-stone-400 block">Quality Passes</span>
                      <span className="font-bold text-emerald-700">{f.approvedProduceCount || 1} approved</span>
                    </div>
                    <div>
                      <span className="text-stone-400 block">Logistics Bonus</span>
                      <span className="font-bold text-purple-700">{f.transportBonusCount || 0} transits</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] font-mono text-stone-500 truncate max-w-[150px]">
                      UPI: {f.bankDetails?.upiId || `${f.name.toLowerCase().replace(/\s+/g, '')}@upi`}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleToggleFarmerVerification(f.id, f.verified)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                          f.verified ? 'bg-stone-100 text-stone-700 hover:bg-stone-200' : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        }`}
                      >
                        {f.verified ? 'Unverify' : 'Verify'}
                      </button>
                      <button
                        onClick={() => handleToggleFarmerSuspension(f.id, f.status === 'SUSPENDED')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                          f.status === 'SUSPENDED'
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-red-50 text-red-700 hover:bg-red-100'
                        }`}
                      >
                        {f.status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODULE 3: BUYERS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'buyers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-stone-900 text-sm">Direct Wholesale & Retail Buyers</h3>
            <span className="text-xs text-stone-500">Total registered buyers: {buyersList.length || users.filter((u) => u.role === 'BUYER').length}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(buyersList.length > 0 ? buyersList : users.filter((u) => u.role === 'BUYER')).map((b) => (
              <div key={b.id} className="p-4 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-stone-900 text-sm">{b.name}</h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                    Consumer
                  </span>
                </div>
                <div className="text-stone-500 text-[11px] space-y-0.5">
                  <div>Email: <span className="font-mono text-stone-800">{b.email}</span></div>
                  <div>Phone: <span className="font-mono text-stone-800">{b.phone || '+91 98765 43210'}</span></div>
                  <div>Location: <strong>{b.location || 'Urban Delivery Dock'}</strong></div>
                  <div>Total Spend: <strong className="text-emerald-700">{formatCurrency(b.totalSpend || 0)}</strong></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODULE 4: PRODUCE & INVENTORY */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-stone-900 text-sm">Agricultural Produce Inventory</h3>
              <p className="text-xs text-stone-500">Strict Rule: Quality Score &gt; 70 required to be APPROVED on marketplace</p>
            </div>
          </div>

          <div className="divide-y divide-stone-200 bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs">
            {(inventoryList.length > 0 ? inventoryList : produceList).map((p) => (
              <div key={p.id} className="p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center font-bold text-emerald-800 text-sm">
                    {p.name?.charAt(0) || 'C'}
                  </div>
                  <div>
                    <h4 className="font-bold text-stone-900 text-sm">{p.name}</h4>
                    <div className="text-[11px] text-stone-500">
                      Farmer: <strong>{p.farmerName}</strong> • {p.category} • {p.variety || 'Standard'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div>
                    <span className="text-stone-400 text-[11px] block">Stock Available</span>
                    <span className="font-bold text-stone-800">{p.availableQuantity || p.quantity} {p.unit}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 text-[11px] block">Price</span>
                    <span className="font-bold text-emerald-700">₹{p.aiRecommendedPrice || p.basePrice}/{p.unit}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 text-[11px] block">Quality Score</span>
                    <span className={`font-bold ${
                      (p.aiQualityScore || 75) > 70 ? 'text-emerald-700' : 'text-red-600'
                    }`}>
                      {p.aiQualityScore || 75}/100
                    </span>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                    p.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {p.status || 'APPROVED'}
                  </span>
                  <button
                    onClick={() => handleToggleProduceStatus(p.id, p.status || 'APPROVED')}
                    className="px-3 py-1 rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 font-bold"
                  >
                    Toggle Status
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODULE 5: QUALITY INSPECTIONS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'inspections' && (() => {
        const filteredInspections = inspectionsList.filter((ins) => {
          const score = ins.qualityScore ?? ins.score;
          const isOverridden = Boolean(ins.adminOverride?.overridden);
          const state = ins.pipelineState || ins.status || '';

          if (inspectionFilter === 'pending_review') {
            return (
              state === 'AI_QUALITY_FAILED' ||
              state === 'ADMIN_REVIEW' ||
              (!isOverridden && typeof score === 'number' && score <= 70)
            );
          }
          if (inspectionFilter === 'admin_approved') {
            return state === 'ADMIN_APPROVED' || ins.adminOverride?.newVerdict === 'APPROVED';
          }
          if (inspectionFilter === 'admin_rejected') {
            return state === 'ADMIN_REJECTED' || ins.adminOverride?.newVerdict === 'REJECTED';
          }
          if (inspectionFilter === 'service_issues') {
            return (
              state === 'AI_SERVICE_UNAVAILABLE' ||
              state === 'AI_PROCESSING_FAILED' ||
              (score === null && state !== 'NO_VIDEO')
            );
          }
          return true;
        });

        const pendingCount = inspectionsList.filter(
          (ins) =>
            ins.pipelineState === 'AI_QUALITY_FAILED' ||
            (!ins.adminOverride?.overridden && typeof (ins.qualityScore ?? ins.score) === 'number' && (ins.qualityScore ?? ins.score) <= 70)
        ).length;

        const serviceIssueCount = inspectionsList.filter(
          (ins) => ins.pipelineState === 'AI_SERVICE_UNAVAILABLE' || ins.pipelineState === 'AI_PROCESSING_FAILED'
        ).length;

        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-stone-900 text-sm">Gemini AI Video & Quality Inspections</h3>
                <p className="text-xs text-stone-500">Multimodal harvest evidence inspection with administrative review and farmer rating governance</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-100 text-purple-800">
                {inspectionsList.length} Total Inspections
              </span>
            </div>

            {/* Categorized Filter Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 pb-2">
              <button
                type="button"
                onClick={() => setInspectionFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  inspectionFilter === 'all'
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                All ({inspectionsList.length})
              </button>
              <button
                type="button"
                onClick={() => setInspectionFilter('pending_review')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  inspectionFilter === 'pending_review'
                    ? 'bg-red-600 text-white'
                    : 'bg-red-50 text-red-700 hover:bg-red-100'
                }`}
              >
                <span>AI Failed — Awaiting Admin Review</span>
                {pendingCount > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    inspectionFilter === 'pending_review' ? 'bg-white text-red-700' : 'bg-red-600 text-white'
                  }`}>
                    {pendingCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setInspectionFilter('admin_approved')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  inspectionFilter === 'admin_approved'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                Admin Approved
              </button>
              <button
                type="button"
                onClick={() => setInspectionFilter('admin_rejected')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  inspectionFilter === 'admin_rejected'
                    ? 'bg-stone-700 text-white'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                Admin Rejected
              </button>
              <button
                type="button"
                onClick={() => setInspectionFilter('service_issues')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  inspectionFilter === 'service_issues'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
              >
                <span>AI Service Issues</span>
                {serviceIssueCount > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    inspectionFilter === 'service_issues' ? 'bg-white text-amber-800' : 'bg-amber-600 text-white'
                  }`}>
                    {serviceIssueCount}
                  </span>
                )}
              </button>
            </div>

            <div className="space-y-4">
              {filteredInspections.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-white border border-stone-200 text-xs text-stone-500">
                  No inspection records found in this category.
                </div>
              ) : (
                filteredInspections.map((ins) => {
                  const isOverridden = Boolean(ins.adminOverride?.overridden);
                  const score = ins.qualityScore ?? ins.score;
                  const state = ins.pipelineState || ins.status || 'PROCESSING';
                  const isApproved = state === 'AI_APPROVED' || state === 'ADMIN_APPROVED' || ins.verdict === 'APPROVED';
                  const isRejected = state === 'ADMIN_REJECTED';
                  const isPendingAdmin = state === 'AI_QUALITY_FAILED' || state === 'ADMIN_REVIEW' || (!isOverridden && typeof score === 'number' && score <= 70);
                  const isServiceIssue = state === 'AI_SERVICE_UNAVAILABLE' || state === 'AI_PROCESSING_FAILED' || (score === null && state !== 'NO_VIDEO');

                  const videoSrc = ins.videoUrl || ins.videoReferenceUrl;
                  const keyframes = Array.isArray(ins.extractedFrames) ? ins.extractedFrames : [];

                  const freshnessVal = (ins.freshnessScore ?? ins.parameters?.freshness) != null ? `${ins.freshnessScore ?? ins.parameters?.freshness}%` : 'N/A';
                  const colorVal = (ins.colorUniformityScore ?? ins.parameters?.colorUniformity) != null ? `${ins.colorUniformityScore ?? ins.parameters?.colorUniformity}%` : 'N/A';
                  const blemishVal = (ins.blemishFreeScore ?? ins.parameters?.blemishFreeRating) != null ? `${ins.blemishFreeScore ?? ins.parameters?.blemishFreeRating}%` : 'N/A';
                  const firmnessVal = (ins.firmnessVisualScore ?? ins.parameters?.firmnessIndex) != null ? `${ins.firmnessVisualScore ?? ins.parameters?.firmnessIndex}%` : 'N/A';

                  return (
                    <div
                      key={ins.inspectionId || ins.id || ins._id}
                      className={`p-5 rounded-2xl bg-white border shadow-2xs space-y-3 text-xs transition-all ${
                        isPendingAdmin
                          ? 'border-red-300 ring-1 ring-red-200'
                          : isServiceIssue
                          ? 'border-amber-300 ring-1 ring-amber-200'
                          : 'border-stone-200'
                      }`}
                    >
                      {/* Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-stone-100">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-stone-900 text-base">{ins.produceName || 'Produce Batch'}</h4>
                            <span className="font-mono text-stone-400 text-[11px]">ID: {ins.inspectionId || ins.id}</span>
                            {isOverridden && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-900 border border-purple-300">
                                ADMIN OVERRIDDEN
                              </span>
                            )}
                          </div>
                          <span className="text-stone-500 text-[11px]">
                            Farmer: <strong>{ins.farmerName || 'Registered Farmer'}</strong> (ID: {ins.farmerId || 'farmer'}) • Date: {formatDate(ins.createdAt || ins.inspectedAt)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="text-right mr-1">
                            <span className="text-[10px] text-stone-400 block uppercase font-semibold">AI Quality Score</span>
                            {typeof score === 'number' ? (
                              <span className={`text-base font-black ${score > 70 ? 'text-emerald-700' : 'text-red-600'}`}>
                                {score} / 100
                              </span>
                            ) : (
                              <span className="text-xs font-bold text-amber-700">
                                AI Service Issue
                              </span>
                            )}
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                            state === 'ADMIN_APPROVED'
                              ? 'bg-purple-600 text-white'
                              : state === 'ADMIN_REJECTED'
                              ? 'bg-stone-800 text-white'
                              : isApproved
                              ? 'bg-emerald-600 text-white'
                              : isPendingAdmin
                              ? 'bg-red-600 text-white'
                              : 'bg-amber-600 text-white'
                          }`}>
                            {state.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>

                      {/* Admin Override Banner if present */}
                      {isOverridden && (
                        <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-[11px] space-y-1">
                          <div className="flex items-center justify-between font-bold">
                            <span>Admin Decision by {ins.adminOverride.adminName || ins.adminReviewedBy || 'Administrator'}</span>
                            <span className="font-normal text-purple-700">
                              {formatDate(ins.adminOverride?.overriddenAt || ins.adminReviewedAt)}
                            </span>
                          </div>
                          <p>
                            <strong>Verdict:</strong> {ins.adminOverride.originalVerdict} → <strong>{ins.adminOverride.newVerdict}</strong>
                            {ins.adminOverride.reason && ` • Reason: "${ins.adminOverride.reason}"`}
                          </p>
                          {ins.ratingPenalty != null && ins.ratingPenalty > 0 && (
                            <p className="text-red-700 font-semibold">
                              Farmer rating penalty applied: -{ins.ratingPenalty} (New rating: {ins.farmerRatingAfter})
                            </p>
                          )}
                        </div>
                      )}

                      {/* Actual Video Evidence & Keyframes (Admin examines actual goods) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        {/* Video Player */}
                        <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 space-y-2">
                          <span className="text-[11px] font-bold text-stone-700 block flex items-center gap-1.5">
                            <Video className="w-3.5 h-3.5 text-emerald-600" />
                            Sample Video Evidence (Actual Goods)
                          </span>
                          {videoSrc ? (
                            <div className="space-y-1.5">
                              <video
                                src={videoSrc}
                                controls
                                preload="metadata"
                                className="w-full h-36 rounded-lg bg-black object-contain border border-stone-200"
                              />
                              <a
                                href={videoSrc}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-emerald-700 hover:underline flex items-center gap-1 font-semibold"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Open Video Stream in New Tab
                              </a>
                            </div>
                          ) : (
                            <div className="h-24 rounded-lg bg-stone-200/60 flex items-center justify-center text-stone-500 text-xs italic">
                              No video file attached
                            </div>
                          )}
                        </div>

                        {/* Extracted Keyframes Gallery */}
                        <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 space-y-2">
                          <span className="text-[11px] font-bold text-stone-700 block flex items-center gap-1.5">
                            <Eye className="w-3.5 h-3.5 text-blue-600" />
                            Extracted Keyframes ({keyframes.length})
                          </span>
                          {keyframes.length > 0 ? (
                            <div className="grid grid-cols-3 gap-2">
                              {keyframes.slice(0, 6).map((f, i) => (
                                <img
                                  key={i}
                                  src={f}
                                  alt={`Frame ${i + 1}`}
                                  className="w-full h-20 object-cover rounded-md border border-stone-300 shadow-2xs hover:scale-105 transition cursor-pointer"
                                  onClick={() => window.open(f, '_blank')}
                                  title="Click to view full image"
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="h-24 rounded-lg bg-stone-200/60 flex items-center justify-center text-stone-500 text-xs italic">
                              No keyframe snapshots available
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Visual Quality Parameters (Strict N/A Fallback, Never Empty %) */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                        <div className="p-2 rounded-lg bg-stone-50 border border-stone-100">
                          <span className="text-stone-400 block text-[10px]">Freshness</span>
                          <strong className="text-stone-900 text-xs">{freshnessVal}</strong>
                        </div>
                        <div className="p-2 rounded-lg bg-stone-50 border border-stone-100">
                          <span className="text-stone-400 block text-[10px]">Color Uniformity</span>
                          <strong className="text-stone-900 text-xs">{colorVal}</strong>
                        </div>
                        <div className="p-2 rounded-lg bg-stone-50 border border-stone-100">
                          <span className="text-stone-400 block text-[10px]">Blemish-Free Rating</span>
                          <strong className="text-stone-900 text-xs">{blemishVal}</strong>
                        </div>
                        <div className="p-2 rounded-lg bg-stone-50 border border-stone-100">
                          <span className="text-stone-400 block text-[10px]">Firmness Index</span>
                          <strong className="text-stone-900 text-xs">{firmnessVal}</strong>
                        </div>
                      </div>

                      {/* Visual Observations & Rejection Reasons */}
                      {ins.visualObservations && (
                        <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-100 text-[11px]">
                          <strong className="text-stone-800">Visual Observations:</strong>
                          <p className="text-stone-600 mt-0.5">
                            {Array.isArray(ins.visualObservations) ? ins.visualObservations.join(' • ') : ins.visualObservations}
                          </p>
                        </div>
                      )}

                      {ins.defectsDetected && ins.defectsDetected.length > 0 && (
                        <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-[11px]">
                          <strong className="text-red-950">Reported Quality Defects:</strong>
                          <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                            {ins.defectsDetected.map((d, i) => (
                              <li key={i}>{d}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Action Bar with Direct Approve & Reject Buttons */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100">
                        <div className="text-[11px] text-stone-500">
                          Product Identified: <strong>{ins.productIdentified || ins.productDetected || ins.produceName}</strong>
                          {ins.evidenceQuality && ` • Evidence: ${ins.evidenceQuality}`}
                        </div>

                        <div className="flex items-center gap-2">
                          {isServiceIssue && (
                            <button
                              type="button"
                              onClick={() => handleAdminRetryAiInspection(ins)}
                              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition active:scale-95 flex items-center gap-1"
                            >
                              <span>Retry AI Analysis</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleAdminApproveInspection(ins)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition active:scale-95 flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve Stock</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleAdminRejectInspection(ins)}
                            className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm transition active:scale-95 flex items-center gap-1"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Reject Stock</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedInspectionForOverride(ins);
                              setOverrideVerdict(ins.verdict === 'APPROVED' ? 'REJECTED' : 'APPROVED');
                              setOverrideScore(typeof score === 'number' && score >= 70 ? 60 : 85);
                              setOverrideReason('');
                            }}
                            className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm transition active:scale-95 flex items-center gap-1"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Custom Override</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })()}

      {/* ------------------------------------------------------------- */}
      {/* MODULE 6: ORDERS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-stone-900 text-sm">All Marketplace Consignments</h3>
            <span className="text-xs text-stone-500">{orders.length} total orders recorded</span>
          </div>

          <div className="divide-y divide-stone-200 bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs">
            {orders.map((o) => (
              <div key={o.id} className="p-4 space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-900 text-sm">#{o.id}</span>
                    <span className="text-stone-500">• Buyer: <strong>{o.buyerName}</strong></span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-700">
                      {o.transportMode === 'BUYER_TRANSPORT' ? "Buyer's Transport" : "Farmer's Transport"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-700 text-sm">
                      {formatCurrency(o.grandTotal || o.totalOrderAmount || 0)}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      o.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {o.status}
                    </span>
                  </div>
                </div>

                <div className="text-stone-500 text-[11px]">
                  Checkpoints: {o.checkpoints?.length || 0} Farms • Road Transit: {o.transportDistanceKm || 0} km • Delivery OTP: {o.deliveryOtp || 'Active'}
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => onOpenLiveMap(o)}
                    className="px-3 py-1 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 font-bold"
                  >
                    Track Corridor
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODULE 7: LIVE DELIVERIES */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'liveDeliveries' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-stone-900 text-sm">Active Deliveries on the Road</h3>
            <span className="text-xs text-stone-500">{liveShipments.length} Active Shipments</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {liveShipments.map((o) => (
              <div key={o.id} className="p-4 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-900 text-sm">Order #{o.id}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 animate-pulse">
                    IN TRANSIT
                  </span>
                </div>
                <div className="text-stone-600 text-[11px] space-y-1">
                  <div>Destination: <strong>{o.deliveryAddress || o.buyerLocation}</strong></div>
                  <div>Transporter: <strong>{o.transporterName || 'Assigned Carrier'}</strong></div>
                  <div>Payload Weight: <strong>{o.totalWeightKg} kg</strong></div>
                </div>
                <button
                  onClick={() => onOpenLiveMap(o)}
                  className="w-full py-2 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 transition"
                >
                  Open Live GPS Corridors
                </button>
              </div>
            ))}
            {liveShipments.length === 0 && (
              <div className="col-span-2 p-12 text-center rounded-2xl bg-white border border-stone-200 text-stone-500 text-xs">
                No active delivery vehicles currently in transit.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODULE 8: ROUTES */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'routes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-stone-900 text-sm">Road Routing & Transit Distance Audit</h3>
            <span className="text-xs text-emerald-700 font-bold">Strict Rule: ₹15/km • Zero Arbitrary Multipliers</span>
          </div>

          <div className="divide-y divide-stone-200 bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs">
            {(routesList.length > 0 ? routesList : orders).map((r) => (
              <div key={r.orderId || r.id} className="p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-900">Order #{r.orderId || r.id}</span>
                  <span className="text-emerald-700 font-bold">
                    Distance: {r.totalRoadDistanceKm || r.transportDistanceKm || 0} km @ ₹15/km = ₹
                    {((r.totalRoadDistanceKm || r.transportDistanceKm || 0) * 15).toFixed(0)}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-stone-600">
                  <div>Buyer Share (50%): <strong>₹{((r.totalTransportCost || 0) * 0.5).toFixed(0)}</strong></div>
                  <div>Farmers Share (50%): <strong>₹{((r.totalTransportCost || 0) * 0.5).toFixed(0)}</strong></div>
                  <div>Rate per Km: <strong>₹15/km</strong></div>
                  <div>Status: <strong>{r.status}</strong></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODULE 9: PAYMENTS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-stone-900 text-sm">Escrow Payments & Razorpay Transactions</h3>
            <span className="text-xs text-stone-500">Funds released only after Buyer Delivery OTP verification</span>
          </div>

          <div className="divide-y divide-stone-200 bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs">
            {paymentRecords.map((p, idx) => (
              <div key={idx} className="p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div>
                  <span className="font-bold text-stone-900">Order #{p.orderId}</span>
                  <span className="text-stone-500 ml-2">• {p.buyerName}</span>
                  <div className="text-[11px] text-stone-400 font-mono mt-0.5">
                    Gateway: {p.paymentMethod} {p.razorpayPaymentId ? `• ID: ${p.razorpayPaymentId}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-emerald-700 text-sm">{formatCurrency(p.amount)}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    p.escrowHold ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {p.escrowHold ? 'HELD IN ESCROW' : 'DISBURSED'}
                  </span>
                </div>
              </div>
            ))}
            {paymentRecords.length === 0 && (
              <div className="p-8 text-center text-xs text-stone-500">No payment records found.</div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODULE 10: PAYOUTS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'payouts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-stone-900 text-sm">Direct Farmer UPI Disbursements</h3>
            <span className="text-xs text-stone-500">Net Produce Amount - 50% Allocated Transport Share</span>
          </div>

          <div className="divide-y divide-stone-200 bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs">
            {payoutsList.map((p, idx) => (
              <div key={idx} className="p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div>
                  <span className="font-bold text-stone-900 text-sm">{p.farmerName}</span>
                  <span className="text-stone-500 ml-2 font-mono text-[11px]">UPI: {p.farmerUpiId}</span>
                  <div className="text-[11px] text-stone-400 font-mono mt-0.5">
                    Ref: {p.transferReference} • Order #{p.orderId}
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-bold text-emerald-700 text-sm block">
                    Net: {formatCurrency(p.netDisbursedAmount)}
                  </span>
                  <span className="text-[10px] text-stone-400">
                    Gross ₹{p.grossProduceAmount} - Transport ₹{p.allocatedTransportChargeDeduction}
                  </span>
                </div>
              </div>
            ))}
            {payoutsList.length === 0 && (
              <div className="p-8 text-center text-xs text-stone-500">
                No farmer disbursements yet. Disbursed automatically upon Buyer Delivery OTP verification.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODULE 11: RATINGS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'ratings' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-stone-900 text-sm">Reputation & Logistics Rating Monitor</h3>
            <span className="text-xs text-stone-500">Transporter farmers receive accelerated mathematical rating boost</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {ratingsList.map((r) => (
              <div key={r.id} className="p-4 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-stone-900 text-sm">{r.name}</h4>
                  <span className="font-bold text-amber-600">★ {r.rating?.toFixed(1)}</span>
                </div>
                <div className="text-stone-500 text-[11px] space-y-1">
                  <div>Reviews: <strong>{r.ratingCount}</strong></div>
                  <div>Failed Quality Inspections: <strong className="text-red-600">{r.qualityFailedCount || 0}</strong></div>
                  <div>Transport Delivery Bonus: <strong className="text-purple-600">{r.transportBonusCount || 0} transits</strong></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODULE 12: DISPUTES */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'disputes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-stone-900 text-sm">Dispute Investigation & Payment Arbitration Desk</h3>
            <span className="text-xs text-amber-700 font-bold">{openDisputes.length} Open Cases</span>
          </div>

          <div className="space-y-3">
            {disputes.map((d) => (
              <div key={d.id} className="p-4 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-900 text-sm">Dispute #{d.id} • Order #{d.orderId}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    d.status.includes('OPEN') ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {d.status}
                  </span>
                </div>
                <p className="text-stone-700 text-[11px]">{d.reason || d.description}</p>
                {d.penaltyAmount && (
                  <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-800 font-bold text-[11px]">
                    Penalty Charged: ₹{d.penaltyAmount} for detour (+{d.extraDistanceKm} km)
                  </div>
                )}
                {d.status.includes('OPEN') && (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => {
                        setResolvingDisputeId(d.id);
                        setResolutionAction('APPROVE_REPLACEMENT');
                      }}
                      className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700"
                    >
                      Confirm Reroute & Deduct Penalty
                    </button>
                    <button
                      onClick={() => {
                        setResolvingDisputeId(d.id);
                        setResolutionAction('REFUND_BUYER');
                      }}
                      className="px-3 py-1 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700"
                    >
                      Refund Buyer
                    </button>
                  </div>
                )}
              </div>
            ))}
            {disputes.length === 0 && (
              <div className="p-12 text-center rounded-2xl bg-white border border-stone-200 text-xs text-stone-500">
                No active disputes on file.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODULE 13: EMERGENCY REPLACEMENTS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'emergencyReplacements' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-stone-900 text-sm">Emergency Replacements & Route Detours</h3>
            <span className="text-xs text-stone-500">Triggered on failed transporter checkpoint quality check</span>
          </div>

          <div className="space-y-3">
            {emergencyReplacements.map((r, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-900">Order #{r.orderId} • {r.buyerName}</span>
                  <span className="text-red-700 font-bold text-[11px]">
                    Penalty ₹{r.emergencyReroute?.penaltyChargedToFailedFarmer} charged to failing farmer
                  </span>
                </div>
                <p className="text-stone-600 text-[11px]">{r.emergencyReroute?.notes}</p>
              </div>
            ))}
            {emergencyReplacements.length === 0 && (
              <div className="p-12 text-center rounded-2xl bg-white border border-stone-200 text-xs text-stone-500">
                No emergency replacements triggered. All checkpoint inspections passed.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODULE 14: MARKET DATA */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'marketData' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-stone-900 text-sm">APMC & Agmarknet Benchmark Mandi Prices</h3>
            <span className="text-xs text-stone-500">Real regional agricultural mandi dataset</span>
          </div>

          <div className="divide-y divide-stone-200 bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs">
            {marketDataList.length === 0 ? (
              <div className="p-8 text-center text-stone-500 text-xs">
                Insufficient verified historical data.
              </div>
            ) : (
              marketDataList.map((m, idx) => (
                <div key={idx} className="p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
                  <div>
                    <h4 className="font-bold text-stone-900 text-sm">{m.crop}</h4>
                    <div className="text-stone-500 text-[11px]">{m.market} • {m.source}</div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-emerald-700 text-sm block">₹{m.price} {m.units}</span>
                    <span className="text-stone-400 text-[10px]">Arrivals: {m.arrivals} Quintals</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODULE 15: FORECASTS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'forecasts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-stone-900 text-sm">Price Prediction & Seasonal Demand Surges</h3>
            <span className="text-xs text-stone-500">Predictive intelligence models</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {forecastsList.map((f, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-stone-900 text-sm">{f.cropName}</h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                    Surge: {f.seasonalSurgeFactor}x
                  </span>
                </div>
                <div className="text-stone-500 text-[11px] space-y-1">
                  <div>Predicted Demand: <strong>{formatNumber(f.predictedDemandKg)} kg</strong></div>
                  <div>Historical Avg: <strong>₹{f.historicalAvgPrice}/kg</strong></div>
                  <div>Recommended Corridor: <strong>₹{f.recommendedPriceRange?.min} - ₹{f.recommendedPriceRange?.max}/kg</strong></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODULE 16: CROP RECOMMENDATIONS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'recommendations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-stone-900 text-sm">AI Crop Recommendations (Soil & Weather Advisory)</h3>
            <span className="text-xs text-stone-500">Generated for regional farming clusters</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendationsList.map((r, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-stone-900 text-sm">{r.crop}</h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    {r.confidence}% Confidence
                  </span>
                </div>
                <p className="text-stone-700 text-[11px]">{r.reasoning}</p>
                <div className="p-2 rounded-xl bg-stone-50 text-[10px] text-stone-500">
                  Data: {r.supportingHistoricalData}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODULE 17: NOTIFICATIONS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-4">
            <h3 className="font-bold text-stone-900 text-sm">Send Platform Broadcast Announcement</h3>
            <form onSubmit={handleSendBroadcast} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-stone-600 font-medium mb-1">Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mandi Holiday Notice or Quality Alert"
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-stone-600 font-medium mb-1">Recipient Group</label>
                  <select
                    value={broadcastRole}
                    onChange={(e) => setBroadcastRole(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white"
                  >
                    <option value="ALL">All Platform Users</option>
                    <option value="FARMER">Farmers Only</option>
                    <option value="BUYER">Buyers Only</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-stone-600 font-medium mb-1">Message Content</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Type broadcast message..."
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white"
                />
              </div>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 text-white font-bold text-xs hover:bg-purple-700 shadow-md"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Broadcast</span>
              </button>
            </form>
          </div>

          <div className="divide-y divide-stone-200 bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs">
            {adminNotifications.map((n, idx) => (
              <div key={idx} className="p-4 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-900">{n.title}</span>
                  <span className="text-[10px] text-stone-400">{formatDate(n.timestamp || n.createdAt)}</span>
                </div>
                <p className="text-stone-600 text-[11px]">{n.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODULE 18: SYSTEM SETTINGS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'settings' && (
        <div className="p-6 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-4">
          <div>
            <h3 className="font-bold text-stone-900 text-sm">Marketplace Business Engine Rules</h3>
            <p className="text-xs text-stone-500">Configure core economic parameters and quality thresholds</p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-stone-700 font-bold mb-1">
                  Transport Cost per Km (₹)
                </label>
                <input
                  type="number"
                  value={systemSettings.transportRatePerKm}
                  onChange={(e) => setSystemSettings({ ...systemSettings, transportRatePerKm: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white"
                />
                <span className="text-[10px] text-stone-500 mt-1 block">Standard business rule: Strictly ₹15/km</span>
              </div>

              <div>
                <label className="block text-stone-700 font-bold mb-1">
                  Minimum Quality Score (&gt; 70)
                </label>
                <input
                  type="number"
                  value={systemSettings.minQualityThreshold}
                  onChange={(e) => setSystemSettings({ ...systemSettings, minQualityThreshold: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white"
                />
                <span className="text-[10px] text-stone-500 mt-1 block">Batches &lt;= 70 are rejected from marketplace</span>
              </div>

              <div>
                <label className="block text-stone-700 font-bold mb-1">
                  SMS OTP Simulator Mode
                </label>
                <select
                  value={systemSettings.otpSimulatorEnabled ? 'true' : 'false'}
                  onChange={(e) => setSystemSettings({ ...systemSettings, otpSimulatorEnabled: e.target.value === 'true' })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white"
                >
                  <option value="true">Enabled (Safe Simulator Mode)</option>
                  <option value="false">Live SMS Gateway Only</option>
                </select>
                <span className="text-[10px] text-stone-500 mt-1 block">Allows smooth dev/demo login via simulated OTP</span>
              </div>
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 shadow-md"
            >
              Save Engine Settings
            </button>
          </form>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODULE 19: API & INTEGRATION HEALTH */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'health' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-stone-900 text-sm">External API & Integration Health Monitor</h3>
            <span className="text-xs text-stone-500">Live configuration probe</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {integrationHealth?.services ? (
              Object.entries(integrationHealth.services).map(([key, s]) => (
                <div key={key} className="p-4 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-stone-900 text-sm">{s.name}</h4>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      s.status === 'HEALTHY' || s.status === 'CONFIGURED' || s.status === 'LIVE_PROVIDER'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {s.status}
                    </span>
                  </div>
                  <div className="text-stone-500 text-[11px]">
                    Status: {s.status} • Active Integration
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-stone-500 col-span-2">
                Click refresh to probe integration services.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODULE 20: AUDIT LOGS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'auditLogs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-stone-900 text-sm">Immutable Security & Operations Audit Trail</h3>
            <span className="text-xs text-stone-500">{auditLogsList.length} total logged events</span>
          </div>

          <div className="divide-y divide-stone-200 bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs">
            {auditLogsList.map((log) => (
              <div key={log.id || log._id} className="p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div>
                  <span className="font-bold text-stone-900">{log.action}</span>
                  <span className="text-stone-500 ml-2">• Admin: <strong>{log.adminName}</strong></span>
                  <div className="text-[11px] text-stone-400 font-mono mt-0.5">
                    Target: {log.targetType} {log.targetId ? `• ID: ${log.targetId}` : ''}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-stone-400 font-mono block">
                    {formatDate(log.timestamp)}
                  </span>
                </div>
              </div>
            ))}
            {auditLogsList.length === 0 && (
              <div className="p-8 text-center text-xs text-stone-500">No audit events recorded yet.</div>
            )}
          </div>
        </div>
      )}



      {/* ------------------------------------------------------------- */}
      {/* MODAL: RESOLVE DISPUTE */}
      {/* ------------------------------------------------------------- */}
      {resolvingDisputeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 space-y-4 text-xs">
            <h4 className="font-bold text-stone-900 text-sm">Resolve Dispute #{resolvingDisputeId}</h4>
            <form onSubmit={handleResolveDisputeSubmit} className="space-y-3">
              <div>
                <label className="block text-stone-600 font-medium mb-1">Resolution Action</label>
                <select
                  value={resolutionAction}
                  onChange={(e) => setResolutionAction(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white"
                >
                  <option value="APPROVE_REPLACEMENT">Confirm Reroute & Deduct Detour Penalty (₹15/km)</option>
                  <option value="REFUND_BUYER">Refund Buyer Escrow Deposit</option>
                  <option value="DISMISS">Dismiss Dispute</option>
                </select>
              </div>
              <div>
                <label className="block text-stone-600 font-medium mb-1">Administrative Notes</label>
                <textarea
                  rows={3}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Record formal justification for arbitration audit log..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white"
                />
              </div>
              <div className="flex justify-end gap-2 font-semibold">
                <button
                  type="button"
                  onClick={() => setResolvingDisputeId(null)}
                  className="px-3 py-1.5 rounded-lg text-stone-600 hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 font-bold"
                >
                  Confirm Arbitration Ruling
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: ADMIN OVERRIDE QUALITY INSPECTION */}
      {/* ------------------------------------------------------------- */}
      {selectedInspectionForOverride && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 space-y-4 text-xs shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-600" />
                <h4 className="font-bold text-stone-900 text-sm">
                  Administrative Quality Override
                </h4>
              </div>
              <button
                onClick={() => setSelectedInspectionForOverride(null)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-200 text-purple-950 space-y-1">
              <div className="font-bold text-xs">
                {selectedInspectionForOverride.produceName} (ID: {selectedInspectionForOverride.inspectionId || selectedInspectionForOverride.id})
              </div>
              <div className="text-[11px] text-purple-800">
                Current AI Result: <strong>{selectedInspectionForOverride.verdict || selectedInspectionForOverride.decision}</strong> ({selectedInspectionForOverride.qualityScore || selectedInspectionForOverride.score}/100)
              </div>
            </div>

            <form onSubmit={handleAdminOverrideInspectionSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-700 font-bold mb-1">New Verdict *</label>
                  <select
                    value={overrideVerdict}
                    onChange={(e) => {
                      setOverrideVerdict(e.target.value);
                      if (e.target.value === 'APPROVED' && overrideScore < 70) setOverrideScore(85);
                      if (e.target.value === 'REJECTED' && overrideScore >= 70) setOverrideScore(55);
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white font-bold"
                  >
                    <option value="APPROVED">APPROVED (&gt; 70/100)</option>
                    <option value="REJECTED">REJECTED (&le; 70/100)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-stone-700 font-bold mb-1">
                    New Score (0 - 100) *: <strong>{overrideScore}</strong>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={overrideScore}
                    onChange={(e) => setOverrideScore(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-stone-700 font-bold mb-1">
                  Mandatory Administrative Justification *
                </label>
                <textarea
                  rows={3}
                  required
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Explain reason for overriding automated AI decision (e.g. video clarity, manual lab validation, visual color compensation)..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
                <span className="text-[10px] text-stone-500 block mt-0.5">
                  This explanation is immutably recorded in the platform security audit log.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-100 font-semibold">
                <button
                  type="button"
                  onClick={() => setSelectedInspectionForOverride(null)}
                  className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOverride}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-md transition active:scale-95 disabled:opacity-50"
                >
                  {isSubmittingOverride ? 'Saving Override...' : 'Confirm Administrative Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
