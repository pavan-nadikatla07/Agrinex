import { spawn } from 'child_process';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 9223;

const browser = spawn(edgePath, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + process.env.TEMP + '\\edge_fresh_session_' + Date.now(),
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

    // Ensure completely fresh localStorage
    await send('Page.navigate', { url: 'http://localhost:3000' });
    await new Promise(r => setTimeout(r, 1000));
    await send('Runtime.evaluate', { expression: 'localStorage.clear(); sessionStorage.clear();' });
    await send('Page.navigate', { url: 'http://localhost:3000' });

    // Wait 3 seconds for React to render AuthPage
    await new Promise(r => setTimeout(r, 3000));

    const authCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const text = document.body.innerText;
        const hasFarmer = text.includes('Farmer / FPO');
        const hasBuyer = text.includes('Buyer / Consumer');
        const hasAdmin = text.includes('Admin');
        const hasDriver = /driver|transporter/i.test(text);
        const hasDemoCredentials = /ramesh kumar patel|password123|4920 1829 4819/i.test(text);
        const hasAuthTitle = text.includes('Sign In') || text.includes('Create New');
        const inputs = Array.from(document.querySelectorAll('input')).map(i => ({ type: i.type, val: i.value, placeholder: i.placeholder }));
        return {
          hasAuthTitle,
          hasFarmer,
          hasBuyer,
          hasAdmin,
          hasDriver,
          hasDemoCredentials,
          inputs: inputs.filter(i => i.val !== ''),
          totalInputs: inputs.length,
          preview: text.slice(0, 400)
        };
      })()`,
      returnByValue: true
    });

    console.log('--- FRESH CLIENT SESSION (NO AUTH) ---');
    console.log(JSON.stringify(authCheck?.result?.value, null, 2));

    browser.kill();
    process.exit(0);
  });

  await new Promise(r => setTimeout(r, 10000));
} catch (e) {
  console.error('Test Error:', e);
} finally {
  browser.kill();
  process.exit(0);
}
