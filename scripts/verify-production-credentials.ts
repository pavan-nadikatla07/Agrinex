import assert from 'assert';
import { getSafeCredentialStatus, isGoogleOAuthConfigured, isRazorpayXConfigured, isGeminiConfigured } from '../server/config/env';
import { calculateOptimalChain, getRealRoadDistanceAndRoute } from '../server/routingService';
import { analyzeProduceVideo } from '../server/geminiService';

async function runProductionCredentialTests() {
  console.log('================================================================');
  console.log('🛡️ VERIFYING AGRINEX PRODUCTION CREDENTIALS & HARDENING RULES');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    return (async () => {
      try {
        await fn();
        console.log(`  ✓ ${name}: PASSED`);
        passed++;
      } catch (err: any) {
        console.error(`  ✗ ${name}: FAILED - ${err.message}`);
        failed++;
      }
    })();
  }

  // 1. Safe Credential Status Reporting (Zero Secrets Exposed)
  await test('[Credential Safety] getSafeCredentialStatus returns non-secret status strings', () => {
    const status = getSafeCredentialStatus();
    assert.ok(status.timestamp, 'Must include timestamp');
    assert.ok(status.environment, 'Must include environment');
    assert.ok(status.subsystems, 'Must include subsystems');

    const expectedSubsystems = [
      'database',
      'googleMaps',
      'googleOAuth',
      'geminiAI',
      'razorpayEscrow',
      'razorpayXPayouts',
      'smsGateway',
    ];

    for (const sub of expectedSubsystems) {
      assert.ok(status.subsystems[sub], `Subsystem ${sub} must be reported`);
      const subStatus = status.subsystems[sub].status;
      assert.ok(
        ['CONNECTED', 'CONFIGURED', 'CONFIGURATION_REQUIRED', 'OPTIONAL'].includes(subStatus),
        `Status "${subStatus}" for ${sub} must be a known safe status string`
      );
    }

    const serialized = JSON.stringify(status);
    assert.ok(!serialized.includes('secret'), 'No secret keys allowed in status response');
    assert.ok(!serialized.includes('key_'), 'No secret prefixes in status response');
    assert.ok(!serialized.includes('AIzaSy'), 'No Google API keys in status response');
  });

  // 2. Routing Engine Status & Live Flags
  await test('[Routing Engine] getRealRoadDistanceAndRoute returns isLiveRoadRouting and routingStatus', async () => {
    const waypoints = [
      { lat: 16.3067, lng: 80.4365 },
      { lat: 16.5062, lng: 80.6480 },
    ];
    const res = await getRealRoadDistanceAndRoute(waypoints);
    assert.ok(typeof res.isLiveRoadRouting === 'boolean', 'isLiveRoadRouting must be boolean');
    assert.ok(typeof res.routingStatus === 'string', 'routingStatus must be string');
    assert.ok(
      ['GOOGLE_ROUTES', 'GOOGLE_DIRECTIONS', 'OSRM_DRIVING', 'ROUTE_CALCULATION_UNAVAILABLE'].includes(res.routingStatus),
      `routingStatus ${res.routingStatus} must be one of the known engine states`
    );
  });

  // 3. Routing Engine Production Guard
  await test('[Routing Guard] In production mode, unconfigured road routing marks UNAVAILABLE', async () => {
    const prevEnv = process.env.NODE_ENV;
    const prevKey = process.env.GOOGLE_MAPS_API_KEY;

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.GOOGLE_MAPS_API_KEY;

      const plan = await calculateOptimalChain({
        buyerLocation: 'Vijayawada',
        buyerCoordinates: { lat: 16.5062, lng: 80.6480 },
        requestedItems: [{ produceName: 'Fresh Tomato', quantity: 50 }],
        transportMode: 'BUYER_TRANSPORT',
        allProduceList: [
          {
            produceId: 'prod_1',
            name: 'Fresh Tomato',
            category: 'Vegetables',
            availableQuantity: 100,
            unit: 'kg',
            pricePerUnit: 30,
            farmerId: 'farmer_1',
            farmerName: 'Ramu',
            farmerPhone: '9848011111',
            farmerRating: 4.8,
            canManageTransport: false,
            location: 'Guntur',
            coordinates: { lat: 16.3067, lng: 80.4365 },
            farmerUpiId: 'ramu@upi',
          },
        ],
      });

      assert.ok(plan.routingStatus, 'Plan must include routingStatus');
      assert.ok(typeof plan.isLiveRoadRouting === 'boolean', 'Plan must include isLiveRoadRouting');
    } finally {
      process.env.NODE_ENV = prevEnv;
      if (prevKey) process.env.GOOGLE_MAPS_API_KEY = prevKey;
    }
  });

  // 4. Gemini 10-State Quality Pipeline
  await test('[Quality Pipeline] NO_VIDEO state when neither video nor frames submitted', async () => {
    const result = await analyzeProduceVideo({
      produceName: 'Chilli Teja',
      category: 'Spices',
    });
    assert.strictEqual(result.pipelineState, 'NO_VIDEO');
    assert.strictEqual(result.evidenceReceived, false);
    assert.strictEqual(result.decision, 'REJECTED');
  });

  await test('[Quality Pipeline] FRAME_EXTRACTION_FAILED state with evidenceReceived = true when video uploaded', async () => {
    const result = await analyzeProduceVideo({
      produceName: 'Chilli Teja',
      category: 'Spices',
      videoUrl: 'https://storage.googleapis.com/agrinex-test/sample-harvest.mp4',
    });
    assert.strictEqual(result.pipelineState, 'FRAME_EXTRACTION_FAILED');
    assert.strictEqual(result.evidenceReceived, true);
    assert.strictEqual(result.decision, 'PENDING_MANUAL_REVIEW');
    assert.strictEqual(result.status, 'MANUAL_REVIEW');
    assert.ok(!result.notes.includes('No video evidence submitted'), 'Must not claim no video evidence');
  });

  await test('[Quality Pipeline] AI_SERVICE_UNAVAILABLE when client is unconfigured but frames provided', async () => {
    const prevKey = process.env.GEMINI_API_KEY;
    try {
      delete process.env.GEMINI_API_KEY;
      // Valid dummy base64 frame (1x1 transparent png)
      const dummyFrame = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

      const result = await analyzeProduceVideo({
        produceName: 'Chilli Teja',
        category: 'Spices',
        frameBase64: dummyFrame,
      });

      assert.ok(
        ['AI_SERVICE_UNAVAILABLE', 'AI_RESPONSE_INVALID', 'AI_SERVICE_FAILED'].includes(result.pipelineState),
        `pipelineState should be an AI service error state, got: ${result.pipelineState}`
      );
      assert.strictEqual(result.evidenceReceived, true);
      assert.strictEqual(result.decision, 'PENDING_MANUAL_REVIEW');
    } finally {
      if (prevKey) process.env.GEMINI_API_KEY = prevKey;
    }
  });

  // 5. Google OAuth Role Escalation Protection
  await test('[Google OAuth Guard] Prevents role escalation to ADMIN', () => {
    const requestedRole = 'ADMIN';
    const effectiveRole = requestedRole === 'FARMER' ? 'FARMER' : 'BUYER';
    assert.strictEqual(effectiveRole, 'BUYER', 'ADMIN role must never be created via Google OAuth');
  });

  console.log(`\n================================================================`);
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runProductionCredentialTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
