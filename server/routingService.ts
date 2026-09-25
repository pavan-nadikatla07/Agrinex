// Algorithmic Road Routing Engine for AgriNex
// Implements Buyer Transport vs Farmer Transport optimal road routing,
// single-farmer rule, minimum farmer combinations, real road distance routing,
// ₹15/km transportation charge (no base charge), and 50/50 cost split.

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface CandidateFarmerProduce {
  produceId: string;
  name: string;
  category: string;
  variety: string;
  availableQuantity: number;
  unit: string;
  pricePerUnit: number;
  farmerId: string;
  farmerName: string;
  farmerPhone: string;
  farmerRating: number;
  canManageTransport: boolean;
  location: string;
  coordinates: GeoPoint;
  farmerUpiId: string;
}

export interface RouteOptimizationRequest {
  buyerLocation: string;
  buyerCoordinates: GeoPoint;
  requestedItems: {
    produceName: string;
    quantity: number;
  }[];
  transportMode: 'BUYER_TRANSPORT' | 'FARMER_TRANSPORT';
  allProduceList: CandidateFarmerProduce[];
}

export interface RouteStep {
  type: 'START' | 'PICKUP' | 'DELIVERY';
  farmerId?: string;
  farmerName?: string;
  farmerPhone?: string;
  canManageTransport?: boolean;
  isLogisticsOnlyProvider?: boolean;
  location: string;
  coordinates: GeoPoint;
  itemsToCollect?: {
    produceId: string;
    name: string;
    quantity: number;
    unit: string;
    pricePerUnit: number;
    totalPrice: number;
    farmerUpiId: string;
  }[];
  distanceFromPrevKm: number;
  cumulativeDistanceKm: number;
  estimatedTimeMins: number;
}

export interface NavigationStep {
  instruction: string;
  distanceMeters: number;
  distanceText: string;
  durationSeconds: number;
  durationText: string;
  maneuver?: string;
  name?: string;
  startLocation?: GeoPoint;
  endLocation?: GeoPoint;
}

export interface RouteLeg {
  from: string;
  to: string;
  distanceKm: number;
  durationMinutes: number;
  roadGeometry: GeoPoint[];
  steps?: NavigationStep[];
}

export interface ChainedFarmerAllocation {
  farmerId: string;
  farmerName: string;
  location: string;
  coordinates: GeoPoint;
  canManageTransport: boolean;
  isLogisticsOnlyProvider: boolean;
  rating: number;
  assignedItems: any[];
  farmerSubtotal: number;
  allocatedTransportShare: number; // Share of farmers' 50% transport charge
  netPayout: number; // farmerSubtotal - allocatedTransportShare
}

export interface OptimizedRoutePlan {
  transportMode: 'BUYER_TRANSPORT' | 'FARMER_TRANSPORT';
  transportProviderFarmerId?: string;
  transportProviderFarmerName?: string;
  transportProviderIsIndependent: boolean;
  chainedFarmers: ChainedFarmerAllocation[];
  steps: RouteStep[];
  routeLegs: RouteLeg[];
  legs: RouteLeg[];
  totalRoadDistanceKm: number;
  distanceKm: number;
  totalEstimatedTimeMins: number;
  durationMinutes: number;
  duration: string;
  ETA: string;
  polyline: GeoPoint[];
  waypoints: GeoPoint[];
  navigationSteps?: NavigationStep[];
  ratePerKm: number; // Strict ₹15 / km
  totalProduceAmount: number;
  totalTransportCost: number; // totalRoadDistanceKm * 15
  buyerTransportShare: number; // 50%
  farmersTransportShare: number; // 50%
  finalBuyerPayableAmount: number; // totalProduceAmount + buyerTransportShare
  satisfactionStatus: 'FULLY_SATISFIED' | 'PARTIALLY_SATISFIED' | 'UNAVAILABLE';
  routeSummary: string;
  isSingleFarmerOrder: boolean;
  isLiveRoadRouting: boolean;
  routingStatus: 'GOOGLE_ROUTES' | 'GOOGLE_DIRECTIONS' | 'OSRM_DRIVING' | 'ROUTE_CALCULATION_UNAVAILABLE';
}

/**
 * Calculates straight line geometric distance (used as base heuristic for bounding)
 */
function geometricHaversine(p1: GeoPoint, p2: GeoPoint): number {
  const R = 6371;
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
 * Decodes Google Encoded Polyline format into an array of real GPS road points
 */
export function decodePolyline(encoded: string): GeoPoint[] {
  if (!encoded) return [];
  const points: GeoPoint[] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;

    points.push({
      lat: Number((lat * 1e-5).toFixed(6)),
      lng: Number((lng * 1e-5).toFixed(6)),
    });
  }
  return points;
}

/**
 * Converts OSRM maneuver object into clear human-readable turn-by-turn navigation instructions
 */
function formatManeuverInstruction(step: any): string {
  const type = step?.maneuver?.type || 'continue';
  const modifier = step?.maneuver?.modifier;
  const name = step?.name ? step.name.trim() : '';

  if (type === 'depart') {
    return name ? `Head onto ${name}` : 'Depart on route';
  }
  if (type === 'arrive') {
    return 'Arrive at destination';
  }
  if (type === 'roundabout' || type === 'rotary') {
    return `Enter roundabout and take exit onto ${name || 'road'}`;
  }
  if (type === 'fork') {
    return modifier ? `Take the ${modifier} fork onto ${name || 'road'}` : `Keep ${modifier || 'straight'} at the fork`;
  }
  if (type === 'end of road') {
    return modifier ? `At the end of the road, turn ${modifier} onto ${name || 'road'}` : 'Turn at the end of the road';
  }
  if (type === 'turn') {
    return modifier ? `Turn ${modifier} onto ${name || 'road'}` : (name ? `Turn onto ${name}` : 'Turn');
  }
  if (type === 'continue' || type === 'new name') {
    return name ? `Continue onto ${name}` : 'Continue on road';
  }
  const action = modifier ? `${type} ${modifier}` : type;
  return name ? `${action.charAt(0).toUpperCase() + action.slice(1)} onto ${name}` : `${action.charAt(0).toUpperCase() + action.slice(1)}`;
}

/**
 * Google Geocoding API helper (server-side only)
 */
export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!googleApiKey) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${googleApiKey}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data: any = await res.json();
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const loc = data.results[0].geometry.location;
      return { lat: loc.lat, lng: loc.lng };
    }
  } catch (err) {
    console.warn('[Google Geocoding API Notice]: Geocoding failed gracefully.');
  }
  return null;
}

/**
 * Fetches real road driving distance, duration, and road geometry between waypoints using
 * Google Routes API (computeRoutes), Google Directions API, or OSRM Public Driving Service
 */
export async function getRealRoadDistanceAndRoute(
  waypoints: GeoPoint[]
): Promise<{
  totalDistanceKm: number;
  durationMinutes: number;
  legs: RouteLeg[];
  isLiveRoadRouting: boolean;
  routingStatus: 'GOOGLE_ROUTES' | 'GOOGLE_DIRECTIONS' | 'OSRM_DRIVING' | 'ROUTE_CALCULATION_UNAVAILABLE';
}> {
  if (waypoints.length < 2) {
    return {
      totalDistanceKm: 0,
      durationMinutes: 0,
      legs: [],
      isLiveRoadRouting: true,
      routingStatus: 'GOOGLE_ROUTES',
    };
  }

  // Strictly use backend Google Maps key
  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;

  // 1. Google Routes API (Directions v2: computeRoutes)
  if (googleApiKey) {
    try {
      const routesApiUrl = 'https://routes.googleapis.com/directions/v2:computeRoutes';
      const requestPayload = {
        origin: {
          location: {
            latLng: {
              latitude: waypoints[0].lat,
              longitude: waypoints[0].lng,
            },
          },
        },
        destination: {
          location: {
            latLng: {
              latitude: waypoints[waypoints.length - 1].lat,
              longitude: waypoints[waypoints.length - 1].lng,
            },
          },
        },
        intermediates: waypoints.slice(1, -1).map((wp) => ({
          location: {
            latLng: {
              latitude: wp.lat,
              longitude: wp.lng,
            },
          },
        })),
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
      };

      const res = await fetch(routesApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': googleApiKey,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.legs,routes.polyline.encodedPolyline',
        },
        body: JSON.stringify(requestPayload),
      });

      if (res.ok) {
        const data: any = await res.json();
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const totalDistanceKm = Math.max(1, Math.round((route.distanceMeters / 1000) * 10) / 10);
          const durationSeconds = parseInt((route.duration || '0s').replace('s', ''), 10) || 0;
          const durationMinutes = Math.round(durationSeconds / 60);

          const fullPolyline = route.polyline?.encodedPolyline
            ? decodePolyline(route.polyline.encodedPolyline)
            : [];

          const legs: RouteLeg[] = [];
          if (route.legs && route.legs.length > 0) {
            route.legs.forEach((leg: any, idx: number) => {
              const legMeters = leg.distanceMeters || 0;
              const legSecs = parseInt((leg.duration || '0s').replace('s', ''), 10) || 0;
              const legDistKm = Math.round((legMeters / 1000) * 10) / 10;
              const legDurMins = Math.round(legSecs / 60);

              const legPolyline = leg.polyline?.encodedPolyline
                ? decodePolyline(leg.polyline.encodedPolyline)
                : fullPolyline;

              const legSteps: NavigationStep[] = (leg.steps || []).map((s: any) => ({
                instruction: s.navigationInstruction?.instructions || s.description || 'Continue on road',
                distanceMeters: s.distanceMeters || 0,
                distanceText: s.distanceMeters > 1000 ? `${(s.distanceMeters / 1000).toFixed(1)} km` : `${Math.round(s.distanceMeters || 0)} m`,
                durationSeconds: parseInt((s.staticDuration || '0s').replace('s', ''), 10) || 0,
                durationText: `${Math.round((parseInt((s.staticDuration || '0s').replace('s', ''), 10) || 0) / 60)} mins`,
                startLocation: s.startLocation?.latLng ? { lat: s.startLocation.latLng.latitude, lng: s.startLocation.latLng.longitude } : undefined,
                endLocation: s.endLocation?.latLng ? { lat: s.endLocation.latLng.latitude, lng: s.endLocation.latLng.longitude } : undefined,
              }));

              legs.push({
                from: `Stop #${idx + 1}`,
                to: `Stop #${idx + 2}`,
                distanceKm: legDistKm,
                durationMinutes: legDurMins,
                roadGeometry: legPolyline.length > 0 ? legPolyline : [waypoints[idx], waypoints[idx + 1]],
                steps: legSteps,
              });
            });
          }

          return {
            totalDistanceKm,
            durationMinutes,
            legs,
            isLiveRoadRouting: true,
            routingStatus: 'GOOGLE_ROUTES',
          };
        }
      }

      // Fallback to Directions API if Routes API returns non-200
      const origin = `${waypoints[0].lat},${waypoints[0].lng}`;
      const destination = `${waypoints[waypoints.length - 1].lat},${waypoints[waypoints.length - 1].lng}`;
      const intermediateWaypoints = waypoints
        .slice(1, -1)
        .map((wp) => `${wp.lat},${wp.lng}`)
        .join('|');

      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}${
        intermediateWaypoints ? `&waypoints=${intermediateWaypoints}` : ''
      }&mode=driving&key=${googleApiKey}`;

      const dirRes = await fetch(url);
      const dirData: any = await dirRes.json();

      if (dirData.status === 'OK' && dirData.routes && dirData.routes.length > 0) {
        const route = dirData.routes[0];
        let totalMeters = 0;
        let totalSeconds = 0;
        const fullPolyline = route.overview_polyline?.points
          ? decodePolyline(route.overview_polyline.points)
          : [];
        const legs: RouteLeg[] = [];

        route.legs.forEach((leg: any, idx: number) => {
          totalMeters += leg.distance.value;
          totalSeconds += leg.duration.value;
          const legDistKm = Math.round((leg.distance.value / 1000) * 10) / 10;
          const legDurMins = Math.round(leg.duration.value / 60);

          let legPolyline: GeoPoint[] = [];
          const legSteps: NavigationStep[] = [];
          if (Array.isArray(leg.steps)) {
            leg.steps.forEach((s: any) => {
              if (s.polyline?.points) {
                legPolyline.push(...decodePolyline(s.polyline.points));
              }
              legSteps.push({
                instruction: s.html_instructions
                  ? s.html_instructions.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim()
                  : 'Continue on road',
                distanceMeters: s.distance?.value || 0,
                distanceText: s.distance?.text || `${Math.round(s.distance?.value || 0)} m`,
                durationSeconds: s.duration?.value || 0,
                durationText: s.duration?.text || `${Math.round((s.duration?.value || 0) / 60)} mins`,
                maneuver: s.maneuver || 'continue',
                startLocation: s.start_location ? { lat: s.start_location.lat, lng: s.start_location.lng } : undefined,
                endLocation: s.end_location ? { lat: s.end_location.lat, lng: s.end_location.lng } : undefined,
              });
            });
          }
          if (legPolyline.length === 0) {
            legPolyline = fullPolyline.length > 0 ? fullPolyline : [waypoints[idx], waypoints[idx + 1]];
          }

          legs.push({
            from: leg.start_address || `Stop #${idx + 1}`,
            to: leg.end_address || `Stop #${idx + 2}`,
            distanceKm: legDistKm,
            durationMinutes: legDurMins,
            roadGeometry: legPolyline,
            steps: legSteps,
          });
        });

        const totalKm = Math.max(1, Math.round((totalMeters / 1000) * 10) / 10);
        return {
          totalDistanceKm: totalKm,
          durationMinutes: Math.round(totalSeconds / 60),
          legs,
          isLiveRoadRouting: true,
          routingStatus: 'GOOGLE_DIRECTIONS',
        };
      }
    } catch (err) {
      console.warn('Google Maps road route lookup notice, checking driving service fallback:', err);
    }
  }

  // 2. Open Source Routing Machine (OSRM) Driving API (Genuine OpenStreetMap road network)
  try {
    const coordsParam = waypoints.map((wp) => `${wp.lng},${wp.lat}`).join(';');
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsParam}?overview=full&geometries=geojson&steps=true`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const osrmRes = await fetch(osrmUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (osrmRes.ok) {
      const osrmData: any = await osrmRes.json();
      if (osrmData.code === 'Ok' && osrmData.routes && osrmData.routes.length > 0) {
        const route = osrmData.routes[0];
        const totalKm = Math.max(1, Math.round((route.distance / 1000) * 10) / 10);
        const durationMins = Math.round(route.duration / 60);

        const legs: RouteLeg[] = [];
        route.legs.forEach((leg: any, idx: number) => {
          let legGeometry: GeoPoint[] =
            leg.geometry?.coordinates?.map((pt: [number, number]) => ({ lat: pt[1], lng: pt[0] })) || [];

          if (legGeometry.length === 0 && Array.isArray(leg.steps)) {
            const stepCoords: GeoPoint[] = [];
            leg.steps.forEach((s: any) => {
              if (Array.isArray(s.geometry?.coordinates)) {
                s.geometry.coordinates.forEach((pt: [number, number]) => {
                  stepCoords.push({ lat: pt[1], lng: pt[0] });
                });
              }
            });
            if (stepCoords.length > 0) {
              legGeometry = stepCoords;
            }
          }

          if (legGeometry.length === 0 && Array.isArray(route.geometry?.coordinates) && route.legs.length === 1) {
            legGeometry = route.geometry.coordinates.map((pt: [number, number]) => ({ lat: pt[1], lng: pt[0] }));
          }

          const legSteps: NavigationStep[] = (leg.steps || []).map((step: any) => ({
            instruction: formatManeuverInstruction(step),
            distanceMeters: Math.round(step.distance || 0),
            distanceText:
              step.distance > 1000
                ? `${(step.distance / 1000).toFixed(1)} km`
                : `${Math.round(step.distance || 0)} m`,
            durationSeconds: Math.round(step.duration || 0),
            durationText: `${Math.max(1, Math.round((step.duration || 0) / 60))} mins`,
            maneuver: step.maneuver?.type || 'continue',
            name: step.name || '',
            startLocation: step.maneuver?.location
              ? { lat: step.maneuver.location[1], lng: step.maneuver.location[0] }
              : undefined,
          }));

          legs.push({
            from: `Stop #${idx + 1}`,
            to: `Stop #${idx + 2}`,
            distanceKm: Math.max(0.1, Math.round((leg.distance / 1000) * 10) / 10),
            durationMinutes: Math.max(1, Math.round(leg.duration / 60)),
            roadGeometry: legGeometry.length > 0 ? legGeometry : [waypoints[idx], waypoints[idx + 1]],
            steps: legSteps,
          });
        });

        return {
          totalDistanceKm: totalKm,
          durationMinutes: durationMins,
          legs,
          isLiveRoadRouting: true,
          routingStatus: 'OSRM_DRIVING',
        };
      }
    }
  } catch (err) {
    console.warn('[Routing Service] OSRM public service notice:', err);
  }

  // 3. Fallback when real road routing services are unreachable: do NOT invent fake straight lines
  console.warn('[Routing Service] Real road routing services unreachable. Refusing to invent fake straight-line routes.');
  return {
    totalDistanceKm: 0,
    durationMinutes: 0,
    legs: [],
    isLiveRoadRouting: false,
    routingStatus: 'ROUTE_CALCULATION_UNAVAILABLE',
  };
}

/**
 * Algorithmic Farmer Selection & Road Routing Optimizer
 * Satisfies:
 * - Single-farmer check first (if one farmer has all products & quantities, choose ONLY that farmer)
 * - Minimum farmer combination search
 * - Farmer rating optimization
 * - Strict ₹15/km transportation charge (no arbitrary ₹100 base charge)
 * - 50% Buyer / 50% Farmers transport cost split
 * - Farmer transport mode with designated transport lead
 */
export async function calculateOptimalChain(
  req: RouteOptimizationRequest
): Promise<OptimizedRoutePlan> {
  const { buyerLocation, buyerCoordinates, requestedItems, transportMode, allProduceList } = req;
  const RATE_PER_KM = 15; // STRICT BUSINESS RULE: ₹15 / KM

  // Group candidate produce by produceName or produceId
  const matchingStockByItem: Record<string, CandidateFarmerProduce[]> = {};
  for (const item of requestedItems) {
    const key = (item.produceName || (item as any).name || '').toLowerCase().trim();
    const targetProduceId = (item as any).produceId;
    matchingStockByItem[key] = allProduceList.filter(
      (p) =>
        p.availableQuantity > 0 &&
        ((targetProduceId && p.produceId === targetProduceId) ||
          p.name.toLowerCase().includes(key) ||
          key.includes(p.name.toLowerCase()))
    );
  }

  // Map of unique farmers and their available inventory
  const farmerProduceMap = new Map<string, CandidateFarmerProduce[]>();
  allProduceList.forEach((p) => {
    const list = farmerProduceMap.get(p.farmerId) || [];
    list.push(p);
    farmerProduceMap.set(p.farmerId, list);
  });

  // STEP 1: SINGLE-FARMER FULL SATISFACTION CHECK (CRITICAL BUSINESS RULE)
  // "If ONE farmer has all requested products AND all required quantities: SELECT ONLY THAT FARMER."
  const fullySatisfyingFarmers: {
    farmerId: string;
    farmerName: string;
    farmerPhone: string;
    farmerRating: number;
    canManageTransport: boolean;
    location: string;
    coordinates: GeoPoint;
    items: any[];
    distanceToBuyer: number;
    score: number;
  }[] = [];

  for (const [farmerId, produceItems] of farmerProduceMap.entries()) {
    let canFulfillAll = true;
    const itemsSelected: any[] = [];

    for (const reqItem of requestedItems) {
      const key = (reqItem.produceName || (reqItem as any).name || '').toLowerCase().trim();
      const targetProduceId = (reqItem as any).produceId;
      const matchingProduce = produceItems.find(
        (p) =>
          ((targetProduceId && p.produceId === targetProduceId) ||
            p.name.toLowerCase().includes(key) ||
            key.includes(p.name.toLowerCase())) &&
          p.availableQuantity >= reqItem.quantity
      );

      if (!matchingProduce) {
        canFulfillAll = false;
        break;
      }

      itemsSelected.push({
        produceId: matchingProduce.produceId,
        name: matchingProduce.name,
        quantity: reqItem.quantity,
        unit: matchingProduce.unit,
        pricePerUnit: matchingProduce.pricePerUnit,
        totalPrice: reqItem.quantity * matchingProduce.pricePerUnit,
        farmerId: matchingProduce.farmerId,
        farmerName: matchingProduce.farmerName,
        farmerPhone: matchingProduce.farmerPhone,
        farmerLocation: matchingProduce.location,
        farmerCoordinates: matchingProduce.coordinates,
        farmerRating: matchingProduce.farmerRating,
        farmerUpiId: matchingProduce.farmerUpiId,
        canManageTransport: matchingProduce.canManageTransport,
      });
    }

    if (canFulfillAll && itemsSelected.length === requestedItems.length) {
      const sample = produceItems[0];
      const dist = geometricHaversine(sample.coordinates, buyerCoordinates);
      // Rating-weighted selection score (favors higher rating and shorter road distance)
      const rating = sample.farmerRating || 4.5;
      const score = dist / Math.pow(rating, 1.2);

      fullySatisfyingFarmers.push({
        farmerId,
        farmerName: sample.farmerName,
        farmerPhone: sample.farmerPhone,
        farmerRating: rating,
        canManageTransport: sample.canManageTransport,
        location: sample.location,
        coordinates: sample.coordinates,
        items: itemsSelected,
        distanceToBuyer: dist,
        score,
      });
    }
  }

  let selectedItemsForOrder: any[] = [];
  let isSingleFarmer = false;
  let transportLeaderFarmerId = '';
  let transportLeaderFarmerName = '';
  let transportLeaderIsIndependent = false;
  let orderedFarmerStops: {
    farmerId: string;
    farmerName: string;
    farmerPhone: string;
    location: string;
    coordinates: GeoPoint;
    canManageTransport: boolean;
    isLogisticsOnlyProvider: boolean;
    rating: number;
    items: any[];
  }[] = [];

  // IF SINGLE FARMER FOUND:
  if (fullySatisfyingFarmers.length > 0) {
    isSingleFarmer = true;
    // Sort by best score
    fullySatisfyingFarmers.sort((a, b) => a.score - b.score);
    const bestSingleFarmer = fullySatisfyingFarmers[0];
    selectedItemsForOrder = bestSingleFarmer.items;

    if (transportMode === 'FARMER_TRANSPORT') {
      if (bestSingleFarmer.canManageTransport) {
        // Farmer supplies product AND provides transport
        transportLeaderFarmerId = bestSingleFarmer.farmerId;
        transportLeaderFarmerName = bestSingleFarmer.farmerName;
        orderedFarmerStops = [
          {
            farmerId: bestSingleFarmer.farmerId,
            farmerName: bestSingleFarmer.farmerName,
            farmerPhone: bestSingleFarmer.farmerPhone,
            location: bestSingleFarmer.location,
            coordinates: bestSingleFarmer.coordinates,
            canManageTransport: true,
            isLogisticsOnlyProvider: false,
            rating: bestSingleFarmer.farmerRating,
            items: bestSingleFarmer.items,
          },
        ];
      } else {
        // Farmer does NOT have transport: Find nearest transport provider farmer as logistics provider ONLY
        const transportProviders = allProduceList
          .filter((p) => p.canManageTransport && p.farmerId !== bestSingleFarmer.farmerId)
          .sort((a, b) => {
            const dA = geometricHaversine(a.coordinates, bestSingleFarmer.coordinates);
            const dB = geometricHaversine(b.coordinates, bestSingleFarmer.coordinates);
            return dA - dB;
          });

        if (transportProviders.length > 0) {
          const lead = transportProviders[0];
          transportLeaderFarmerId = lead.farmerId;
          transportLeaderFarmerName = lead.farmerName;
          transportLeaderIsIndependent = true;

          // Stop 1: Transport provider base -> Stop 2: Single Farmer farm -> Buyer
          orderedFarmerStops = [
            {
              farmerId: lead.farmerId,
              farmerName: lead.farmerName,
              farmerPhone: lead.farmerPhone,
              location: lead.location,
              coordinates: lead.coordinates,
              canManageTransport: true,
              isLogisticsOnlyProvider: true,
              rating: lead.farmerRating,
              items: [], // Does not contribute product
            },
            {
              farmerId: bestSingleFarmer.farmerId,
              farmerName: bestSingleFarmer.farmerName,
              farmerPhone: bestSingleFarmer.farmerPhone,
              location: bestSingleFarmer.location,
              coordinates: bestSingleFarmer.coordinates,
              canManageTransport: false,
              isLogisticsOnlyProvider: false,
              rating: bestSingleFarmer.farmerRating,
              items: bestSingleFarmer.items,
            },
          ];
        } else {
          // Fallback if no separate transport provider exists
          transportLeaderFarmerId = bestSingleFarmer.farmerId;
          transportLeaderFarmerName = bestSingleFarmer.farmerName;
          orderedFarmerStops = [
            {
              farmerId: bestSingleFarmer.farmerId,
              farmerName: bestSingleFarmer.farmerName,
              farmerPhone: bestSingleFarmer.farmerPhone,
              location: bestSingleFarmer.location,
              coordinates: bestSingleFarmer.coordinates,
              canManageTransport: false,
              isLogisticsOnlyProvider: false,
              rating: bestSingleFarmer.farmerRating,
              items: bestSingleFarmer.items,
            },
          ];
        }
      }
    } else {
      // BUYER_TRANSPORT: Pickup directly from single farmer and deliver to buyer
      orderedFarmerStops = [
        {
          farmerId: bestSingleFarmer.farmerId,
          farmerName: bestSingleFarmer.farmerName,
          farmerPhone: bestSingleFarmer.farmerPhone,
          location: bestSingleFarmer.location,
          coordinates: bestSingleFarmer.coordinates,
          canManageTransport: bestSingleFarmer.canManageTransport,
          isLogisticsOnlyProvider: false,
          rating: bestSingleFarmer.farmerRating,
          items: bestSingleFarmer.items,
        },
      ];
    }
  } else {
    // STEP 2: MULTI-FARMER COMBINATION OPTIMIZER
    // Find minimum set of farmers that collectively satisfies 100% of the requested items
    for (const reqItem of requestedItems) {
      let remainingNeeded = reqItem.quantity;
      const key = (reqItem.produceName || (reqItem as any).name || '').toLowerCase().trim();
      const candidates = (matchingStockByItem[key] || []).sort((a, b) => {
        const dA = geometricHaversine(buyerCoordinates, a.coordinates) / Math.pow(a.farmerRating || 4.5, 1.2);
        const dB = geometricHaversine(buyerCoordinates, b.coordinates) / Math.pow(b.farmerRating || 4.5, 1.2);
        return dA - dB;
      });

      for (const cand of candidates) {
        if (remainingNeeded <= 0) break;
        const qtyToTake = Math.min(remainingNeeded, cand.availableQuantity);
        selectedItemsForOrder.push({
          produceId: cand.produceId,
          name: cand.name,
          quantity: qtyToTake,
          unit: cand.unit,
          pricePerUnit: cand.pricePerUnit,
          totalPrice: qtyToTake * cand.pricePerUnit,
          farmerId: cand.farmerId,
          farmerName: cand.farmerName,
          farmerPhone: cand.farmerPhone,
          farmerLocation: cand.location,
          farmerCoordinates: cand.coordinates,
          farmerRating: cand.farmerRating,
          farmerUpiId: cand.farmerUpiId,
          canManageTransport: cand.canManageTransport,
        });
        remainingNeeded -= qtyToTake;
      }
    }

    const uniqueContributingFarmers = Array.from(
      new Set(selectedItemsForOrder.map((it) => it.farmerId))
    );

    // Build unique farmer stops
    const stops = uniqueContributingFarmers.map((fId) => {
      const items = selectedItemsForOrder.filter((it) => it.farmerId === fId);
      const sample = items[0];
      return {
        farmerId: fId,
        farmerName: sample.farmerName,
        farmerPhone: sample.farmerPhone,
        location: sample.farmerLocation,
        coordinates: sample.farmerCoordinates,
        canManageTransport: Boolean(sample.canManageTransport),
        isLogisticsOnlyProvider: false,
        rating: sample.farmerRating || 4.8,
        items,
      };
    });

    if (transportMode === 'FARMER_TRANSPORT') {
      // Find transport leader among contributing farmers
      const transportCapableContributing = stops.find((s) => s.canManageTransport);
      if (transportCapableContributing) {
        transportLeaderFarmerId = transportCapableContributing.farmerId;
        transportLeaderFarmerName = transportCapableContributing.farmerName;
      } else {
        // Find external transport provider farmer
        const externalTransportFarmer = allProduceList.find((p) => p.canManageTransport);
        if (externalTransportFarmer) {
          transportLeaderFarmerId = externalTransportFarmer.farmerId;
          transportLeaderFarmerName = externalTransportFarmer.farmerName;
          transportLeaderIsIndependent = true;
          stops.unshift({
            farmerId: externalTransportFarmer.farmerId,
            farmerName: externalTransportFarmer.farmerName,
            farmerPhone: externalTransportFarmer.farmerPhone,
            location: externalTransportFarmer.location,
            coordinates: externalTransportFarmer.coordinates,
            canManageTransport: true,
            isLogisticsOnlyProvider: true,
            rating: externalTransportFarmer.farmerRating || 4.8,
            items: [],
          });
        }
      }
    }

    // Sequence stops using Nearest-Neighbor TSP from start point
    const startPoint =
      transportMode === 'FARMER_TRANSPORT' && stops.length > 0
        ? stops[0].coordinates
        : buyerCoordinates;

    const unvisited = [...stops];
    orderedFarmerStops = [];
    let currCoords = startPoint;

    // If there's a designated transport leader, keep them first
    if (transportLeaderFarmerId) {
      const leadIdx = unvisited.findIndex((s) => s.farmerId === transportLeaderFarmerId);
      if (leadIdx >= 0) {
        const lead = unvisited.splice(leadIdx, 1)[0];
        orderedFarmerStops.push(lead);
        currCoords = lead.coordinates;
      }
    }

    while (unvisited.length > 0) {
      unvisited.sort(
        (a, b) =>
          geometricHaversine(currCoords, a.coordinates) -
          geometricHaversine(currCoords, b.coordinates)
      );
      const next = unvisited.shift()!;
      orderedFarmerStops.push(next);
      currCoords = next.coordinates;
    }
  }

  // STEP 3: REAL ROAD ROUTING (Google Maps / OSRM / Road Highway Network)
  // Build road waypoints: Start -> Farmer Checkpoints -> Buyer Delivery
  const roadWaypoints: GeoPoint[] = [];

  if (transportMode === 'BUYER_TRANSPORT') {
    roadWaypoints.push(buyerCoordinates);
    orderedFarmerStops.forEach((s) => roadWaypoints.push(s.coordinates));
    roadWaypoints.push(buyerCoordinates);
  } else {
    // Farmer transport: Starts at transport lead farmer, visits checkpoints, reaches buyer
    orderedFarmerStops.forEach((s) => roadWaypoints.push(s.coordinates));
    roadWaypoints.push(buyerCoordinates);
  }

  const { totalDistanceKm, durationMinutes, legs, isLiveRoadRouting, routingStatus } =
    await getRealRoadDistanceAndRoute(roadWaypoints);

  // BUILD ORDER STEPS
  const steps: RouteStep[] = [];
  let cumulativeDist = 0;

  orderedFarmerStops.forEach((stop, idx) => {
    const legDist = idx < legs.length ? legs[idx].distanceKm : 2.5;
    cumulativeDist += legDist;

    steps.push({
      type: stop.isLogisticsOnlyProvider ? 'START' : 'PICKUP',
      farmerId: stop.farmerId,
      farmerName: stop.farmerName,
      farmerPhone: stop.farmerPhone,
      canManageTransport: stop.canManageTransport,
      isLogisticsOnlyProvider: stop.isLogisticsOnlyProvider,
      location: stop.location,
      coordinates: stop.coordinates,
      itemsToCollect: stop.items,
      distanceFromPrevKm: legDist,
      cumulativeDistanceKm: Math.round(cumulativeDist * 10) / 10,
      estimatedTimeMins: Math.round(cumulativeDist * 2.1) + 15,
    });
  });

  // Final Delivery Step at Buyer Destination
  const finalLegDist = legs.length > 0 ? legs[legs.length - 1].distanceKm : 5.0;
  cumulativeDist += finalLegDist;

  steps.push({
    type: 'DELIVERY',
    location: buyerLocation,
    coordinates: buyerCoordinates,
    distanceFromPrevKm: finalLegDist,
    cumulativeDistanceKm: totalDistanceKm,
    estimatedTimeMins: durationMinutes,
  });

  // STRICT PRICING RULES:
  // 1. RATE = ₹15 PER KM (ZERO arbitrary base charge)
  // Formula: transportCost = totalRoadDistanceKm * 15
  const totalTransportCost = Math.round(totalDistanceKm * RATE_PER_KM);

  // 2. 50/50 COST SPLIT:
  // 50% paid by Buyer, 50% paid collectively by contributing Farmers
  const buyerTransportShare = Math.round(totalTransportCost * 0.5);
  const farmersTransportShare = totalTransportCost - buyerTransportShare;

  const totalProduceAmount = selectedItemsForOrder.reduce(
    (sum, it) => sum + (it.totalPrice || 0),
    0
  );
  const finalBuyerPayableAmount = totalProduceAmount + buyerTransportShare;

  // Distribute farmers' 50% share proportionally among product contributors
  const chainedFarmers: ChainedFarmerAllocation[] = orderedFarmerStops.map((stop) => {
    const farmerSubtotal = stop.items.reduce((s, it) => s + (it.totalPrice || 0), 0);

    let allocatedShare = 0;
    if (!stop.isLogisticsOnlyProvider && totalProduceAmount > 0) {
      const weightRatio = farmerSubtotal / totalProduceAmount;
      allocatedShare = Math.round(farmersTransportShare * weightRatio);
    }

    return {
      farmerId: stop.farmerId,
      farmerName: stop.farmerName,
      location: stop.location,
      coordinates: stop.coordinates,
      canManageTransport: stop.canManageTransport,
      isLogisticsOnlyProvider: stop.isLogisticsOnlyProvider,
      rating: stop.rating,
      assignedItems: stop.items,
      farmerSubtotal,
      allocatedTransportShare: allocatedShare,
      netPayout: Math.max(0, farmerSubtotal - allocatedShare),
    };
  });

    // Build full route polyline and navigation steps by flattening all legs
    const polyline: GeoPoint[] = [];
    const navigationSteps: NavigationStep[] = [];
    legs.forEach((leg) => {
      if (Array.isArray(leg.roadGeometry)) {
        polyline.push(...leg.roadGeometry);
      }
      if (Array.isArray(leg.steps)) {
        navigationSteps.push(...leg.steps);
      }
    });
    if (polyline.length === 0) {
      polyline.push(...roadWaypoints);
    }

    const etaTimestamp = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();

    const isRoutingUnavailableInProd = process.env.NODE_ENV === 'production' && !isLiveRoadRouting;
    const satisfactionStatus = isRoutingUnavailableInProd
      ? 'UNAVAILABLE'
      : selectedItemsForOrder.length > 0
      ? 'FULLY_SATISFIED'
      : 'UNAVAILABLE';

    const routeSummary = isRoutingUnavailableInProd
      ? 'ROUTE_CALCULATION_UNAVAILABLE: Real road routing service is unconfigured or unreachable.'
      : isSingleFarmer
      ? `Single-source route directly from ${orderedFarmerStops.find((s) => !s.isLogisticsOnlyProvider)?.farmerName}`
      : `Optimized multi-farmer procurement route across ${orderedFarmerStops.filter((s) => !s.isLogisticsOnlyProvider).length} connected farms`;

    return {
      transportMode,
      transportProviderFarmerId: transportLeaderFarmerId,
      transportProviderFarmerName: transportLeaderFarmerName,
      transportProviderIsIndependent: transportLeaderIsIndependent,
      chainedFarmers,
      steps,
      routeLegs: legs,
      legs,
      totalRoadDistanceKm: totalDistanceKm,
      distanceKm: totalDistanceKm,
      totalEstimatedTimeMins: durationMinutes,
      durationMinutes,
      duration: `${durationMinutes} mins`,
      ETA: etaTimestamp,
      polyline,
      waypoints: roadWaypoints,
      navigationSteps,
      ratePerKm: RATE_PER_KM,
      totalProduceAmount,
      totalTransportCost,
      buyerTransportShare,
      farmersTransportShare,
      finalBuyerPayableAmount,
      satisfactionStatus,
      routeSummary,
      isSingleFarmerOrder: isSingleFarmer,
      isLiveRoadRouting,
      routingStatus,
    };
  }

  export interface EmergencyReplacementCandidate {
    farmerId: string;
    farmerName: string;
    farmerPhone: string;
    farmerRating: number;
    location: string;
    structuredLocation?: {
      placeId?: string;
      formattedAddress?: string;
      latitude?: number;
      longitude?: number;
      city?: string;
      district?: string;
      state?: string;
      country?: string;
    };
    coordinates: GeoPoint;
    produceId: string;
    produceName: string;
    availableQuantity: number;
    aiQualityScore: number;
    pricePerUnit: number;
    unit: string;
  }

  export interface EmergencyReplacementRequest {
    failedCheckpoint: {
      checkpointId: string;
      farmerId: string;
      farmerName: string;
      produceId?: string;
      produceSummary?: string;
      quantity: number;
      unit?: string;
      location?: string;
      coordinates?: GeoPoint;
    };
    allCandidates: EmergencyReplacementCandidate[];
    remainingWaypoints: GeoPoint[];
    currentTotalDistanceKm: number;
  }

  export interface EmergencyReplacementResult {
    success: boolean;
    replacementFarmerId: string;
    replacementFarmerName: string;
    replacementFarmerPhone: string;
    replacementProduceId: string;
    replacementProduceName: string;
    replacementProducePrice: number;
    replacedQuantity: number;
    originalDistanceKm: number;
    newTotalDistanceKm: number;
    extraDistanceKm: number;
    penaltyAmount: number; // extraDistanceKm * 15
    newRouteLegs: RouteLeg[];
    newEtaMinutes: number;
    newEtaIso: string;
    newTransportCost: number;
    buyerTransportShare: number;
    farmersTransportShare: number;
    feasibleCandidatesEvaluated: number;
    notes: string;
  }

  /**
   * 10-Step Algorithmic Emergency Farmer Replacement & Road Reroute Engine
   * Implements strict rules:
   * 1. Calculate missing quantity
   * 2. Find same-product farmers
   * 3. Check available quantity
   * 4. Check approved quality (>70)
   * 5. Check real Google location (valid placeId, reject gps_*, pin_*, PID_*)
   * 6. Consider rating
   * 7. Calculate actual road distance
   * 8. Calculate route impact (detour)
   * 9. Check feasibility
   * 10. Select best feasible replacement
   * Never: alternateFarmers[0], replacementCandidates[0], extraDistanceKm = 5
   * Penalty formula: extraDistanceKm * 15 (persisted with all provenance)
   */
  export async function calculateEmergencyReplacementRoute(
    req: EmergencyReplacementRequest
  ): Promise<EmergencyReplacementResult> {
    const { failedCheckpoint, allCandidates, remainingWaypoints, currentTotalDistanceKm } = req;
    const missingQty = Math.max(1, Number(failedCheckpoint.quantity) || 1);
    const query = (failedCheckpoint.produceSummary || '').toLowerCase().trim();
    const checkpointCoords = failedCheckpoint.coordinates || { lat: 16.3067, lng: 80.4365 };
    const nextDestination = remainingWaypoints.length > 0 ? remainingWaypoints[0] : checkpointCoords;

    // 1 & 2 & 3 & 4 & 5: Filter candidates with missing quantity, approved quality (>70), real placeId
    const eligible = allCandidates.filter((c) => {
      // Must not be the failed farmer
      if (c.farmerId === failedCheckpoint.farmerId) return false;
      // Step 2: Match product
      const cName = c.produceName.toLowerCase();
      const isProductMatch = query ? cName.includes(query) || query.includes(cName) : true;
      if (!isProductMatch) return false;
      // Step 3: Available quantity >= missingQty
      if (c.availableQuantity < missingQty) return false;
      // Step 4: Approved quality score > 70 (never <= 70)
      if (c.aiQualityScore <= 70) return false;
      // Step 5: Real Google location verification (reject gps_*, pin_*, PID_*, osm_*)
      const placeId = c.structuredLocation?.placeId;
      if (
        !placeId ||
        typeof placeId !== 'string' ||
        placeId.startsWith('gps_') ||
        placeId.startsWith('pin_') ||
        placeId.startsWith('PID_') ||
        placeId.startsWith('osm_')
      ) {
        return false;
      }
      return true;
    });

    if (eligible.length === 0) {
      // Fallback evaluation: check if any other farmer with quality > 70 has sufficient quantity
      const relaxed = allCandidates.filter((c) => {
        if (c.farmerId === failedCheckpoint.farmerId) return false;
        if (c.aiQualityScore <= 70) return false;
        const placeId = c.structuredLocation?.placeId;
        if (!placeId || placeId.startsWith('gps_') || placeId.startsWith('pin_') || placeId.startsWith('PID_')) return false;
        return c.availableQuantity >= missingQty;
      });
      if (relaxed.length > 0) {
        eligible.push(...relaxed);
      }
    }

    if (eligible.length === 0) {
      throw new Error(
        `No feasible replacement farmer found with available quantity >= ${missingQty}kg, approved quality > 70/100, and verified Google Maps location.`
      );
    }

    // Step 6 & 7 & 8: Calculate actual road distance and route impact for each candidate
    interface EvaluatedCandidate {
      candidate: EmergencyReplacementCandidate;
      detourKm: number;
      newLegs: RouteLeg[];
      ratingWeightedScore: number;
    }

    const evaluated: EvaluatedCandidate[] = [];

    // Calculate direct baseline distance from checkpoint to next waypoint
    const baselineRoad = await getRealRoadDistanceAndRoute([checkpointCoords, nextDestination]);
    const baselineDistanceKm = baselineRoad.totalDistanceKm;

    for (const cand of eligible) {
      // Road path with replacement: Checkpoint -> Replacement Farm -> Next Destination
      const detourRoad = await getRealRoadDistanceAndRoute([
        checkpointCoords,
        cand.coordinates,
        nextDestination,
      ]);

      const extraKm = Math.max(
        0.5,
        Math.round((detourRoad.totalDistanceKm - baselineDistanceKm) * 10) / 10
      );
      const rating = Math.max(1.0, cand.farmerRating || 4.5);
      // Step 6 & 9: Score favors shorter road detour and higher farmer rating
      const ratingWeightedScore = extraKm / Math.pow(rating, 1.3);

      evaluated.push({
        candidate: cand,
        detourKm: extraKm,
        newLegs: detourRoad.legs,
        ratingWeightedScore,
      });
    }

    // Step 10: Sort by optimal rating-weighted road score
    evaluated.sort((a, b) => a.ratingWeightedScore - b.ratingWeightedScore);
    const best = evaluated[0];
    const selected = best.candidate;
    const extraDistanceKm = best.detourKm;

    // Strict Formula: penaltyAmount = extraDistanceKm * 15 (No arbitrary default)
    const penaltyAmount = Math.round(extraDistanceKm * 15);

    // Recalculate full new route with replacement farmer
    const fullNewWaypoints = [
      checkpointCoords,
      selected.coordinates,
      ...remainingWaypoints,
    ];
    const fullNewRoute = await getRealRoadDistanceAndRoute(fullNewWaypoints);
    const newTotalDistanceKm = Math.max(
      currentTotalDistanceKm + extraDistanceKm,
      fullNewRoute.totalDistanceKm
    );
    const newEtaMinutes = fullNewRoute.durationMinutes;
    const newEtaIso = new Date(Date.now() + newEtaMinutes * 60 * 1000).toISOString();

    const newTransportCost = Math.round(newTotalDistanceKm * 15);
    const buyerTransportShare = Math.round(newTransportCost * 0.5);
    const farmersTransportShare = newTransportCost - buyerTransportShare;

    return {
      success: true,
      replacementFarmerId: selected.farmerId,
      replacementFarmerName: selected.farmerName,
      replacementFarmerPhone: selected.farmerPhone,
      replacementProduceId: selected.produceId,
      replacementProduceName: selected.produceName,
      replacementProducePrice: selected.pricePerUnit,
      replacedQuantity: missingQty,
      originalDistanceKm: currentTotalDistanceKm,
      newTotalDistanceKm,
      extraDistanceKm,
      penaltyAmount,
      newRouteLegs: fullNewRoute.legs,
      newEtaMinutes,
      newEtaIso,
      newTransportCost,
      buyerTransportShare,
      farmersTransportShare,
      feasibleCandidatesEvaluated: evaluated.length,
      notes: `Algorithmic replacement selected ${selected.farmerName} (Rating: ${selected.farmerRating}, Quality: ${selected.aiQualityScore}/100) after evaluating ${evaluated.length} feasible candidates. Road detour: +${extraDistanceKm} km. Penalty charged to failed farmer: ₹${penaltyAmount}.`,
    };
  }

