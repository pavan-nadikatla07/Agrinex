import { spawn } from 'child_process';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function run() {
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=9229',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const listRes = await fetch('http://127.0.0.1:9229/json');
    const tabs = await listRes.json();
    const pageTab = tabs.find(t => t.type === 'page');
    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

    let msgId = 1;
    const pending = new Map();
    const consoleLogs = [];

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && pending.has(data.id)) {
        pending.get(data.id)(data.result);
        pending.delete(data.id);
      }
      if (data.method === 'Runtime.consoleAPICalled') {
        consoleLogs.push({ type: data.params.type, text: data.params.args.map(a => a.value || a.description).join(' ') });
      }
      if (data.method === 'Runtime.exceptionThrown') {
        consoleLogs.push({ type: 'EXCEPTION', text: data.params.exceptionDetails.text + ' ' + (data.params.exceptionDetails.exception?.description || '') });
      }
    };

    await new Promise(r => (ws.onopen = r));
    const send = (method, params = {}) => {
      return new Promise((resolve) => {
        const id = msgId++;
        pending.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    };

    await send('Runtime.enable');
    await send('Page.enable');
    
    await send('Page.navigate', { url: 'http://localhost:3000' });
    await new Promise(r => setTimeout(r, 4000));

    const pageInfo = await send('Runtime.evaluate', {
      expression: `({
        url: window.location.href,
        title: document.title,
        bodyTextSnippet: document.body.innerText.slice(0, 400),
        buttonTexts: Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean).slice(0, 15),
        inputs: Array.from(document.querySelectorAll('input')).map(i => ({ type: i.type, placeholder: i.placeholder, id: i.id }))
      })`,
      returnByValue: true
    });

    console.log('PAGE INFO:', JSON.stringify(pageInfo.result.value, null, 2));
    console.log('CONSOLE LOGS:', JSON.stringify(consoleLogs, null, 2));
    ws.close();
  } finally {
    edge.kill();
  }
}

run().catch(console.error);
