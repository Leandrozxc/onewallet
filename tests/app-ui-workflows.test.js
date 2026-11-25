'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

// Browser-faithful headless DOM harness to exercise src/app.js end-to-end
function setupDOMEnvironment() {
  const storageMap = new Map();
  const winListeners = {};
  const docListeners = {};
  let quotaExceeded = false;
  let currentHash = '#login';

  const elements = {
    app: { id: 'app', innerHTML: '' },
    'shell-root': { id: 'shell-root', innerHTML: '' },
    'modal-root': {
      id: 'modal-root',
      innerHTML: '',
      querySelector: () => null
    },
    'status-toast': {
      id: 'status-toast',
      textContent: '',
      classList: { remove() {}, add() {} }
    }
  };
  const inputs = {};

  function setInput(id, value, type = 'text') {
    inputs[id] = {
      id,
      value: String(value),
      type,
      focus() {}
    };
  }

  function emitWindow(type, ev = {}) {
    for (const fn of winListeners[type] || []) fn(ev);
  }

  function emitDoc(type, ev = {}) {
    for (const fn of docListeners[type] || []) fn(ev);
  }

  globalThis.__OW_DISABLE_AUTOBOOT__ = true;
  globalThis.localStorage = {
    getItem: k => (storageMap.has(k) ? storageMap.get(k) : null),
    setItem: (k, v) => {
      if (quotaExceeded) throw new Error('QuotaExceededError: Storage limit reached');
      storageMap.set(k, String(v));
    },
    removeItem: k => { storageMap.delete(k); },
    clear: () => { storageMap.clear(); }
  };

  globalThis.location = {
    get hash() {
      return currentHash;
    },
    set hash(v) {
      const next = String(v).startsWith('#') ? String(v) : '#' + String(v);
      if (next !== currentHash) {
        currentHash = next;
        emitWindow('hashchange', {});
      }
    },
    replace(h) {
      const next = String(h).startsWith('#') ? String(h) : '#' + String(h);
      if (next !== currentHash) {
        currentHash = next;
        emitWindow('hashchange', {});
      }
    }
  };

  globalThis.document = {
    title: 'One Wallet',
    hidden: false,
    activeElement: null,
    body: { appendChild() {} },
    getElementById(id) {
      if (elements[id]) return elements[id];
      if (inputs[id]) return inputs[id];
      return null;
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener(type, fn) {
      (docListeners[type] ||= []).push(fn);
    }
  };

  globalThis.window = globalThis;
  globalThis.window.scrollTo = () => {};
  globalThis.window.matchMedia = () => ({ matches: false });
  globalThis.window.addEventListener = (type, fn) => {
    (winListeners[type] ||= []).push(fn);
  };

  for (const mod of ['../src/money.js', '../src/domain.js', '../src/alert-parser.js', '../src/vault-cloud.js', '../src/cards.js', '../src/app.js']) {
    delete require.cache[require.resolve(mod)];
  }

  const Vault = require('../src/vault-cloud.js');
  Vault.setFetchAdapter(async () => ({
    ok: false,
    status: 503,
    text: async () => JSON.stringify({ message: 'Offline test environment' })
  }));
  require('../src/money.js');
  require('../src/domain.js');
  require('../src/alert-parser.js');
  require('../src/cards.js');
  require('../src/app.js');

  function clickAction(action, dataset = {}) {
    const fakeEl = { dataset: { action, ...dataset } };
    const ev = {
      stopPropagation() {},
      preventDefault() {},
      target: {
        hasAttribute: () => false,
        closest: sel => (sel === '[data-action]' ? fakeEl : null)
      }
    };
    for (const fn of docListeners.click || []) fn(ev);
  }

  async function waitUntilIdle(maxMs = 4000) {
    const start = Date.now();
    while (globalThis.OWApp.getState().authBusy && Date.now() - start < maxMs) {
      await new Promise(r => setTimeout(r, 25));
    }
    await new Promise(r => setTimeout(r, 25));
  }

  return {
    elements,
    inputs,
    setInput,
    clickAction,
    waitUntilIdle,
    setQuotaExceeded(flag) { quotaExceeded = flag; },
    emitWindow,
    emitDoc
  };
}

test('Production CSS & Responsive/Accessibility Markup Verification', () => {
  const cssPath = path.resolve(__dirname, '../dist/output.css');
  assert.ok(fs.existsSync(cssPath), 'dist/output.css must exist after npm run build');
  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(css.length > 15000, 'Compiled CSS bundle should contain full Tailwind utilities');

  // Verify DESIGN.md Ledger Cobalt accent (#1D5FBF / #1d5fbf), tabular-nums, skip-link, reduced-motion, and breakpoints
  assert.match(css, /#1d5fbf/i);
  assert.ok(css.includes('tabular-nums'));
  assert.ok(css.includes('.skip-link'));
  assert.ok(css.includes('prefers-reduced-motion'));
  assert.ok(css.includes('sm\\:grid-cols-2'));
  assert.ok(css.includes('touch-target'));
});

test('Navigation, Route Auth Guard, Accessibility Landmarks & Auto-Masking', async () => {
  const env = setupDOMEnvironment();
  await globalThis.OWApp.initApp();

  // 1. Unauthenticated route guard blocks protected hashes
  assert.equal(globalThis.OWApp.getState().authenticated, false);
  for (const protectedHash of ['#today', '#wallets', '#ledger', '#import', '#bills', '#insights', '#settings']) {
    globalThis.location.hash = protectedHash;
    assert.equal(globalThis.location.hash, '#login');
    assert.equal(globalThis.OWApp.getState().view, 'login');
  }

  // 2. Open Demo Sandbox & verify all 9 views render valid semantic HTML with zero "undefined"
  env.clickAction('open-demo');
  await env.waitUntilIdle();
  assert.equal(globalThis.OWApp.getState().authenticated, true);
  assert.equal(globalThis.OWApp.getState().view, 'today');

  for (const view of ['today', 'wallets', 'ledger', 'import', 'bills', 'insights', 'settings', 'help', 'more']) {
    globalThis.location.hash = `#${view}`;
    const html = env.elements['shell-root'].innerHTML;
    assert.ok(html.includes('<main id="main"'), `Missing <main id="main"> landmark in #${view}`);
    assert.ok(html.includes('Skip to main content'), `Missing skip-link in #${view}`);
    assert.equal(html.includes('undefined'), false, `Unexpected "undefined" text in #${view}`);
    assert.equal(html.includes('NaN'), false, `Unexpected "NaN" text in #${view}`);
  }

  // 3. Auto-masking on visibilitychange (tab switch) and window blur
  globalThis.OWApp.getState().revealed[1] = true;
  globalThis.document.hidden = true;
  env.emitDoc('visibilitychange', {});
  assert.deepEqual(globalThis.OWApp.getState().revealed, {});
  globalThis.document.hidden = false;

  // 4. Sign out wipes memory & session
  env.clickAction('signout');
  assert.equal(globalThis.OWApp.getState().authenticated, false);
  assert.equal(globalThis.OWApp.getState().w.length, 0);
});

test('Interactive Workflows: Form Validation, Duplicate Guard, Partial & Recurring Bills, SMS Import', async () => {
  const env = setupDOMEnvironment();
  await globalThis.OWApp.initApp();
  env.clickAction('open-demo');
  await env.waitUntilIdle();

  // 1. Form validation in Add Entry modal sets aria-invalid & aria-describedby
  globalThis.OWApp.openModal('tx');
  env.setInput('ty', '-1');
  env.setInput('am', '0');
  env.setInput('mw', '1');
  env.setInput('mc', 'Food');
  env.setInput('nt', 'Coffee');
  env.setInput('tnote', '');
  env.setInput('td', '2026-11-25');
  env.clickAction('save-tx');

  const errModalHtml = env.elements['modal-root'].innerHTML;
  assert.ok(errModalHtml.includes('aria-invalid="true"'));
  assert.ok(errModalHtml.includes('aria-describedby="am-err"'));

  // 2. Valid entry saves cleanly & second identical entry triggers duplicate confirmation guard
  const startGcashBal = globalThis.OWApp.getState().w.find(w => w.id === 1).b;
  env.setInput('am', '125.25');
  env.setInput('nt', 'starbucks');
  env.clickAction('save-tx');
  assert.equal(globalThis.OWApp.getState().modal, '');
  assert.equal(globalThis.OWApp.getState().w.find(w => w.id === 1).b, Number((startGcashBal - 125.25).toFixed(2)));
  assert.equal(globalThis.OWApp.getState().t[0].s, 'Starbucks');

  globalThis.OWApp.openModal('tx');
  env.setInput('ty', '-1');
  env.setInput('am', '125.25');
  env.setInput('mw', '1');
  env.setInput('mc', 'Food');
  env.setInput('nt', 'Starbucks');
  env.setInput('tnote', '');
  env.setInput('td', '2026-11-25');
  env.clickAction('save-tx');
  assert.equal(globalThis.OWApp.getState().modal, 'tx');
  assert.ok(env.elements['modal-root'].innerHTML.includes('Similar entry already exists'));

  // 3. Partial Bill Payment + Recurring Monthly Rollover
  assert.equal(globalThis.OWApp.getState().b.find(b => b.id === 1).a, 1299);
  globalThis.OWApp.openModal('payBill', 1);
  env.setInput('pw', '2');
  env.setInput('pa', '299.00');
  env.clickAction('confirm-pay-bill');
  assert.equal(globalThis.OWApp.getState().b.find(b => b.id === 1).a, 1000);

  const prevDue = globalThis.OWApp.getState().b.find(b => b.id === 1).dueDate;
  globalThis.OWApp.openModal('payBill', 1);
  env.setInput('pw', '2');
  env.setInput('pa', '1000.00');
  env.clickAction('confirm-pay-bill');
  const rolledBill = globalThis.OWApp.getState().b.find(b => b.id === 1);
  assert.ok(rolledBill.dueDate > prevDue);
  assert.equal(rolledBill.a, 1299);

  // 4. SMS Import: rejects OTP, imports valid edited BPI 7-Eleven alert
  globalThis.location.hash = '#import';
  env.setInput('raw', 'GCash: Your OTP is 884120 for PHP 500.00. Never share your OTP.');
  env.clickAction('read-alert');
  assert.ok(env.elements['shell-root'].innerHTML.includes('Notification was not imported'));

  env.setInput('raw', 'BPI Alert: PHP 145.50 was paid at 7-Eleven. Trace No. 774102.');
  env.clickAction('read-alert');
  assert.equal(globalThis.OWApp.getState().pr.valid, true);
  env.setInput('imp-dir', '-1');
  env.setInput('imp-amt', '145.50');
  env.setInput('imp-merch', '7-Eleven Makati');
  env.setInput('imp-cat', 'Food');
  env.setInput('imp-date', '2026-11-25');
  env.setInput('imp-wal', '1');
  env.setInput('imp-ref', '774102');
  env.clickAction('confirm-alert');
  assert.equal(globalThis.OWApp.getState().view, 'ledger');
  assert.equal(globalThis.OWApp.getState().t[0].s, '7-Eleven Makati');
});

test('Failure & Recovery: Real Account Reload Vault Lock/Unlock (No demo1234 Fallback) & Quota Error Banner', async () => {
  const env = setupDOMEnvironment();
  await globalThis.OWApp.initApp();

  // 1. Register a real non-demo account with an encrypted card
  env.clickAction('switch-auth-tab', { tab: 'signup' });
  env.setInput('reg-name', 'Maria Santos');
  env.setInput('reg-email', 'maria@onewallet.test');
  env.setInput('reg-pwd', 'StrongPass#2026', 'password');
  env.setInput('reg-payday', 'bimonthly');
  env.setInput('reg-preset', 'starter');
  env.clickAction('signup');
  await env.waitUntilIdle();

  assert.equal(globalThis.OWApp.getState().authenticated, true);
  assert.equal(globalThis.OWApp.getState().isDemo, false);

  // Add a card with real PAN & CVV while unlocked
  globalThis.OWApp.openModal('wallet', 1);
  env.setInput('wnm', 'GCash Card');
  env.setInput('wb', '500.00');
  env.setInput('wnum', '5399640211119999');
  env.setInput('wexp', '10/29');
  env.setInput('wcvv', '777');
  env.setInput('wholder', 'MARIA SANTOS');
  env.clickAction('save-wallet');
  for (let i = 0; i < 40 && globalThis.OWApp.getState().modal !== ''; i++) {
    await new Promise(r => setTimeout(r, 25));
  }
  assert.equal(globalThis.OWApp.getState().w[0].last4, '9999');
  assert.equal(globalThis.OWApp.getState().t[0].s, 'Balance correction');
  assert.equal(globalThis.OWApp.getState().t[0].a, 500);

  // 2. Simulate page reload by locking vault in memory, then attempting to reveal card info
  env.clickAction('lock-vault-now');
  assert.equal(globalThis.OWApp.getState().w[0].num, '');
  assert.equal(globalThis.OWApp.getState().w[0].cvv, '');

  env.clickAction('reveal-card', { id: '1' });
  assert.equal(globalThis.OWApp.getState().modal, 'unlockVault');

  // Wrong password rejected
  env.setInput('unlock-pwd', 'WrongPassword123', 'password');
  env.clickAction('confirm-unlock-vault');
  await new Promise(r => setTimeout(r, 400));
  assert.equal(globalThis.OWApp.getState().modal, 'unlockVault');
  assert.ok(env.elements['modal-root'].innerHTML.includes('Incorrect password'));

  // Correct password unlocks and reveals the exact original encrypted PAN & CVV!
  env.setInput('unlock-pwd', 'StrongPass#2026', 'password');
  env.clickAction('confirm-unlock-vault');
  for (let i = 0; i < 60 && globalThis.OWApp.getState().modal !== ''; i++) {
    await new Promise(r => setTimeout(r, 40));
  }
  assert.equal(globalThis.OWApp.getState().modal, '');
  assert.equal(globalThis.OWApp.getState().w[0].num, '5399640211119999');
  assert.equal(globalThis.OWApp.getState().w[0].cvv, '777');
  assert.equal(globalThis.OWApp.getState().revealed[1], true);

  // 3. Storage quota exceeded surfaces warning banner instead of crashing
  env.setQuotaExceeded(true);
  globalThis.OWApp.getState().wid = 1;
  globalThis.OWApp.openModal('reconcile');
  env.setInput('rb', '600.00');
  env.clickAction('save-reconcile');
  assert.ok(globalThis.OWApp.getState().storageWarning.includes('QuotaExceededError'));
  assert.ok(env.elements['shell-root'].innerHTML.includes('Local storage warning'));
  env.setQuotaExceeded(false);
});
