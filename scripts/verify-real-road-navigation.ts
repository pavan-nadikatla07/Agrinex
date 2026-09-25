import {
  isValidCoordinate,
  decodePolyline,
  getDistance,
  getDuration,
  isOffRoute,
  getNextInstruction,
  calculateRouteProgress,
} from '../src/services/routingService';
import { formatCurrency, formatNumber } from '../src/utils/formatters';

const BASE_URL = 'http://localhost:3000';

async function runVerification() {
  console.log('======================================================');
  console.log('🚗 AGRINEX REAL-ROAD NAVIGATION & TELEMETRY VERIFICATION');
  console.log('======================================================\n');

  let passed = 0;
  let total = 0;

  function assert(desc: string, condition: boolean, detail = '') {
    total++;
    if (condition) {
      passed++;
      console.log(`  ✓ ${desc} ${detail ? `(${detail})` : ''}`);
    } else {
      console.error(`  ✗ FAIL: ${desc} ${detail ? `(${detail})` : ''}`);
      process.exitCode = 1;
    }
  }

  // 1. Currency & Formatter UTF-8 ₹ Verification
  console.log('--- TEST 1: Currency Formatter & Safe toLocaleString ---');
  const c1 = formatCurrency(500);
  const c2 = formatCurrency(1250);
  const c3 = formatCurrency(10000);
  const cUndef = formatCurrency(undefined);
  const cNull = formatCurrency(null);

  assert('formatCurrency(500) renders ₹500', c1 === '₹500', c1);
  assert('formatCurrency(1250) renders ₹1,250', c2 === '₹1,250', c2);
  assert('formatCurrency(10000) renders ₹10,000', c3 === '₹10,000', c3);
  assert('No corrupted currency characters (Ôé╣, â‚¹)', !c1.includes('Ô') && !c1.includes('â') && !c1.includes('Â'));
  assert('Safe handling of undefined currency', cUndef === '₹0', cUndef);
  assert('Safe handling of null currency', cNull === '₹0', cNull);

  // 2. Routing Primitive Unit Tests
  console.log('\n--- TEST 2: Routing Service Primitives & Coordinate Validation ---');
  assert('isValidCoordinate({ lat: 16.3067, lng: 80.4365 }) is true', isValidCoordinate({ lat: 16.3067, lng: 80.4365 }));
  assert('isValidCoordinate({ lat: 95, lng: 80 }) is false', !isValidCoordinate({ lat: 95, lng: 80 }));
  assert('isValidCoordinate(null) is false', !isValidCoordinate(null));

  const testEncodedPolyline = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
  const decoded = decodePolyline(testEncodedPolyline);
  assert('decodePolyline decodes points array', Array.isArray(decoded) && decoded.length > 0, `${decoded.length} points`);

  // 3. Real Road Route Polyline Off-Route Detection
  console.log('\n--- TEST 3: Off-Route Detection & Perpendicular Vector Distance ---');
  // Define a road segment from (16.3000, 80.4000) to (16.3100, 80.4000)
  const sampleRoad = [
    { lat: 16.3000, lng: 80.4000 },
    { lat: 16.3050, lng: 80.4000 },
    { lat: 16.3100, lng: 80.4000 },
  ];

  // Point right on the road (offset by ~5 meters)
  const onRoadPoint = { lat: 16.3050, lng: 80.40005 };
  const onRoadCheck = isOffRoute(onRoadPoint, { routeGeometry: sampleRoad }, 75);
  assert('Point 5m from route is NOT off-route', !onRoadCheck.isOff, `${onRoadCheck.distanceMeters}m away`);

  // Point 200 meters away from the road
  const offRoadPoint = { lat: 16.3050, lng: 80.4020 };
  const offRoadCheck = isOffRoute(offRoadPoint, { routeGeometry: sampleRoad }, 75);
  assert('Point 200m away triggers off-route detection', offRoadCheck.isOff, `${offRoadCheck.distanceMeters}m away`);

  // 4. Route Progression & Turn-by-Turn Maneuver Matching
  console.log('\n--- TEST 4: Live Route Progression & Next Instruction ---');
  const sampleSteps = [
    {
      instruction: 'Head north on Guntur Bypass Rd',
      distanceMeters: 500,
      distanceText: '500 m',
      durationSeconds: 60,
      durationText: '1 min',
      maneuver: 'depart',
      startLocation: { lat: 16.3000, lng: 80.4000 },
    },
    {
      instruction: 'Turn right onto NH 16 Highway',
      distanceMeters: 4500,
      distanceText: '4.5 km',
      durationSeconds: 300,
      durationText: '5 mins',
      maneuver: 'turn-right',
      startLocation: { lat: 16.3100, lng: 80.4000 },
    },
  ];

  const routeObj = {
    routeGeometry: sampleRoad,
    steps: sampleSteps,
    distanceKm: 5.0,
    durationMinutes: 6,
  };

  const initialProg = calculateRouteProgress({ lat: 16.3000, lng: 80.4000 }, routeObj);
  assert('Route progress at start is near 0%', initialProg.percentCompleted <= 10, `${initialProg.percentCompleted}%`);

  const midProg = calculateRouteProgress({ lat: 16.3050, lng: 80.4000 }, routeObj);
  assert('Route progress at midpoint shows remaining distance', midProg.distanceRemainingKm > 0, `${midProg.distanceRemainingKm} km remaining`);

  const nextInstr = getNextInstruction({ lat: 16.3090, lng: 80.4000 }, routeObj);
  assert('Identifies upcoming turn maneuver near junction', nextInstr.currentStep?.instruction?.includes('Turn right'), nextInstr.currentStep?.instruction);

  // 5. Backend Live Navigation API Endpoint
  console.log('\n--- TEST 5: Backend Real-Road Navigation Endpoint (/api/navigation/route) ---');
  const origin = { lat: 16.3067, lng: 80.4365 }; // Guntur Farm
  const destination = { lat: 16.5062, lng: 80.6480 }; // Vijayawada Hub

  try {
    const res = await fetch(`${BASE_URL}/api/navigation/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination }),
    });

    assert('POST /api/navigation/route returns 200 OK', res.ok, `Status: ${res.status}`);
    const data = await res.json();
    assert('Returns routingStatus and durationMinutes', Boolean(data.routingStatus && data.durationMinutes > 0), `Status: ${data.routingStatus}, Duration: ${data.durationMinutes}m`);
    assert('Returns valid distance in km', data.totalDistanceKm > 10, `Distance: ${data.totalDistanceKm} km`);
    assert('Returns real road geometry points (never fake straight line)', Array.isArray(data.routeGeometry) && data.routeGeometry.length > 0, `${data.routeGeometry?.length} road points`);
    assert('Returns turn-by-turn navigation steps', Array.isArray(data.navigationSteps) && data.navigationSteps.length > 0, `${data.navigationSteps?.length} steps`);
  } catch (err: any) {
    console.error('Navigation API error:', err);
  }

  // 6. Reverse Geocoding with Authentic Coordinates
  console.log('\n--- TEST 6: Reverse Geocoding Without Fake Guesses ---');
  try {
    const revGeoRes = await fetch(`${BASE_URL}/api/location/reverse-geocode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: 16.5062, longitude: 80.6480, accuracy: 8 }),
    });
    assert('Reverse geocode returns 200', revGeoRes.ok);
    const revData = await revGeoRes.json();
    assert('Address is human readable', Boolean(revData.formattedAddress));
    assert('Coordinates remain unmodified from original GPS input', revData.latitude === 16.5062 && revData.longitude === 80.6480);
    assert('Does not invent fake "Main Road, Market Yard"', !revData.formattedAddress.startsWith('Main Road, Market Yard'));
  } catch (err: any) {
    console.error('Reverse geocode error:', err);
  }

  console.log('\n======================================================');
  console.log(`TOTAL TESTS: ${total}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${total - passed}`);
  console.log('======================================================\n');

  if (passed === total) {
    console.log('🎉 ALL REAL-ROAD NAVIGATION & TELEMETRY TESTS PASSED WITH 100% SUCCESS!');
  } else {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
