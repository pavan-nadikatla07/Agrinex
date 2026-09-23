import { spawn } from 'child_process';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('======================================================');
  console.log('🌐 COMPREHENSIVE ALL-PORTAL REAL BROWSER VERIFICATION');
  console.log('======================================================');

  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=9225',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    'http://localhost:3000',
  ]);

  await sleep(2500);

  try {
    const listRes = await fetch('http://127.0.0.1:9225/json');
    const tabs = await listRes.json();
    const pageTab = tabs.find((t) => t.type === 'page');
    if (!pageTab || !pageTab.webSocketDebuggerUrl) {
      throw new Error('No page tab with webSocketDebuggerUrl found');
    }

    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
    let msgId = 1;
    const pending = new Map();
    const jsExceptions = [];
    const consoleErrors = [];

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && pending.has(data.id)) {
        pending.get(data.id)(data.result);
        pending.delete(data.id);
      }
      if (data.method === 'Runtime.consoleAPICalled') {
        if (data.params.type === 'error') {
          consoleErrors.push(data.params.args.map((a) => a.value || a.description).join(' '));
        }
      }
      if (data.method === 'Runtime.exceptionThrown') {
        jsExceptions.push(data.params.exceptionDetails.text + ' ' + (data.params.exceptionDetails.exception?.description || ''));
      }
    };

    await new Promise((resolve) => (ws.onopen = resolve));

    const send = (method, params = {}) => {
      return new Promise((resolve) => {
        const id = msgId++;
        pending.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    };

    await send('Runtime.enable');
    await send('Page.enable');

    // -------------------------------------------------------------
    // PHASE 1: Fresh Unauthenticated AuthPage
    // -------------------------------------------------------------
    console.log('\n--- PHASE 1: Fresh Session & AuthPage ---');
    await send('Runtime.evaluate', {
      expression: `
        localStorage.removeItem('agrinex_clean_v2_currentUserId');
        localStorage.removeItem('agrinex_token');
        window.location.reload();
      `,
    });
    await sleep(2000);

    const authCheck = await send('Runtime.evaluate', {
      expression: `({
        heading: document.querySelector('h1')?.innerText,
        hasPhoneInput: Boolean(document.querySelector('input[type="tel"]')),
        hasPasswordInput: Boolean(document.querySelector('input[type="password"]')),
        hasGoogleBtn: Boolean(document.getElementById('btn-google-sign-in')),
        roles: Array.from(document.querySelectorAll('button')).map(b => b.innerText).filter(t => t.includes('Farmer') || t.includes('Buyer') || t.includes('Admin')),
        hasDriverRole: Boolean(Array.from(document.querySelectorAll('button')).find(b => b.innerText.toLowerCase().includes('driver') || b.innerText.toLowerCase().includes('transporter'))),
      })`,
      returnByValue: true,
    });
    console.log('✓ AuthPage check:', authCheck.result.value);

    // -------------------------------------------------------------
    // PHASE 2: Farmer Portal Deep Audit
    // -------------------------------------------------------------
    console.log('\n--- PHASE 2: Farmer Portal Deep Audit ---');
    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('agrinex_clean_v2_currentUserId', 'usr_farmer');
        window.location.reload();
      `,
    });
    await sleep(2500);

    // Click all Farmer tabs: Dashboard, Produce Listings, Add Stock, Crop Advisory
    const farmerTabs = await send('Runtime.evaluate', {
      expression: `
        const tabs = Array.from(document.querySelectorAll('nav button, header button, div button')).map(b => b.innerText).filter(t => t.length > 2 && t.length < 30);
        tabs;
      `,
      returnByValue: true,
    });
    console.log('Farmer available tab controls:', farmerTabs.result.value?.slice(0, 8));

    // Test clicking Crop Advisory
    console.log('Testing Farmer: Next-Season Crop Advisory...');
    await send('Runtime.evaluate', {
      expression: `
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.toLowerCase().includes('advisory') || b.innerText.toLowerCase().includes('market intelligence'));
        if (btn) btn.click();
      `,
    });
    await sleep(1500);

    const farmerAdvisoryState = await send('Runtime.evaluate', {
      expression: `({
        regionInput: document.querySelector('input[placeholder*="Agro-Climatic"]')?.value,
        hasCards: document.querySelectorAll('.grid > div').length > 0,
      })`,
      returnByValue: true,
    });
    console.log('✓ Farmer Crop Advisory state:', farmerAdvisoryState.result.value);

    // -------------------------------------------------------------
    // PHASE 3: Buyer Portal Deep Audit
    // -------------------------------------------------------------
    console.log('\n--- PHASE 3: Buyer Portal Deep Audit ---');
    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('agrinex_clean_v2_currentUserId', 'usr_buyer');
        window.location.reload();
      `,
    });
    await sleep(2500);

    const buyerCheck = await send('Runtime.evaluate', {
      expression: `({
        buyerName: document.body.innerText.includes('Urban Green Supermarkets') || document.body.innerText.includes('Buyer'),
        produceCardsCount: document.querySelectorAll('[title*="Click produce"], [title*="produce"]').length,
        hasMyOrdersTab: Boolean(Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('My Orders'))),
      })`,
      returnByValue: true,
    });
    console.log('✓ Buyer Portal check:', buyerCheck.result.value);

    // Test clicking My Orders
    console.log('Testing Buyer: My Orders & Consignment Tracking...');
    await send('Runtime.evaluate', {
      expression: `
        const ordersTab = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('My Orders'));
        if (ordersTab) ordersTab.click();
      `,
    });
    await sleep(1500);

    // Open LiveMapModal
    console.log('Testing Buyer: Opening LiveMapModal on active order...');
    await send('Runtime.evaluate', {
      expression: `
        const orderCard = document.querySelector('div[title*="Google Map"]') || Array.from(document.querySelectorAll('div')).find(d => d.innerText && d.innerText.includes('Order #ORD'));
        if (orderCard) orderCard.click();
      `,
    });
    await sleep(2000);

    const buyerModalCheck = await send('Runtime.evaluate', {
      expression: `({
        hasModal: Boolean(document.querySelector('.fixed.inset-0')),
        modalTitle: document.querySelector('.fixed.inset-0 h2, .fixed.inset-0 h3')?.innerText,
        hasCloseBtn: Boolean(Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Close Tracker'))),
      })`,
      returnByValue: true,
    });
    console.log('✓ LiveMapModal check:', buyerModalCheck.result.value);

    // Close modal
    await send('Runtime.evaluate', {
      expression: `
        const closeBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Close Tracker'));
        if (closeBtn) closeBtn.click();
      `,
    });
    await sleep(1000);

    // -------------------------------------------------------------
    // PHASE 4: Admin Portal Deep Audit
    // -------------------------------------------------------------
    console.log('\n--- PHASE 4: Admin Portal Deep Audit ---');
    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('agrinex_clean_v2_currentUserId', 'usr_admin');
        window.location.reload();
      `,
    });
    await sleep(2500);

    const adminCheck = await send('Runtime.evaluate', {
      expression: `({
        adminTitle: document.body.innerText.includes('Admin') || document.body.innerText.includes('Escrow'),
        hasFarmersTab: Boolean(Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Farmers'))),
        hasLogisticsTab: Boolean(Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Logistics') || b.innerText.includes('Routes'))),
        hasDriverRoleOption: Boolean(document.querySelector('option[value="TRANSPORTER"]') || document.querySelector('option[value="DRIVER"]')),
      })`,
      returnByValue: true,
    });
    console.log('✓ Admin Portal check:', adminCheck.result.value);

    // -------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------
    console.log('\n======================================================');
    console.log('HEALTH SUMMARY:');
    console.log(`Total Runtime JS Exceptions: ${jsExceptions.length}`);
    console.log(`Total Console Errors: ${consoleErrors.length}`);
    if (jsExceptions.length > 0) {
      console.error('JS Exceptions:', jsExceptions);
    }
    if (consoleErrors.length > 0) {
      console.error('Console Errors:', consoleErrors);
    }
    console.log('======================================================');

    ws.close();
  } finally {
    edge.kill();
  }
}

run().catch((e) => {
  console.error('Test error:', e);
  process.exit(1);
});
