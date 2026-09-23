import { spawn } from 'child_process';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('Testing LiveMapModal in headless Edge...');
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=9224',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    'http://localhost:3000',
  ]);

  await sleep(2500);

  try {
    const listRes = await fetch('http://127.0.0.1:9224/json');
    const tabs = await listRes.json();
    const pageTab = tabs.find((t) => t.type === 'page');
    if (!pageTab || !pageTab.webSocketDebuggerUrl) {
      throw new Error('No page tab with webSocketDebuggerUrl found');
    }

    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
    let msgId = 1;
    const pending = new Map();
    const jsExceptions = [];

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && pending.has(data.id)) {
        pending.get(data.id)(data.result);
        pending.delete(data.id);
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

    console.log('Logging in as buyer with an active order...');
    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('agrinex_clean_v2_currentUserId', 'usr_buyer');
        window.location.reload();
      `,
    });
    await sleep(2500);

    console.log('Navigating to My Orders & Live Tracking...');
    await send('Runtime.evaluate', {
      expression: `
        const ordersTab = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('My Orders') || b.innerText.includes('Tracking'));
        if (ordersTab) ordersTab.click();
      `,
    });
    await sleep(1500);

    console.log('Clicking order card to open LiveMapModal...');
    const trackClickRes = await send('Runtime.evaluate', {
      expression: `
        const orderCard = document.querySelector('div[title*="Google Map"]');
        if (orderCard) {
          orderCard.click();
          true;
        } else {
          // Fallback click on any order element
          const anyOrder = Array.from(document.querySelectorAll('div')).find(d => d.innerText && d.innerText.includes('Order #ORD'));
          if (anyOrder) {
            anyOrder.click();
            true;
          } else {
            false;
          }
        }
      `,
      returnByValue: true,
    });
    console.log('Order card found and clicked:', trackClickRes.result.value);
    await sleep(2000);

    const modalCheck = await send('Runtime.evaluate', {
      expression: `({
        hasModal: Boolean(document.querySelector('.fixed.inset-0')),
        modalTitle: document.querySelector('.fixed.inset-0 h2, .fixed.inset-0 h3')?.innerText,
        hasDistanceRemaining: document.body.innerText.includes('Distance Remaining'),
        hasEstimatedEta: document.body.innerText.includes('Estimated ETA'),
        hasCloseBtn: Boolean(Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Close Tracker'))),
      })`,
      returnByValue: true,
    });
    console.log('✓ LiveMapModal render check:', modalCheck.result.value);

    console.log('\n--- BROWSER RUNTIME HEALTH CHECK ---');
    console.log('Total JS Exceptions caught:', jsExceptions.length);
    if (jsExceptions.length > 0) {
      console.error('Exceptions:', jsExceptions);
    } else {
      console.log('✓ ZERO Runtime ReferenceErrors when opening LiveMapModal!');
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
