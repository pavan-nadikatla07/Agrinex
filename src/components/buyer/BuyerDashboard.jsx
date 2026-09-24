import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { calculateDistanceKm, isWithinRadius } from '../../services/locationService';
import { GoogleMapsLocationPicker } from '../common/GoogleMapsLocationPicker';
import { formatCurrency, formatNumber, formatDate } from '../../utils/formatters';
import {
  Search,
  ShoppingCart,
  MapPin,
  Calendar,
  ShieldCheck,
  Truck,
  CheckCircle2,
  KeyRound,
  AlertTriangle,
  FileText,
  SlidersHorizontal,
  Package,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Compass,
  Target,
  Navigation,
  Layers,
  X,
  Users,
  Sprout,
} from 'lucide-react';

const FUTURE_PRICE_FORECASTS = [
  {
    id: 'f-1',
    name: 'Red Tomatoes',
    category: 'Vegetables',
    unit: 'kg',
    currentPrice: 28,
    predicted7d: 34,
    predicted15d: 42,
    predicted30d: 38,
    direction: 'UP',
    percentDelta15d: 50,
    confidence: '94%',
    recommendation: 'Procure Now (Save up to 50%)',
    driver: 'Pre-monsoon supply transition across Southern transport corridors is curbing arrivals.',
    actionAdvice: 'Current price is at monthly lowest. Consider booking 2-3 weeks supply.',
  },
  {
    id: 'f-2',
    name: 'Nashik Red Onions',
    category: 'Vegetables',
    unit: 'kg',
    currentPrice: 32,
    predicted7d: 29,
    predicted15d: 25,
    predicted30d: 23,
    direction: 'DOWN',
    percentDelta15d: -22,
    confidence: '91%',
    recommendation: 'Wait 10-14 Days (Save ~22%)',
    driver: 'Bumper late-Kharif harvest arrivals entering Maharashtra and MP mandis.',
    actionAdvice: 'Hold off bulk purchases. Retail prices expected to drop by ₹7-9/kg.',
  },
  {
    id: 'f-3',
    name: 'Basmati Rice (Pusa 1121)',
    category: 'Grains & Pulses',
    unit: 'kg',
    currentPrice: 85,
    predicted7d: 88,
    predicted15d: 92,
    predicted30d: 96,
    direction: 'UP',
    percentDelta15d: 8,
    confidence: '88%',
    recommendation: 'Buy Current Stock',
    driver: 'Strong export orders and milling parity prices holding steady across Northern mills.',
    actionAdvice: 'Stable upward trend. Locking current price protects against export-driven inflation.',
  },
  {
    id: 'f-4',
    name: 'Fresh Jyoti Potatoes',
    category: 'Tubers & Roots',
    unit: 'kg',
    currentPrice: 20,
    predicted7d: 21,
    predicted15d: 20,
    predicted30d: 19,
    direction: 'STABLE',
    percentDelta15d: 0,
    confidence: '96%',
    recommendation: 'Procure as Needed',
    driver: 'Adequate cold storage reserves in UP and West Bengal buffer market prices.',
    actionAdvice: 'Minimal volatility expected over the next 30 days.',
  },
  {
    id: 'f-5',
    name: 'G4 Green Chillies',
    category: 'Spices',
    unit: 'kg',
    currentPrice: 65,
    predicted7d: 74,
    predicted15d: 84,
    predicted30d: 88,
    direction: 'UP',
    percentDelta15d: 29,
    confidence: '92%',
    recommendation: 'Buy Immediately',
    driver: 'High ambient temperature impacting flowering and yield in Andhra & Karnataka belts.',
    actionAdvice: 'Prices projected to climb past ₹80/kg within two weeks.',
  },
  {
    id: 'f-6',
    name: 'Sharbati Wheat',
    category: 'Grains & Pulses',
    unit: 'kg',
    currentPrice: 42,
    predicted7d: 40,
    predicted15d: 38,
    predicted30d: 37,
    direction: 'DOWN',
    percentDelta15d: -10,
    confidence: '95%',
    recommendation: 'Wait for Harvest Peak',
    driver: 'Fresh Rabi harvest arrivals peaking across Madhya Pradesh procurement centers.',
    actionAdvice: 'Waiting 15 days allows buying at season-best wholesale rates.',
  },
  {
    id: 'f-7',
    name: 'Shimla Royal Apples',
    category: 'Fruits',
    unit: 'kg',
    currentPrice: 140,
    predicted7d: 152,
    predicted15d: 168,
    predicted30d: 180,
    direction: 'UP',
    percentDelta15d: 20,
    confidence: '89%',
    recommendation: 'Buy Current Lot',
    driver: 'Controlled Atmosphere (CA) storage stocks declining before new harvest in August.',
    actionAdvice: 'Gradual price escalation expected until fresh crop enters markets.',
  },
  {
    id: 'f-8',
    name: 'Organic Alphonso Mangoes',
    category: 'Fruits',
    unit: 'kg',
    currentPrice: 220,
    predicted7d: 190,
    predicted15d: 160,
    predicted30d: 135,
    direction: 'DOWN',
    percentDelta15d: -27,
    confidence: '93%',
    recommendation: 'Wait 10-15 Days',
    driver: 'Peak arrival phase begins from Ratnagiri and Devgad coastal orchards.',
    actionAdvice: 'Substantial 25-35% price softening anticipated as bulk volume hits.',
  },
];

export const BuyerDashboard = ({
  onOpenCart,
  onOpenLiveMap,
  onOpenDisputeModal,
}) => {
  const {
    currentUser,
    produceList,
    orders,
    cart,
    addToCart,
    activeTab,
    setActiveTab,
    verifyDelivery,
    setSelectedOrderForTracking,
    switchUser,
    users,
  } = useApp();

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [maxPrice, setMaxPrice] = useState(500);

  // AI Sourcing Radius Filter (Default 30 km set by AI as requested)
  const [sourcingRadius, setSourcingRadius] = useState(30); // 30km AI optimal path default
  const [consumerCoords, setConsumerCoords] = useState(
    currentUser?.coordinates || { lat: 17.3850, lng: 78.4867 } // default Hyderabad central market
  );
  const [consumerAddress, setConsumerAddress] = useState(
    currentUser?.location || 'Banjara Hills, Hyderabad, Telangana'
  );

  useEffect(() => {
    if (currentUser?.coordinates) setConsumerCoords(currentUser.coordinates);
    if (currentUser?.location) setConsumerAddress(currentUser.location);
  }, [currentUser?.coordinates, currentUser?.location]);

  const [showRadiusRadarModal, setShowRadiusRadarModal] = useState(false);

  // Future Forecast state for Consumer
  const [forecastTimeframe, setForecastTimeframe] = useState('15d'); // '7d' | '15d' | '30d'
  const [forecastSearch, setForecastSearch] = useState('');
  const [forecastCategory, setForecastCategory] = useState('All');

  // Delivery OTP verification modal
  const [verifyingOrderId, setVerifyingOrderId] = useState(null);
  const [enteredDeliveryOtp, setEnteredDeliveryOtp] = useState('');

  // Buyer orders
  const buyerOrders = orders.filter((o) => o.buyerId === currentUser?.id);
  const activeOrders = buyerOrders.filter((o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED');
  const completedOrders = buyerOrders.filter((o) => o.status === 'COMPLETED');

  // Categories list
  const categories = ['All', 'Vegetables', 'Fruits', 'Grains & Pulses', 'Tubers & Roots', 'Spices'];

  // Combine produce across farmers if product name is the same (consolidate whole produce into single marketplace entry)
  const combinedProduceList = React.useMemo(() => {
    const map = new Map();

    produceList.forEach((prod) => {
      const normKey = (prod.name || '').trim().toLowerCase();
      if (!normKey) return;

      const farmerObj = users.find((u) => u.id === prod.farmerId);
      const prodCoords = prod.coordinates || farmerObj?.coordinates || { lat: 16.3067, lng: 80.4365 };
      const dist = calculateDistanceKm(consumerCoords, prodCoords);

      const enrichedFarmer = {
        farmerId: prod.farmerId,
        farmerName: prod.farmerName || farmerObj?.name || 'Regional Producer',
        farmerPhone: prod.farmerPhone || farmerObj?.phone || '+91 98765 43210',
        location: prod.location || farmerObj?.location || 'Direct Farm',
        coordinates: prodCoords,
        availableQuantity: Number(prod.availableQuantity) || 0,
        unit: prod.unit || 'kg',
        basePrice: Number(prod.basePrice) || 0,
        aiRecommendedPrice: Number(prod.aiRecommendedPrice || prod.basePrice) || 0,
        qualityGrade: prod.qualityGrade || 'Grade A',
        aiQualityScore: prod.aiQualityScore || 92,
        canManageTransport: Boolean(prod.canManageTransport),
        videoSampleUrl: prod.videoSampleUrl || '',
        distanceKm: dist,
      };

      if (!map.has(normKey)) {
        map.set(normKey, {
          ...prod,
          id: prod.id,
          resolvedCoords: prodCoords,
          distanceKm: dist,
          isAiOptimalRoute: dist !== null && dist <= 30,
          totalQuantity: Number(prod.availableQuantity) || 0,
          availableQuantity: Number(prod.availableQuantity) || 0,
          contributingFarmers: [enrichedFarmer],
          images: prod.images && prod.images.length > 0 ? [...prod.images] : [],
        });
      } else {
        const existing = map.get(normKey);
        existing.availableQuantity += (Number(prod.availableQuantity) || 0);
        existing.totalQuantity = existing.availableQuantity;
        existing.contributingFarmers.push(enrichedFarmer);

        // Merge images without duplicates
        if (prod.images && prod.images.length > 0) {
          prod.images.forEach((img) => {
            if (!existing.images.includes(img)) existing.images.push(img);
          });
        }

        // Keep closer distance / optimal path representation
        if (dist !== null && (existing.distanceKm === null || dist < existing.distanceKm)) {
          existing.distanceKm = dist;
          existing.resolvedCoords = prodCoords;
          existing.isAiOptimalRoute = dist <= 30;
        }

        // Use lowest AI recommended price if any slight variation
        if (prod.aiRecommendedPrice && (!existing.aiRecommendedPrice || prod.aiRecommendedPrice < existing.aiRecommendedPrice)) {
          existing.aiRecommendedPrice = prod.aiRecommendedPrice;
          existing.basePrice = prod.basePrice;
        }
      }
    });

    return Array.from(map.values());
  }, [produceList, users, consumerCoords]);

  // Filtered produce from consolidated list with AI optimal path radius filtering
  const filteredProduce = combinedProduceList.filter((prod) => {
    const matchesSearch =
      prod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (prod.variety && prod.variety.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (prod.contributingFarmers?.some((f) => f.farmerName.toLowerCase().includes(searchTerm.toLowerCase()))) ||
      (prod.contributingFarmers?.some((f) => f.location.toLowerCase().includes(searchTerm.toLowerCase()))) ||
      (prod.location && prod.location.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory =
      selectedCategory === 'All' || prod.category === selectedCategory;

    const matchesPrice = (prod.aiRecommendedPrice || prod.basePrice) <= maxPrice;
    const hasStock = prod.availableQuantity > 0;

    // Radius matching (optimal path distance check)
    const matchesRadius = isWithinRadius(consumerCoords, prod.resolvedCoords, sourcingRadius);

    return matchesSearch && matchesCategory && matchesPrice && hasStock && matchesRadius;
  });

  const handleVerifyDeliverySubmit = (e) => {
    e.preventDefault();
    if (!verifyingOrderId || !enteredDeliveryOtp.trim()) return;

    const res = verifyDelivery(verifyingOrderId, { enteredOtp: enteredDeliveryOtp });
    if (res.success) {
      setVerifyingOrderId(null);
      setEnteredDeliveryOtp('');
    }
  };

  const farmerUser = users.find((u) => u.role === 'FARMER' || u.role === 'FPO');

  return (
    <div className="space-y-6">
      {/* Buyer Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-stone-900 via-stone-850 to-emerald-950 text-white shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border-2 border-white/20 flex items-center justify-center text-white text-xl font-bold shadow-sm">
              {currentUser?.name?.charAt(0) || 'C'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold font-heading">{currentUser?.name || 'Consumer Portal'}</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {currentUser?.buyerType || 'Verified Consumer'}
                </span>
              </div>
              <p className="text-xs text-stone-300 flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                Delivery Location: {currentUser?.location || 'Not specified'}
              </p>
              <span className="text-[11px] text-stone-400 block mt-1">
                Direct Farm ↔ Buyer Sourcing • Protected with Direct Payment & Verification
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="btn-buyer-cart-banner"
              onClick={onOpenCart}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition active:scale-95"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Checkout Cart ({cart.length} items)</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl bg-white border border-stone-200/80 shadow-2xs">
          <span className="text-stone-500 text-xs block mb-1">Available Farm Lots</span>
          <span className="text-2xl font-black text-stone-900">{produceList.length}</span>
          <span className="text-[10px] text-emerald-700 font-semibold block mt-1">
            Active produce listings in marketplace
          </span>
        </div>
        <div className="p-4 rounded-xl bg-white border border-stone-200/80 shadow-2xs">
          <span className="text-stone-500 text-xs block mb-1">Active Deliveries</span>
          <span className="text-2xl font-black text-blue-600">{activeOrders.length}</span>
          <span className="text-[10px] text-blue-700 font-medium block mt-1">
            Orders currently in transit
          </span>
        </div>
        <div className="p-4 rounded-xl bg-white border border-stone-200/80 shadow-2xs">
          <span className="text-stone-500 text-xs block mb-1">Completed Orders</span>
          <span className="text-2xl font-black text-emerald-700">{completedOrders.length}</span>
          <span className="text-[10px] text-stone-500 block mt-1">
            Delivered and verified
          </span>
        </div>
        <div className="p-4 rounded-xl bg-white border border-stone-200/80 shadow-2xs">
          <span className="text-stone-500 text-xs block mb-1">Total Orders</span>
          <span className="text-2xl font-black text-stone-800">{buyerOrders.length}</span>
          <span className="text-[10px] text-stone-500 block mt-1">
            Direct farmer transactions
          </span>
        </div>
      </div>

      {/* Buyer Tabs */}
      <div className="flex items-center gap-2 border-b border-stone-200 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('marketplace')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition whitespace-nowrap ${
            activeTab === 'marketplace' || activeTab === 'dashboard'
              ? 'bg-emerald-700 text-white'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          Marketplace Catalogue ({filteredProduce.length})
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'orders'
              ? 'bg-emerald-700 text-white'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <span>My Orders & Live Tracking</span>
          {activeOrders.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-white text-[10px]">
              {activeOrders.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('receipts')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition whitespace-nowrap ${
            activeTab === 'receipts'
              ? 'bg-emerald-700 text-white'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          Payment History
        </button>

        <button
          onClick={() => setActiveTab('futureForecast')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'futureForecast'
              ? 'bg-emerald-700 text-white'
              : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
          <span>Future Forecast</span>
        </button>
      </div>

      {/* TAB 1: MARKETPLACE CATALOGUE */}
      {(activeTab === 'marketplace' || activeTab === 'dashboard') && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search produce, variety, farmer name, or location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-stone-200 bg-stone-50 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-stone-600">
                <span className="text-[11px] font-semibold text-stone-500">Max Price:</span>
                <input
                  type="range"
                  min="10"
                  max="500"
                  step="5"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-24 accent-emerald-600"
                />
                <span className="font-bold text-stone-900 w-12">₹{maxPrice}</span>
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pt-1">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
                <SlidersHorizontal className="w-3 h-3" /> Category:
              </span>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                    selectedCategory === cat
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* AI Sourcing Radius & Optimal Path Filter */}
            <div className="pt-2.5 border-t border-stone-100 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-bold text-stone-800">
                    Sourcing Radius (Optimal Path):
                  </span>
                  <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    {sourcingRadius >= 9999 ? 'All India (Unlimited)' : `${sourcingRadius} km`}
                  </span>
                  {sourcingRadius === 30 && (
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      AI Optimal Default
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRadiusRadarModal(true)}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg border border-emerald-300 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-800 flex items-center gap-1.5 transition shadow-2xs"
                  >
                    <Compass className="w-3.5 h-3.5 text-emerald-600" />
                    <span>View Radius & Farmers Radar</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {[
                  { label: '10 km (Hyperlocal)', val: 10 },
                  { label: '20 km (Nearby Cluster)', val: 20 },
                  { label: '30 km (AI Optimal Path)', val: 30, isDefault: true },
                  { label: '50 km (Regional Farms)', val: 50 },
                  { label: '100 km (Extended Hub)', val: 100 },
                  { label: 'All India', val: 9999 },
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => setSourcingRadius(item.val)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                      sourcingRadius === item.val
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                    }`}
                  >
                    {item.isDefault && sourcingRadius !== item.val && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    )}
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between text-[11px] text-stone-500 bg-stone-50 p-2 rounded-lg border border-stone-200">
                <span className="truncate">
                  📍 <strong>Consumer Delivery Base:</strong> {consumerAddress}
                </span>
                <span className="shrink-0 text-stone-600 font-semibold ml-2">
                  {filteredProduce.length} produce lots within {sourcingRadius >= 9999 ? 'range' : `${sourcingRadius} km`}
                </span>
              </div>
            </div>
          </div>

          {/* Produce Grid or Clean Empty State */}
          {filteredProduce.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <Package className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-stone-800">
                {produceList.length === 0 ? 'Marketplace is Currently Empty' : 'No Matching Produce Found'}
              </h4>
              <p className="text-xs text-stone-500 max-w-md mx-auto">
                {produceList.length === 0
                  ? 'No crops have been listed by farmers yet. You can sign in as a Farmer to list fresh produce, which will appear here instantly for buyers to purchase.'
                  : 'Try adjusting your search terms, category filters, or price slider.'}
              </p>
              {produceList.length === 0 && farmerUser && (
                <button
                  onClick={() => switchUser(farmerUser.id)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm"
                >
                  <span>Switch to Farmer Portal to List Crops</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredProduce.map((prod) => (
                <div
                  key={prod.id}
                  className="rounded-2xl bg-white border border-stone-200 overflow-hidden shadow-2xs hover:shadow-md transition duration-200 flex flex-col justify-between"
                >
                  <div>
                    {prod.images?.[0] ? (
                      <div className="relative h-44 w-full bg-stone-100 overflow-hidden">
                        <img
                          src={prod.images[0]}
                          alt={prod.name}
                          className="w-full h-full object-cover hover:scale-105 transition duration-500"
                        />
                        <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-stone-900/80 backdrop-blur-xs text-white text-[10px] font-bold uppercase tracking-wide">
                            {prod.qualityGrade}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="relative h-44 w-full bg-gradient-to-br from-stone-900 via-stone-850 to-emerald-950 flex items-center justify-center p-4 text-center overflow-hidden">
                        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px]" />
                        <span className="text-2xl sm:text-3xl font-black text-white tracking-wide uppercase drop-shadow-md select-none line-clamp-2 px-2 z-10 font-heading">
                          {prod.name}
                        </span>
                        <div className="absolute top-2.5 left-2.5 z-10">
                          <span className="px-2 py-0.5 rounded-md bg-stone-900/80 backdrop-blur-xs text-white text-[10px] font-bold uppercase tracking-wide">
                            {prod.qualityGrade}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-stone-500">
                        <span className="font-semibold text-emerald-700 uppercase">
                          {prod.category}
                        </span>
                        {prod.contributingFarmers?.length > 1 ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-bold text-[10px] flex items-center gap-1">
                            <Users className="w-3 h-3 text-emerald-700" />
                            {prod.contributingFarmers.length} Farms Combined
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-stone-400">
                            Single Origin
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-stone-900 text-base leading-tight">
                        {prod.name}
                      </h3>
                      {prod.variety && (
                        <span className="text-xs text-stone-500 block">Variety: {prod.variety}</span>
                      )}

                      {/* Contributing Farmers Breakdown */}
                      {prod.contributingFarmers?.length > 1 ? (
                        <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/70 text-xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-emerald-950 uppercase tracking-wide flex items-center gap-1">
                              <Sprout className="w-3 h-3 text-emerald-700" />
                              Combined Regional Stock:
                            </span>
                            <span className="text-[10px] font-bold text-emerald-800">
                              {prod.availableQuantity} {prod.unit} Total
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {prod.contributingFarmers.map((f, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded-lg bg-white text-emerald-900 border border-emerald-200/80 text-[10px] font-semibold shadow-2xs"
                              >
                                {f.farmerName}: <strong>{f.availableQuantity} {f.unit}</strong>
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-1 text-xs text-stone-600">
                          <div className="flex items-center gap-1.5 truncate">
                            <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="truncate">{prod.contributingFarmers?.[0]?.farmerName || prod.farmerName || 'Direct Farm'}</span>
                          </div>
                          {prod.distanceKm !== null && (
                            <span
                              className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                prod.isAiOptimalRoute
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : 'bg-stone-100 text-stone-600 border-stone-200'
                              }`}
                            >
                              {prod.distanceKm} km
                            </span>
                          )}
                        </div>
                      )}

                      {prod.isAiOptimalRoute && (
                        <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                          <Sparkles className="w-3 h-3 text-emerald-600" />
                          <span>Within 30km AI Optimal Path</span>
                        </div>
                      )}

                      {prod.description && (
                        <p className="text-xs text-stone-500 line-clamp-2 mt-1">
                          {prod.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="p-4 border-t border-stone-100 bg-stone-50/60 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-stone-400 block font-medium">AI Market Price</span>
                        <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded">
                          -10% Mandi Discount
                        </span>
                      </div>
                      <span className="text-lg font-black text-stone-900">
                        ₹{prod.aiRecommendedPrice || prod.basePrice}
                        <span className="text-xs font-medium text-stone-500">/{prod.unit}</span>
                      </span>
                      <span className="text-[10px] text-stone-500 block font-semibold">
                        Total Combined Stock: {prod.availableQuantity} {prod.unit}
                      </span>
                    </div>

                    <button
                      onClick={() => addToCart(prod, Math.min(prod.availableQuantity, 10))}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition active:scale-95 flex items-center gap-1.5"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>Add to Cart</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MY ORDERS & LIVE TRACKING */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <h3 className="font-bold text-stone-900 text-sm">
            My Consignment Orders ({buyerOrders.length})
          </h3>

          {buyerOrders.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-2">
              <Package className="w-8 h-8 text-stone-300 mx-auto" />
              <h4 className="text-sm font-bold text-stone-800">No Orders Placed Yet</h4>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Browse available produce in the marketplace and place an order to track live logistics and verify delivery.
              </p>
              <button
                onClick={() => setActiveTab('marketplace')}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm mt-2"
              >
                <span>Browse Marketplace</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {buyerOrders.map((order) => {
                const checkpoints = order.checkpoints || [];
                const farmerCount = checkpoints.length > 0 ? checkpoints.length : 1;
                return (
                  <div
                    key={order.id}
                    onClick={() => onOpenLiveMap(order)}
                    title="Click order to view Google Map, route, and connected farmers' contributions"
                    className="p-5 rounded-2xl bg-white border border-stone-200 shadow-2xs hover:shadow-md hover:border-emerald-400 transition duration-200 space-y-4 cursor-pointer group"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-stone-900 text-sm group-hover:text-emerald-700 transition">
                            Order #{order.id}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              order.status === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : order.status === 'IN_TRANSIT'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {order.status.replace('_', ' ')}
                          </span>
                        </div>
                        <span className="text-xs text-stone-500">
                          Sourced from: <strong className="text-stone-700">{order.farmerName}</strong> • {order.totalWeightKg} kg total
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-xs text-stone-400 block">Total Payment Amount</span>
                        <span className="text-lg font-black text-stone-900">
                          {formatCurrency(order.grandTotal ?? order.totalOrderAmount)}
                        </span>
                      </div>
                    </div>

                    {/* Connected Farmers & Contribution Summary */}
                    <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-950">
                          <Users className="w-4 h-4 text-emerald-700 shrink-0" />
                          <span>Connected Farmers in Route ({farmerCount}):</span>
                        </div>
                        <span className="text-[11px] text-emerald-800 font-semibold bg-emerald-100/80 px-2 py-0.5 rounded-md">
                          Click to open Map & Pickup Route 🗺️
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                        {checkpoints.length > 0 ? (
                          checkpoints.map((cp, idx) => (
                            <div
                              key={idx}
                              className="p-2.5 rounded-lg bg-white border border-emerald-200 text-xs space-y-1 shadow-2xs"
                            >
                              <div className="flex items-center justify-between font-bold text-stone-900">
                                <span className="truncate">{cp.farmerName}</span>
                                <span className="text-emerald-700 text-[11px] font-extrabold shrink-0">
                                  {cp.contributionPercentage || Math.round((cp.quantity / (order.totalWeightKg || 1)) * 100)}%
                                </span>
                              </div>
                              <div className="text-[11px] text-stone-500 flex items-center justify-between">
                                <span className="truncate text-[10px] text-stone-400">{cp.location}</span>
                                <span className="font-bold text-stone-700 shrink-0">
                                  {cp.quantity || cp.contributionWeightKg} {cp.unit || 'kg'}
                                </span>
                              </div>
                              {cp.subtotalAmount != null && (
                                <div className="text-[10px] text-emerald-800 font-medium pt-0.5 border-t border-emerald-100 flex justify-between">
                                  <span>Contribution Value:</span>
                                  <span className="font-bold">{formatCurrency(cp.subtotalAmount)}</span>
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="p-2.5 rounded-lg bg-white border border-emerald-200 text-xs flex items-center justify-between">
                            <div>
                              <span className="font-bold text-stone-900 block">{order.farmerName || 'Direct Farm'}</span>
                              <span className="text-stone-500 text-[11px]">{order.farmerLocation || 'Guntur'}</span>
                            </div>
                            <span className="font-bold text-emerald-800">{order.totalWeightKg} kg (100%)</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Bar: Click to view Route & Connected Farmers Map */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenLiveMap(order);
                        }}
                        className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition active:scale-95"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>View Route & Connected Farmers Map ({farmerCount})</span>
                      </button>

                      {order.status === 'IN_TRANSIT' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setVerifyingOrderId(order.id);
                          }}
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-xs"
                        >
                          Verify Delivery & Pay Escrow
                        </button>
                      )}
                    </div>

                    {/* Delivery OTP verification button for Buyer */}
                    {order.status === 'IN_TRANSIT' && (
                      <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div>
                          <span className="font-bold text-blue-900 block">
                            Consignment is currently in transit to your delivery address.
                          </span>
                          <span className="text-blue-800 text-[11px]">
                            When the transporter delivers your shipment, verify quality and provide the Delivery Handover OTP.
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Delivery OTP display for Buyer */}
                    {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
                      <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <KeyRound className="w-4 h-4 text-emerald-600 shrink-0" />
                          <div>
                            <span className="font-bold text-stone-800">
                              Your Delivery Handover OTP: <span className="font-mono text-emerald-700 font-extrabold text-sm">{order.deliveryOtp}</span>
                            </span>
                            <span className="text-stone-400 text-[10px] block">
                              Give this code to the driver only after inspecting produce quality at your door.
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenDisputeModal(order);
                          }}
                          className="text-stone-400 hover:text-red-600 text-xs font-medium transition"
                        >
                          Report Issue
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PAYMENT HISTORY */}
      {activeTab === 'receipts' && (
        <div className="space-y-4">
          <h3 className="font-bold text-stone-900 text-sm">
            Payment History & Audit Slips
          </h3>

          {buyerOrders.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-2">
              <ShieldCheck className="w-8 h-8 text-stone-300 mx-auto" />
              <h4 className="text-sm font-bold text-stone-800">No Payment History Yet</h4>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                All order transactions are backed with digital settlement slips and payment records.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {buyerOrders.map((o) => (
                <div
                  key={o.id}
                  className="p-4 rounded-xl bg-white border border-stone-200 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold text-stone-900">Receipt #{o.payment?.transactionRef || o.id}</span>
                      <span className="px-1.5 py-0.5 rounded-sm bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        {o.payment?.status === 'HELD_IN_ESCROW' ? 'PAYMENT_CONFIRMED' : (o.payment?.status || 'PAID')}
                      </span>
                    </div>
                    <span className="text-stone-500 text-[11px] block mt-0.5">
                      Order #{o.id} • Farmer: {o.farmerName} • Method: {o.payment?.method}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-stone-400 block">Total Amount</span>
                    <span className="text-base font-extrabold text-stone-900">
                      {formatCurrency(o.grandTotal ?? o.totalOrderAmount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: FUTURE FORECAST (CONSUMER PREDICTED PRICES) */}
      {activeTab === 'futureForecast' && (
        <div className="space-y-5 animate-in fade-in">
          {/* Header Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-900 via-teal-900 to-stone-900 text-white shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-lg font-bold font-heading">Commodity Future Price Forecast</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Mandi Intelligence
                  </span>
                </div>
                <p className="text-xs text-stone-300 mt-1 max-w-xl">
                  AI-powered future price predictions analyzing wholesale arrivals, seasonal weather shifts, transport bottlenecks, and festival demands across national agricultural mandis.
                </p>
              </div>

              {/* Timeframe Toggle */}
              <div className="flex items-center gap-1.5 p-1 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setForecastTimeframe('7d')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    forecastTimeframe === '7d'
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-200 hover:text-white'
                  }`}
                >
                  7 Days Ahead
                </button>
                <button
                  type="button"
                  onClick={() => setForecastTimeframe('15d')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    forecastTimeframe === '15d'
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-200 hover:text-white'
                  }`}
                >
                  15 Days Ahead
                </button>
                <button
                  type="button"
                  onClick={() => setForecastTimeframe('30d')}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    forecastTimeframe === '30d'
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-200 hover:text-white'
                  }`}
                >
                  30 Days Ahead
                </button>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="p-4 rounded-xl bg-white border border-stone-200 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] text-stone-500 block">Best Buy Window</span>
                <span className="text-sm font-bold text-emerald-800">Nashik Red Onions</span>
                <span className="text-[10px] text-emerald-600 block">Projected 22% price drop in 14 days</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <ArrowDownRight className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-stone-200 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] text-stone-500 block">Highest Surge Warning</span>
                <span className="text-sm font-bold text-red-700">Red Tomatoes</span>
                <span className="text-[10px] text-red-600 block">Projected +50% surge due to rains</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-stone-200 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] text-stone-500 block">Price Stability Index</span>
                <span className="text-sm font-bold text-blue-700">Potatoes & Grains</span>
                <span className="text-[10px] text-blue-600 block">Fluctuation below ±3% expected</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Search & Category filter for Forecast */}
          <div className="p-4 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search forecast by crop name (e.g. Tomatoes, Onions, Basmati Rice)..."
                  value={forecastSearch}
                  onChange={(e) => setForecastSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-stone-200 bg-stone-50 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold">
                {['All', 'Vegetables', 'Fruits', 'Grains & Pulses', 'Tubers & Roots', 'Spices'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setForecastCategory(cat)}
                    className={`px-3 py-1 rounded-xl transition ${
                      forecastCategory === cat
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Forecast Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FUTURE_PRICE_FORECASTS.filter((item) => {
              const matchesSearch = item.name.toLowerCase().includes(forecastSearch.toLowerCase());
              const matchesCat = forecastCategory === 'All' || item.category === forecastCategory;
              return matchesSearch && matchesCat;
            }).map((item) => {
              const predictedPrice =
                forecastTimeframe === '7d'
                  ? item.predicted7d
                  : forecastTimeframe === '15d'
                  ? item.predicted15d
                  : item.predicted30d;

              const delta = predictedPrice - item.currentPrice;
              const deltaPercent = Math.round((delta / item.currentPrice) * 100);
              const isSurge = deltaPercent > 0;
              const isDrop = deltaPercent < 0;

              return (
                <div
                  key={item.id}
                  className="p-5 rounded-2xl bg-white border border-stone-200 hover:border-emerald-300 shadow-2xs hover:shadow-md transition flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">
                          {item.category}
                        </span>
                        <h4 className="text-base font-bold text-stone-900">{item.name}</h4>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide block">
                          Forecast ({forecastTimeframe === '7d' ? '7 Days' : forecastTimeframe === '15d' ? '15 Days' : '30 Days'})
                        </span>
                        <div className="flex items-center justify-end gap-1.5 mt-0.5">
                          <span className="text-lg font-black text-stone-900">
                            ₹{predictedPrice} <span className="text-xs font-normal text-stone-500">/{item.unit}</span>
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-0.5 ${
                              isSurge
                                ? 'bg-red-100 text-red-800'
                                : isDrop
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-stone-100 text-stone-700'
                            }`}
                          >
                            {isSurge ? (
                              <>
                                <TrendingUp className="w-3 h-3 text-red-600" />
                                +{deltaPercent}%
                              </>
                            ) : isDrop ? (
                              <>
                                <TrendingDown className="w-3 h-3 text-emerald-600" />
                                {deltaPercent}%
                              </>
                            ) : (
                              '0%'
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Price Projection Timeline */}
                    <div className="p-3 rounded-xl bg-stone-50 border border-stone-100 grid grid-cols-4 gap-2 text-center text-xs">
                      <div>
                        <span className="text-[10px] text-stone-400 block">Current</span>
                        <span className="font-bold text-stone-800">₹{item.currentPrice}</span>
                      </div>
                      <div className={forecastTimeframe === '7d' ? 'p-1 rounded-lg bg-emerald-50 border border-emerald-200' : ''}>
                        <span className="text-[10px] text-stone-400 block">7 Days</span>
                        <span className="font-bold text-stone-800">₹{item.predicted7d}</span>
                      </div>
                      <div className={forecastTimeframe === '15d' ? 'p-1 rounded-lg bg-emerald-50 border border-emerald-200' : ''}>
                        <span className="text-[10px] text-stone-400 block">15 Days</span>
                        <span className="font-bold text-stone-800">₹{item.predicted15d}</span>
                      </div>
                      <div className={forecastTimeframe === '30d' ? 'p-1 rounded-lg bg-emerald-50 border border-emerald-200' : ''}>
                        <span className="text-[10px] text-stone-400 block">30 Days</span>
                        <span className="font-bold text-stone-800">₹{item.predicted30d}</span>
                      </div>
                    </div>

                    {/* Smart Advisory */}
                    <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-emerald-800">Smart Buyer Advice:</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-200/80 text-emerald-900">
                          {item.recommendation}
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-900">{item.actionAdvice}</p>
                    </div>

                    {/* Market Driver Insight */}
                    <p className="text-[11px] text-stone-500 leading-relaxed">
                      <strong className="text-stone-700">Market Driver:</strong> {item.driver}
                    </p>
                  </div>

                  {/* Action Link to Marketplace */}
                  <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-stone-400 font-mono">
                      Prediction Model Confidence: {item.confidence}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm(item.name.split(' ')[0]);
                        setActiveTab('marketplace');
                      }}
                      className="flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-bold hover:underline"
                    >
                      <span>Find in Marketplace</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delivery Confirmation OTP Modal */}
      {verifyingOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 space-y-4">
            <h4 className="font-bold text-stone-900 text-sm">Verify Delivery for #{verifyingOrderId}</h4>
            <p className="text-xs text-stone-500">
              Enter your Delivery OTP to confirm receipt of shipment and complete payment to the farmer.
            </p>
            <form onSubmit={handleVerifyDeliverySubmit} className="space-y-3">
              <input
                type="text"
                required
                maxLength={6}
                placeholder="Enter 6-digit Delivery OTP"
                value={enteredDeliveryOtp}
                onChange={(e) => setEnteredDeliveryOtp(e.target.value)}
                className="w-full px-3 py-2 text-center text-sm font-mono tracking-widest font-bold rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <div className="flex justify-end gap-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setVerifyingOrderId(null)}
                  className="px-3 py-1.5 rounded-lg text-stone-600 hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-bold"
                >
                  Confirm & Complete Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Optimal Path Radius & Farmers Radar Modal */}
      {showRadiusRadarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-stone-200 space-y-4 animate-in fade-in my-8">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                  <Compass className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-stone-900 text-sm">
                    AI Optimal Path Sourcing Radar
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Geographic distribution of farms and goods within optimal delivery paths
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRadiusRadarModal(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Change Delivery Location using Google Maps API */}
            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
              <GoogleMapsLocationPicker
                label="Update Your Base Location (Center of Sourcing Radius)"
                value={consumerAddress}
                coordinates={consumerCoords}
                placeholder="Enter city or detect current GPS position"
                onChange={(addr, coords) => {
                  setConsumerAddress(addr);
                  if (coords) setConsumerCoords(coords);
                }}
                helperText="All farm distances and the 30 km optimal path radius are calculated from this exact GPS coordinate."
              />
            </div>

            {/* Radar Graphic & Radius Selector */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              {/* Visual Simulated Radar Canvas */}
              <div className="relative w-full aspect-square max-w-[280px] mx-auto rounded-full bg-stone-900 border-4 border-stone-800 flex items-center justify-center p-4 overflow-hidden shadow-inner">
                {/* Concentric distance rings */}
                <div className="absolute w-[85%] h-[85%] rounded-full border border-emerald-500/20" />
                <div className="absolute w-[60%] h-[60%] rounded-full border-2 border-dashed border-emerald-400/50">
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-mono text-emerald-400 font-bold bg-stone-900 px-1">
                    30 km (AI Optimal)
                  </span>
                </div>
                <div className="absolute w-[35%] h-[35%] rounded-full border border-emerald-500/30" />

                {/* Radar sweep beam animation */}
                <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/10 to-transparent rounded-full animate-spin [animation-duration:6s]" />

                {/* Center Consumer Marker */}
                <div className="relative z-10 w-6 h-6 rounded-full bg-blue-600 text-white border-2 border-white shadow-lg flex items-center justify-center">
                  <Navigation className="w-3 h-3 text-white" />
                </div>

                {/* Pinned Farmers plotted dynamically */}
                {filteredProduce.slice(0, 6).map((prod, idx) => {
                  const angle = (idx * 60) * (Math.PI / 180);
                  const distRatio = Math.min(1, (prod.distanceKm || 25) / Math.max(sourcingRadius, 30));
                  const r = distRatio * 110;
                  const x = Math.cos(angle) * r;
                  const y = Math.sin(angle) * r;

                  return (
                    <div
                      key={prod.id}
                      style={{
                        transform: `translate(${x}px, ${y}px)`,
                      }}
                      className="absolute z-20 group cursor-pointer"
                      title={`${prod.name} - ${prod.farmerName} (${prod.distanceKm} km)`}
                    >
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center border-2 border-white shadow-md ${
                        prod.isAiOptimalRoute ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                      }`}>
                        <Sprout className="w-2.5 h-2.5 text-white" />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Radius Details & Controls */}
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>AI Optimal Path Radius: 30 km</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    By default, the AI engine limits sourcing to a 30 km radius. This ensures same-day cold transit, avoids perishability degradation, and optimizes logistics freight charges.
                  </p>
                </div>

                <div>
                  <span className="font-bold text-stone-700 block mb-1.5">
                    Adjust Active Radius Ring:
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[10, 20, 30, 50, 100, 9999].map((rad) => (
                      <button
                        key={rad}
                        type="button"
                        onClick={() => setSourcingRadius(rad)}
                        className={`p-2 rounded-lg font-bold text-center border transition ${
                          sourcingRadius === rad
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                            : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                        }`}
                      >
                        {rad >= 9999 ? 'All India' : `${rad} km`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-[11px] text-stone-500 space-y-1 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                    <span>Blue marker: Your Delivery Base Dock</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                    <span>Green pins: Farms within 30 km AI Optimal Route</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Farms Table */}
            <div className="border-t border-stone-100 pt-3 space-y-2">
              <h4 className="text-xs font-bold text-stone-800 flex items-center justify-between">
                <span>Farms & Produce in Active Radius ({filteredProduce.length})</span>
                <span className="text-[11px] text-stone-500 font-normal">
                  Optimal path transit &lt; 2.5 hrs
                </span>
              </h4>

              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {filteredProduce.map((prod) => (
                  <div
                    key={prod.id}
                    className="p-2.5 rounded-xl border border-stone-200 bg-stone-50/60 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-stone-900 truncate flex items-center gap-1.5">
                        <span>{prod.name}</span>
                        {prod.isAiOptimalRoute && (
                          <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold">
                            AI Route
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-stone-500 block truncate">
                        {prod.farmerName} • {prod.location}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-bold text-stone-900 block">
                        ₹{prod.aiRecommendedPrice || prod.basePrice}/{prod.unit}
                      </span>
                      <span className="text-[10px] text-emerald-700 font-bold block">
                        📍 {prod.distanceKm !== null ? `${prod.distanceKm} km away` : 'Direct Farm'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setShowRadiusRadarModal(false)}
                className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition"
              >
                Apply & Browse Marketplace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
