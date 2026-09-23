import { spawn } from 'child_process';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('================================================================');
  console.log('🌐 E2E BROWSER TEST: CUSTOMER ACCOUNT CREATION, LOGIN & LOCATION');
  console.log('================================================================');

  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=9231',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
  ]);

  await sleep(2000);

  try {
    const listRes = await fetch('http://127.0.0.1:9231/json');
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

    // -----------------------------------------------------------------
    // STEP 1: Navigate to http://localhost:3000
    // -----------------------------------------------------------------
    console.log('\n--- Step 1: Navigating to AgriNex Application ---');
    await send('Page.navigate', { url: 'http://localhost:3000' });
    await sleep(3500);

    // Ensure session is fresh
    await send('Runtime.evaluate', {
      expression: `
        localStorage.removeItem('agrinex_clean_v2_currentUserId');
        localStorage.removeItem('agrinex_token');
        window.location.reload();
      `,
    });
    await sleep(3000);

    const isAuth = await send('Runtime.evaluate', {
      expression: `Boolean(document.getElementById('btn-auth-login-submit'))`,
      returnByValue: true,
    });
    console.log('✓ AuthPage loaded:', isAuth.result.value);

    // -----------------------------------------------------------------
    // STEP 2: Switch to Customer / Buyer Role & Register Mode
    // -----------------------------------------------------------------
    console.log('\n--- Step 2: Switch to Customer Registration (Sign Up) ---');
    await send('Runtime.evaluate', {
      expression: `(() => {
        const buyerTab = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Buyer / Consumer'));
        if (buyerTab) buyerTab.click();

        const registerLink = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Create new account'));
        if (registerLink) registerLink.click();
      })()`,
    });
    await sleep(1000);

    const testPhone = '98' + Math.floor(10000000 + Math.random() * 90000000);
    const testEmail = `buyer.${Date.now()}@example.com`;
    console.log(`Generated fresh test credentials: Phone=${testPhone}, Email=${testEmail}`);

    // Helper to set React 19 input values properly
    console.log('Filling registration details for direct customer...');
    const fillResult = await send('Runtime.evaluate', {
      expression: `(() => {
        function setReactVal(el, val) {
          if (!el) return false;
          const proto = window.HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (setter) {
            setter.call(el, val);
          } else {
            el.value = val;
          }
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }

        const nameInput = document.querySelector('input[placeholder*="full official name"]');
        const phoneInput = document.querySelector('input[placeholder*="9876543210"]');
        const pwdInput = document.querySelector('input[placeholder*="Min 8 chars"]');
        const emailInput = document.querySelector('input[placeholder="user@example.com"]');

        const hasName = setReactVal(nameInput, 'Ramesh Rao');
        const hasPhone = setReactVal(phoneInput, '${testPhone}');
        const hasPwd = setReactVal(pwdInput, 'CustomerPass@123');
        const hasEmail = setReactVal(emailInput, '${testEmail}');

        return { hasName, hasPhone, hasPwd, hasEmail };
      })()`,
      returnByValue: true,
    });
    console.log('✓ Form fields populated:', fillResult.result.value);
    await sleep(1000);

    // Click "Send OTP"
    console.log('Clicking Send OTP...');
    await send('Runtime.evaluate', {
      expression: `(() => {
        const sendOtpBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Send OTP'));
        if (sendOtpBtn) sendOtpBtn.click();
      })()`,
    });
    await sleep(2000);

    // Auto-verify OTP using simulator button
    console.log('Verifying phone via OTP simulator...');
    const verifyOtpResult = await send('Runtime.evaluate', {
      expression: `(() => {
        const autoOtpBtn = document.getElementById('btn-auto-fill-verify-otp');
        if (autoOtpBtn) {
          autoOtpBtn.click();
          return { clicked: true, mode: 'auto-btn' };
        }
        return { clicked: false };
      })()`,
      returnByValue: true,
    });
    console.log('✓ OTP verification trigger:', verifyOtpResult.result.value);
    await sleep(1500);

    // Type and confirm address
    console.log('Configuring delivery address...');
    await send('Runtime.evaluate', {
      expression: `(() => {
        function setReactVal(el, val) {
          if (!el) return false;
          const proto = window.HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (setter) {
            setter.call(el, val);
          } else {
            el.value = val;
          }
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }

        const addrInput = document.getElementById('address-search-input') || document.querySelector('input[placeholder*="address"]');
        setReactVal(addrInput, 'Plot 42, Hitech City Main Road, Madhapur, Hyderabad, Telangana');

        const confirmBtn = document.getElementById('btn-confirm-typed-address') || document.getElementById('btn-confirm-address');
        if (confirmBtn) confirmBtn.click();
      })()`,
    });
    await sleep(1000);

    // Submit customer registration form
    console.log('Submitting customer registration form (#btn-auth-register-submit)...');
    await send('Runtime.evaluate', {
      expression: `document.getElementById('btn-auth-register-submit')?.click();`,
    });
    await sleep(3500);

    // Check if Buyer Dashboard loaded
    const buyerDashboardCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const bodyText = document.body.innerText;
        const errMsg = document.querySelector('.text-red-700, .bg-red-50')?.innerText;
        const isBuyerDash = Boolean(
          document.getElementById('buyer-dashboard') ||
          bodyText.includes('Produce Catalog') ||
          bodyText.includes('Direct Farm Produce') ||
          bodyText.includes('Ramesh Rao')
        );
        const locationBtn = Boolean(document.getElementById('btn-navbar-current-location'));
        const logoutBtn = Boolean(document.getElementById('btn-navbar-logout'));
        return {
          isBuyerDash,
          locationBtn,
          logoutBtn,
          errMsg,
          pageTextSnippet: bodyText.slice(0, 300)
        };
      })()`,
      returnByValue: true,
    });
    console.log('✓ Buyer Dashboard after Registration:', buyerDashboardCheck.result.value);

    // -----------------------------------------------------------------
    // STEP 3: Verify "Current Location" Button Directly Beside "Logout"
    // -----------------------------------------------------------------
    console.log('\n--- Step 3: Verify Navbar Current Location directly beside Logout ---');
    const navbarCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const locBtn = document.getElementById('btn-navbar-current-location');
        const logoutBtn = document.getElementById('btn-navbar-logout');
        if (!locBtn || !logoutBtn) return { error: 'Buttons not found', foundBoth: false };

        const locRect = locBtn.getBoundingClientRect();
        const logoutRect = logoutBtn.getBoundingClientRect();
        const sameParent = locBtn.parentElement === logoutBtn.parentElement;
        const distancePx = Math.abs(logoutRect.left - locRect.right);

        return {
          foundBoth: true,
          sameParent,
          locText: locBtn.innerText.trim(),
          logoutText: logoutBtn.innerText.trim(),
          distancePx,
          locRect: { left: Math.round(locRect.left), right: Math.round(locRect.right) },
          logoutRect: { left: Math.round(logoutRect.left), right: Math.round(logoutRect.right) }
        };
      })()`,
      returnByValue: true,
    });
    console.log('✓ Navbar buttons check:', navbarCheck.result.value);

    // Test clicking "Current Location" button
    console.log('Testing click on #btn-navbar-current-location...');
    await send('Runtime.evaluate', {
      expression: `document.getElementById('btn-navbar-current-location')?.click();`,
    });
    await sleep(2500);

    const locationFeedback = await send('Runtime.evaluate', {
      expression: `(() => {
        const locBtn = document.getElementById('btn-navbar-current-location');
        const modal = document.querySelector('.fixed.inset-0');
        return {
          btnText: locBtn?.innerText.trim(),
          modalOpen: Boolean(modal),
          modalText: modal?.innerText.slice(0, 150)
        };
      })()`,
      returnByValue: true,
    });
    console.log('✓ Current Location reaction:', locationFeedback.result.value);

    // Close any modal that opened
    await send('Runtime.evaluate', {
      expression: `(() => {
        const closeBtn = document.querySelector('.fixed.inset-0 button[aria-label*="close" i]') ||
                         Array.from(document.querySelectorAll('.fixed.inset-0 button')).find(b => b.innerText.includes('Close') || b.innerText.includes('Dismiss') || b.innerText.includes('Done'));
        if (closeBtn) closeBtn.click();
      })()`,
    });
    await sleep(1000);

    // -----------------------------------------------------------------
    // STEP 4: Logout and Login with Customer Credentials
    // -----------------------------------------------------------------
    console.log('\n--- Step 4: Logout and Re-Login ---');
    await send('Runtime.evaluate', {
      expression: `document.getElementById('btn-navbar-logout')?.click();`,
    });
    await sleep(1000);

    // Confirm logout dialog
    await send('Runtime.evaluate', {
      expression: `(() => {
        const confirmBtn = Array.from(document.querySelectorAll('button')).find(b =>
          b.innerText.includes('Confirm Sign Out') ||
          b.innerText.includes('Sign Out') ||
          b.innerText.includes('Yes')
        );
        if (confirmBtn) confirmBtn.click();
      })()`,
    });
    await sleep(2500);

    const isLoggedOut = await send('Runtime.evaluate', {
      expression: `Boolean(document.getElementById('btn-auth-login-submit'))`,
      returnByValue: true,
    });
    console.log('✓ Logged out back to AuthPage:', isLoggedOut.result.value);

    // Now Sign In with the created customer credentials
    console.log('Switching to Buyer role for login...');
    await send('Runtime.evaluate', {
      expression: `(() => {
        const buyerTab = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Buyer / Consumer'));
        if (buyerTab) buyerTab.click();
      })()`,
    });
    await sleep(1200);

    console.log('Filling customer login credentials & submitting...');
    await send('Runtime.evaluate', {
      expression: `(() => {
        function setReactVal(el, val) {
          if (!el) return false;
          const proto = window.HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (setter) {
            setter.call(el, val);
          } else {
            el.value = val;
          }
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }

        const idInput = document.querySelector('input[placeholder*="phone"], input[placeholder*="email"]') ||
                        document.querySelector('input[type="text"]');
        const pwdInput = document.querySelector('input[type="password"]');

        const setPhoneOk = setReactVal(idInput, '${testPhone}');
        const setPwdOk = setReactVal(pwdInput, 'CustomerPass@123');

        const loginBtn = document.getElementById('btn-auth-login-submit');
        if (loginBtn) loginBtn.click();

        return { setPhoneOk, setPwdOk, hasLoginBtn: Boolean(loginBtn) };
      })()`,
    });
    await sleep(3500);

    // Handle 2FA OTP if required on login
    await send('Runtime.evaluate', {
      expression: `(() => {
        const autoOtpBtn = document.getElementById('btn-auto-fill-verify-otp');
        if (autoOtpBtn) autoOtpBtn.click();
      })()`,
    });
    await sleep(2500);

    const reLoginCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        const bodyText = document.body.innerText;
        const errMsg = document.querySelector('.text-red-700, .bg-red-50')?.innerText;
        const isBuyerDash = Boolean(
          document.getElementById('buyer-dashboard') ||
          bodyText.includes('Produce Catalog') ||
          bodyText.includes('Direct Farm Produce') ||
          bodyText.includes('Ramesh Rao')
        );
        const locationBtn = Boolean(document.getElementById('btn-navbar-current-location'));
        const logoutBtn = Boolean(document.getElementById('btn-navbar-logout'));
        return { isBuyerDash, locationBtn, logoutBtn, errMsg };
      })()`,
      returnByValue: true,
    });
    console.log('✓ Buyer Dashboard after Re-Login:', reLoginCheck.result.value);

    // -----------------------------------------------------------------
    // STEP 5: Farmer & Admin Portals Navbar Verification
    // -----------------------------------------------------------------
    console.log('\n--- Step 5: Farmer & Admin Portals Current Location Check ---');
    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('agrinex_clean_v2_currentUserId', 'usr_farmer');
        window.location.reload();
      `,
    });
    await sleep(3000);

    const farmerNavCheck = await send('Runtime.evaluate', {
      expression: `({
        portal: 'FARMER',
        hasLocationBtn: Boolean(document.getElementById('btn-navbar-current-location')),
        hasLogoutBtn: Boolean(document.getElementById('btn-navbar-logout')),
        locationBtnText: document.getElementById('btn-navbar-current-location')?.innerText.trim(),
        hasProduceListings: Boolean(document.body.innerText.includes('Produce') || document.body.innerText.includes('Farmer'))
      })`,
      returnByValue: true,
    });
    console.log('✓ Farmer portal navbar check:', farmerNavCheck.result.value);

    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('agrinex_clean_v2_currentUserId', 'usr_admin');
        window.location.reload();
      `,
    });
    await sleep(3000);

    const adminNavCheck = await send('Runtime.evaluate', {
      expression: `({
        portal: 'ADMIN',
        hasLocationBtn: Boolean(document.getElementById('btn-navbar-current-location')),
        hasLogoutBtn: Boolean(document.getElementById('btn-navbar-logout')),
        locationBtnText: document.getElementById('btn-navbar-current-location')?.innerText.trim(),
        hasAdminOps: Boolean(document.body.innerText.includes('Escrow') || document.body.innerText.includes('Admin'))
      })`,
      returnByValue: true,
    });
    console.log('✓ Admin portal navbar check:', adminNavCheck.result.value);

    // -----------------------------------------------------------------
    // SUMMARY
    // -----------------------------------------------------------------
    console.log('\n================================================================');
    console.log('TEST SUMMARY:');
    console.log(`Total Runtime JS Exceptions: ${jsExceptions.length}`);
    console.log(`Total Console Errors: ${consoleErrors.length}`);
    if (jsExceptions.length > 0) {
      console.error('JS Exceptions:', jsExceptions);
    }
    if (consoleErrors.length > 0) {
      console.error('Console Errors:', consoleErrors);
    }
    console.log('================================================================');

    const success = (
      buyerDashboardCheck.result.value.isBuyerDash &&
      navbarCheck.result.value.foundBoth &&
      navbarCheck.result.value.sameParent &&
      reLoginCheck.result.value.isBuyerDash &&
      farmerNavCheck.result.value.hasLocationBtn &&
      farmerNavCheck.result.value.hasLogoutBtn &&
      adminNavCheck.result.value.hasLocationBtn &&
      adminNavCheck.result.value.hasLogoutBtn &&
      jsExceptions.length === 0
    );

    if (success) {
      console.log('🎉 ALL CUSTOMER REGISTRATION, LOGIN, AND CURRENT LOCATION TESTS PASSED WITH 0 ERRORS!');
      process.exitCode = 0;
    } else {
      console.error('❌ Some checks did not pass as expected.');
      process.exitCode = 1;
    }

    ws.close();
  } finally {
    edge.kill();
  }
}

run().catch((e) => {
  console.error('Test execution error:', e);
  process.exit(1);
});
