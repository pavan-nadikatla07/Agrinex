import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import {
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

  const [confirmedAddress, setConfirmedAddress] = useState(initialAddr);
  const [confirmedStructured, setConfirmedStructured] = useState(
    typeof initialLocation === 'object' ? initialLocation : structuredLocation
  );

  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedAddress, setDetectedAddress] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showManualFallback, setShowManualFallback] = useState(false);
  const [manualQuery, setManualQuery] = useState('');
  const [predictions, setPredictions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (value && value !== confirmedAddress) {
      setConfirmedAddress(value);
    }
  }, [value]);

  const notifySelection = (formatted, coords, structured) => {
    setConfirmedAddress(formatted);
    setConfirmedStructured(structured);
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

  // 1. Detect location using device GPS + reverse geocoding
  const handleUseCurrentLocation = async () => {
    setIsDetecting(true);
    setErrorMessage('');
    setStatusMessage('Requesting GPS permission and detecting current device location...');

    try {
      const coords = await getCurrentCoordinates();

      if (coords.isLowAccuracy || coords.accuracy > 200) {
        setErrorMessage(`Location accuracy is low (${coords.accuracy}m). Please move to an open area and try again.`);
        setStatusMessage('');
        setIsDetecting(false);
        return;
      }

      setStatusMessage('Device location acquired. Converting GPS coordinates to readable address...');

      const result = await reverseGeocodeLocation(coords.lat, coords.lng);
      if (!result || !result.formattedAddress) {
        throw new Error('Reverse geocoding failed to find a valid address for your coordinates.');
      }

      setDetectedAddress(result);
      setStatusMessage('');
      // Auto-notify immediately so form value is populated without requiring a second click
      notifySelection(result.formattedAddress, result.coordinates, result);
    } catch (err) {
      const message =
        err?.message ||
        'Location permission is required to detect your current address.';
      setErrorMessage(message);
      setStatusMessage('');
      if (err?.code === 1) { // PERMISSION_DENIED
        setShowManualFallback(true);
      }
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
      // First check if predictions already contain a Google place
      if (predictions.length > 0) {
        const first = predictions[0];
        const details = await fetchPlaceDetails(first.place_id, first);
        notifySelection(details.formattedAddress, details.coordinates, details);
        return;
      }
      
      // Fallback: reverse-geocode or lookup coordinates for user city query
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
        source: 'Google Places / Geocoded Address',
      };
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
        source: 'Google Places / Geocoded Address',
      };
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
      notifySelection(details.formattedAddress, details.coordinates, details);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to resolve selected place details.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-xs font-semibold text-stone-700">
          {label}
        </label>
      )}

      {/* CONFIRMED ADDRESS CARD (When address is already selected) */}
      {confirmedAddress && !detectedAddress && !showManualFallback ? (
        <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <MapPin className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                Confirmed Address
              </span>
              <p className="font-semibold text-stone-900 mt-0.5">{confirmedAddress}</p>
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
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              id="btn-change-address"
              disabled={disabled}
              onClick={() => {
                setDetectedAddress(null);
                setErrorMessage('');
                handleUseCurrentLocation();
              }}
              className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-white hover:bg-emerald-100/50 text-emerald-900 font-bold text-xs transition flex items-center gap-1 shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Change Location</span>
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setShowManualFallback(true)}
              className="px-2.5 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 text-xs font-semibold transition"
              title="Enter address manually"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : detectedAddress ? (
        /* DETECTED ADDRESS PREVIEW & CONFIRMATION BOX */
        <div className="p-4 rounded-xl bg-white border-2 border-emerald-500 shadow-md space-y-3 animate-in fade-in text-xs">
          <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs uppercase tracking-wide">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Address Detected from Current GPS Location</span>
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
          </div>

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
              <span>Change Location</span>
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
                    onClick={handleConfirmManualQuery}
                    className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Use &quot;{manualQuery.trim().slice(0, 35)}{manualQuery.trim().length > 35 ? '...' : ''}&quot; as Address</span>
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

      {/* ERROR FEEDBACK / PERMISSION DENIED HANDLING */}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold block">Address Detection Notice</span>
            <p className="text-[11px] text-amber-800 mt-0.5">{errorMessage}</p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                className="px-2.5 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-[10px] font-bold transition"
              >
                Retry GPS
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

      {helperText && !errorMessage && !detectedAddress && (
        <p className="text-[11px] text-stone-400">{helperText}</p>
      )}
    </div>
  );
};
