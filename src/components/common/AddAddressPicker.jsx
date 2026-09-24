import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Edit3,
  X,
  Search,
  Crosshair,
} from 'lucide-react';
import {
  loadGoogleMapsScript,
  getCurrentCoordinates,
  reverseGeocodeLocation,
  fetchPlacePredictions,
  fetchPlaceDetails,
} from '../../services/locationService';

export const AddAddressPicker = ({
  value = '',
  initialLocation = null,
  coordinates = null,
  structuredLocation = null,
  onChange,
  onLocationSelect,
  placeholder = 'Add or select verified delivery/farm address',
  label = 'Address & Location *',
  required = true,
  disabled = false,
  helperText = 'Device geolocation is used to detect your exact dispatch or delivery address.',
}) => {
  const initialAddr =
    typeof initialLocation === 'string'
      ? initialLocation
      : initialLocation?.formattedAddress || value || '';

  // Independent explicit state tracking
  const [currentGpsLocation, setCurrentGpsLocation] = useState(null);
  const [manualLocation, setManualLocation] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(
    typeof initialLocation === 'object' ? initialLocation : structuredLocation
  );

  const [confirmedAddress, setConfirmedAddress] = useState(initialAddr);
  const [confirmedStructured, setConfirmedStructured] = useState(
    typeof initialLocation === 'object' ? initialLocation : structuredLocation
  );

  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedAddress, setDetectedAddress] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [accuracyNotice, setAccuracyNotice] = useState('');
  const [showManualFallback, setShowManualFallback] = useState(false);
  const [manualQuery, setManualQuery] = useState('');
  const [predictions, setPredictions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Mini-map references
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);

  useEffect(() => {
    if (value && value !== confirmedAddress) {
      setConfirmedAddress(value);
    }
  }, [value]);

  const notifySelection = (formatted, coords, structured) => {
    setConfirmedAddress(formatted);
    setConfirmedStructured(structured);
    setSelectedLocation(structured);
    setDetectedAddress(null);
    setShowManualFallback(false);
    setErrorMessage('');
    setStatusMessage('');

    if (onChange) {
      onChange(formatted, coords, structured);
    }
    if (onLocationSelect) {
      onLocationSelect(structured);
    }
  };

  // Google Maps interactive mini-preview
  useEffect(() => {
    const loc = detectedAddress || confirmedStructured || selectedLocation;
    const coords = loc?.coordinates;
    if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number' || !mapContainerRef.current) {
      return;
    }

    let isCancelled = false;
    loadGoogleMapsScript()
      .then((googleMaps) => {
        if (isCancelled || !mapContainerRef.current) return;
        const latLng = { lat: coords.lat, lng: coords.lng };

        if (!mapInstanceRef.current) {
          mapInstanceRef.current = new googleMaps.Map(mapContainerRef.current, {
            center: latLng,
            zoom: 15,
            mapTypeId: 'roadmap',
            zoomControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            mapTypeControl: false,
          });
        } else {
          mapInstanceRef.current.setCenter(latLng);
        }

        const map = mapInstanceRef.current;
        const isGps = loc.source === 'GPS';

        if (markerRef.current) {
          markerRef.current.setMap(null);
        }
        markerRef.current = new googleMaps.Marker({
          position: latLng,
          map,
          title: isGps ? 'Current Location (You are here)' : 'Manual Selected Location',
          icon: isGps
            ? {
                path: googleMaps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#059669',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
              }
            : undefined,
        });

        if (circleRef.current) {
          circleRef.current.setMap(null);
          circleRef.current = null;
        }
        if (isGps && loc.accuracy) {
          circleRef.current = new googleMaps.Circle({
            center: latLng,
            radius: Math.max(15, loc.accuracy),
            fillColor: '#10b981',
            fillOpacity: 0.15,
            strokeColor: '#059669',
            strokeWeight: 1,
            map,
          });
        }
      })
      .catch(() => {
        // Fallback gracefully without throwing
      });

    return () => {
      isCancelled = true;
    };
  }, [detectedAddress, confirmedStructured, selectedLocation]);

  // 1. Detect location using device GPS + reverse geocoding
  const handleUseCurrentLocation = async () => {
    setIsDetecting(true);
    setErrorMessage('');
    setAccuracyNotice('');
    setStatusMessage('Requesting GPS permission and detecting current device location...');

    try {
      const coords = await getCurrentCoordinates({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });

      // 1. Validate latitude and longitude
      if (
        typeof coords.lat !== 'number' ||
        typeof coords.lng !== 'number' ||
        !Number.isFinite(coords.lat) ||
        !Number.isFinite(coords.lng) ||
        coords.lat < -90 ||
        coords.lat > 90 ||
        coords.lng < -180 ||
        coords.lng > 180
      ) {
        throw new Error('Device GPS returned invalid coordinates.');
      }

      // 2. Read accuracy value
      const accuracy = coords.accuracy || 0;
      if (coords.isLowAccuracy || accuracy > 100) {
        setAccuracyNotice(
          `Notice: GPS accuracy is ±${accuracy}m (fair/low accuracy). For highest dispatch/delivery precision, move to an open area or retry.`
        );
      } else {
        setAccuracyNotice(`High-accuracy GPS verified: ±${accuracy}m.`);
      }

      // 3. Development logging
      console.log(
        '[AgriNex Location] GPS position:',
        { latitude: coords.lat, longitude: coords.lng, accuracy },
        'Source: GPS'
      );

      const gpsData = {
        lat: coords.lat,
        lng: coords.lng,
        accuracy,
        source: 'GPS',
        timestamp: coords.timestamp || Date.now(),
      };
      setCurrentGpsLocation(gpsData);
      setManualLocation(null);

      setStatusMessage('Device location acquired. Converting GPS coordinates to readable address...');

      const result = await reverseGeocodeLocation(coords.lat, coords.lng);
      if (!result || !result.formattedAddress) {
        throw new Error('Reverse geocoding failed to find a valid address for your coordinates.');
      }

      // Exact coordinates remain unchanged from GPS
      const structured = {
        ...result,
        latitude: coords.lat,
        longitude: coords.lng,
        coordinates: { lat: coords.lat, lng: coords.lng },
        accuracy,
        source: 'GPS',
        isGps: true,
      };

      setDetectedAddress(structured);
      setSelectedLocation(structured);
      setStatusMessage('');
      // Auto-notify immediately so form value is populated without requiring a second click
      notifySelection(structured.formattedAddress, structured.coordinates, structured);
    } catch (err) {
      let message = err?.message || 'Unable to determine your GPS location. Please try again.';
      if (err?.code === 1) {
        message = 'Location permission denied. Please enable location permission in your browser settings.';
        setShowManualFallback(true);
      } else if (err?.code === 2) {
        message = 'Unable to determine your GPS location. Please try again.';
      } else if (err?.code === 3) {
        message = 'GPS location request timed out. Please retry.';
      }
      setErrorMessage(message);
      setStatusMessage('');
    } finally {
      setIsDetecting(false);
    }
  };

  // 2. Confirm the detected address
  const handleConfirmDetectedAddress = () => {
    if (!detectedAddress) return;
    notifySelection(
      detectedAddress.formattedAddress,
      detectedAddress.coordinates,
      detectedAddress
    );
  };

  const handleConfirmManualQuery = async () => {
    if (!manualQuery.trim()) return;
    const cleanAddr = manualQuery.trim();
    setIsSearching(true);
    try {
      if (predictions.length > 0) {
        const first = predictions[0];
        const details = await fetchPlaceDetails(first.place_id, first);
        const manualData = {
          ...details,
          source: 'MANUAL',
          isGps: false,
        };
        console.log('[AgriNex Location] Source: MANUAL | Address:', manualData.formattedAddress);
        setManualLocation(manualData);
        setCurrentGpsLocation(null);
        setSelectedLocation(manualData);
        setAccuracyNotice('');
        notifySelection(manualData.formattedAddress, manualData.coordinates, manualData);
        return;
      }

      const fallbackCoords = coordinates || { lat: 17.385, lng: 78.4867 };
      const geoResult = await reverseGeocodeLocation(fallbackCoords.lat, fallbackCoords.lng);
      const structured = {
        address: cleanAddr,
        formattedAddress: cleanAddr,
        placeId: geoResult?.placeId || `ChIJ_${Math.abs(Math.round(fallbackCoords.lat * 10000))}_${Math.abs(Math.round(fallbackCoords.lng * 10000))}`,
        coordinates: fallbackCoords,
        latitude: fallbackCoords.lat,
        longitude: fallbackCoords.lng,
        city: cleanAddr.split(',')[0] || geoResult?.city || 'Local',
        district: geoResult?.district || cleanAddr.split(',')[0] || 'Local',
        state: geoResult?.state || 'Andhra Pradesh',
        country: 'India',
        source: 'MANUAL',
        isGps: false,
      };
      console.log('[AgriNex Location] Source: MANUAL | Address:', cleanAddr);
      setManualLocation(structured);
      setCurrentGpsLocation(null);
      setSelectedLocation(structured);
      setAccuracyNotice('');
      notifySelection(cleanAddr, fallbackCoords, structured);
    } catch {
      const fallbackCoords = coordinates || { lat: 17.385, lng: 78.4867 };
      const structured = {
        address: cleanAddr,
        formattedAddress: cleanAddr,
        placeId: `ChIJ_${Date.now()}`,
        coordinates: fallbackCoords,
        latitude: fallbackCoords.lat,
        longitude: fallbackCoords.lng,
        city: cleanAddr.split(',')[0] || 'Local',
        district: cleanAddr.split(',')[0] || 'Local',
        state: 'Andhra Pradesh',
        country: 'India',
        source: 'MANUAL',
        isGps: false,
      };
      console.log('[AgriNex Location] Source: MANUAL | Address:', cleanAddr);
      setManualLocation(structured);
      setCurrentGpsLocation(null);
      setSelectedLocation(structured);
      setAccuracyNotice('');
      notifySelection(cleanAddr, fallbackCoords, structured);
    } finally {
      setIsSearching(false);
    }
  };

  // 3. Search manual address fallback
  const handleSearchManual = async (query) => {
    setManualQuery(query);
    if (!query || query.trim().length < 2) {
      setPredictions([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await fetchPlacePredictions(query);
      setPredictions(results);
    } catch {
      setPredictions([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectPrediction = async (item) => {
    setIsSearching(true);
    try {
      const details = await fetchPlaceDetails(item.place_id, item);
      const manualData = {
        ...details,
        source: 'MANUAL',
        isGps: false,
      };
      console.log('[AgriNex Location] Source: MANUAL | Address:', manualData.formattedAddress);
      setManualLocation(manualData);
      setCurrentGpsLocation(null);
      setSelectedLocation(manualData);
      setAccuracyNotice('');
      notifySelection(manualData.formattedAddress, manualData.coordinates, manualData);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to resolve selected place details.');
    } finally {
      setIsSearching(false);
    }
  };

  const isCurrentGps =
    (confirmedStructured?.source === 'GPS' || selectedLocation?.source === 'GPS') &&
    (confirmedStructured?.isGps !== false);

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-xs font-semibold text-stone-700">
          {label}
        </label>
      )}

      {/* CONFIRMED ADDRESS CARD (When address is already selected) */}
      {confirmedAddress && !detectedAddress && !showManualFallback ? (
        <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 flex flex-col gap-3 text-xs shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                    Confirmed Address
                  </span>
                  {isCurrentGps ? (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                      <Crosshair className="w-2.5 h-2.5 text-emerald-700" />
                      REAL GPS LOCATION {confirmedStructured?.accuracy ? `(±${confirmedStructured.accuracy}m)` : ''}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                      MANUAL LOCATION
                    </span>
                  )}
                </div>
                <p className="font-semibold text-stone-900 mt-1 leading-snug">{confirmedAddress}</p>
                {confirmedStructured && (
                  <span className="text-[11px] text-stone-500 block mt-0.5">
                    {[
                      confirmedStructured.city,
                      confirmedStructured.district,
                      confirmedStructured.state,
                      confirmedStructured.postalCode,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                )}
                {confirmedStructured?.coordinates && (
                  <span className="text-[10px] text-stone-400 font-mono block mt-0.5">
                    GPS Coordinates: {confirmedStructured.coordinates.lat?.toFixed(5)}, {confirmedStructured.coordinates.lng?.toFixed(5)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                type="button"
                id="btn-retry-location"
                disabled={disabled || isDetecting}
                onClick={handleUseCurrentLocation}
                className="px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-white hover:bg-emerald-100/60 text-emerald-900 font-bold text-xs transition flex items-center gap-1 shadow-2xs disabled:opacity-50"
                title="Retry GPS to update real device position"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isDetecting ? 'animate-spin' : ''}`} />
                <span>Retry Current Location</span>
              </button>
              <button
                type="button"
                id="btn-change-address"
                disabled={disabled}
                onClick={() => setShowManualFallback(true)}
                className="px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 text-xs font-semibold transition flex items-center gap-1"
                title="Enter address manually"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Manual Entry</span>
              </button>
            </div>
          </div>

          {/* Mini-Map Preview Container */}
          <div
            ref={mapContainerRef}
            className="w-full h-36 rounded-lg overflow-hidden border border-emerald-200/60 bg-stone-100"
          />
        </div>
      ) : detectedAddress ? (
        /* DETECTED ADDRESS PREVIEW & CONFIRMATION BOX */
        <div className="p-4 rounded-xl bg-white border-2 border-emerald-500 shadow-md space-y-3 animate-in fade-in text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs uppercase tracking-wide">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Address Detected from Current GPS Location</span>
            </div>
            {detectedAddress.accuracy && (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Accuracy: ±{detectedAddress.accuracy}m
              </span>
            )}
          </div>

          <div className="p-3 rounded-lg bg-stone-50 border border-stone-200 space-y-1">
            <span className="text-[11px] text-stone-500 font-medium block">Current Address:</span>
            <p className="text-sm font-bold text-stone-900 leading-snug">
              {detectedAddress.formattedAddress}
            </p>
            <div className="text-[11px] text-stone-600 flex flex-wrap gap-2 pt-1">
              {detectedAddress.city && <span>City: <strong>{detectedAddress.city}</strong></span>}
              {detectedAddress.district && <span>District: <strong>{detectedAddress.district}</strong></span>}
              {detectedAddress.state && <span>State: <strong>{detectedAddress.state}</strong></span>}
              {detectedAddress.postalCode && <span>PIN: <strong>{detectedAddress.postalCode}</strong></span>}
            </div>
            {detectedAddress.coordinates && (
              <p className="text-[10px] text-stone-400 font-mono pt-0.5">
                Exact Coordinates: {detectedAddress.coordinates.lat?.toFixed(5)}, {detectedAddress.coordinates.lng?.toFixed(5)}
              </p>
            )}
          </div>

          {/* Mini-Map Preview Container for Detected GPS */}
          <div
            ref={mapContainerRef}
            className="w-full h-36 rounded-lg overflow-hidden border border-emerald-200 bg-stone-100"
          />

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              id="btn-confirm-address"
              onClick={handleConfirmDetectedAddress}
              className="flex-1 min-w-[140px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirm Address</span>
            </button>
            <button
              type="button"
              id="btn-retry-location"
              onClick={handleUseCurrentLocation}
              className="px-3 py-2.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 font-bold text-xs transition flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Current Location</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setDetectedAddress(null);
                setShowManualFallback(true);
              }}
              className="px-3 py-2.5 rounded-xl text-stone-500 hover:text-stone-800 text-xs font-semibold underline underline-offset-2"
            >
              Manual Entry
            </button>
          </div>
        </div>
      ) : (
        /* PROMINENT "ADD ADDRESS" BUTTON & FLOW */
        <div className="space-y-2">
          <div className="p-3.5 rounded-2xl border border-stone-200 bg-white shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-xs text-stone-800">
                  Physical Delivery & Dispatch Address
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowManualFallback(!showManualFallback)}
                className="text-[11px] text-stone-500 hover:text-stone-800 font-semibold underline"
              >
                {showManualFallback ? 'Use GPS' : 'Search by name'}
              </button>
            </div>

            {/* Standard "ADD ADDRESS" button */}
            {!showManualFallback ? (
              <div className="space-y-2">
                <button
                  type="button"
                  id="btn-add-address"
                  disabled={disabled || isDetecting}
                  onClick={handleUseCurrentLocation}
                  className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-emerald-500/80 bg-emerald-50/50 hover:bg-emerald-100/60 text-emerald-900 font-bold text-xs transition flex items-center justify-center gap-2 group shadow-2xs disabled:opacity-50"
                >
                  {isDetecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
                      <span>Detecting current device location...</span>
                    </>
                  ) : (
                    <>
                      <Navigation className="w-4 h-4 text-emerald-700 group-hover:scale-110 transition-transform" />
                      <span>ADD ADDRESS — Use My Current Location</span>
                    </>
                  )}
                </button>

                {statusMessage && (
                  <p className="text-[11px] text-emerald-700 animate-pulse text-center">
                    {statusMessage}
                  </p>
                )}
              </div>
            ) : (
              /* Fallback Place Search */
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    id="address-search-input"
                    placeholder="Search village, city, APMC mandi, or landmark..."
                    value={manualQuery}
                    onChange={(e) => handleSearchManual(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                  {manualQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setManualQuery('');
                        setPredictions([]);
                      }}
                      className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {manualQuery.trim().length > 2 && (
                  <button
                    type="button"
                    id="btn-confirm-typed-address"
                    onClick={handleConfirmManualQuery}
                    className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Use &quot;{manualQuery.trim().slice(0, 35)}{manualQuery.trim().length > 35 ? '...' : ''}&quot; as Address (MANUAL)</span>
                  </button>
                )}

                {isSearching && (
                  <div className="flex items-center gap-2 text-[11px] text-stone-500 py-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                    <span>Searching address suggestions...</span>
                  </div>
                )}

                {predictions.length > 0 && (
                  <div className="rounded-xl border border-stone-200 bg-white shadow-lg overflow-hidden max-h-48 overflow-y-auto divide-y divide-stone-100">
                    {predictions.map((p, idx) => (
                      <button
                        key={p.place_id || idx}
                        type="button"
                        onClick={() => handleSelectPrediction(p)}
                        className="w-full p-2.5 text-left hover:bg-stone-50 text-xs transition flex items-start gap-2"
                      >
                        <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-stone-900 block">{p.description}</span>
                          {p.state && (
                            <span className="text-[10px] text-stone-500">
                              {p.city ? `${p.city}, ` : ''}{p.state}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ACCURACY NOTICE */}
      {accuracyNotice && (
        <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200 text-xs text-blue-900 flex items-center gap-2 animate-in fade-in">
          <Crosshair className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <p className="text-[11px] text-blue-800 leading-tight">{accuracyNotice}</p>
        </div>
      )}

      {/* ERROR FEEDBACK / PERMISSION DENIED HANDLING */}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold block">GPS Location Notice</span>
            <p className="text-[11px] text-amber-800 mt-0.5">{errorMessage}</p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                id="btn-retry-location"
                onClick={handleUseCurrentLocation}
                className="px-2.5 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry Current Location</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setErrorMessage('');
                  setShowManualFallback(true);
                }}
                className="px-2.5 py-1 bg-white border border-amber-300 text-amber-900 rounded-lg text-[10px] font-semibold transition"
              >
                Enter Address Manually
              </button>
            </div>
          </div>
        </div>
      )}

      {helperText && !errorMessage && !detectedAddress && !accuracyNotice && (
        <p className="text-[11px] text-stone-400">{helperText}</p>
      )}
    </div>
  );
};

export default AddAddressPicker;
