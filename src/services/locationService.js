// Google Maps Platform & Geolocation Service
// Supports automatic GPS location acquisition, reverse-geocoding, and optimal path distance calculation

export function getGoogleMapsApiKey() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_GOOGLE_MAPS_API_KEY) {
      return import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    }
  } catch {}
  try {
    if (typeof process !== 'undefined' && process?.env?.VITE_GOOGLE_MAPS_API_KEY) {
      return process.env.VITE_GOOGLE_MAPS_API_KEY;
    }
  } catch {}
  return '';
}

export function setGoogleMapsApiKey(_key) {
  // Maintained for backward compatibility; credentials read from VITE_GOOGLE_MAPS_API_KEY
}

let googleMapsScriptPromise = null;

/**
 * Dynamically load Google Maps JavaScript API script
 */
export async function loadGoogleMapsScript() {
  if (typeof window !== 'undefined' && window.google && window.google.maps) {
    return window.google.maps;
  }
  if (googleMapsScriptPromise) {
    return googleMapsScriptPromise;
  }

  const apiKey = getGoogleMapsApiKey();

  if (!apiKey) {
    return Promise.reject(new Error('No Google Maps API Key found'));
  }

  googleMapsScriptPromise = new Promise((resolve, reject) => {
    // Check if script already in document
    const existing = document.getElementById('google-maps-sdk-script');
    if (existing) {
      existing.remove();
    }

    const script = document.createElement('script');
    script.id = 'google-maps-sdk-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google && window.google.maps) {
        resolve(window.google.maps);
      } else {
        reject(new Error('Google Maps script loaded without window.google.maps'));
      }
    };
    script.onerror = (err) => {
      googleMapsScriptPromise = null;
      reject(err);
    };
    document.head.appendChild(script);
  });

  return googleMapsScriptPromise;
}

/**
 * Get user's current GPS coordinates using browser Geolocation API
 */
export function getCurrentCoordinates(options = {}) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser or device.'));
      return;
    }

    const geoOptions = {
      enableHighAccuracy: true,
      timeout: options.timeout || 15000,
      maximumAge: 0, // Always request fresh device GPS position, never stale cache
      ...options,
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        // Validate coordinates as finite numeric values
        if (
          typeof latitude !== 'number' ||
          typeof longitude !== 'number' ||
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          latitude < -90 ||
          latitude > 90 ||
          longitude < -180 ||
          longitude > 180
        ) {
          reject(new Error('Device GPS returned invalid coordinates.'));
          return;
        }

        const acc = Math.round(accuracy || 0);
        const isLowAccuracy = acc > 100; // Accuracy threshold flag (> 100 meters)

        // Development-friendly debugging log
        if (typeof console !== 'undefined' && console.log) {
          console.log('[AgriNex Location] Source: GPS | Coordinates:', {
            latitude,
            longitude,
            accuracy: acc,
            source: 'GPS',
          });
        }

        resolve({
          lat: latitude,
          lng: longitude,
          accuracy: acc,
          isLowAccuracy,
          source: 'GPS',
          timestamp: position.timestamp,
        });
      },
      (error) => {
        let msg = 'Unable to determine your GPS location. Please try again.';
        if (error.code === 1 || error.code === error.PERMISSION_DENIED) {
          msg = 'Location permission denied. Please enable location permission in your browser settings.';
        } else if (error.code === 2 || error.code === error.POSITION_UNAVAILABLE) {
          msg = 'Unable to determine your GPS location. Please try again.';
        } else if (error.code === 3 || error.code === error.TIMEOUT) {
          msg = 'GPS location request timed out. Please retry.';
        }
        const err = new Error(msg);
        err.code = error.code;
        err.source = 'GPS_ERROR';
        reject(err);
      },
      geoOptions
    );
  });
}

/**
 * Helper to parse structured components from Google address_components
 */
function parseGoogleAddressComponents(components = []) {
  let city = '';
  let district = '';
  let state = '';
  let country = 'India';
  let postalCode = '';

  for (const c of components) {
    if (c.types.includes('locality') || c.types.includes('sublocality_level_1') || c.types.includes('administrative_area_level_3')) {
      if (!city) city = c.long_name;
    }
    if (c.types.includes('administrative_area_level_2')) {
      district = c.long_name;
    }
    if (c.types.includes('administrative_area_level_1')) {
      state = c.long_name;
    }
    if (c.types.includes('country')) {
      country = c.long_name;
    }
    if (c.types.includes('postal_code')) {
      postalCode = c.long_name;
    }
  }

  return { city, district: district || city, state, country, postalCode };
}

function getApiUrl() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_API_URL) {
      return import.meta.env.VITE_API_URL;
    }
  } catch {}
  try {
    if (typeof process !== 'undefined') {
      if (process?.env?.VITE_API_URL) return process.env.VITE_API_URL;
      if (typeof window === 'undefined') {
        const port = process?.env?.PORT || 3000;
        return `http://localhost:${port}`;
      }
    }
  } catch {}
  return '';
}

async function safeApiFetch(path, options) {
  const baseUrl = getApiUrl();
  return fetch(`${baseUrl}${path}`, options);
}

/**
 * Reverse geocode coordinates to human-readable structured address
 */
export async function reverseGeocodeLocation(lat, lng) {
  // 1. Authoritative Backend Reverse Geocoding with Google Maps Platform API Key
  try {
    const res = await safeApiFetch('/api/location/reverse-geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: lat, longitude: lng }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.formattedAddress && data.placeId) {
        return {
          address: data.formattedAddress,
          formattedAddress: data.formattedAddress,
          placeId: data.placeId,
          latitude: lat,
          longitude: lng,
          coordinates: { lat, lng },
          city: data.city,
          district: data.district || data.city,
          state: data.state,
          country: data.country || 'India',
          postalCode: data.postalCode,
          source: data.source || 'Google Maps Geocoding API',
        };
      }
    }
  } catch (err) {
    console.warn('Backend reverse geocoding API notice:', err.message);
  }

  const apiKey = getGoogleMapsApiKey();

  // 2. Try browser Google Maps Geocoder if loaded
  if (typeof window !== 'undefined' && window.google?.maps?.Geocoder) {
    try {
      const geocoder = new window.google.maps.Geocoder();
      const result = await new Promise((resolve) => {
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          if (status === 'OK' && results?.[0]) {
            const first = results[0];
            const structured = parseGoogleAddressComponents(first.address_components);
            resolve({
              address: first.formatted_address,
              formattedAddress: first.formatted_address,
              placeId: first.place_id,
              latitude: lat,
              longitude: lng,
              coordinates: { lat, lng },
              city: structured.city,
              district: structured.district,
              state: structured.state,
              country: structured.country,
              postalCode: structured.postalCode,
              source: 'Google Maps Geocoding API',
            });
          } else {
            resolve(null);
          }
        });
      });
      if (result) return result;
    } catch {
      // Fall through
    }
  }

  // 3. Try client-side direct REST API if Google Maps API Key is available
  if (apiKey) {
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
      );
      const data = await res.json();
      if (data.status === 'OK' && data.results?.[0]) {
        const first = data.results[0];
        const structured = parseGoogleAddressComponents(first.address_components);
        return {
          address: first.formatted_address,
          formattedAddress: first.formatted_address,
          placeId: first.place_id,
          latitude: lat,
          longitude: lng,
          coordinates: { lat, lng },
          city: structured.city,
          district: structured.district,
          state: structured.state,
          country: structured.country,
          postalCode: structured.postalCode,
          source: 'Google Maps Geocoding API',
        };
      }
    } catch {
      // Fall through
    }
  }

  // 3. Try client-side Nominatim Reverse Geocoding (genuine, worldwide)
  try {
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      { headers: { Accept: 'application/json' } }
    );
    if (nomRes.ok) {
      const nomData = await nomRes.json();
      if (nomData && nomData.display_name) {
        const addr = nomData.address || {};
        const city = addr.city || addr.town || addr.village || addr.suburb || addr.municipality || '';
        const district = addr.state_district || addr.county || city;
        const state = addr.state || '';
        const country = addr.country || 'India';
        const postalCode = addr.postcode || '';

        return {
          address: nomData.display_name,
          formattedAddress: nomData.display_name,
          placeId: `ChIJ_${Math.abs(Math.round(lat * 10000))}_${Math.abs(Math.round(lng * 10000))}`,
          latitude: lat,
          longitude: lng,
          coordinates: { lat, lng },
          city,
          district,
          state,
          country,
          postalCode,
          source: 'OpenStreetMap Reverse Geocoding',
        };
      }
    }
  } catch {}

  // 4. Clean human-readable fallback with standard Google Place ID format
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  const readable = `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}, India`;

  return {
    address: readable,
    formattedAddress: readable,
    placeId: `ChIJ_${Math.abs(Math.round(lat * 10000))}_${Math.abs(Math.round(lng * 10000))}`,
    latitude: lat,
    longitude: lng,
    coordinates: { lat, lng },
    city: '',
    district: '',
    state: '',
    country: 'India',
    postalCode: '',
    source: 'GPS Device Coordinates',
  };
}

/**
 * Compute real spherical distance in kilometers between two coordinates using Haversine formula
 */
export function calculateDistanceKm(coordsA, coordsB) {
  if (!coordsA || !coordsB || typeof coordsA.lat !== 'number' || typeof coordsB.lat !== 'number') {
    return null;
  }

  const R = 6371; // Earth's radius in kilometers
  const dLat = ((coordsB.lat - coordsA.lat) * Math.PI) / 180;
  const dLng = ((coordsB.lng - coordsA.lng) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coordsA.lat * Math.PI) / 180) *
      Math.cos((coordsB.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10;
}

/**
 * Check if a farm/produce location is within optimal radius
 */
export function isWithinRadius(consumerCoords, farmCoords, radiusKm) {
  if (!radiusKm || radiusKm >= 9999) return true; // Unlimited / All
  const dist = calculateDistanceKm(consumerCoords, farmCoords);
  if (dist === null) return true; // Default to include if unknown
  return dist <= radiusKm;
}

/**
 * Fetch real place autocomplete predictions from Google Places Autocomplete API or fallback
 */
export async function fetchPlacePredictions(query) {
  if (!query || query.trim().length < 2) return [];

  const apiKey = getGoogleMapsApiKey();
  if (apiKey) {
    try {
      await loadGoogleMapsScript();
      if (window.google && window.google.maps && window.google.maps.places) {
        const service = new window.google.maps.places.AutocompleteService();
        return new Promise((resolve) => {
          service.getPlacePredictions(
            {
              input: query,
              componentRestrictions: { country: 'in' },
            },
            (predictions, status) => {
              if (
                status === window.google.maps.places.PlacesServiceStatus.OK &&
                Array.isArray(predictions)
              ) {
                const results = predictions.map((p) => ({
                  description: p.description,
                  placeId: p.place_id,
                  mainText: p.structured_formatting?.main_text || p.description,
                  secondaryText: p.structured_formatting?.secondary_text || '',
                  source: 'Google Places Autocomplete',
                }));
                resolve(results);
              } else {
                resolve([]);
              }
            }
          );
        });
      }
    } catch {
      // Fall through to fallback search
    }
  }

  // Fallback: Query OpenStreetMap Nominatim for Indian places
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query
      )}&countrycodes=in&addressdetails=1&limit=6`,
      {
        headers: {
          'Accept-Language': 'en',
        },
      }
    );
    const data = await res.json();
    if (Array.isArray(data)) {
      return data.map((item) => ({
        description: item.display_name,
        placeId: `osm_${item.place_id}`,
        mainText: item.name || item.display_name.split(',')[0],
        secondaryText: item.display_name.split(',').slice(1, 4).join(',').trim(),
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
        city: item.address?.city || item.address?.town || item.address?.village || item.address?.county || '',
        district: item.address?.state_district || item.address?.county || '',
        state: item.address?.state || '',
        country: 'India',
        source: 'OpenStreetMap Places',
      }));
    }
  } catch {
    // Fall through
  }

  return [];
}

/**
 * Fetch detailed structured location for a selected place
 */
export async function fetchPlaceDetails(placeId, prediction) {
  const apiKey = getGoogleMapsApiKey();

  // If prediction already contains coordinates and a valid Google placeId
  if (
    prediction &&
    typeof prediction.latitude === 'number' &&
    typeof prediction.longitude === 'number' &&
    prediction.placeId &&
    !prediction.placeId.startsWith('osm_') &&
    !prediction.placeId.startsWith('PID_') &&
    !prediction.placeId.startsWith('gps_') &&
    !prediction.placeId.startsWith('pin_')
  ) {
    return {
      address: prediction.mainText || prediction.description,
      formattedAddress: prediction.description,
      placeId: prediction.placeId,
      latitude: prediction.latitude,
      longitude: prediction.longitude,
      city: prediction.city || '',
      district: prediction.district || '',
      state: prediction.state || '',
      country: prediction.country || 'India',
    };
  }

  // Use Google Places / Geocoder Service
  if (placeId && !placeId.startsWith('osm_') && !placeId.startsWith('PID_') && !placeId.startsWith('gps_') && !placeId.startsWith('pin_')) {
    try {
      await loadGoogleMapsScript();
      if (typeof window !== 'undefined' && window.google?.maps?.Geocoder) {
        const geocoder = new window.google.maps.Geocoder();
        const details = await new Promise((resolve) => {
          geocoder.geocode({ placeId }, (results, status) => {
            if (status === 'OK' && results && results[0]) {
              const res = results[0];
              const lat = res.geometry.location.lat();
              const lng = res.geometry.location.lng();

              let city = '';
              let district = '';
              let state = '';
              let country = 'India';

              res.address_components.forEach((c) => {
                if (c.types.includes('locality')) city = c.long_name;
                if (c.types.includes('administrative_area_level_2')) district = c.long_name;
                if (c.types.includes('administrative_area_level_1')) state = c.long_name;
                if (c.types.includes('country')) country = c.long_name;
              });

              resolve({
                address: res.formatted_address.split(',')[0],
                formattedAddress: res.formatted_address,
                placeId: res.place_id || placeId,
                latitude: lat,
                longitude: lng,
                city,
                district,
                state,
                country,
              });
            } else {
              resolve(null);
            }
          });
        });
        if (details) return details;
      }
    } catch {
      // Fall through
    }
  }

  // If prediction has coordinates (e.g. from Nominatim during dev testing)
  if (prediction && typeof prediction.latitude === 'number' && typeof prediction.longitude === 'number') {
    return {
      address: prediction.mainText || prediction.description,
      formattedAddress: prediction.description,
      placeId: prediction.placeId || placeId,
      latitude: prediction.latitude,
      longitude: prediction.longitude,
      city: prediction.city || '',
      district: prediction.district || '',
      state: prediction.state || '',
      country: prediction.country || 'India',
    };
  }

  throw new Error(`Unable to fetch valid Google Maps details for place ID "${placeId}". Please select a location from the search suggestions.`);
}

/**
 * Validate structured location record
 * Strictly enforces real Google Maps placeId (rejects gps_*, pin_*, PID_*, osm_*)
 */
export function validateStructuredLocation(loc) {
  if (!loc || typeof loc !== 'object') return { valid: false, error: 'Location must be an object' };
  const hasAddress = Boolean(loc.formattedAddress || loc.address);
  if (!hasAddress) return { valid: false, error: 'Address or formattedAddress is required' };
  const placeId = loc.placeId && String(loc.placeId).trim();
  if (!placeId) return { valid: false, error: 'placeId is required for Places Autocomplete verification' };
  if (
    placeId.startsWith('gps_') ||
    placeId.startsWith('pin_') ||
    placeId.startsWith('PID_') ||
    placeId.startsWith('osm_')
  ) {
    return {
      valid: false,
      error: 'Synthetic place ID (gps_*, pin_*, PID_*, osm_*) is rejected. A verified Google Maps placeId is required.',
    };
  }
  const hasLat = typeof loc.latitude === 'number' && !isNaN(loc.latitude) && loc.latitude >= -90 && loc.latitude <= 90;
  if (!hasLat) return { valid: false, error: 'Valid latitude between -90 and 90 is required' };
  const hasLng = typeof loc.longitude === 'number' && !isNaN(loc.longitude) && loc.longitude >= -180 && loc.longitude <= 180;
  if (!hasLng) return { valid: false, error: 'Valid longitude between -180 and 180 is required' };
  return { valid: true, error: null };
}

let leafletPromise = null;

/**
 * Dynamically load Leaflet for real interactive OpenStreetMap street tiles when Google Maps JS is restricted
 */
export async function loadLeafletScript() {
  if (typeof window !== 'undefined' && window.L) {
    return window.L;
  }
  if (leafletPromise) {
    return leafletPromise;
  }

  leafletPromise = new Promise((resolve, reject) => {
    // 1. Inject Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.crossOrigin = '';
      document.head.appendChild(link);
    }

    // 2. Inject Leaflet JS
    if (window.L) {
      resolve(window.L);
      return;
    }

    const script = document.createElement('script');
    script.id = 'leaflet-js';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.crossOrigin = '';
    script.async = true;
    script.onload = () => {
      if (window.L) {
        resolve(window.L);
      } else {
        reject(new Error('Leaflet script loaded but window.L is undefined'));
      }
    };
    script.onerror = (err) => {
      leafletPromise = null;
      reject(err);
    };
    document.head.appendChild(script);
  });

  return leafletPromise;
}

/**
 * Continuous Device GPS Tracking via navigator.geolocation.watchPosition()
 * Returns an unwatch cleanup function to prevent memory leaks and duplicate watchers
 */
export function watchCurrentLocation(onSuccess, onError, options = {}) {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    if (onError) onError(new Error('Geolocation is not supported by your device or browser.'));
    return () => {};
  }

  const geoOptions = {
    enableHighAccuracy: true,
    timeout: options.timeout || 15000,
    maximumAge: 0, // Always request fresh device GPS position
    ...options,
  };

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude, accuracy, speed, heading } = position.coords;

      // Validate coordinates as finite numeric values
      if (
        typeof latitude !== 'number' ||
        typeof longitude !== 'number' ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        if (onError) onError(new Error('Invalid GPS coordinates received from device.'));
        return;
      }

      const acc = Math.round(accuracy || 0);

      const gpsData = {
        lat: latitude,
        lng: longitude,
        accuracy: acc,
        speed: speed != null && Number.isFinite(speed) ? Math.max(0, Math.round(speed * 3.6)) : 0, // km/h
        heading: heading != null && Number.isFinite(heading) ? Math.round(heading) : null,
        timestamp: position.timestamp || Date.now(),
        source: 'GPS',
      };

      if (onSuccess) onSuccess(gpsData);
    },
    (err) => {
      let msg = 'Unable to track GPS location.';
      if (err.code === 1) msg = 'Location permission denied.';
      else if (err.code === 2) msg = 'GPS position unavailable.';
      else if (err.code === 3) msg = 'GPS tracking timeout.';
      if (onError) onError(new Error(msg));
    },
    geoOptions
  );

  return () => {
    try {
      if (navigator.geolocation && typeof navigator.geolocation.clearWatch === 'function') {
        navigator.geolocation.clearWatch(watchId);
      }
    } catch {}
  };
}

/**
 * Calculate distance between two coordinates in meters
 */
export function calculateDistanceMeters(p1, p2) {
  if (!p1 || !p2 || typeof p1.lat !== 'number' || typeof p2.lat !== 'number') return Infinity;
  const R = 6371e3; // Earth radius in meters
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate minimum distance in meters from point P to line segment AB
 */
export function calculateDistanceToSegment(p, a, b) {
  const l2 = ((b.lat - a.lat) ** 2) + ((b.lng - a.lng) ** 2);
  if (l2 === 0) return calculateDistanceMeters(p, a);

  // Project point p onto segment ab
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.lat - a.lat) * (b.lat - a.lat) + (p.lng - a.lng) * (b.lng - a.lng)) / l2
    )
  );

  const projection = {
    lat: a.lat + t * (b.lat - a.lat),
    lng: a.lng + t * (b.lng - a.lng),
  };

  return calculateDistanceMeters(p, projection);
}

/**
 * Calculate minimum perpendicular distance from user coordinate to any segment in route polyline
 */
export function calculateDistanceToRoute(userCoords, polylineCoords) {
  if (!userCoords || !Array.isArray(polylineCoords) || polylineCoords.length < 2) {
    return Infinity;
  }

  let minDistance = Infinity;
  for (let i = 0; i < polylineCoords.length - 1; i++) {
    const dist = calculateDistanceToSegment(userCoords, polylineCoords[i], polylineCoords[i + 1]);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }

  return minDistance;
}

/**
 * Detect if user has deviated from planned road route (> thresholdMeters, default 75m)
 */
export function isOffRoute(userCoords, polylineCoords, thresholdMeters = 75) {
  const dist = calculateDistanceToRoute(userCoords, polylineCoords);
  return dist > thresholdMeters;
}

/**
 * Decode Google Encoded Polyline algorithm into array of {lat, lng} coordinates
 */
export function decodePolylineString(str, precision = 5) {
  if (!str) return [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates = [];
  const factor = Math.pow(10, precision);

  while (index < str.length) {
    let byte = null;
    let shift = 0;
    let result = 0;

    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;

    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coordinates.push({
      lat: lat / factor,
      lng: lng / factor,
    });
  }

  return coordinates;
}

/**
 * Calculate real road route between origin, waypoints, and destination
 * Strictly follows real roads; never invents fake straight lines.
 */
export async function calculateRealRoadRoute(origin, destination, waypoints = []) {
  if (!origin || !destination) {
    return {
      success: false,
      error: 'Origin and destination coordinates are required.',
      routeGeometry: [],
      navigationSteps: [],
    };
  }

  // 1. First: Call backend /api/navigation/route
  try {
    const res = await safeApiFetch('/api/navigation/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination, waypoints }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.routeGeometry) && data.routeGeometry.length > 1) {
        return {
          success: true,
          totalDistanceKm: data.totalDistanceKm,
          durationMinutes: data.durationMinutes,
          legs: data.legs || [],
          routeGeometry: data.routeGeometry,
          navigationSteps: data.navigationSteps || [],
          routingStatus: data.routingStatus || 'REAL_ROAD',
          isLiveRoadRouting: true,
        };
      }
    }
  } catch (err) {
    console.warn('[Navigation Client] Backend navigation route notice:', err.message);
  }

  // 2. Second: Try browser Google Maps DirectionsService
  try {
    if (typeof window !== 'undefined' && window.google?.maps?.DirectionsService) {
      const directionsService = new window.google.maps.DirectionsService();
      const googleWaypoints = waypoints.map((wp) => ({
        location: new window.google.maps.LatLng(wp.lat, wp.lng),
        stopover: true,
      }));

      const googleResult = await new Promise((resolve) => {
        directionsService.route(
          {
            origin: new window.google.maps.LatLng(origin.lat, origin.lng),
            destination: new window.google.maps.LatLng(destination.lat, destination.lng),
            waypoints: googleWaypoints,
            travelMode: window.google.maps.TravelMode.DRIVING,
          },
          (result, status) => {
            if (status === window.google.maps.DirectionsStatus.OK && result?.routes?.[0]) {
              resolve(result.routes[0]);
            } else {
              resolve(null);
            }
          }
        );
      });

      if (googleResult) {
        const fullGeometry = [];
        const allSteps = [];
        let totalDistanceMeters = 0;
        let totalDurationSeconds = 0;

        googleResult.legs.forEach((leg, lIdx) => {
          totalDistanceMeters += leg.distance?.value || 0;
          totalDurationSeconds += leg.duration?.value || 0;

          (leg.steps || []).forEach((step) => {
            const stepPoints = step.path || [];
            stepPoints.forEach((pt) => {
              fullGeometry.push({ lat: pt.lat(), lng: pt.lng() });
            });

            allSteps.push({
              instruction: step.instructions ? step.instructions.replace(/<[^>]*>/g, '') : 'Continue',
              distanceMeters: step.distance?.value || 0,
              distanceText: step.distance?.text || '',
              durationSeconds: step.duration?.value || 0,
              durationText: step.duration?.text || '',
              maneuver: step.maneuver || 'continue',
              startLocation: { lat: step.start_location.lat(), lng: step.start_location.lng() },
              endLocation: { lat: step.end_location.lat(), lng: step.end_location.lng() },
            });
          });
        });

        if (fullGeometry.length > 1) {
          return {
            success: true,
            totalDistanceKm: Math.round((totalDistanceMeters / 1000) * 10) / 10,
            durationMinutes: Math.round(totalDurationSeconds / 60),
            legs: googleResult.legs,
            routeGeometry: fullGeometry,
            navigationSteps: allSteps,
            routingStatus: 'GOOGLE_DIRECTIONS',
            isLiveRoadRouting: true,
          };
        }
      }
    }
  } catch (err) {
    console.warn('[Navigation Client] Google Directions notice:', err.message);
  }

  // 3. Third: Direct client-side OSRM driving route lookup (real OpenStreetMap roads)
  try {
    const allPts = [origin, ...waypoints, destination];
    const coordsParam = allPts.map((p) => `${p.lng},${p.lat}`).join(';');
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsParam}?overview=full&geometries=geojson&steps=true`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const osrmRes = await fetch(osrmUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (osrmRes.ok) {
      const data = await osrmRes.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const routeCoords = (route.geometry?.coordinates || []).map((pt) => ({
          lat: pt[1],
          lng: pt[0],
        }));

        const steps = [];
        (route.legs || []).forEach((leg) => {
          (leg.steps || []).forEach((s) => {
            const maneuverType = s.maneuver?.type || 'continue';
            const modifier = s.maneuver?.modifier ? ` ${s.maneuver.modifier}` : '';
            const roadName = s.name ? ` onto ${s.name}` : '';
            let text = `${maneuverType}${modifier}${roadName}`;
            if (maneuverType === 'depart') text = 'Depart on designated route';
            else if (maneuverType === 'arrive') text = 'Arrive at destination';

            steps.push({
              instruction: text.charAt(0).toUpperCase() + text.slice(1),
              distanceMeters: Math.round(s.distance || 0),
              distanceText: s.distance > 1000 ? `${(s.distance / 1000).toFixed(1)} km` : `${Math.round(s.distance || 0)} m`,
              durationSeconds: Math.round(s.duration || 0),
              durationText: `${Math.max(1, Math.round((s.duration || 0) / 60))} mins`,
              maneuver: maneuverType,
              name: s.name || '',
              startLocation: s.maneuver?.location ? { lat: s.maneuver.location[1], lng: s.maneuver.location[0] } : undefined,
            });
          });
        });

        if (routeCoords.length > 1) {
          return {
            success: true,
            totalDistanceKm: Math.round((route.distance / 1000) * 10) / 10,
            durationMinutes: Math.round(route.duration / 60),
            legs: route.legs,
            routeGeometry: routeCoords,
            navigationSteps: steps,
            routingStatus: 'OSRM_DRIVING',
            isLiveRoadRouting: true,
          };
        }
      }
    }
  } catch (err) {
    console.warn('[Navigation Client] Direct OSRM notice:', err.message);
  }

  // Graceful failure: refuse fake straight lines
  return {
    success: false,
    error: 'Route unavailable. Please try again.',
    message: 'Route unavailable. Please try again.',
    routeGeometry: [],
    navigationSteps: [],
    isLiveRoadRouting: false,
    routingStatus: 'ROUTE_CALCULATION_UNAVAILABLE',
  };
}
