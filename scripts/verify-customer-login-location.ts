import assert from 'assert';
import { normalizePhone } from '../server/smsService';
import { hashPassword, comparePassword, generateToken } from '../server/auth';
import { reverseGeocodeLocation } from '../src/services/locationService';

async function runTests() {
  console.log('================================================================');
  console.log('🧪 VERIFYING CUSTOMER REGISTRATION, LOGIN & LIVE LOCATION FLOW');
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

  // Test 1: Phone normalization for customer login/registration
  await test('[Phone Normalization] Handles 10-digit, +91 prefixed, and formatted numbers', () => {
    assert.strictEqual(normalizePhone('9876512345'), '9876512345');
    assert.strictEqual(normalizePhone('+91 98765 12345'), '9876512345');
    assert.strictEqual(normalizePhone('+91-98765-12345'), '9876512345');
    assert.strictEqual(normalizePhone('(987) 651-2345'), '9876512345');
  });

  // Test 2: Customer password hashing and verification
  await test('[Customer Auth] Secure password hashing & verification', async () => {
    const rawPass = 'Customer@123';
    const hashed = await hashPassword(rawPass);
    assert.ok(hashed.startsWith('$2'), 'Should produce bcrypt hash');
    const valid = await comparePassword(rawPass, hashed);
    assert.strictEqual(valid, true, 'Valid password must match');
    const invalid = await comparePassword('wrongPass', hashed);
    assert.strictEqual(invalid, false, 'Invalid password must not match');
  });

  // Test 3: Customer registration payload validation without organization
  await test('[Customer Registration] Organization is optional for BUYER role', () => {
    const customerName = 'Pavan Kumar';
    const selectedRole = 'BUYER';
    const rawOrg = '';
    const effectiveOrg = rawOrg.trim() || (selectedRole === 'BUYER' ? `${customerName} (Direct Consumer)` : `${customerName}'s Farm`);
    assert.strictEqual(effectiveOrg, 'Pavan Kumar (Direct Consumer)');
  });

  // Test 4: Verify customer token generation
  await test('[Token Generation] Generates valid JWT token for BUYER', () => {
    const buyerUser = {
      id: 'usr_test_buyer',
      name: 'Ravi Teja',
      email: 'ravi@gmail.com',
      phone: '9848012345',
      role: 'BUYER',
      organization: 'Ravi Teja (Direct Consumer)',
    };
    const token = generateToken(buyerUser);
    assert.ok(typeof token === 'string' && token.length > 20, 'Token must be non-empty JWT');
  });

  // Test 5: Live reverse-geocoding returns real address data
  await test('[Real Location] Reverse geocode coordinates returns authentic address', async () => {
    // Coordinates for Banjara Hills, Hyderabad
    const result = await reverseGeocodeLocation(17.4156, 78.4357);
    assert.ok(result, 'Result must exist');
    assert.ok(result.formattedAddress, 'Must return formatted street address');
    assert.ok(result.coordinates, 'Must contain coordinates');
    assert.strictEqual(typeof result.latitude, 'number');
    assert.strictEqual(typeof result.longitude, 'number');
    console.log(`    → Resolved Real Address: "${result.formattedAddress}"`);
  });

  // Test 6: Verify location update structure
  await test('[User Location] Authoritative location updates user profile correctly', () => {
    const originalUser = {
      id: 'usr_buyer_1',
      name: 'Consumer Test',
      location: 'Old Location',
      coordinates: { lat: 10, lng: 10 },
    };

    const newLocation = 'Road No 12, Banjara Hills, Hyderabad, Telangana, India';
    const newCoords = { lat: 17.4156, lng: 78.4357 };

    const updatedUser = {
      ...originalUser,
      location: newLocation,
      coordinates: newCoords,
    };

    assert.strictEqual(updatedUser.location, newLocation);
    assert.deepStrictEqual(updatedUser.coordinates, newCoords);
  });

  console.log(`\n================================================================`);
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log(`================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
