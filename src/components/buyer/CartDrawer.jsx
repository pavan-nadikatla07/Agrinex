import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { calculateLogisticsCost } from '../../services/aiService';
import { GoogleMapsLocationPicker } from '../common/GoogleMapsLocationPicker';
import { AddAddressPicker } from '../common/AddAddressPicker';
import {
  X,
  Trash2,
  ShieldCheck,
  Truck,
  ArrowRight,
  MapPin,
  CreditCard,
  Building2,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

export const CartDrawer = ({ isOpen, onClose }) => {
  const {
    cart,
    removeFromCart,
    updateCartQuantity,
    currentUser,
    placeMultiFarmerOrder,
    agrinexBank,
    initiateRazorpayUpiPayment,
    setActiveTab,
    setSelectedOrderForTracking,
    showToast,
  } = useApp();

  const [deliveryAddress, setDeliveryAddress] = useState(currentUser?.location || '');
  const [deliveryCoords, setDeliveryCoords] = useState(currentUser?.coordinates || null);
  const [structuredLocation, setStructuredLocation] = useState(currentUser?.structuredLocation || null);

  useEffect(() => {
    if (currentUser?.location) setDeliveryAddress(currentUser.location);
    if (currentUser?.coordinates) setDeliveryCoords(currentUser.coordinates);
    if (currentUser?.structuredLocation) setStructuredLocation(currentUser.structuredLocation);
  }, [currentUser?.location, currentUser?.coordinates, currentUser?.structuredLocation]);
  const [paymentMethod, setPaymentMethod] = useState('Direct UPI');
  const [transportMode, setTransportMode] = useState('BUYER_TRANSPORT'); // 'BUYER_TRANSPORT' | 'FARMER_TRANSPORT'
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const totalWeightKg = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const produceSubtotal = cart.reduce(
    (sum, item) => sum + (item.produce.aiRecommendedPrice || item.produce.basePrice || 0) * (item.quantity || 0),
    0
  );

  // Compute logistics cost dynamically based on origin & destination
  const firstProduce = cart[0]?.produce;
  const logistics = calculateLogisticsCost(
    firstProduce?.coordinates,
    deliveryCoords || currentUser?.coordinates,
    totalWeightKg
  );

  // Unique participating farmers in cart
  const uniqueFarmerIds = Array.from(new Set(cart.map((i) => i.produce.farmerId || i.produce.id)));
  const farmersWithTransport = cart.filter((i) => i.produce.canManageTransport);
  const hasFarmerWithTransport = farmersWithTransport.length > 0;

  // 50/50 Transport Cost Split:
  // Buyer bares 50% transport expense, remaining 50% is divided equally among all participating farmers
  const totalTransportCost = cart.length > 0 ? logistics.cost : 0;
  const buyerTransportExpense = Math.round(totalTransportCost * 0.5);
  const farmersTransportExpense = totalTransportCost - buyerTransportExpense;
  const perFarmerTransportShare = Math.round(farmersTransportExpense / Math.max(1, uniqueFarmerIds.length));

  const platformFee = Math.round(produceSubtotal * 0.01);
  const grandTotal = produceSubtotal + buyerTransportExpense + platformFee;

  const handleCheckout = async () => {
    // Validate if any item has 0 quantity
    const zeroItem = cart.find((i) => !i.quantity || i.quantity <= 0);
    if (zeroItem) {
      showToast(
        'Invalid Quantity',
        `Please enter a quantity greater than 0 for "${zeroItem.produce.name}" or remove it using the delete icon.`,
        'error'
      );
      return;
    }

    if (!deliveryAddress.trim()) {
      showToast('Delivery Address Missing', 'Please specify a delivery location.', 'error');
      return;
    }

    setIsProcessing(true);

    try {
      // 1. Algorithmic Routing Engine Call
      let routePlan = null;
      try {
        const routeRes = await fetch('/api/routes/calculate-optimal-chain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            buyerLocation: deliveryAddress,
            buyerCoordinates: deliveryCoords || currentUser?.coordinates || { lat: 17.385, lng: 78.4867 },
            requestedItems: cart.map((i) => ({
              produceId: i.produce.id,
              produceName: i.produce.name,
              quantity: i.quantity,
            })),
            transportMode,
          }),
        });
        if (routeRes.ok) {
          routePlan = await routeRes.json();
        }
      } catch (err) {
        console.warn('Backend route calculation fallback notice:', err);
      }

      // 2. Derive checkpoints and allocations
      let checkpoints = [];
      let roadDistanceKm = 0;
      let calculatedTransportCost = 0;
      let buyerShare = 0;
      let farmersShare = 0;
      let calculatedLegs = [];
      let transportLeaderId = '';
      let transportLeaderName = '';

      if (routePlan && routePlan.steps && routePlan.steps.length > 0) {
        roadDistanceKm = routePlan.totalRoadDistanceKm || routePlan.distanceKm || 0;
        calculatedTransportCost = routePlan.totalTransportCost || Math.round(roadDistanceKm * 15);
        buyerShare = routePlan.buyerTransportShare || Math.round(calculatedTransportCost * 0.5);
        farmersShare = routePlan.farmersTransportShare || (calculatedTransportCost - buyerShare);
        calculatedLegs = routePlan.routeLegs || routePlan.legs || [];
        transportLeaderId = routePlan.transportProviderFarmerId || '';
        transportLeaderName = routePlan.transportProviderFarmerName || '';

        const pickupSteps = routePlan.steps.filter((s) => s.type === 'PICKUP');
        checkpoints = pickupSteps.map((s, idx) => {
          const itemSummary = s.itemsToCollect?.map((it) => `${it.quantity} ${it.unit || 'kg'} ${it.name}`).join(', ') || 'Produce Batch';
          const firstItem = s.itemsToCollect?.[0];
          return {
            checkpointId: `CP_${Date.now()}_${idx}`,
            checkpointIndex: idx,
            farmerId: s.farmerId,
            farmerName: s.farmerName,
            farmerPhone: s.farmerPhone || '+91 98765 43210',
            location: s.location,
            coordinates: s.coordinates,
            produceId: firstItem?.produceId || '',
            produceSummary: itemSummary,
            quantity: s.itemsToCollect?.reduce((sum, it) => sum + (it.quantity || 0), 0) || 1,
            unit: firstItem?.unit || 'kg',
            itemsCount: s.itemsToCollect?.length || 1,
            status: 'PENDING',
            sampleScanScore: 0,
            qualityPassed: false,
          };
        });
      } else {
        // Fallback: build checkpoints from cart items
        roadDistanceKm = Math.round(totalTransportCost / 15) || 10;
        calculatedTransportCost = totalTransportCost;
        buyerShare = buyerTransportExpense;
        farmersShare = farmersTransportExpense;

        cart.forEach((item, idx) => {
          checkpoints.push({
            checkpointId: `CP_${Date.now()}_${idx}`,
            checkpointIndex: idx,
            farmerId: item.produce.farmerId || `farmer_${idx}`,
            farmerName: item.produce.farmerName || 'Independent Producer',
            farmerPhone: item.produce.farmerPhone || '+91 98765 43210',
            produceId: item.produce.id,
            produceSummary: `${item.quantity} ${item.produce.unit || 'kg'} ${item.produce.name}`,
            quantity: item.quantity,
            unit: item.produce.unit || 'kg',
            itemsCount: 1,
            location: item.produce.location || 'Local Farm Hub',
            coordinates: item.produce.coordinates || { lat: 16.3067, lng: 80.4365 },
            status: 'PENDING',
            sampleScanScore: 0,
            qualityPassed: false,
          });
        });
      }

      const orderId = `ORD_${Date.now()}`;
      const uniqueFarmers = Array.from(new Set(checkpoints.map((c) => c.farmerId)));
      const farmerAcceptances = uniqueFarmers.map((fId) => {
        const cp = checkpoints.find((c) => c.farmerId === fId);
        return {
          farmerId: fId,
          farmerName: cp?.farmerName || 'Farmer',
          accepted: false,
        };
      });

      const orderPayload = {
        id: orderId,
        buyerId: currentUser?.id || 'buyer_001',
        buyerName: currentUser?.name || 'Consumer Direct',
        buyerPhone: currentUser?.phone || '+91 99999 88888',
        buyerLocation: deliveryAddress,
        buyerCoordinates: deliveryCoords || currentUser?.coordinates || { lat: 17.385, lng: 78.4867 },
        structuredBuyerLocation: structuredLocation || currentUser?.structuredLocation || {
          formattedAddress: deliveryAddress,
          address: deliveryAddress,
          placeId: currentUser?.structuredLocation?.placeId || 'ChIJbU60qSX9ZToR5ujq48gy128',
          latitude: (deliveryCoords || currentUser?.coordinates || { lat: 17.385 }).lat,
          longitude: (deliveryCoords || currentUser?.coordinates || { lng: 78.4867 }).lng,
        },
        items: cart.map((i) => ({
          produceId: i.produce.id,
          name: i.produce.name,
          produceName: i.produce.name,
          quantity: i.quantity,
          unit: i.produce.unit,
          pricePerUnit: i.produce.aiRecommendedPrice || i.produce.basePrice,
          totalPrice: (i.produce.aiRecommendedPrice || i.produce.basePrice || 0) * (i.quantity || 0),
          farmerId: i.produce.farmerId || i.produce.id,
          farmerName: i.produce.farmerName,
          farmerLocation: i.produce.location,
          farmerCoordinates: i.produce.coordinates,
          canManageTransport: Boolean(i.produce.canManageTransport),
        })),
        transportMode,
        transportProviderFarmerId: transportLeaderId,
        transportProviderFarmerName: transportLeaderName,
        transportDistanceKm: roadDistanceKm,
        ratePerKm: 15,
        totalTransportCost: calculatedTransportCost,
        buyerTransportShare: buyerShare,
        farmersTransportShare: farmersShare,
        totalProduceAmount: produceSubtotal,
        totalOrderAmount: produceSubtotal + buyerShare,
        grandTotal: produceSubtotal + buyerShare,
        checkpoints,
        farmerAcceptances,
        routeLegs: calculatedLegs,
        paymentMethod,
        paymentStatus: 'PENDING',
        status: 'PAYMENT_PENDING',
        escrowHold: false,
      };

      const createdOrder = await placeMultiFarmerOrder(orderPayload);
      if (!createdOrder || createdOrder.error) {
        setIsProcessing(false);
        return;
      }

      try {
        const rzpRes = await initiateRazorpayUpiPayment(orderPayload.grandTotal, createdOrder.id);
        const razorpayKey = rzpRes?.keyId || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_RAZORPAY_KEY_ID);
        const hasLiveRzp = Boolean(
          window.Razorpay &&
          razorpayKey &&
          !razorpayKey.includes('<PENDING>') &&
          razorpayKey.trim() !== ''
        );

        if (hasLiveRzp) {
          const rzpOptions = {
            key: razorpayKey,
            amount: Math.round(orderPayload.grandTotal * 100),
            currency: 'INR',
            name: 'AgriNex Digital Marketplace',
            description: `Order #${createdOrder.id} - Escrow Clearing`,
            order_id: rzpRes?.razorpayOrderId,
            handler: async function (response) {
              try {
                const verifyRes = await fetch('/api/payments/razorpay/verify-payment', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    orderId: createdOrder.id,
                    razorpayPaymentId: response.razorpay_payment_id,
                    razorpayOrderId: response.razorpay_order_id,
                    razorpaySignature: response.razorpay_signature,
                  }),
                });
                const verifyData = await verifyRes.json();
                setIsProcessing(false);
                onClose();
                setActiveTab('orders');
                setSelectedOrderForTracking(verifyData.order || createdOrder);
                showToast('Payment Verified', 'Payment secured in escrow. Order confirmed!');
              } catch (e) {
                console.error('Payment verification error:', e);
              }
            },
            modal: {
              ondismiss: async function () {
                // Payment cancelled/closed: rollback reserved stock immediately!
                try {
                  await fetch(`/api/orders/${createdOrder.id}/payment-failed`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                  });
                } catch {}
                setIsProcessing(false);
                showToast(
                  'Payment Cancelled',
                  'Checkout was not completed. Reserved stock has been released.',
                  'info'
                );
              },
            },
            prefill: {
              name: currentUser?.name || 'AgriNex Buyer',
              email: currentUser?.email || 'buyer@agrinex.com',
              contact: currentUser?.phone || '9876543210',
            },
            theme: { color: '#059669' },
          };

          const rzp = new window.Razorpay(rzpOptions);
          rzp.open();
          return;
        } else {
          // Direct verification for local/test mode without live credentials
          await fetch('/api/payments/razorpay/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: createdOrder.id,
              razorpayPaymentId: `pay_direct_${Date.now()}`,
              razorpayOrderId: rzpRes?.razorpayOrderId || `order_direct_${Date.now()}`,
            }),
          });
        }
      } catch (payErr) {
        console.warn('Payment flow fallback notice:', payErr);
      }

      setIsProcessing(false);
      onClose();
      setActiveTab('orders');
      if (createdOrder) {
        setSelectedOrderForTracking(createdOrder);
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setIsProcessing(false);
      showToast('Checkout Failed', 'Please retry placing the order.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-2xs animate-in fade-in">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl border-l border-stone-200 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                AGX
              </div>
              <div>
                <h3 className="font-bold text-stone-900 text-sm">Procurement Cart</h3>
                <p className="text-[11px] text-stone-500">
                  Direct Farm Sourcing • Transparent Logistics
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

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {cart.length === 0 ? (
              <div className="py-16 text-center text-stone-400">
                <Truck className="w-10 h-10 mx-auto mb-2 opacity-30 text-stone-600" />
                <p className="font-medium">Your procurement cart is empty.</p>
                <span className="text-[11px]">Browse marketplace produce to add items.</span>
              </div>
            ) : (
              <>
                {/* Cart Items List */}
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div
                      key={item.produce.id}
                      className="p-3 rounded-xl border border-stone-200 bg-stone-50/60 flex items-center justify-between gap-3"
                    >
                      <img
                        src={item.produce.images?.[0]}
                        alt={item.produce.name}
                        className="w-12 h-12 rounded-lg object-cover border border-stone-200 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-stone-900 truncate">
                          {item.produce.name}
                        </h4>
                        <span className="text-[11px] text-stone-500 block">
                          ₹{item.produce.aiRecommendedPrice}/{item.produce.unit} • Farm: {item.produce.farmerName}
                        </span>

                        {/* Quantity input */}
                        <div className="flex items-center gap-2 mt-1.5">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={item.quantity === 0 ? '0' : (item.quantity ?? '')}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const val = raw === '' ? 0 : parseInt(raw, 10);
                              updateCartQuantity(item.produce.id, isNaN(val) ? 0 : val);
                            }}
                            className={`w-20 p-1 border rounded-md text-xs font-semibold text-center ${
                              item.quantity === 0 ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-stone-300'
                            }`}
                          />
                          <span className="text-stone-500 text-[11px]">{item.produce.unit}</span>
                          {item.quantity === 0 && (
                            <span className="text-[10px] font-semibold text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded">
                              Qty is 0
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-bold text-stone-900 block">
                          ₹{((item.produce.aiRecommendedPrice || item.produce.basePrice || 0) * (item.quantity || 0)).toLocaleString('en-IN')}
                        </span>
                        <button
                          onClick={() => removeFromCart(item.produce.id)}
                          className="text-red-500 hover:text-red-700 p-1 mt-1 rounded hover:bg-red-50 transition"
                          title="Delete item from cart"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Delivery Location Input with Google Maps GPS Picker */}
                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
                  <AddAddressPicker
                    label="Destination Delivery Dock & Address *"
                    value={deliveryAddress}
                    coordinates={deliveryCoords}
                    structuredLocation={structuredLocation}
                    placeholder="Enter delivery address or detect via GPS"
                    onChange={(addr, coords) => {
                      setDeliveryAddress(addr);
                      if (coords) setDeliveryCoords(coords);
                    }}
                    onLocationSelect={(loc) => {
                      if (loc?.formattedAddress) setDeliveryAddress(loc.formattedAddress);
                      if (loc?.latitude && loc?.longitude) {
                        setDeliveryCoords({ lat: loc.latitude, lng: loc.longitude });
                      }
                      setStructuredLocation(loc);
                    }}
                    helperText="Logistics route and freight ETA calculate directly to this location."
                  />
                  <div className="text-[10px] text-stone-500 flex items-center justify-between pt-1 border-t border-stone-200">
                    <span>Est. Distance: ~{logistics.distanceKm} km</span>
                    <span>Transit Time: ~{logistics.etaHours} hrs</span>
                  </div>
                </div>

                {/* TRANSPORT SELECTION: BUYER'S TRANSPORT VS FARMER'S TRANSPORT */}
                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-stone-900">
                      <Truck className="w-4 h-4 text-emerald-600" />
                      <span>Logistics Transport Mode *</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                      50 / 50 Cost Split Rule
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500">
                    Choose who coordinates the transit. Freight expense is strictly shared 50% by the buyer and 50% equally among all participating farmers.
                  </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTransportMode('BUYER_TRANSPORT')}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        transportMode === 'BUYER_TRANSPORT'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-500'
                          : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <strong className="text-xs font-bold text-stone-900">Buyer's Transport</strong>
                        <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                          transportMode === 'BUYER_TRANSPORT' ? 'border-emerald-600 bg-emerald-600' : 'border-stone-300'
                        }`}>
                          {transportMode === 'BUYER_TRANSPORT' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </span>
                      </div>
                      <p className="text-[10px] text-stone-600 leading-tight">
                        AI aggregates nearest farmers along an optimal route corridor. Dedicated transporter dispatched to docks.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTransportMode('FARMER_TRANSPORT')}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        transportMode === 'FARMER_TRANSPORT'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-500'
                          : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <strong className="text-xs font-bold text-stone-900">Farmer's Transport</strong>
                        <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                          transportMode === 'FARMER_TRANSPORT' ? 'border-emerald-600 bg-emerald-600' : 'border-stone-300'
                        }`}>
                          {transportMode === 'FARMER_TRANSPORT' && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </span>
                      </div>
                      <p className="text-[10px] text-stone-600 leading-tight">
                        {hasFarmerWithTransport ? (
                          <span className="text-emerald-800 font-medium">
                            AI selects nearest transport-enabled farmer (<strong>{farmersWithTransport[0]?.produce.farmerName}</strong>) to lead aggregation.
                          </span>
                        ) : (
                          'AI selects nearest farmer who enabled transport option to pickup & aggregate goods.'
                        )}
                      </p>
                    </button>
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-stone-900">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Payment Method (Escrow Secured)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('Direct UPI')}
                      className={`p-2 rounded-lg border text-left font-semibold text-[11px] transition ${
                        paymentMethod === 'Direct UPI'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                          : 'border-stone-200 bg-white text-stone-600'
                      }`}
                    >
                      UPI / Instant VPA
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('NetBanking')}
                      className={`p-2 rounded-lg border text-left font-semibold text-[11px] transition ${
                        paymentMethod === 'NetBanking'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                          : 'border-stone-200 bg-white text-stone-600'
                      }`}
                    >
                      Corporate NetBanking
                    </button>
                  </div>
                </div>

                {/* Cost Breakdown with 50/50 Split Rule */}
                <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80 space-y-2.5">
                  <div className="flex justify-between text-stone-700">
                    <span>Produce Subtotal ({totalWeightKg} kg):</span>
                    <strong className="text-stone-900">₹{produceSubtotal.toLocaleString('en-IN')}</strong>
                  </div>

                  {/* 50/50 Transport Cost Itemization */}
                  <div className="p-2.5 rounded-lg bg-white/80 border border-emerald-200 space-y-1 text-[11px]">
                    <div className="flex justify-between text-stone-700 font-semibold">
                      <span>Total Calculated Logistics Freight:</span>
                      <span>₹{totalTransportCost.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-emerald-800 font-bold">
                      <span>• Buyer's Share (50%):</span>
                      <span>+ ₹{buyerTransportExpense.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-stone-500">
                      <span>• Farmers' Share (50% divided among {uniqueFarmerIds.length} farmer{uniqueFarmerIds.length > 1 ? 's' : ''}):</span>
                      <span>- ₹{farmersTransportExpense.toLocaleString('en-IN')} (~₹{perFarmerTransportShare}/farmer)</span>
                    </div>
                  </div>

                  <div className="flex justify-between text-stone-700">
                    <span>AgriNex Platform Transaction Fee (1%):</span>
                    <strong className="text-stone-900">₹{platformFee}</strong>
                  </div>
                  <div className="pt-2 border-t border-emerald-200 flex justify-between text-sm font-black text-emerald-950">
                    <span>Buyer Grand Total (Payable Now):</span>
                    <span>₹{grandTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* AgriNex Escrow Account & Payment Guarantee Notice */}
                <div className="p-3 rounded-xl bg-stone-100 border border-stone-200 text-[11px] text-stone-600 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-stone-900">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Protected by AgriNex Escrow</span>
                  </div>
                  <p>
                    Your ₹{grandTotal.toLocaleString('en-IN')} payment is held in the official AgriNex Escrow Account ({agrinexBank.bankName}, A/C: {agrinexBank.accountNumber}, IFSC: {agrinexBank.ifscCode}). Funds are transferred to farmers only upon successful produce delivery and OTP validation.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Footer Checkout Button */}
          {cart.length > 0 && (
            <div className="p-4 border-t border-stone-200 bg-stone-50">
              <button
                id="btn-confirm-escrow-checkout"
                disabled={isProcessing}
                onClick={handleCheckout}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-700/20 transition active:scale-95 flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>
                  {isProcessing
                    ? 'Processing Payment...'
                    : `Pay & Place Order (₹${grandTotal.toLocaleString('en-IN')})`}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
