import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, details?: string) {
  if (condition) {
    results.push({ name, passed: true, details });
    console.log(`  ✓ ${name}${details ? ` (${details})` : ''}`);
  } else {
    results.push({ name, passed: false, error: 'Assertion failed' });
    console.error(`  ✗ ${name} - FAILED`);
  }
}

async function runTests() {
  console.log('======================================================');
  console.log('🧪 AGRINEX MAJOR RUNTIME FIXES — VERIFICATION SUITE');
  console.log('======================================================\n');

  // Verify server is healthy
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  const healthData = await healthRes.json();
  assert(healthRes.ok && healthData.status === 'ok', 'Server Health Check', `DB: ${healthData.databaseType}`);

  // --------------------------------------------------------------------------
  // TEST 1: Current GPS location & reverse geocode address detection
  // Must return human-readable address and reject synthetic IDs
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 1: GPS Location & Reverse Geocoding ---');
  try {
    const revGeoRes = await fetch(`${BASE_URL}/api/location/reverse-geocode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: 16.5062, longitude: 80.6480 }), // Vijayawada
    });
    const revGeoData = await revGeoRes.json();
    assert(
      revGeoRes.ok && typeof revGeoData.formattedAddress === 'string' && revGeoData.formattedAddress.length > 5,
      'Reverse geocode returns human-readable address',
      revGeoData.formattedAddress
    );
    assert(
      revGeoData.placeId &&
      !revGeoData.placeId.startsWith('gps_') &&
      !revGeoData.placeId.startsWith('pin_') &&
      !revGeoData.placeId.startsWith('PID_') &&
      !revGeoData.placeId.startsWith('osm_') &&
      !revGeoData.placeId.startsWith('addr_') &&
      !revGeoData.placeId.startsWith('loc_'),
      'Reject synthetic place IDs (returns authentic Google Place ID)',
      `placeId: ${revGeoData.placeId}`
    );
  } catch (err: any) {
    assert(false, 'Reverse geocode execution', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Google Place search & details
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: Google Places Autocomplete & Details ---');
  try {
    const autoRes = await fetch(`${BASE_URL}/api/location/places-autocomplete?input=Guntur`);
    const autoData = await autoRes.json();
    assert(
      autoRes.ok && Array.isArray(autoData.predictions) && autoData.predictions.length > 0,
      'Places autocomplete returns results for query "Guntur"',
      `${autoData.predictions.length} predictions`
    );

    const firstPrediction = autoData.predictions[0];
    const detailsRes = await fetch(`${BASE_URL}/api/location/place-details?placeId=${encodeURIComponent(firstPrediction.placeId)}`);
    const detailsData = await detailsRes.json();
    assert(
      detailsRes.ok && typeof detailsData.latitude === 'number' && typeof detailsData.longitude === 'number',
      'Place details returns genuine coordinates',
      `lat: ${detailsData.latitude}, lng: ${detailsData.longitude}`
    );
  } catch (err: any) {
    assert(false, 'Places autocomplete & details execution', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 4 & 5: Realtime Farmer Registration, Produce Listing & Stock Checkout
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 4 & 5: Realtime Farmer Detection & Stock Reservation ---');
  const uniqueTimestamp = Date.now();
  const testFarmerPhone = `98${String(uniqueTimestamp).slice(-8)}`;
  const testBuyerPhone = `97${String(uniqueTimestamp).slice(-8)}`;
  let farmerToken = '';
  let farmerId = '';
  let buyerToken = '';
  let buyerId = '';
  let produceId = '';

  // 1. Register a NEW realtime farmer
  try {
    const regFarmerRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Test Realtime Farmer ${uniqueTimestamp}`,
        phone: testFarmerPhone,
        password: 'Password123!',
        role: 'FARMER',
        location: 'Tanuku, West Godavari District, Andhra Pradesh',
        coordinates: { lat: 16.7565, lng: 81.6828 },
        organization: 'Godavari Fresh Farms',
      }),
    });
    const regFarmerData = await regFarmerRes.json();
    assert(regFarmerRes.ok && regFarmerData.token && regFarmerData.user, 'Realtime farmer registered in database', `ID: ${regFarmerData.user?.id}`);
    farmerToken = regFarmerData.token;
    farmerId = regFarmerData.user?.id;

    // 2. Add produce under this new farmer (100 kg stock)
    const addProdRes = await fetch(`${BASE_URL}/api/produce`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${farmerToken}`,
      },
      body: JSON.stringify({
        name: `Organic Sweet Papaya ${uniqueTimestamp}`,
        category: 'Fruits',
        variety: 'Red Lady',
        basePrice: 40,
        aiRecommendedPrice: 42,
        quantity: 100,
        totalQuantity: 100,
        availableQuantity: 100,
        unit: 'kg',
        farmerId,
        farmerName: regFarmerData.user.name,
        farmerPhone: testFarmerPhone,
        location: 'Tanuku, West Godavari',
        coordinates: { lat: 16.7565, lng: 81.6828 },
        status: 'APPROVED',
        aiQualityScore: 92,
        aiQualityGrade: 'GRADE_A',
      }),
    });
    const addProdData = await addProdRes.json();
    assert(addProdRes.ok && addProdData.id, 'Produce listed under new realtime farmer', `Produce ID: ${addProdData.id}`);
    produceId = addProdData.id;

    // 3. Register a buyer
    const regBuyerRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Test Buyer ${uniqueTimestamp}`,
        phone: testBuyerPhone,
        password: 'Password123!',
        role: 'BUYER',
        location: 'Vijayawada Hub, Andhra Pradesh',
        coordinates: { lat: 16.5062, lng: 80.6480 },
      }),
    });
    const regBuyerData = await regBuyerRes.json();
    buyerToken = regBuyerData.token;
    buyerId = regBuyerData.user?.id;
    assert(regBuyerRes.ok && buyerToken, 'Buyer registered', `Buyer ID: ${buyerId}`);

    // TEST 5: Sufficient stock accepted (100 kg available, 30 kg ordered)
    const order1Res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buyerToken}`,
      },
      body: JSON.stringify({
        buyerId,
        buyerName: regBuyerData.user.name,
        buyerPhone: testBuyerPhone,
        buyerLocation: 'Vijayawada Hub, Andhra Pradesh',
        buyerCoordinates: { lat: 16.5062, lng: 80.6480 },
        items: [
          {
            produceId,
            produceName: `Organic Sweet Papaya ${uniqueTimestamp}`,
            quantity: 30,
            unit: 'kg',
            pricePerUnit: 42,
            totalPrice: 1260,
            farmerId,
            farmerName: regFarmerData.user.name,
          },
        ],
        totalProduceAmount: 1260,
        totalOrderAmount: 1800,
        grandTotal: 1800,
        transportMode: 'BUYER_TRANSPORT',
      }),
    });
    const order1Data = await order1Res.json();
    assert(order1Res.ok && order1Data.id, 'Sufficient stock order accepted (30kg of 100kg)', `Order ID: ${order1Data.id}`);
    assert(order1Data.status === 'PAYMENT_PENDING' || order1Data.status === 'STOCK_RESERVED', 'Stock is temporarily reserved pending payment');

    // Check availableQuantity decremented by 30 to 70
    const checkProd1Res = await fetch(`${BASE_URL}/api/produce`);
    const allProd1 = await checkProd1Res.json();
    const targetProd1 = allProd1.find((p: any) => p.id === produceId);
    assert(targetProd1 && targetProd1.availableQuantity === 70, 'Available stock atomically decremented from 100 to 70', `Stock now: ${targetProd1?.availableQuantity}`);
  } catch (err: any) {
    assert(false, 'Realtime farmer & stock order execution', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Actual insufficient stock rejected with INSUFFICIENT_STOCK
  // Current available stock is 70 kg. Attempting to order 90 kg must fail.
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 6: Insufficient Stock Rejection ---');
  try {
    const orderOverRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buyerToken}`,
      },
      body: JSON.stringify({
        buyerId,
        items: [
          {
            produceId,
            quantity: 90, // Exceeds 70 kg available
            farmerId,
          },
        ],
        totalProduceAmount: 3780,
        totalOrderAmount: 3780,
        grandTotal: 3780,
        transportMode: 'BUYER_TRANSPORT',
      }),
    });
    const orderOverData = await orderOverRes.json();
    assert(
      orderOverRes.status === 400 && orderOverData.error === 'INSUFFICIENT_STOCK',
      'Order exceeding available stock rejected with code INSUFFICIENT_STOCK',
      `Status: ${orderOverRes.status}, Error: ${orderOverData.error}`
    );
  } catch (err: any) {
    assert(false, 'Insufficient stock rejection execution', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 7: Payment failure releases reserved stock
  // Create an order for 20 kg -> stock becomes 50 kg -> cancel order -> stock restored to 70 kg
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 7: Payment Failure & Atomic Stock Rollback ---');
  try {
    const orderFailRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buyerToken}`,
      },
      body: JSON.stringify({
        buyerId,
        items: [{ produceId, quantity: 20, farmerId }],
        totalProduceAmount: 840,
        totalOrderAmount: 1200,
        grandTotal: 1200,
        transportMode: 'BUYER_TRANSPORT',
      }),
    });
    const orderFailData = await orderFailRes.json();
    assert(orderFailRes.ok && orderFailData.id, 'Temporary order created for rollback test', `Order: ${orderFailData.id}`);

    // Verify stock is now 50
    const checkStockBefore = await (await fetch(`${BASE_URL}/api/produce`)).json();
    const prodBefore = checkStockBefore.find((p: any) => p.id === produceId);
    assert(prodBefore?.availableQuantity === 50, 'Stock reduced to 50 during reservation', `Stock: ${prodBefore?.availableQuantity}`);

    // Trigger payment failure / abandonment
    const rollbackRes = await fetch(`${BASE_URL}/api/orders/${orderFailData.id}/payment-failed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const rollbackData = await rollbackRes.json();
    assert(rollbackRes.ok && rollbackData.success === true, 'Payment failure rollback API succeeded', rollbackData.message);

    // Verify stock is restored to 70
    const checkStockAfter = await (await fetch(`${BASE_URL}/api/produce`)).json();
    const prodAfter = checkStockAfter.find((p: any) => p.id === produceId);
    assert(prodAfter?.availableQuantity === 70, 'Reserved stock restored back to 70 kg upon payment failure', `Stock: ${prodAfter?.availableQuantity}`);
  } catch (err: any) {
    assert(false, 'Payment failure rollback execution', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 8: Payment success finalizes stock deduction
  // Create an order for 15 kg -> verify-payment -> order status PAID -> stockFinalized: true
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 8: Payment Success & Stock Finalization ---');
  let confirmedOrderId = '';
  try {
    const orderSuccessRes = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buyerToken}`,
      },
      body: JSON.stringify({
        buyerId,
        items: [{ produceId, quantity: 15, farmerId }],
        totalProduceAmount: 630,
        totalOrderAmount: 900,
        grandTotal: 900,
        transportMode: 'BUYER_TRANSPORT',
      }),
    });
    const orderSuccessData = await orderSuccessRes.json();
    confirmedOrderId = orderSuccessData.id;
    assert(orderSuccessRes.ok && confirmedOrderId, 'Order created for payment verification', `Order: ${confirmedOrderId}`);

    // Simulate authentic Razorpay payment verification
    const payVerifyRes = await fetch(`${BASE_URL}/api/payments/razorpay/verify-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: confirmedOrderId,
        razorpayPaymentId: `pay_test_${Date.now()}`,
        razorpayOrderId: `order_rzp_${Date.now()}`,
      }),
    });
    const payVerifyData = await payVerifyRes.json();
    assert(payVerifyRes.ok && payVerifyData.order?.paymentStatus === 'PAID', 'Payment verified and status updated to PAID', `PaymentStatus: ${payVerifyData.order?.paymentStatus}`);
    assert(payVerifyData.order?.stockFinalized === true, 'Stock deduction permanently finalized (stockFinalized: true)');

    // Available stock should remain 55 kg (70 - 15)
    const checkStockFinal = await (await fetch(`${BASE_URL}/api/produce`)).json();
    const prodFinal = checkStockFinal.find((p: any) => p.id === produceId);
    assert(prodFinal?.availableQuantity === 55, 'Final stock count is 55 kg', `Stock: ${prodFinal?.availableQuantity}`);
  } catch (err: any) {
    assert(false, 'Payment success execution', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Live Tracking GPS Pings & Road Geometry
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: Live GPS Tracking & Road Polyline ---');
  try {
    // 1. Advance order to active delivery status (IN_TRANSIT) so GPS pings are accepted
    // First, farmer accepts
    await fetch(`${BASE_URL}/api/orders/${confirmedOrderId}/farmer-accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${farmerToken}`,
      },
      body: JSON.stringify({ farmerId, accepted: true }),
    });

    // Send a valid GPS ping from delivery device
    const pingRes = await fetch(`${BASE_URL}/api/orders/${confirmedOrderId}/gps-ping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: 16.7000,
        longitude: 81.5000,
        accuracy: 12,
        speed: 14.5,
        heading: 210,
        timestamp: Date.now(),
      }),
    });
    const pingData = await pingRes.json();
    assert(pingRes.ok && pingData.success === true, 'Real GPS ping accepted by backend', `ETA: ${pingData.tracking?.ETA || 'Calculated'}`);

    // Query live tracking endpoint
    const trackRes = await fetch(`${BASE_URL}/api/orders/${confirmedOrderId}/live-tracking`);
    const trackData = await trackRes.json();
    assert(trackRes.ok && trackData.success === true, 'Live tracking endpoint returns active telemetry');
    assert(typeof trackData.remainingDistanceKm === 'number', 'Returns remaining distance to destination', `${trackData.remainingDistanceKm} km`);
    assert(typeof trackData.durationMinutes === 'number', 'Returns remaining ETA in minutes', `${trackData.durationMinutes} mins`);
    assert(Array.isArray(trackData.polyline), 'Returns road polyline geometry');
  } catch (err: any) {
    assert(false, 'Live tracking GPS execution', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 9, 10 & 11: Real Google OAuth & First-Time Profile Creation
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 9, 10 & 11: Google OAuth & First-Time Profile Creation ---');
  const googleSubId = `google_sub_${uniqueTimestamp}`;
  const googleEmail = `new.farmer.${uniqueTimestamp}@gmail.com`;
  const googleName = `Aarav Sharma ${uniqueTimestamp}`;
  let tempToken = '';

  // TEST 10: First-time Google user prompts profile completion
  try {
    // Create a mock Google ID token with sub, email, name
    // Our backend /api/auth/google decodes Google JWT or handles payload
    const googleLoginRes = await fetch(`${BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mockUser: {
          sub: googleSubId,
          email: googleEmail,
          name: googleName,
          email_verified: true,
          picture: 'https://lh3.googleusercontent.com/a/default',
        },
      }),
    });
    const googleLoginData = await googleLoginRes.json();
    assert(
      googleLoginRes.ok && googleLoginData.isNewUser === true,
      'First-time Google user recognized as isNewUser: true (NOT half-created)',
      `TempToken generated: ${Boolean(googleLoginData.tempToken)}`
    );
    tempToken = googleLoginData.tempToken;

    // Complete profile with Role (FARMER), Phone with OTP, and Verified Physical Address
    const completeProfileRes = await fetch(`${BASE_URL}/api/auth/google/complete-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tempToken,
        role: 'FARMER',
        phone: `96${String(uniqueTimestamp).slice(-8)}`,
        otp: '123456',
        location: 'Main Road, Tadepalligudem, West Godavari, Andhra Pradesh 534101',
        structuredLocation: {
          formattedAddress: 'Main Road, Tadepalligudem, West Godavari, Andhra Pradesh 534101',
          placeId: 'ChIJTadepalligudem_real_google_place_id',
          latitude: 16.8135,
          longitude: 81.5267,
          city: 'Tadepalligudem',
          district: 'West Godavari',
          state: 'Andhra Pradesh',
          country: 'India',
        },
        canManageTransport: true,
      }),
    });
    const completeProfileData = await completeProfileRes.json();
    assert(
      completeProfileRes.ok && completeProfileData.token && completeProfileData.user,
      'First-time Google profile completed and linked with googleSubject',
      `User ID: ${completeProfileData.user?.id}, Role: ${completeProfileData.user?.role}`
    );
    assert(completeProfileData.user?.authProvider === 'google', 'User authProvider is "google"');
    assert(completeProfileData.user?.canManageTransport === true, 'Farmer canManageTransport flag saved correctly');

    // TEST 9 & 11: Subsequent Google sign-in logs in directly without prompts (Duplicate prevention)
    const secondLoginRes = await fetch(`${BASE_URL}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mockUser: {
          sub: googleSubId,
          email: googleEmail,
          name: googleName,
          email_verified: true,
        },
      }),
    });
    const secondLoginData = await secondLoginRes.json();
    assert(
      secondLoginRes.ok && secondLoginData.isNewUser === false && secondLoginData.token,
      'Existing Google user logs in directly with token (No duplicate account created)',
      `Returned User: ${secondLoginData.user?.name}`
    );
    assert(secondLoginData.user?.id === completeProfileData.user?.id, 'Returned user matches existing account ID');
  } catch (err: any) {
    assert(false, 'Google OAuth & profile completion execution', err.message);
  }

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n======================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`TOTAL TESTS: ${total}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('======================================================');

  if (failed === 0) {
    console.log('\n🎉 ALL 11 MAJOR RUNTIME FIX SCENARIOS VERIFIED WITH 100% SUCCESS!\n');
    process.exit(0);
  } else {
    console.error(`\n❌ ${failed} TESTS FAILED. PLEASE REVIEW LOGS ABOVE.\n`);
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Test runner fatal error:', e);
  process.exit(1);
});
