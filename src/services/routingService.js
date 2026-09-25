// Centralized Real-Road Routing, Navigation & Telemetry Service
// Strictly uses real highway & road network data (Google Directions / Routes API & OSRM)
// Rejects straight lines, fake curves, and synthetic coordinates.

import {
  loadGoogleMapsScript,
  calculateDistanceMeters,
  calculateDistanceToSegment,
  calculateDistanceToRoute,
} from './locationService';

function getApiUrl() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_API_URL) {
      return import.meta.env.VITE_API_URL;
    }
  } catch {}
  try {
    if (typeof process !== 'undefined' && process?.env?.VITE_API_URL) {
      return process.env.VITE_API_URL;
    }
  } catch {}
  return '';
}

async function safeApiFetch(path, options) {
  const baseUrl = getApiUrl();
  return fetch(`${baseUrl}${path}`, options);
}

/**
 * Validate geographic coordinate object
 */
export function isValidCoordinate(coord) {
  return (
    coord != null &&
    typeof coord.lat === 'number' &&
    typeof coord.lng === 'number' &&
    Number.isFinite(coord.lat) &&
    Number.isFinite(coord.lng) &&
    coord.lat >= -90 &&
    coord.lat <= 90 &&
    coord.lng >= -180 &&
    coord.lng <= 180
  );
}

/**
 * Decode Google Encoded Polyline algorithm into array of {lat, lng} coordinates
 */
export function decodePolyline(str, precision = 5) {
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
 * Format maneuver into a natural turn-by-turn instruction
 */
function formatInstruction(step) {
  if (step.instructions) {
    return step.instructions.replace(/<[^>]*>/g, '').trim();
  }
  const maneuver = (step.maneuver?.type || 'continue').toLowerCase();
  const modifier = step.maneuver?.modifier ? ` ${step.maneuver.modifier}` : '';
  const road = step.name ? ` onto ${step.name}` : '';

  if (maneuver === 'depart') return 'Depart along designated road corridor';
  if (maneuver === 'arrive') return 'Arrive at destination';
  if (maneuver === 'turn') return `Turn${modifier}${road}`;
  if (maneuver === 'fork') return `Take the fork${modifier}${road}`;
  if (maneuver === 'merge') return `Merge${modifier}${road}`;
  if (maneuver === 'roundabout') return `Enter roundabout and take exit${road}`;
  return `Continue${modifier}${road}`;
}

/**
 * 1. getRoute: Request real road route between origin and destination with optional waypoints
 * Employs 3 layers of real road networks (Backend -> Google Maps JS -> OSRM)
 * Refuses fake straight-line geometry
 */
export async function getRoute(origin, destination, options = {}) {
  if (!isValidCoordinate(origin) || !isValidCoordinate(destination)) {
    return {
      success: false,
      error: 'Invalid coordinates provided. Valid origin and destination coordinates are required.',
      routeGeometry: [],
      steps: [],
      distanceKm: 0,
      durationMinutes: 0,
      isLiveRoadRouting: false,
    };
  }

  const waypoints = (options.waypoints || []).filter(isValidCoordinate);

  // Layer 1: Call Backend Real Road Navigation API
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
          routeGeometry: data.routeGeometry,
          steps: data.navigationSteps || [],
          distanceKm: data.totalDistanceKm,
          distanceMeters: Math.round(data.totalDistanceKm * 1000),
          durationMinutes: data.durationMinutes,
          durationSeconds: data.durationMinutes * 60,
          legs: data.legs || [],
          routingStatus: data.routingStatus || 'BACKEND_ROAD_SERVICE',
          isLiveRoadRouting: true,
        };
      }
    }
  } catch (err) {
    console.warn('[Routing Service] Backend route endpoint warning:', err.message);
  }

  // Layer 2: Browser Google Maps DirectionsService
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
              instruction: formatInstruction(step),
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
            routeGeometry: fullGeometry,
            steps: allSteps,
            distanceKm: Math.round((totalDistanceMeters / 1000) * 10) / 10,
            distanceMeters: totalDistanceMeters,
            durationMinutes: Math.round(totalDurationSeconds / 60),
            durationSeconds: totalDurationSeconds,
            legs: googleResult.legs,
            routingStatus: 'GOOGLE_DIRECTIONS',
            isLiveRoadRouting: true,
          };
        }
      }
    }
  } catch (err) {
    console.warn('[Routing Service] Browser Google Directions warning:', err.message);
  }

  // Layer 3: Direct Client-Side OSRM Driving Service (Real OpenStreetMap Roads)
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
            const instr = formatInstruction(s);
            steps.push({
              instruction: instr.charAt(0).toUpperCase() + instr.slice(1),
              distanceMeters: Math.round(s.distance || 0),
              distanceText:
                s.distance > 1000
                  ? `${(s.distance / 1000).toFixed(1)} km`
                  : `${Math.round(s.distance || 0)} m`,
              durationSeconds: Math.round(s.duration || 0),
              durationText: `${Math.max(1, Math.round((s.duration || 0) / 60))} mins`,
              maneuver: s.maneuver?.type || 'continue',
              name: s.name || '',
              startLocation: s.maneuver?.location
                ? { lat: s.maneuver.location[1], lng: s.maneuver.location[0] }
                : undefined,
            });
          });
        });

        if (routeCoords.length > 1) {
          return {
            success: true,
            routeGeometry: routeCoords,
            steps,
            distanceKm: Math.round((route.distance / 1000) * 10) / 10,
            distanceMeters: Math.round(route.distance),
            durationMinutes: Math.round(route.duration / 60),
            durationSeconds: Math.round(route.duration),
            legs: route.legs,
            routingStatus: 'OSRM_DRIVING',
            isLiveRoadRouting: true,
          };
        }
      }
    }
  } catch (err) {
    console.warn('[Routing Service] Client OSRM warning:', err.message);
  }

  // Graceful API failure: Never invent fake routes
  return {
    success: false,
    error: 'Route unavailable. Please try again.',
    routeGeometry: [],
    steps: [],
    distanceKm: 0,
    durationMinutes: 0,
    isLiveRoadRouting: false,
    routingStatus: 'ROUTE_UNAVAILABLE',
  };
}

/**
 * 2. getRouteSteps: Extract navigation steps from calculated route object
 */
export function getRouteSteps(route) {
  if (!route) return [];
  return Array.isArray(route.steps) ? route.steps : [];
}

/**
 * 3. getDistance: Extract distance metrics from route
 */
export function getDistance(route) {
  const km = route?.distanceKm || 0;
  const meters = route?.distanceMeters || Math.round(km * 1000);
  return {
    distanceKm: km,
    distanceMeters: meters,
    distanceText: km >= 1 ? `${km.toFixed(1)} km` : `${meters} m`,
  };
}

/**
 * 4. getDuration: Extract duration metrics from route
 */
export function getDuration(route) {
  const minutes = route?.durationMinutes || 0;
  const seconds = route?.durationSeconds || minutes * 60;
  return {
    durationMinutes: minutes,
    durationSeconds: seconds,
    durationText: minutes > 60 ? `${Math.floor(minutes / 60)} hr ${minutes % 60} mins` : `${minutes} mins`,
  };
}

/**
 * 5. isOffRoute: Detect if user has deviated from planned road route
 * Calculates shortest perpendicular distance to route polyline segments
 */
export function isOffRoute(currentLocation, route, thresholdMeters = 75) {
  if (!isValidCoordinate(currentLocation)) {
    return { isOff: false, distanceMeters: 0 };
  }

  const polyline = Array.isArray(route?.routeGeometry)
    ? route.routeGeometry
    : Array.isArray(route)
    ? route
    : [];

  if (polyline.length < 2) {
    return { isOff: false, distanceMeters: 0 };
  }

  const dist = calculateDistanceToRoute(currentLocation, polyline);
  return {
    isOff: dist > thresholdMeters,
    distanceMeters: Math.round(dist),
  };
}

/**
 * 6. getNextInstruction: Find active step & next upcoming maneuver based on current GPS location
 */
export function getNextInstruction(currentLocation, route) {
  const steps = getRouteSteps(route);
  if (!steps.length) {
    return {
      currentStep: null,
      nextStep: null,
      stepIndex: 0,
      distanceToManeuverMeters: 0,
    };
  }

  if (!isValidCoordinate(currentLocation)) {
    return {
      currentStep: steps[0],
      nextStep: steps[1] || null,
      stepIndex: 0,
      distanceToManeuverMeters: steps[0]?.distanceMeters || 0,
    };
  }

  // Find the step whose startLocation is closest or next ahead
  let nearestIdx = 0;
  let minDistance = Infinity;

  steps.forEach((step, idx) => {
    if (step.startLocation) {
      const d = calculateDistanceMeters(currentLocation, step.startLocation);
      if (d < minDistance) {
        minDistance = d;
        nearestIdx = idx;
      }
    }
  });

  return {
    currentStep: steps[nearestIdx] || steps[0],
    nextStep: steps[nearestIdx + 1] || null,
    stepIndex: nearestIdx,
    distanceToManeuverMeters: Math.round(minDistance),
  };
}

/**
 * 7. recalculateRoute: Re-route from current GPS location to destination
 */
export async function recalculateRoute(currentLocation, destination, options = {}) {
  return getRoute(currentLocation, destination, options);
}

/**
 * 8. calculateMultiStopRoute: Calculate multi-stop road route (e.g. Buyer Transport picking up multiple farmers)
 */
export async function calculateMultiStopRoute(stops = [], options = {}) {
  const validStops = stops.filter(isValidCoordinate);
  if (validStops.length < 2) {
    return {
      success: false,
      error: 'At least 2 valid stops are required for multi-stop routing.',
      routeGeometry: [],
      steps: [],
      distanceKm: 0,
      durationMinutes: 0,
    };
  }

  const origin = validStops[0];
  const destination = validStops[validStops.length - 1];
  const waypoints = validStops.slice(1, -1);

  return getRoute(origin, destination, { ...options, waypoints });
}

/**
 * 9. calculateRouteProgress: Calculate progression along actual road geometry
 */
export function calculateRouteProgress(currentLocation, route) {
  const polyline = Array.isArray(route?.routeGeometry)
    ? route.routeGeometry
    : Array.isArray(route)
    ? route
    : [];

  const totalDistanceKm = route?.distanceKm || 0;
  const totalDurationMinutes = route?.durationMinutes || 0;

  if (polyline.length < 2 || !isValidCoordinate(currentLocation)) {
    return {
      distanceTraveledKm: 0,
      distanceRemainingKm: totalDistanceKm,
      percentCompleted: 0,
      etaMinutesRemaining: totalDurationMinutes,
      nearestPoint: polyline[0] || null,
    };
  }

  // Find nearest segment index on route polyline
  let nearestSegmentIdx = 0;
  let minSegmentDist = Infinity;
  let nearestPoint = polyline[0];

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const d = calculateDistanceToSegment(currentLocation, a, b);
    if (d < minSegmentDist) {
      minSegmentDist = d;
      nearestSegmentIdx = i;

      // Project onto segment
      const l2 = (b.lat - a.lat) ** 2 + (b.lng - a.lng) ** 2;
      const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((currentLocation.lat - a.lat) * (b.lat - a.lat) + (currentLocation.lng - a.lng) * (b.lng - a.lng)) / l2));
      nearestPoint = {
        lat: a.lat + t * (b.lat - a.lat),
        lng: a.lng + t * (b.lng - a.lng),
      };
    }
  }

  // Total polyline length in meters
  let totalPolylineMeters = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    totalPolylineMeters += calculateDistanceMeters(polyline[i], polyline[i + 1]);
  }
  if (totalPolylineMeters === 0) totalPolylineMeters = (route?.distanceKm || 1) * 1000;

  // Remaining meters from nearest point along polyline to destination
  let remainingMeters = calculateDistanceMeters(nearestPoint, polyline[nearestSegmentIdx + 1]);
  for (let i = nearestSegmentIdx + 1; i < polyline.length - 1; i++) {
    remainingMeters += calculateDistanceMeters(polyline[i], polyline[i + 1]);
  }
  remainingMeters = Math.min(totalPolylineMeters, Math.max(0, remainingMeters));

  const traveledRatio = Math.max(0, Math.min(1, (totalPolylineMeters - remainingMeters) / totalPolylineMeters));
  const percentCompleted = Math.round(traveledRatio * 100);

  const effectiveTotalKm = route?.distanceKm || Math.round((totalPolylineMeters / 1000) * 10) / 10;
  const remainingKm = Math.round(effectiveTotalKm * (1 - traveledRatio) * 10) / 10;
  const traveledKm = Math.round((effectiveTotalKm - remainingKm) * 10) / 10;
  const etaMinutesRemaining = Math.max(
    0,
    Math.round(totalDurationMinutes * (1 - traveledRatio))
  );

  return {
    distanceTraveledKm: traveledKm,
    distanceRemainingKm: remainingKm,
    percentCompleted,
    etaMinutesRemaining,
    nearestPoint,
    nearestSegmentIdx,
  };
}

export default {
  getRoute,
  getRouteSteps,
  getDistance,
  getDuration,
  isOffRoute,
  getNextInstruction,
  recalculateRoute,
  calculateMultiStopRoute,
  calculateRouteProgress,
  isValidCoordinate,
  decodePolyline,
};
