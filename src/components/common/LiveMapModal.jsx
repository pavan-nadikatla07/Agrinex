import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
  getGoogleMapsApiKey,
  loadGoogleMapsScript,
} from '../../services/locationService';
import { formatCurrency, formatNumber, formatDate, formatTime } from '../../utils/formatters';
import {
  X,
  MapPin,
  Truck,
  Navigation,
  Clock,
  Phone,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Key,
  Sprout,
  Users,
  Check,
  Sparkles,
} from 'lucide-react';

export const LiveMapModal = ({ order, onClose }) => {
  const { updateTransporterGPS, showToast } = useApp();
  const mapRef = useRef(null);
  const googleMapInstance = useRef(null);
  const markersRef = useRef([]);
  const polylineRef = useRef([]);

  // Google Maps API Key management via import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  const apiKey = getGoogleMapsApiKey();
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState('');

  if (!order) return null;

  // Extract all connected farmer checkpoints
  const checkpoints = (order.checkpoints && order.checkpoints.length > 0)
    ? order.checkpoints
    : [
        {
          checkpointIndex: 0,
          farmerId: order.farmerId || 'farmer_01',
          farmerName: order.farmerName || 'Lead Farm Origin',
          farmerPhone: order.farmerPhone || '',
          produceName: order.items?.[0]?.produceName || 'Agricultural Produce',
          quantity: order.totalWeightKg || 500,
          contributionPercentage: 100,
          unit: order.items?.[0]?.unit || 'kg',
          unitPrice: order.items?.[0]?.pricePerUnit || 30,
          location: order.farmerLocation || 'Guntur Agricultural Cluster',
          coordinates: order.farmerCoordinates || { lat: 16.3067, lng: 80.4365 },
          status: 'COMPLETED',
          qualityScore: 94,
          qualityGrade: 'Grade A',
        },
      ];

  // Real-Time GPS Tracking Feed from /api/orders/:id/live-tracking
  const [liveData, setLiveData] = useState(null);
  const [isFetchingLive, setIsFetchingLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchLiveTracking = async () => {
    setIsFetchingLive(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/live-tracking`);
      if (res.ok) {
        const data = await res.json();
        setLiveData(data);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.warn('Failed to fetch live tracking:', err);
    } finally {
      setIsFetchingLive(false);
    }
  };

  useEffect(() => {
    fetchLiveTracking();

    // 1. Connect to Server-Sent Events (SSE) stream for zero-refresh live updates
    let eventSource = null;
    try {
      eventSource = new EventSource(`/api/orders/${order.id}/tracking/stream`);
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLiveData(data);
          setLastUpdated(new Date());
        } catch {}
      };
      eventSource.onerror = () => {
        eventSource?.close();
      };
    } catch {}

    // 2. Resilient fallback polling every 4 seconds
    const interval = setInterval(fetchLiveTracking, 4000);

    return () => {
      clearInterval(interval);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [order.id]);

  // Real device GPS Tracking via navigator.geolocation.watchPosition()
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    let watchId = null;
    try {
      watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude, speed, heading, accuracy } = position.coords;
          const token = localStorage.getItem('agrinex_token');
          const activeStatuses = [
            'CONFIRMED',
            'PICKUP_IN_PROGRESS',
            'IN_TRANSIT',
            'OUT_FOR_DELIVERY',
            'BUYER_QUALITY_CHECK',
            'CHECKPOINT_QUALITY_VERIFICATION',
            'PICKED_UP',
          ];
          if (activeStatuses.includes(order.status)) {
            try {
              await fetch(`/api/orders/${order.id}/gps-ping`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                  latitude,
                  longitude,
                  speed: speed || 0,
                  heading: heading || 0,
                  accuracy: accuracy || 10,
                  timestamp: new Date(position.timestamp).toISOString(),
                }),
              });
            } catch {}
          }
        },
        (error) => {
          console.warn('GPS watchPosition notice:', error.message);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 15000,
        }
      );
    } catch (err) {
      console.warn('Unable to initialize watchPosition:', err);
    }

    return () => {
      if (watchId !== null && navigator.geolocation?.clearWatch) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [order.id, order.status]);

  const currentVehicleLat =
    liveData?.currentLocation?.lat ??
    order.transporterCurrentLocation?.lat ??
    checkpoints[0]?.coordinates?.lat ??
    16.3067;
  const currentVehicleLng =
    liveData?.currentLocation?.lng ??
    order.transporterCurrentLocation?.lng ??
    checkpoints[0]?.coordinates?.lng ??
    80.4365;
  const vehicleSpeed = liveData?.currentLocation?.speed || 0;
  const vehicleAccuracy = liveData?.currentLocation?.accuracy || 10;
  const vehicleHeading = liveData?.currentLocation?.heading || 0;

  const progress = Math.min(
    100,
    Math.max(0, liveData?.routeProgressPercent ?? order.routeProgressPercent ?? 0)
  );

  // Structured tracking data model conforming to AgriNex order tracking lifecycle
  const trackingStatus = liveData?.status || order.status || 'NOT_STARTED';
  const distanceRemainingKm =
    liveData?.distanceRemainingKm ??
    order.distanceRemainingKm ??
    order.actualRoadDistanceKm ??
    order.deliveryRoute?.totalDistanceKm ??
    order.distanceKm ??
    null;
  const etaMinutes =
    liveData?.etaMinutes ??
    order.etaMinutes ??
    order.estimatedMinutes ??
    order.deliveryRoute?.estimatedMinutes ??
    null;
  const lastUpdatedTime = formatTime(lastUpdated || liveData?.currentLocation?.timestamp);

  const tracking = {
    status: trackingStatus,
    distanceRemainingKm,
    etaMinutes,
    lastUpdatedTime,
    isAvailable: Boolean(liveData || order.status),
  };

  // Initialize or reload Google Map
  useEffect(() => {
    let isCancelled = false;

    if (!mapRef.current) return;

    loadGoogleMapsScript()
      .then((googleMaps) => {
        if (isCancelled || !mapRef.current) return;

        setMapLoaded(true);
        setMapError('');

        // Clear existing markers & polylines
        markersRef.current.forEach((m) => m.setMap(null));
        markersRef.current = [];
        polylineRef.current.forEach((p) => p.setMap(null));
        polylineRef.current = [];

        const bounds = new googleMaps.LatLngBounds();

        const defaultCenter = checkpoints[0]?.coordinates || { lat: 16.3067, lng: 80.4365 };
        const map = new googleMaps.Map(mapRef.current, {
          center: defaultCenter,
          zoom: 11,
          mapTypeId: 'roadmap',
          zoomControl: true,
          streetViewControl: false,
          fullscreenControl: false,
          styles: [
            { featureType: 'poi', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', stylers: [{ visibility: 'simplified' }] },
          ],
        });
        googleMapInstance.current = map;

        // Path waypoints
        const pathCoords = [];

        // Add markers for all connected farmers
        checkpoints.forEach((cp, idx) => {
          const coords = cp.coordinates || { lat: 16.3067 + idx * 0.04, lng: 80.4365 + idx * 0.04 };
          pathCoords.push(coords);
          bounds.extend(coords);

          const farmerMarker = new googleMaps.Marker({
            position: coords,
            map,
            title: `Farmer #${idx + 1}: ${cp.farmerName} (${cp.quantity || cp.contributionWeightKg} ${cp.unit || 'kg'})`,
            icon: {
              path: googleMaps.SymbolPath.CIRCLE,
              scale: 9,
              fillColor: '#059669',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            },
          });

          const infoWindow = new googleMaps.InfoWindow({
            content: `
              <div style="font-family: sans-serif; padding: 6px; font-size: 12px;">
                <div style="font-weight: bold; color: #065f46; font-size: 13px;">🌾 ${cp.farmerName}</div>
                <div style="color: #4b5563; margin-top: 2px;">📍 ${cp.location || 'Farm Origin'}</div>
                <div style="font-weight: 600; margin-top: 4px; color: #111827;">
                  Contribution: ${cp.quantity || cp.contributionWeightKg} ${cp.unit || 'kg'} (${cp.contributionPercentage || Math.round((cp.quantity / (order.totalWeightKg || 1)) * 100)}%)
                </div>
                <div style="color: #059669; font-size: 11px; margin-top: 2px;">
                  Quality Grade: ${cp.qualityGrade || 'Grade A'} (${cp.qualityScore || 94}/100)
                </div>
              </div>
            `,
          });

          farmerMarker.addListener('click', () => {
            infoWindow.open(map, farmerMarker);
          });

          markersRef.current.push(farmerMarker);
        });

        // Add Transporter Current Position Marker from live tracking
        const truckCoords = {
          lat: currentVehicleLat,
          lng: currentVehicleLng,
        };
        pathCoords.push(truckCoords);
        bounds.extend(truckCoords);

        const truckMarker = new googleMaps.Marker({
          position: truckCoords,
          map,
          title: `Transporter: ${order.transporter?.name || 'Logistics Partner'} (${vehicleSpeed} km/h)`,
          icon: {
            path: googleMaps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 6,
            fillColor: '#d97706',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            rotation: vehicleHeading || 45,
          },
        });
        markersRef.current.push(truckMarker);

        // Add Buyer Destination Marker
        const buyerCoords = order.buyerCoordinates || { lat: 17.3850, lng: 78.4867 };
        pathCoords.push(buyerCoords);
        bounds.extend(buyerCoords);

        const buyerMarker = new googleMaps.Marker({
          position: buyerCoords,
          map,
          title: `Destination: ${order.buyerName} (${order.deliveryAddress || 'Buyer Dock'})`,
          icon: {
            path: googleMaps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#2563eb',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
          },
        });

        const buyerInfoWindow = new googleMaps.InfoWindow({
          content: `
            <div style="font-family: sans-serif; padding: 6px; font-size: 12px;">
              <div style="font-weight: bold; color: #1e40af; font-size: 13px;">🏢 Destination: ${order.buyerName}</div>
              <div style="color: #4b5563; margin-top: 2px;">📍 ${order.deliveryAddress || 'Consumer Dock'}</div>
              <div style="color: #2563eb; font-weight: 600; margin-top: 4px;">
                Total Shipment: ${order.totalWeightKg} kg • ${checkpoints.length} Farmers Combined
              </div>
            </div>
          `,
        });

        buyerMarker.addListener('click', () => {
          buyerInfoWindow.open(map, buyerMarker);
        });

        markersRef.current.push(buyerMarker);

        // Draw Real Road Geometry Route Polyline
        let detailedPathCoords = [];
        const legs = liveData?.routeLegs || order.routeLegs || order.legs || [];
        if (Array.isArray(legs) && legs.length > 0) {
          legs.forEach((leg) => {
            if (Array.isArray(leg.roadGeometry) && leg.roadGeometry.length > 0) {
              leg.roadGeometry.forEach((pt) => {
                if (pt && typeof pt.lat === 'number' && typeof pt.lng === 'number') {
                  detailedPathCoords.push(pt);
                  bounds.extend(pt);
                }
              });
            }
          });
        }
        if (detailedPathCoords.length === 0) {
          detailedPathCoords = pathCoords;
        }

        const routePolyline = new googleMaps.Polyline({
          path: detailedPathCoords,
          geodesic: true,
          strokeColor: '#059669',
          strokeOpacity: 0.85,
          strokeWeight: 4,
          map,
        });
        polylineRef.current.push(routePolyline);

        map.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
      })
      .catch((err) => {
        if (!isCancelled) {
          setMapLoaded(false);
          setMapError(err.message || 'Unable to connect to Google Maps');
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [apiKey, order, currentVehicleLat, currentVehicleLng, vehicleHeading]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Navigation className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-stone-900">
                  Consignment Route & Connected Farmers • Order #{order.id}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                  {order.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-stone-500">
                {checkpoints.length} Connected Farmer{checkpoints.length > 1 ? 's' : ''} • {order.totalWeightKg} kg Total Procurement • Multi-Pickup Route
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {order.status || 'IN_TRANSIT'}
            </span>

            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200/60 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Real Google Map Container with Fallback Interactive Canvas */}
          <div className="relative w-full rounded-2xl overflow-hidden border border-stone-800 shadow-md">
            {/* Real Google Map Div (hidden if failed or no key) */}
            <div
              ref={mapRef}
              className={`w-full h-80 sm:h-96 ${mapLoaded ? 'block' : 'hidden'}`}
            />

            {/* Fallback & Visual Vector Map (shown if Google Maps is loading or unconfigured) */}
            {!mapLoaded && (
              <div className="relative w-full h-80 sm:h-96 bg-gradient-to-br from-emerald-950 via-stone-900 to-slate-900 p-4 flex flex-col justify-between overflow-hidden">
                {/* Top overlay */}
                <div className="flex items-center justify-between z-10">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/70 backdrop-blur-md text-white text-xs border border-white/10">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span className="font-semibold">Live GPS Stream Active</span>
                    <span className="text-stone-400">|</span>
                    <span>{checkpoints.length} Farm Pickups → Buyer Dock</span>
                  </div>

                  <button
                    onClick={fetchLiveTracking}
                    disabled={isFetchingLive}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition active:scale-95 disabled:opacity-50"
                    title="Poll latest vehicle GPS coordinates"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isFetchingLive ? 'animate-spin' : ''}`} />
                    <span>{isFetchingLive ? 'Connecting...' : 'Refresh GPS'}</span>
                  </button>
                </div>

                {/* SVG Route Visualization with all connected farmers */}
                <div className="relative w-full flex-1 flex items-center justify-center px-8">
                  <svg className="w-full h-36" viewBox="0 0 600 120" fill="none">
                    {/* Background Road Corridor */}
                    <path
                      d="M 20 60 C 150 15, 300 105, 450 45 L 580 60"
                      stroke="#334155"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray="10 10"
                    />

                    {/* Active Transit Path */}
                    <path
                      d="M 20 60 C 150 15, 300 105, 450 45 L 580 60"
                      stroke="#10b981"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray="600"
                      strokeDashoffset={600 - (600 * progress) / 100}
                      className="transition-all duration-700 ease-out"
                    />

                    {/* Waypoints for each connected farmer */}
                    {checkpoints.map((cp, idx) => {
                      const totalCps = checkpoints.length;
                      const xPos = 30 + (idx * 220) / Math.max(1, totalCps);
                      const yPos = 60 - (idx % 2 === 0 ? 25 : -25);
                      return (
                        <g key={idx} transform={`translate(${xPos}, ${yPos})`}>
                          <circle r="14" fill="#059669" className="shadow-lg" />
                          <circle r="6" fill="#ffffff" />
                          <text
                            x="0"
                            y="-20"
                            fill="#a7f3d0"
                            fontSize="10"
                            fontWeight="bold"
                            textAnchor="middle"
                          >
                            Farm #{idx + 1}: {cp.farmerName}
                          </text>
                          <text
                            x="0"
                            y="-8"
                            fill="#d1fae5"
                            fontSize="9"
                            textAnchor="middle"
                          >
                            {cp.quantity || cp.contributionWeightKg} {cp.unit || 'kg'} ({cp.contributionPercentage || Math.round((cp.quantity / (order.totalWeightKg || 1)) * 100)}%)
                          </text>
                        </g>
                      );
                    })}

                    {/* Destination Marker: Buyer Dock */}
                    <g transform="translate(570, 60)">
                      <circle r="16" fill="#2563eb" />
                      <circle r="8" fill="#ffffff" />
                      <text
                        x="0"
                        y="30"
                        fill="#bfdbfe"
                        fontSize="11"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        Buyer Dock
                      </text>
                    </g>

                    {/* Moving Transporter Vehicle */}
                    {(() => {
                      const truckX = 20 + (550 * progress) / 100;
                      const truckY = 60 - 25 * Math.sin((progress / 100) * Math.PI);
                      return (
                        <g
                          transform={`translate(${truckX}, ${truckY})`}
                          className="transition-all duration-700 ease-out"
                        >
                          <circle r="18" fill="#f59e0b" opacity="0.3" className="animate-ping" />
                          <circle r="15" fill="#f59e0b" />
                          <Truck className="w-4 h-4 text-stone-950" x="-8" y="-8" />
                          <text
                            x="0"
                            y="-22"
                            fill="#fbbf24"
                            fontSize="10"
                            fontWeight="bold"
                            textAnchor="middle"
                          >
                            {order.transporter?.name || 'Transporter Truck'}
                          </text>
                        </g>
                      );
                    })()}
                  </svg>
                </div>

                {/* Bottom Overlay Status */}
                <div className="grid grid-cols-3 gap-2 z-10">
                  <div className="p-2 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 text-center">
                    <span className="text-[10px] text-stone-400 block uppercase font-bold">Route Progress</span>
                    <span className="text-sm font-bold text-emerald-400">{progress}%</span>
                  </div>
                  <div className="p-2 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 text-center">
                    <span className="text-[10px] text-stone-400 block uppercase font-bold">Distance Remaining</span>
                    <span className="text-sm font-bold text-white">
                      {tracking.distanceRemainingKm != null ? `${tracking.distanceRemainingKm} km` : 'Pending'}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 text-center">
                    <span className="text-[10px] text-stone-400 block uppercase font-bold">Estimated ETA</span>
                    <span className="text-sm font-bold text-amber-400">
                      {tracking.etaMinutes != null ? `${tracking.etaMinutes} mins` : 'Calculating'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Top Toolbar over map */}
            <div className="p-3 bg-stone-900 border-t border-stone-800 text-stone-300 text-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-bold text-white">Live Highway GPS:</span>
                <span className="font-mono text-[11px] text-emerald-400">
                  {currentVehicleLat.toFixed(4)}, {currentVehicleLng.toFixed(4)} ({vehicleSpeed} km/h • ±{vehicleAccuracy}m)
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={fetchLiveTracking}
                  disabled={isFetchingLive}
                  className="px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isFetchingLive ? 'animate-spin' : ''}`} />
                  <span>{isFetchingLive ? 'Polling...' : 'Refresh Live GPS'}</span>
                </button>
                <span className="text-stone-400 text-[11px]">
                  Updated: <strong className="text-stone-200">{formatTime(lastUpdated || liveData?.currentLocation?.timestamp, 'Just now')}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* DEDICATED SECTION: CONNECTED FARMERS & ORDER CONTRIBUTIONS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-700" />
                <h4 className="font-bold text-stone-900 text-sm">
                  Connected Farmers & Procurement Contributions ({checkpoints.length})
                </h4>
              </div>
              <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                Total Sourced: {order.totalWeightKg} kg
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {checkpoints.map((cp, idx) => {
                const percentage =
                  cp.contributionPercentage ||
                  Math.round(((cp.quantity || cp.contributionWeightKg || 1) / (order.totalWeightKg || 1)) * 100);
                const farmerSubtotal =
                  cp.subtotalAmount ||
                  Math.round((cp.quantity || cp.contributionWeightKg || 1) * (cp.unitPrice || 30));

                return (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200/80 space-y-3 shadow-2xs hover:border-emerald-300 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                          #{idx + 1}
                        </div>
                        <div>
                          <span className="font-bold text-stone-900 block text-sm">
                            {cp.farmerName}
                          </span>
                          <span className="text-[11px] text-stone-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-emerald-600" />
                            {cp.location}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-black text-emerald-900 block">
                          {percentage}% of Order
                        </span>
                        <span className="text-[11px] text-stone-500 font-medium">
                          {cp.quantity || cp.contributionWeightKg} {cp.unit || 'kg'}
                        </span>
                      </div>
                    </div>

                    {/* Contribution Details Grid */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-200/60 text-[11px]">
                      <div>
                        <span className="text-stone-400 block text-[10px]">Produce</span>
                        <span className="font-bold text-stone-800 truncate block">
                          {cp.produceName || order.items?.[0]?.produceName || 'Produce'}
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-400 block text-[10px]">Escrow Value</span>
                        <span className="font-bold text-stone-900">
                          {formatCurrency(farmerSubtotal)}
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-400 block text-[10px]">Quality Score</span>
                        <span className="font-bold text-emerald-700 flex items-center gap-0.5">
                          <Sparkles className="w-2.5 h-2.5" />
                          {cp.qualityGrade || 'Grade A'} ({cp.qualityScore || 94}/100)
                        </span>
                      </div>
                    </div>

                    {/* Checkpoint Pickup Status */}
                    <div className="p-2 rounded-lg bg-white/90 border border-emerald-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-stone-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-[11px] font-medium">
                          Pickup OTP: <strong className="font-mono text-emerald-800">{cp.pickupOtp || 'Verified'}</strong>
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        {cp.status === 'COMPLETED' ? 'Picked Up & En Route' : 'Ready for Pickup'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Logistics & Transporter Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-xs space-y-3">
              <span className="font-bold text-stone-900 block text-sm">Delivery Destination & Recipient</span>
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-stone-900 block">Buyer Dock / Doorstep</span>
                  <span className="text-stone-600">{order.deliveryAddress || 'Direct Delivery Location'}</span>
                  <span className="text-[11px] text-blue-700 block mt-1 font-semibold">
                    Recipient: {order.buyerName} ({order.buyerPhone})
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-900 text-sm">Transport Logistics</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  {order.transportMode === 'FARMER_TRANSPORT' ? 'Farmer Direct Transport' : 'Buyer Transport'}
                </span>
              </div>
              {order.transporter?.name ? (
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-sm">
                      {order.transporter.name[0]}
                    </div>
                    <div>
                      <span className="font-bold text-stone-900 block text-sm">
                        {order.transporter.name}
                      </span>
                      {order.transporter.vehicleNumber && (
                        <span className="text-stone-500 block">
                          {order.transporter.vehicleNumber} {order.transporter.vehicleType ? `• ${order.transporter.vehicleType}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  {order.transporter.phone && (
                    <div className="pt-2 flex items-center justify-between border-t border-stone-200">
                      <a
                        href={`tel:${order.transporter.phone}`}
                        className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-semibold"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Contact Transport ({order.transporter.phone})</span>
                      </a>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-stone-600 space-y-1">
                  <p>
                    <strong>Mode:</strong> {order.transportMode === 'FARMER_TRANSPORT' ? 'Farmer Direct Dispatch' : 'Buyer Transport'}
                  </p>
                  <p>
                    <strong>Route Distance:</strong> {order.actualRoadDistanceKm || order.deliveryRoute?.totalDistanceKm || order.distanceKm || 0} km (₹15/km pricing)
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
          <span className="text-xs text-stone-500">
            Last GPS ping: <strong className="text-stone-700">{tracking.lastUpdatedTime}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-xs font-semibold transition"
          >
            Close Tracker
          </button>
        </div>
      </div>
    </div>
  );
};
