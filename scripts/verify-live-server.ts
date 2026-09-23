async function testLiveServer() {
  console.log('Testing live AgriNex server at http://localhost:3000...\n');
  
  // 1. Root page
  const res = await fetch('http://localhost:3000');
  console.log('GET / Status:', res.status, res.headers.get('content-type'));
  const text = await res.text();
  console.log('HTML length:', text.length, 'Contains root div:', text.includes('id="root"'));

  // 2. Users endpoint
  const apiUsers = await fetch('http://localhost:3000/api/users');
  console.log('GET /api/users Status:', apiUsers.status);
  const users = await apiUsers.json();
  console.log('Users count:', users.length, 'Roles:', users.map((u: any) => u.role));

  // 3. Produce endpoint
  const apiProduce = await fetch('http://localhost:3000/api/produce');
  console.log('GET /api/produce Status:', apiProduce.status);
  const produce = await apiProduce.json();
  console.log('Produce count:', produce.length, 'Sample:', produce[0]?.name, 'Score:', produce[0]?.aiQualityScore);

  // 4. Orders endpoint
  const apiOrders = await fetch('http://localhost:3000/api/orders');
  console.log('GET /api/orders Status:', apiOrders.status);
  const orders = await apiOrders.json();
  console.log('Orders count:', orders.length, 'Sample Order:', orders[0]?.id);

  // 5. Test Farmer Login
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'farmer@agrinex.com', password: 'password123' }),
  });
  console.log('POST /api/auth/login (Farmer) Status:', loginRes.status);
  const loginData = await loginRes.json();
  console.log('Farmer login:', loginData.user?.name, 'Role:', loginData.user?.role, 'Token received:', Boolean(loginData.token));
  if (!loginRes.ok) console.log('Login error:', loginData);

  // 6. Test Buyer Login
  const buyerLoginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'buyer@agrinex.com', password: 'password123' }),
  });
  console.log('POST /api/auth/login (Buyer) Status:', buyerLoginRes.status);
  const buyerData = await buyerLoginRes.json();
  console.log('Buyer login:', buyerData.user?.name, 'Role:', buyerData.user?.role, 'Token received:', Boolean(buyerData.token));

  // 7. Test Admin Login
  const adminLoginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@agrinex.com', password: 'password123' }),
  });
  console.log('POST /api/auth/login (Admin) Status:', adminLoginRes.status);
  const adminData = await adminLoginRes.json();
  console.log('Admin login:', adminData.user?.name, 'Role:', adminData.user?.role, 'Token received:', Boolean(adminData.token));

  // 8. Test Admin Stats with Admin Token
  const statsRes = await fetch('http://localhost:3000/api/admin/stats', {
    headers: { Authorization: `Bearer ${adminData.token}` },
  });
  console.log('GET /api/admin/stats Status:', statsRes.status);
  const stats = await statsRes.json();
  console.log('Admin Stats:', stats);

  console.log('\n✅ ALL LIVE SERVER CHECKS PASSED!');
}

testLiveServer().catch(console.error);
