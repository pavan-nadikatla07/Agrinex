import { spawn } from 'child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9224;

const browser = spawn(edgePath, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + process.env.TEMP + '\\edge_portal_check_' + Date.now(),
  'about:blank'
]);

await new Promise(r => setTimeout(r, 1500));

try {
  const versionRes = await fetch(`http://127.0.0.1:${port}/json/new?http://localhost:3000`, { method: 'PUT' });
  const pageTarget = await versionRes.json();

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  let id = 1;
  const send = (method, params = {}) => {
    return new Promise((resolve) => {
      const curId = id++;
      const handler = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id === curId) {
          ws.removeEventListener('message', handler);
          resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: curId, method, params }));
    });
  };

  ws.addEventListener('open', async () => {
    await send('Runtime.enable');
    await send('Page.enable');

    await send('Page.navigate', { url: 'http://localhost:3000' });
    await new Promise(r => setTimeout(r, 2000));

    // Sign in as Farmer using React value tracker
    await send('Runtime.evaluate', {
      expression: `(() => {
        const setVal = (elem, val) => {
          const proto = window.HTMLInputElement.prototype;
          const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
          descriptor.set.call(elem, val);
          elem.dispatchEvent(new Event('input', { bubbles: true }));
          elem.dispatchEvent(new Event('change', { bubbles: true }));
        };
        const inputs = document.querySelectorAll('input');
        if (inputs.length >= 2) {
          setVal(inputs[0], '9876543210');
          setVal(inputs[1], 'password123');
        }
        const submitBtn = document.getElementById('btn-auth-login-submit') || document.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.click();
      })()`
    });

    await new Promise(r => setTimeout(r, 3000));

    // Inspect Farmer Portal
    const farmerPortalCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const text = document.body.innerText;
        const hasDriver = /transporter console|driver portal|transporter dashboard/i.test(text);
        const hasMapsApiKey = /maps api key|google maps api key|configure maps/i.test(text);
        const hasAddProduce = text.includes('Add Produce') || text.includes('List New Produce');
        const hasMyStock = text.includes('My Produce & Stock');
        const hasOrders = text.includes('Orders & Pickups');
        return {
          hasDriver,
          hasMapsApiKey,
          hasAddProduce,
          hasMyStock,
          hasOrders,
          portalHeader: text.slice(0, 300)
        };
      })()`,
      returnByValue: true
    });

    console.log('--- FARMER PORTAL VERIFICATION ---');
    console.log(JSON.stringify(farmerPortalCheck?.result?.value, null, 2));

    // Open Settings Modal and verify Maps API Key is NOT in settings
    await send('Runtime.evaluate', {
      expression: `(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const settingsBtn = buttons.find(b => b.innerText.includes('Settings'));
        if (settingsBtn) settingsBtn.click();
      })()`
    });

    await new Promise(r => setTimeout(r, 1500));

    const settingsCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const text = document.body.innerText;
        const hasMapsApiInput = /google maps api key|enter google maps api key|maps api/i.test(text);
        const hasApiKeyInput = document.querySelector('input[placeholder*="AIzaSy"]') !== null;
        return {
          hasMapsApiInput,
          hasApiKeyInput,
          settingsVisible: text.includes('Platform Settings') || text.includes('Settings')
        };
      })()`,
      returnByValue: true
    });

    console.log('--- SETTINGS MODAL VERIFICATION ---');
    console.log(JSON.stringify(settingsCheck?.result?.value, null, 2));

    browser.kill();
    process.exit(0);
  });

  await new Promise(r => setTimeout(r, 12000));
} catch (e) {
  console.error('Portal Test Error:', e);
} finally {
  browser.kill();
  process.exit(0);
}
