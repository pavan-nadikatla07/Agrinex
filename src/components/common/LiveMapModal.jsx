import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import {
  getGoogleMapsApiKey,
  loadGoogleMapsScript,
  loadLeafletScript,
  getCurrentCoordinates,
  watchCurrentLocation,
} from '../../services/locationService';
import {
  getRoute,
  getRouteSteps,
  getDistance,
  getDuration,
  isOffRoute,
  getNextInstruction,
  recalculateRoute,
  calculateRouteProgress,
} from '../../services/routingService';
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
  AlertTriangle,
  Key,
  Sprout,
  Users,
  Check,
  Sparkles,
  Compass,
  LocateFixed,
  ArrowUp,
  CornerUpRight,
  CornerUpLeft,
  Flag,
  Radio,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export const LiveMapModal = ({ order, onClose }) => {
  const { updateTransporterGPS, showToast } = useApp();

  // Map DOM containers & engine instances
  const googleMapDivRef = useRef(null);
  const leafletMapDivRef = useRef(null);
  const googleMapInstance = useRef(null);
  const leafletMapInstance = useRef(null);
  const leafletMarkersRef = useRef([]);
  const leafletPolylineRef = useRef(null);
  const googleMarkersRef = useRef([]);
  const googlePolylineRef = useRef(null);

  // Active Map Engine: 'google' | 'leaflet'
  const [mapEngine, setMapEngine] = useState('google');
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapStatusMessage, setMapStatusMessage] = useState('Initializing navigation engine...');

  // Navigation states - STRICT SEPARATION
  const [currentGpsLocation, setCurrentGpsLocation] = useState(null); // Real device GPS position only
  const [manualLocation, setManualLocation] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [destinationLocation, setDestinationLocation] = useState(null);

  // Real Road Route states
  const [routeGeometry, setRouteGeometry] = useState([]);
  const [navigationSteps, setNavigationSteps] = useState([]);
  const [totalRouteDistanceKm, setTotalRouteDistanceKm] = useState(null);
  const [totalRouteDurationMinutes, setTotalRouteDurationMinutes] = useState(null);
  const [routingStatus, setRoutingStatus] = useState('INITIALIZING');
  const [isRoutingLoading, setIsRoutingLoading] = useState(false);
  const [routingError, setRoutingError] = useState('');

  // Live Navigation & Tracking states
  const [isLiveTrackingActive, setIsLiveTrackingActive] = useState(false);
  const [isCameraAutoFollow, setIsCameraAutoFollow] = useState(true);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [vehicleSpeed, setVehicleSpeed] = useState(0);
  const [vehicleHeading, setVehicleHeading] = useState(null);
  const [lastGpsPingTime, setLastGpsPingTime] = useState(null);
  const [gpsErrorMessage, setGpsErrorMessage] = useState('');
  const [isOffRouteDetected, setIsOffRouteDetected] = useState(false);
  const [isRecalculatingRoute, setIsRecalculatingRoute] = useState(false);
  const [showStepList, setShowStepList] = useState(false);

  // Backend tracking feed
  const [liveData, setLiveData] = useState(null);
  const [isFetchingBackend, setIsFetchingBackend] = useState(false);

  const watchCleanupRef = useRef(null);
  const lastRecalculationRef = useRef(0);

  if (!order) return null;

  // Extract all connected farmer checkpoints
  const checkpoints =
    order.checkpoints && order.checkpoints.length > 0
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

  // Resolve buyer destination coordinates
  const buyerCoords = order.buyerCoordinates || { lat: 17.385, lng: 78.4867 };

  // Fetch live tracking from backend API
  const fetchBackendLiveTracking = async () => {
    setIsFetchingBackend(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/live-tracking`);
      if (res.ok) {
        const data = await res.json();
        setLiveData(data);
        if (data.currentLocation && typeof data.currentLocation.lat === 'number') {
          // Update live transporter coordinate if not tracking local GPS
          if (!isLiveTrackingActive) {
            setLastGpsPingTime(new Date(data.currentLocation.timestamp || Date.now()));
            setVehicleSpeed(data.currentLocation.speed || 0);
            setGpsAccuracy(data.currentLocation.accuracy || null);
          }
        }
      }
    } catch (err) {
      console.warn('[LiveMapModal] Backend tracking fetch notice:', err);
    } finally {
      setIsFetchingBackend(false);
    }
  };

  useEffect(() => {
    fetchBackendLiveTracking();
    const interval = setInterval(fetchBackendLiveTracking, 5000);
    return () => clearInterval(interval);
  }, [order.id]);

  // Determine current active vehicle coordinates
  const currentVehicleCoords =
    currentGpsLocation ||
    (liveData?.currentLocation?.lat
      ? { lat: liveData.currentLocation.lat, lng: liveData.currentLocation.lng }
      : null) ||
    (order.transporterCurrentLocation?.lat ? order.transporterCurrentLocation : null) ||
    checkpoints[0]?.coordinates ||
    null;

  // 1. Calculate Real Road Route using centralized routingService
  const calculateRoute = useCallback(
    async (originCoords) => {
      if (!originCoords || !buyerCoords) return;

      setIsRoutingLoading(true);
      setRoutingError('');

      // Build waypoints: for multi-farmer Buyer Transport, intermediate farmers are stops
      const waypoints = [];
      if (checkpoints.length > 1) {
        checkpoints.slice(1).forEach((cp) => {
          if (cp.coordinates && typeof cp.coordinates.lat === 'number') {
            waypoints.push(cp.coordinates);
          }
        });
      }

      try {
        const routeResult = await getRoute(originCoords, buyerCoords, { waypoints });

        if (routeResult.success && Array.isArray(routeResult.routeGeometry) && routeResult.routeGeometry.length > 1) {
          setRouteGeometry(routeResult.routeGeometry);
          setNavigationSteps(routeResult.steps || []);
          setTotalRouteDistanceKm(routeResult.distanceKm);
          setTotalRouteDurationMinutes(routeResult.durationMinutes);
          setRoutingStatus(routeResult.routingStatus || 'REAL_ROAD');
          setIsOffRouteDetected(false);
        } else {
          setRouteGeometry([]);
          setNavigationSteps([]);
          setRoutingError('Route unavailable. Please try again.');
          setRoutingStatus('ROUTE_UNAVAILABLE');
        }
      } catch (err) {
        console.warn('[LiveMapModal] Route calculation failed:', err);
        setRouteGeometry([]);
        setNavigationSteps([]);
        setRoutingError('Route unavailable. Please try again.');
        setRoutingStatus('ROUTE_UNAVAILABLE');
      } finally {
        setIsRoutingLoading(false);
        setIsRecalculatingRoute(false);
      }
    },
    [checkpoints, buyerCoords]
  );

  // Initialize route on mount
  useEffect(() => {
    const initialOrigin =
      currentGpsLocation ||
      checkpoints[0]?.coordinates ||
      (order.farmerCoordinates ? order.farmerCoordinates : null);

    if (initialOrigin) {
      calculateRoute(initialOrigin);
    }
  }, []);

  // 2. Continuous Device GPS Tracking via watchPosition()
  const startGpsLiveTracking = () => {
    if (watchCleanupRef.current) {
      watchCleanupRef.current();
      watchCleanupRef.current = null;
    }

    setGpsErrorMessage('');
    setIsLiveTrackingActive(true);

    const cleanup = watchCurrentLocation(
      async (gpsData) => {
        setCurrentGpsLocation(gpsData);
        setGpsAccuracy(gpsData.accuracy);
        setVehicleSpeed(gpsData.speed || 0);
        setVehicleHeading(gpsData.heading);
        setLastGpsPingTime(new Date(gpsData.timestamp));

        // Auto-follow camera if enabled
        if (isCameraAutoFollow) {
          centerMapOnLocation(gpsData);
        }

        // Transmit fresh GPS ping to backend
        try {
          const token = localStorage.getItem('agrinex_token');
          await fetch(`/api/orders/${order.id}/gps-ping`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              latitude: gpsData.lat,
              longitude: gpsData.lng,
              speed: gpsData.speed,
              heading: gpsData.heading,
              accuracy: gpsData.accuracy,
              timestamp: new Date(gpsData.timestamp).toISOString(),
            }),
          });
        } catch {}

        // Check for Off-Route Deviation (>75 meters)
        if (routeGeometry.length > 2) {
          const offRouteResult = isOffRoute(gpsData, { routeGeometry }, 75);
          if (offRouteResult.isOff) {
            setIsOffRouteDetected(true);
            const now = Date.now();
            // Throttle route recalculation to at most once every 10 seconds
            if (now - lastRecalculationRef.current > 10000) {
              lastRecalculationRef.current = now;
              setIsRecalculatingRoute(true);
              calculateRoute(gpsData);
            }
          } else {
            setIsOffRouteDetected(false);
          }
        }
      },
      (err) => {
        setGpsErrorMessage(err.message || 'GPS tracking unavailable.');
        setIsLiveTrackingActive(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      }
    );

    watchCleanupRef.current = cleanup;
  };

  const stopGpsLiveTracking = () => {
    if (watchCleanupRef.current) {
      watchCleanupRef.current();
      watchCleanupRef.current = null;
    }
    setIsLiveTrackingActive(false);
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (watchCleanupRef.current) {
        watchCleanupRef.current();
      }
      if (leafletMapInstance.current) {
        try {
          leafletMapInstance.current.remove();
        } catch {}
      }
    };
  }, []);

  // Request fresh one-time Current GPS location
  const handleAcquireCurrentGps = async () => {
    setGpsErrorMessage('');
    try {
      const coords = await getCurrentCoordinates({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });

      const gpsData = {
        lat: coords.lat,
        lng: coords.lng,
        accuracy: coords.accuracy,
        speed: 0,
        heading: null,
        timestamp: coords.timestamp || Date.now(),
        source: 'GPS',
      };

      setCurrentGpsLocation(gpsData);
      setGpsAccuracy(coords.accuracy);
      setLastGpsPingTime(new Date());

      // Move map to current GPS
      centerMapOnLocation(gpsData);

      // Recalculate route from current GPS
      calculateRoute(gpsData);

      showToast?.(
        'GPS Position Verified',
        `Current physical GPS location locked (±${coords.accuracy}m). Route recalculated from your real position.`
      );
    } catch (err) {
      setGpsErrorMessage(err.message || 'Unable to detect GPS position.');
    }
  };

  // 3. Dual-Engine Map Initialization (Google Maps -> Leaflet Fallback)
  const initLeafletMap = useCallback(async () => {
    try {
      const L = await loadLeafletScript();
      if (!leafletMapDivRef.current) return;

      if (!leafletMapInstance.current) {
        const defaultCenter = currentVehicleCoords || checkpoints[0]?.coordinates || [16.3067, 80.4365];
        const centerLatLng = Array.isArray(defaultCenter)
          ? defaultCenter
          : [defaultCenter.lat, defaultCenter.lng];

        const map = L.map(leafletMapDivRef.current, {
          center: centerLatLng,
          zoom: 11,
          zoomControl: true,
        });

        // Genuine OpenStreetMap street tiles (authentic real roads worldwide)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map);

        leafletMapInstance.current = map;
      }

      const map = leafletMapInstance.current;

      // Clear previous markers
      leafletMarkersRef.current.forEach((m) => map.removeLayer(m));
      leafletMarkersRef.current = [];

      if (leafletPolylineRef.current) {
        map.removeLayer(leafletPolylineRef.current);
        leafletPolylineRef.current = null;
      }

      const bounds = L.latLngBounds([]);

      // 1. Farmer Stops Markers
      checkpoints.forEach((cp, idx) => {
        if (cp.coordinates && typeof cp.coordinates.lat === 'number') {
          const latLng = [cp.coordinates.lat, cp.coordinates.lng];
          bounds.extend(latLng);

          const farmerIcon = L.divIcon({
            className: 'agrinex-farmer-pin',
            html: `
              <div style="background-color: #059669; color: white; border: 2px solid white; border-radius: 9999px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3);">
                #${idx + 1}
              </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          });

          const marker = L.marker(latLng, { icon: farmerIcon }).addTo(map);
          marker.bindPopup(`
            <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4;">
              <strong style="color: #065f46; font-size: 13px;">🌾 Stop #${idx + 1}: ${cp.farmerName}</strong><br/>
              📍 ${cp.location || 'Farm Origin'}<br/>
              📦 ${cp.quantity || cp.contributionWeightKg} ${cp.unit || 'kg'} (${cp.produceName || 'Produce'})<br/>
              <span style="color: #059669; font-weight: 600;">Grade: ${cp.qualityGrade || 'Grade A'} (${cp.qualityScore || 94}/100)</span>
            </div>
          `);
          leafletMarkersRef.current.push(marker);
        }
      });

      // 2. Buyer Destination Marker
      if (buyerCoords && typeof buyerCoords.lat === 'number') {
        const buyerLatLng = [buyerCoords.lat, buyerCoords.lng];
        bounds.extend(buyerLatLng);

        const buyerIcon = L.divIcon({
          className: 'agrinex-buyer-pin',
          html: `
            <div style="background-color: #2563eb; color: white; border: 2px solid white; border-radius: 9999px; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3);">
              🏢
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });

        const marker = L.marker(buyerLatLng, { icon: buyerIcon }).addTo(map);
        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4;">
            <strong style="color: #1e40af; font-size: 13px;">🏢 Destination: ${order.buyerName || 'Buyer Dock'}</strong><br/>
            📍 ${order.deliveryAddress || 'Delivery Address'}<br/>
            🚚 Total Consignment: ${order.totalWeightKg || 500} kg
          </div>
        `);
        leafletMarkersRef.current.push(marker);
      }

      // 3. Transporter / Current Position Marker
      if (currentVehicleCoords && typeof currentVehicleCoords.lat === 'number') {
        const vehicleLatLng = [currentVehicleCoords.lat, currentVehicleCoords.lng];
        bounds.extend(vehicleLatLng);

        const vehicleIcon = L.divIcon({
          className: 'agrinex-truck-pin',
          html: `
            <div style="position: relative; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;">
              <div style="position: absolute; width: 100%; height: 100%; border-radius: 9999px; background: #f59e0b; opacity: 0.3; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
              <div style="position: relative; background-color: #d97706; color: white; border: 2px solid white; border-radius: 9999px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 4px 8px rgba(0,0,0,0.4);">
                🚚
              </div>
            </div>
          `,
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        });

        const marker = L.marker(vehicleLatLng, { icon: vehicleIcon }).addTo(map);
        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4;">
            <strong style="color: #b45309; font-size: 13px;">🚚 Live Transporter / Device GPS</strong><br/>
            Speed: ${vehicleSpeed} km/h • Accuracy: ±${gpsAccuracy || 10}m<br/>
            Coords: ${currentVehicleCoords.lat.toFixed(5)}, ${currentVehicleCoords.lng.toFixed(5)}
          </div>
        `);
        leafletMarkersRef.current.push(marker);
      }

      // 4. Render Real Road Polyline
      if (Array.isArray(routeGeometry) && routeGeometry.length > 1) {
        const polylinePoints = routeGeometry.map((pt) => [pt.lat, pt.lng]);
        const polyline = L.polyline(polylinePoints, {
          color: '#059669',
          weight: 5,
          opacity: 0.9,
          lineJoin: 'round',
        }).addTo(map);
        leafletPolylineRef.current = polyline;

        polylinePoints.forEach((pt) => bounds.extend(pt));
      }

      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [35, 35] });
      }

      setMapLoaded(true);
      setMapEngine('leaflet');
      setMapStatusMessage('Interactive Real Road Map Active');
    } catch (err) {
      console.warn('[LiveMapModal] Leaflet initialization notice:', err);
      setMapStatusMessage('Map initialization notice: ' + err.message);
    }
  }, [checkpoints, buyerCoords, currentVehicleCoords, routeGeometry, vehicleSpeed, gpsAccuracy]);

  // Attempt Google Maps initialization with fallback to Leaflet
  useEffect(() => {
    let isCancelled = false;

    loadGoogleMapsScript()
      .then((googleMaps) => {
        if (isCancelled || !googleMapDivRef.current) return;

        // Try initializing Google Map
        try {
          const defaultCenter = currentVehicleCoords || checkpoints[0]?.coordinates || { lat: 16.3067, lng: 80.4365 };

          const map = new googleMaps.Map(googleMapDivRef.current, {
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

          // Clear previous markers & polylines
          googleMarkersRef.current.forEach((m) => m.setMap(null));
          googleMarkersRef.current = [];

          if (googlePolylineRef.current) {
            googlePolylineRef.current.setMap(null);
            googlePolylineRef.current = null;
          }

          const bounds = new googleMaps.LatLngBounds();

          // 1. Farmer checkpoints
          checkpoints.forEach((cp, idx) => {
            if (cp.coordinates && typeof cp.coordinates.lat === 'number') {
              bounds.extend(cp.coordinates);
              const marker = new googleMaps.Marker({
                position: cp.coordinates,
                map,
                title: `Stop #${idx + 1}: ${cp.farmerName}`,
                icon: {
                  path: googleMaps.SymbolPath.CIRCLE,
                  scale: 8,
                  fillColor: '#059669',
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 2,
                },
              });
              googleMarkersRef.current.push(marker);
            }
          });

          // 2. Buyer Destination
          if (buyerCoords && typeof buyerCoords.lat === 'number') {
            bounds.extend(buyerCoords);
            const marker = new googleMaps.Marker({
              position: buyerCoords,
              map,
              title: `Destination: ${order.buyerName}`,
              icon: {
                path: googleMaps.SymbolPath.CIRCLE,
                scale: 9,
                fillColor: '#2563eb',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
              },
            });
            googleMarkersRef.current.push(marker);
          }

          // 3. Vehicle Marker
          if (currentVehicleCoords && typeof currentVehicleCoords.lat === 'number') {
            bounds.extend(currentVehicleCoords);
            const marker = new googleMaps.Marker({
              position: currentVehicleCoords,
              map,
              title: `Transporter: ${vehicleSpeed} km/h`,
              icon: {
                path: googleMaps.SymbolPath.FORWARD_CLOSED_ARROW,
                scale: 6,
                fillColor: '#d97706',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
                rotation: vehicleHeading || 0,
              },
            });
            googleMarkersRef.current.push(marker);
          }

          // 4. Real Road Polyline
          if (Array.isArray(routeGeometry) && routeGeometry.length > 1) {
            const polyline = new googleMaps.Polyline({
              path: routeGeometry,
              geodesic: true,
              strokeColor: '#059669',
              strokeOpacity: 0.85,
              strokeWeight: 5,
              map,
            });
            googlePolylineRef.current = polyline;
            routeGeometry.forEach((pt) => bounds.extend(pt));
          }

          map.fitBounds(bounds, { top: 35, bottom: 35, left: 35, right: 35 });

          setMapLoaded(true);
          setMapEngine('google');
          setMapStatusMessage('Google Maps Road View Active');
        } catch (err) {
          // If Google Maps fails runtime check, switch to Leaflet
          initLeafletMap();
        }
      })
      .catch(() => {
        // Fallback to Leaflet + OpenStreetMap street tiles
        if (!isCancelled) {
          initLeafletMap();
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [checkpoints, buyerCoords, currentVehicleCoords, routeGeometry, vehicleHeading, initLeafletMap]);

  // Center map on specific location
  const centerMapOnLocation = (coords) => {
    if (!coords || typeof coords.lat !== 'number') return;
    if (mapEngine === 'google' && googleMapInstance.current) {
      googleMapInstance.current.panTo({ lat: coords.lat, lng: coords.lng });
      googleMapInstance.current.setZoom(15);
    } else if (mapEngine === 'leaflet' && leafletMapInstance.current) {
      leafletMapInstance.current.setView([coords.lat, coords.lng], 15, { animate: true });
    }
  };

  // Fit all route waypoints in camera
  const fitRouteBounds = () => {
    if (mapEngine === 'google' && googleMapInstance.current) {
      const bounds = new window.google.maps.LatLngBounds();
      if (routeGeometry.length > 0) {
        routeGeometry.forEach((pt) => bounds.extend(pt));
      } else {
        checkpoints.forEach((cp) => cp.coordinates && bounds.extend(cp.coordinates));
        if (buyerCoords) bounds.extend(buyerCoords);
      }
      googleMapInstance.current.fitBounds(bounds, { top: 35, bottom: 35, left: 35, right: 35 });
    } else if (mapEngine === 'leaflet' && leafletMapInstance.current && window.L) {
      const bounds = window.L.latLngBounds([]);
      if (routeGeometry.length > 0) {
        routeGeometry.forEach((pt) => bounds.extend([pt.lat, pt.lng]));
      } else {
        checkpoints.forEach((cp) => cp.coordinates && bounds.extend([cp.coordinates.lat, cp.coordinates.lng]));
        if (buyerCoords) bounds.extend([buyerCoords.lat, buyerCoords.lng]);
      }
      if (bounds.isValid()) {
        leafletMapInstance.current.fitBounds(bounds, { padding: [35, 35] });
      }
    }
  };

  // Turn-by-Turn Maneuver Icon Helper
  const getManeuverIcon = (maneuver = '') => {
    const m = maneuver.toLowerCase();
    if (m.includes('right')) return <CornerUpRight className="w-5 h-5 text-emerald-400" />;
    if (m.includes('left')) return <CornerUpLeft className="w-5 h-5 text-emerald-400" />;
    if (m.includes('arrive') || m.includes('destination')) return <Flag className="w-5 h-5 text-blue-400" />;
    return <ArrowUp className="w-5 h-5 text-emerald-400" />;
  };

  // Derive real route progress & active turn instruction from current location
  const activeRouteData = {
    routeGeometry,
    steps: navigationSteps,
    distanceKm: totalRouteDistanceKm,
    durationMinutes: totalRouteDurationMinutes,
  };
  const progressInfo = calculateRouteProgress(currentVehicleCoords, activeRouteData);
  const navInstruction = getNextInstruction(currentVehicleCoords, activeRouteData);
  const currentStep = navInstruction?.currentStep || navigationSteps[0] || null;
  const nextStep = navInstruction?.nextStep || navigationSteps[1] || null;
  const remainingDistanceKm = progressInfo?.distanceRemainingKm ?? totalRouteDistanceKm;
  const remainingEtaMinutes = progressInfo?.etaMinutesRemaining ?? totalRouteDurationMinutes;
  const percentCompleted = progressInfo?.percentCompleted ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[94vh]">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-200 bg-stone-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-stone-900">
                  Real Navigation & Road Corridor • Order #{order.id}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wide">
                  {order.status.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-xs text-stone-500">
                {checkpoints.length} Farm Stop{checkpoints.length > 1 ? 's' : ''} • {order.totalWeightKg} kg Consignment • Real Highway Geometry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200 transition"
              title="Close Navigation"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Main Map Canvas Area */}
          <div className="relative w-full rounded-2xl overflow-hidden border border-stone-800 shadow-lg bg-stone-950">
            {/* Google Maps Canvas */}
            <div
              ref={googleMapDivRef}
              className={`w-full h-80 sm:h-[420px] ${mapEngine === 'google' ? 'block' : 'hidden'}`}
            />

            {/* Leaflet + OpenStreetMap Canvas (100% reliable street tiles) */}
            <div
              ref={leafletMapDivRef}
              className={`w-full h-80 sm:h-[420px] ${mapEngine === 'leaflet' ? 'block' : 'hidden'}`}
            />

            {/* FLOATING TURN-BY-TURN HUD (Upper Left) */}
            {currentStep && (
              <div className="absolute top-3 left-3 z-30 max-w-xs sm:max-w-sm rounded-xl bg-stone-900/90 backdrop-blur-md border border-white/15 text-white p-3 shadow-xl">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center shrink-0">
                    {getManeuverIcon(currentStep.maneuver)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
                      NEXT MANEUVER • {currentStep.distanceText || `${currentStep.distanceMeters} m`}
                    </span>
                    <p className="text-xs sm:text-sm font-bold text-white line-clamp-2">
                      {currentStep.instruction}
                    </p>
                    {nextStep && (
                      <span className="text-[11px] text-stone-400 block mt-1 truncate">
                        Then: {nextStep.instruction}
                      </span>
                    )}
                  </div>
                </div>

                {/* Step List Toggle */}
                {navigationSteps.length > 2 && (
                  <button
                    onClick={() => setShowStepList(!showStepList)}
                    className="w-full mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-stone-400 hover:text-white"
                  >
                    <span>{navigationSteps.length} Route Instructions</span>
                    {showStepList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                )}

                {/* Expandable Turn-by-Turn List */}
                {showStepList && (
                  <div className="mt-2 max-h-48 overflow-y-auto space-y-1.5 pr-1 text-[11px] divide-y divide-white/5 border-t border-white/10 pt-2">
                    {navigationSteps.map((step, sIdx) => (
                      <div key={sIdx} className="pt-1.5 flex items-start gap-2">
                        <span className="text-stone-500 font-mono text-[10px] shrink-0">#{sIdx + 1}</span>
                        <div className="flex-1">
                          <span className="text-stone-200 block">{step.instruction}</span>
                          <span className="text-[10px] text-stone-400">{step.distanceText} • {step.durationText}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* FLOATING OFF-ROUTE RECALCULATION BADGE */}
            {isOffRouteDetected && (
              <div className="absolute top-3 right-3 z-30 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/90 backdrop-blur-md text-stone-950 font-bold text-xs shadow-lg animate-pulse">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {isRecalculatingRoute ? 'Recalculating Road Route...' : 'Off Planned Road Route (>75m)'}
                </span>
              </div>
            )}

            {/* FLOATING MAP CONTROLS (Bottom Right) */}
            <div className="absolute bottom-3 right-3 z-30 flex flex-col gap-2">
              {/* Follow Me Toggle */}
              <button
                onClick={() => {
                  const nextFollow = !isCameraAutoFollow;
                  setIsCameraAutoFollow(nextFollow);
                  if (nextFollow && currentVehicleCoords) {
                    centerMapOnLocation(currentVehicleCoords);
                  }
                }}
                className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg border border-white/10 transition active:scale-95 ${
                  isCameraAutoFollow
                    ? 'bg-emerald-600 text-white shadow-emerald-500/30 ring-2 ring-emerald-400'
                    : 'bg-stone-900/90 text-stone-300 hover:bg-stone-800'
                }`}
                title={isCameraAutoFollow ? 'Auto-Follow Camera: Active' : 'Auto-Follow Camera: Click to Enable'}
              >
                <Compass className={`w-5 h-5 ${isCameraAutoFollow ? 'animate-pulse' : ''}`} />
              </button>

              {/* Recenter Button */}
              <button
                onClick={handleAcquireCurrentGps}
                className="w-10 h-10 rounded-xl bg-stone-900/90 hover:bg-stone-800 text-white flex items-center justify-center shadow-lg border border-white/10 transition active:scale-95"
                title="Recenter on Fresh GPS Location"
              >
                <LocateFixed className="w-5 h-5 text-emerald-400" />
              </button>

              {/* Fit Entire Route Bounds Button */}
              <button
                onClick={fitRouteBounds}
                className="w-10 h-10 rounded-xl bg-stone-900/90 hover:bg-stone-800 text-white flex items-center justify-center shadow-lg border border-white/10 transition active:scale-95"
                title="Fit Entire Consignment Route"
              >
                <Layers className="w-5 h-5 text-blue-400" />
              </button>
            </div>

            {/* LIVE GPS NAVIGATION TOOLBAR */}
            <div className="p-3 bg-stone-900 border-t border-stone-800 text-stone-300 text-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      isLiveTrackingActive ? 'bg-emerald-400 animate-ping' : 'bg-stone-500'
                    }`}
                  />
                  <span className="font-bold text-white">
                    {isLiveTrackingActive ? 'LIVE GPS ACTIVE' : 'GPS STANDBY'}
                  </span>
                </div>

                {gpsAccuracy !== null && (
                  <span className="px-2 py-0.5 rounded-md bg-stone-800 text-emerald-400 font-mono text-[11px] border border-stone-700">
                    GPS accuracy: ±{gpsAccuracy} m
                  </span>
                )}

                {vehicleSpeed > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-stone-800 text-amber-300 font-mono text-[11px] border border-stone-700">
                    {vehicleSpeed} km/h
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {!isLiveTrackingActive ? (
                  <button
                    onClick={startGpsLiveTracking}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-sm"
                  >
                    <Radio className="w-3.5 h-3.5 animate-pulse" />
                    <span>Start Live Tracking</span>
                  </button>
                ) : (
                  <button
                    onClick={stopGpsLiveTracking}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition active:scale-95 shadow-sm"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Stop Tracking</span>
                  </button>
                )}

                <button
                  onClick={fetchBackendLiveTracking}
                  disabled={isFetchingBackend}
                  className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold border border-stone-700 transition disabled:opacity-50"
                  title="Poll server tracking feed"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isFetchingBackend ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* ROUTE METRICS STRIP */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
              <span className="text-[10px] text-stone-500 uppercase font-bold block">Remaining Distance</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base sm:text-lg font-bold text-stone-900">
                  {remainingDistanceKm != null ? `${remainingDistanceKm} km` : 'Calculating...'}
                </span>
                {totalRouteDistanceKm != null && totalRouteDistanceKm > remainingDistanceKm && (
                  <span className="text-[11px] text-stone-400">/ {totalRouteDistanceKm} km</span>
                )}
              </div>
              <div className="w-full bg-stone-200 rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className="bg-emerald-600 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${percentCompleted}%` }}
                />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
              <span className="text-[10px] text-stone-500 uppercase font-bold block">Estimated Travel Time</span>
              <span className="text-base sm:text-lg font-bold text-amber-700 block">
                {remainingEtaMinutes != null ? `${remainingEtaMinutes} mins` : 'Calculating...'}
              </span>
              <span className="text-[10px] text-stone-500 font-medium block">
                {percentCompleted}% trip completed
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
              <span className="text-[10px] text-stone-500 uppercase font-bold block">Connected Stops</span>
              <span className="text-base sm:text-lg font-bold text-emerald-700 block">
                {checkpoints.length} Farm{checkpoints.length > 1 ? 's' : ''}
              </span>
              <span className="text-[10px] text-stone-500 font-medium block">
                {order.transportMode === 'BUYER_TRANSPORT' ? 'Buyer Transit Pickups' : 'Direct Dispatch'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200">
              <span className="text-[10px] text-stone-500 uppercase font-bold block">GPS Last Update</span>
              <span className="text-xs sm:text-sm font-bold text-stone-800 truncate block">
                {lastGpsPingTime ? formatTime(lastGpsPingTime) : 'Location update unavailable'}
              </span>
              <span className="text-[10px] text-stone-500 font-medium block">
                {isLiveTrackingActive ? 'Continuously syncing' : 'Standby mode'}
              </span>
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
                  Math.round(
                    ((cp.quantity || cp.contributionWeightKg || 1) / (order.totalWeightKg || 1)) * 100
                  );
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

          {/* Delivery Destination & Transporter Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-xs space-y-3">
              <span className="font-bold text-stone-900 block text-sm">Delivery Destination & Recipient</span>
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-stone-900 block">Buyer Dock / Doorstep</span>
                  <span className="text-stone-600">{order.deliveryAddress || 'Direct Delivery Location'}</span>
                  <span className="text-[11px] text-blue-700 block mt-1 font-semibold">
                    Recipient: {order.buyerName} ({order.buyerPhone || '+91 98765 43210'})
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
                    <strong>Route Distance:</strong> {totalRouteDistanceKm || order.actualRoadDistanceKm || 0} km (₹15/km standard pricing)
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
          <span className="text-xs text-stone-500">
            {isLiveTrackingActive ? (
              <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                Live GPS Active • Updates synced in real-time
              </span>
            ) : (
              <span>Last update: {lastGpsPingTime ? formatTime(lastGpsPingTime) : 'Location update unavailable'}</span>
            )}
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

export default LiveMapModal;
