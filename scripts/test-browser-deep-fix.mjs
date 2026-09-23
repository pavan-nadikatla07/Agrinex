import { spawn } from 'child_process';
import http from 'http';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('Starting headless Edge with remote debugging port 9223...');
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=9223',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    'http://localhost:3000',
  ]);

  await sleep(2500);

  try {
    const listRes = await fetch('http://127.0.0.1:9223/json');
    const tabs = await listRes.json();
    const pageTab = tabs.find((t) => t.type === 'page');
    if (!pageTab || !pageTab.webSocketDebuggerUrl) {
      throw new Error('No page tab with webSocketDebuggerUrl found');
    }

    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
    let msgId = 1;
    const pending = new Map();
    const consoleLogs = [];
    const jsExceptions = [];

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && pending.has(data.id)) {
        pending.get(data.id)(data.result);
        pending.delete(data.id);
      }
      if (data.method === 'Runtime.consoleAPICalled') {
        consoleLogs.push(data.params.args.map((a) => a.value || a.description).join(' '));
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

    console.log('Waiting for initial page load and rendering...');
    await sleep(2000);

    // 1. Check title and auth screen
    const evalRes = await send('Runtime.evaluate', {
      expression: `({
        title: document.title,
        headingText: document.querySelector('h1')?.innerText,
        hasGoogleBtn: Boolean(document.getElementById('btn-google-sign-in')),
        roleButtons: Array.from(document.querySelectorAll('button')).map(b => b.innerText).filter(t => t.includes('Farmer') || t.includes('Buyer') || t.includes('Admin')),
      })`,
      returnByValue: true,
    });
    console.log('✓ Initial page check:', evalRes.result.value);

    // 2. Click "Sign in with Google" button
    console.log('Clicking "Sign in with Google" button...');
    await send('Runtime.evaluate', {
      expression: `document.getElementById('btn-google-sign-in')?.click()`,
    });
    await sleep(1000);

    const googleModalCheck = await send('Runtime.evaluate', {
      expression: `({
        hasModal: Boolean(document.querySelector('.fixed.inset-0')),
        modalText: document.querySelector('.fixed.inset-0')?.innerText,
      })`,
      returnByValue: true,
    });
    console.log('✓ Google Modal check:', googleModalCheck.result.value);

    // 3. Test logging in as Farmer and verifying Crop Advisory & Live Tracking
    console.log('Setting farmer session and reloading to Farmer Portal...');
    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('agrinex_clean_v2_currentUserId', 'usr_farmer');
        window.location.reload();
      `,
    });
    await sleep(2500);

    const farmerPortalCheck = await send('Runtime.evaluate', {
      expression: `({
        bodyTextSnippet: document.body.innerText.slice(0, 300),
        hasAddAddressBtn: Boolean(Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Add Address'))),
        hasCropAdvisoryTab: Boolean(Array.from(document.querySelectorAll('button')).find(b => b.innerText.toLowerCase().includes('advisory') || b.innerText.toLowerCase().includes('demand'))),
      })`,
      returnByValue: true,
    });
    console.log('✓ Farmer Portal loaded:', farmerPortalCheck.result.value);

    // 4. Click Crop Advisory Tab
    console.log('Clicking Crop Advisory / Market Intelligence Tab...');
    await send('Runtime.evaluate', {
      expression: `
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.toLowerCase().includes('advisory') || b.innerText.toLowerCase().includes('market intelligence'));
        if (btn) btn.click();
      `,
    });
    await sleep(1500);

    const cropAdvisoryCheck = await send('Runtime.evaluate', {
      expression: `({
        inputVal: document.querySelector('input[placeholder*="Agro-Climatic"]')?.value,
        hasRefreshAdvisoryBtn: Boolean(Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Refresh Advisory'))),
      })`,
      returnByValue: true,
    });
    console.log('✓ Crop Advisory section check:', cropAdvisoryCheck.result.value);

    // 5. Check for any JS runtime exceptions
    console.log('\n--- BROWSER RUNTIME HEALTH CHECK ---');
    console.log('Total JS Exceptions caught:', jsExceptions.length);
    if (jsExceptions.length > 0) {
      console.error('Exceptions:', jsExceptions);
    } else {
      console.log('✓ ZERO Runtime ReferenceErrors or fatal exceptions in browser console!');
    }

    ws.close();
  } finally {
    edge.kill();
  }
}

run().catch((e) => {
  console.error('CDP test error:', e);
  process.exit(1);
});
