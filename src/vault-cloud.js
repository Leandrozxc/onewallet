/* ============================================================================
 * One Wallet · Multi-Account, Web Crypto AES-GCM Vault & Supabase Cloud Engine
 * - Real-time date & configurable payday cycle engine (15th/30th, Monthly, Custom)
 * - Client-side PBKDF2-SHA256 + AES-GCM-256 card vault encryption (Web Crypto API)
 * - Live Supabase Auth + PostgREST cloud adapter with local multi-account store
 * ============================================================================ */
(function (global) {
  'use strict';

  const STORAGE_ACCOUNTS = 'onewallet_accounts_v2';
  const STORAGE_SESSION = 'onewallet_active_session_v2';
  const STORAGE_SB_CFG = 'onewallet_supabase_cfg_v1';

  /* Default Live Supabase Cloud Project (One Wallet · ap-southeast-1) */
  const DEFAULT_SUPABASE = {
    url: 'https://jcuxcrxmpvmliewpnewe.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjdXhjcnhtcHZtbGlld3BuZXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3MjQxMzgsImV4cCI6MjExMDMwMDEzOH0.IoyhWd1dq1uj88vnSmAbB6orDYXaxGUiF5qI8wdJmks'
  };

  const pad2 = n => (n < 10 ? '0' : '') + n;

  /* ---------- 1. Real-Time Date & Configurable Payday Engine ---------- */
  const toISODate = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

  function todayISO() {
    return toISODate(new Date());
  }

  function shiftDaysISO(isoDate, deltaDays) {
    const [y, m, d] = isoDate.split('-').map(Number);
    const dt = new Date(y, m - 1, d + deltaDays);
    return toISODate(dt);
  }

  function computeNextPayday(baseISO, mode = 'bimonthly', customDate = '') {
    const [y, m, d] = baseISO.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const endDay = Math.min(30, lastDay);

    if (mode === 'custom' && /^\d{4}-\d{2}-\d{2}$/.test(customDate) && customDate > baseISO) {
      return customDate;
    }
    if (mode === 'monthly-15') {
      if (d < 15) return `${y}-${pad2(m)}-15`;
      const next = new Date(y, m, 15);
      return toISODate(next);
    }
    if (mode === 'monthly-30') {
      if (d < endDay) return `${y}-${pad2(m)}-${pad2(endDay)}`;
      const nextLast = Math.min(30, new Date(y, m + 1, 0).getDate());
      return toISODate(new Date(y, m, nextLast));
    }
    // Default 'bimonthly': 15th & 30th (Philippine payroll standard)
    if (d < 15) return `${y}-${pad2(m)}-15`;
    if (d < endDay) return `${y}-${pad2(m)}-${pad2(endDay)}`;
    return toISODate(new Date(y, m, 15));
  }

  function paydayModeLabel(mode) {
    if (mode === 'monthly-15') return 'Every 15th of the month';
    if (mode === 'monthly-30') return 'Every 30th / end of month';
    if (mode === 'custom') return 'Custom target date';
    return '15th & 30th (Bi-monthly)';
  }

  /* ---------- 2. Web Crypto API: PBKDF2-SHA256 & AES-GCM-256 ---------- */
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const bytesToHex = buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  const hexToBytes = hex => {
    const clean = String(hex || '').replace(/[^0-9a-f]/gi, '');
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    return out;
  };
  const bytesToB64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const b64ToBytes = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

  function randomSaltHex(len = 16) {
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    return bytesToHex(arr);
  }

  async function hashPassword(password, saltHex) {
    const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: hexToBytes(saltHex), iterations: 60000, hash: 'SHA-256' },
      baseKey,
      256
    );
    return bytesToHex(bits);
  }

  async function deriveVaultKey(password, saltHex) {
    const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: hexToBytes(saltHex), iterations: 60000, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encryptVaultPayload(secretObj, cryptoKey) {
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    const pt = enc.encode(JSON.stringify(secretObj));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, pt);
    return `aes256gcm:${bytesToHex(iv)}:${bytesToB64(ct)}`;
  }

  async function decryptVaultPayload(payloadStr, cryptoKey) {
    if (!payloadStr || !payloadStr.startsWith('aes256gcm:') || !cryptoKey) return null;
    try {
      const [, ivHex, ctB64] = payloadStr.split(':');
      const ptBuf = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: hexToBytes(ivHex) },
        cryptoKey,
        b64ToBytes(ctB64)
      );
      return JSON.parse(dec.decode(ptBuf));
    } catch (e) {
      return null;
    }
  }

  /* ---------- 3. Supabase Cloud REST & Auth Client ---------- */
  function getSupabaseConfig() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_SB_CFG) || 'null');
      if (saved && saved.url && saved.anonKey) return saved;
    } catch (e) {}
    if (global.ONEWALLET_SUPABASE && global.ONEWALLET_SUPABASE.url && global.ONEWALLET_SUPABASE.anonKey) {
      return global.ONEWALLET_SUPABASE;
    }
    return DEFAULT_SUPABASE;
  }

  function setSupabaseConfig(url, anonKey) {
    const cleanUrl = String(url || '').trim().replace(/\/+$/, '');
    const cleanKey = String(anonKey || '').trim();
    if (!cleanUrl || !cleanKey) {
      localStorage.removeItem(STORAGE_SB_CFG);
      return DEFAULT_SUPABASE;
    }
    const cfg = { url: cleanUrl, anonKey: cleanKey };
    localStorage.setItem(STORAGE_SB_CFG, JSON.stringify(cfg));
    return cfg;
  }

  function isSupabaseConfigured() {
    const cfg = getSupabaseConfig();
    return Boolean(cfg.url && cfg.anonKey);
  }

  async function sbFetch(path, { method = 'GET', body = null, token = '', prefer = '' } = {}) {
    const { url, anonKey } = getSupabaseConfig();
    if (!url || !anonKey) throw new Error('Supabase URL and Anon Key are not configured.');
    const headers = {
      apikey: anonKey,
      Authorization: `Bearer ${token || anonKey}`,
      'Content-Type': 'application/json'
    };
    if (prefer) headers.Prefer = prefer;
    const res = await fetch(`${url}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    if (!res.ok) {
      const msg = data?.msg || data?.error_description || data?.message || data?.error || `Supabase HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }

  /* ---------- 4. Multi-Account Registry & Cloud Sync ---------- */
  function loadRegistry() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_ACCOUNTS) || '{}');
      return raw && typeof raw === 'object' ? raw : {};
    } catch (e) {
      return {};
    }
  }

  function saveRegistry(reg) {
    try { localStorage.setItem(STORAGE_ACCOUNTS, JSON.stringify(reg)); } catch (e) {}
  }

  function listAccounts() {
    const reg = loadRegistry();
    return Object.values(reg).map(acc => ({
      id: acc.id,
      email: acc.email,
      fullName: acc.fullName,
      paydayMode: acc.paydayMode || 'bimonthly',
      customPayday: acc.customPayday || '',
      isDemo: Boolean(acc.isDemo),
      cloudSynced: Boolean(acc.cloudSynced),
      walletCount: (acc.w || []).length
    }));
  }

  async function buildEncryptedWallet(rawWallet, cryptoKey) {
    const digits = String(rawWallet.num || '4532891023414821').replace(/\D/g, '').slice(0, 16).padEnd(16, '0');
    const last4 = digits.slice(12, 16);
    const exp = rawWallet.exp || '08/29';
    const cvv = String(rawWallet.cvv || '418').replace(/\D/g, '').slice(0, 4) || '418';
    const holder = String(rawWallet.holder || 'JUAN DELA CRUZ').toUpperCase();
    const encrypted_card_vault = await encryptVaultPayload({ num: digits, exp, cvv, holder }, cryptoKey);
    return {
      id: rawWallet.id,
      n: rawWallet.n,
      b: Number(rawWallet.b) || 0,
      style: rawWallet.style || 'gcash',
      last4,
      encrypted_card_vault
    };
  }

  async function hydrateWalletsInMemory(storedWallets, cryptoKey, fallbackHolder = 'ONE WALLET USER') {
    const out = [];
    for (const w of storedWallets || []) {
      let secret = null;
      if (w.encrypted_card_vault && cryptoKey) {
        secret = await decryptVaultPayload(w.encrypted_card_vault, cryptoKey);
      }
      const last4 = w.last4 || (w.num ? String(w.num).slice(-4) : '4821');
      out.push({
        id: w.id ?? w.client_id,
        n: w.n || w.name || 'Wallet',
        b: Number(w.b ?? w.balance ?? 0),
        style: w.style || 'gcash',
        last4,
        encrypted_card_vault: w.encrypted_card_vault || '',
        num: secret?.num || `000000000000${last4}`,
        exp: secret?.exp || '08/29',
        cvv: secret?.cvv || '000',
        holder: secret?.holder || fallbackHolder.toUpperCase()
      });
    }
    return out;
  }

  async function createStarterWorkspace({ preset = 'starter', fullName = 'Juan Dela Cruz', cryptoKey }) {
    const holder = (fullName || 'JUAN DELA CRUZ').toUpperCase();
    const td = todayISO();
    const yd = shiftDaysISO(td, -1);

    if (preset === 'blank') {
      return { w: [], t: [], b: [], n: 10 };
    }

    const isDemo = preset === 'demo';
    const rawWallets = [
      { id: 1, n: 'GCash', b: isDemo ? 1200 : 0, style: 'gcash', num: '5399640288104821', exp: '08/29', cvv: '418', holder },
      { id: 2, n: 'Maya', b: isDemo ? 2100 : 0, style: 'maya-black', num: '4532710499201104', exp: '11/28', cvv: '903', holder },
      { id: 3, n: 'GoTyme', b: isDemo ? 800 : 0, style: 'gotyme', num: '4288190033417762', exp: '04/30', cvv: '625', holder },
      { id: 4, n: 'Cash', b: isDemo ? 150 : 0, style: 'cash', num: '5412750019283390', exp: '06/29', cvv: '712', holder }
    ];
    const w = [];
    for (const rw of rawWallets) {
      w.push(await buildEncryptedWallet(rw, cryptoKey));
    }

    const t = isDemo ? [
      { id: 1, d: td.slice(5), fullDate: td, s: 'Jollibee', c: 'Food', w: 1, a: -189 },
      { id: 2, d: td.slice(5), fullDate: td, s: 'Payroll credit', c: 'Income', w: 2, a: 12000 },
      { id: 3, d: yd.slice(5), fullDate: yd, s: 'Data load', c: 'Load', w: 1, a: -50 },
      { id: 4, d: yd.slice(5), fullDate: yd, s: 'Grab ride', c: 'Transport', w: 1, a: -140 }
    ] : [];

    const b = isDemo ? [
      { id: 1, n: 'Home Wi-Fi', a: 1299, d: shiftDaysISO(td, 5).slice(5) },
      { id: 2, n: 'Spotify', a: 200, d: shiftDaysISO(td, 9).slice(5) }
    ] : [];

    return { w, t, b, n: 20 };
  }

  let syncChain = Promise.resolve();
  let lastSyncFingerprint = '';

  /* Sync an account's current workspace to Supabase Postgres if connected */
  function syncAccountToSupabase(acc, accessToken, force = false) {
    if (!isSupabaseConfigured() || !accessToken || !acc.sbUserId) return Promise.resolve(false);
    const fp = JSON.stringify({
      u: acc.sbUserId,
      n: acc.fullName,
      pm: acc.paydayMode,
      cp: acc.customPayday,
      w: acc.w,
      t: acc.t,
      b: acc.b
    });
    if (!force && fp === lastSyncFingerprint) return Promise.resolve(true);
    lastSyncFingerprint = fp;

    syncChain = syncChain.then(async () => {
      try {
        const uid = acc.sbUserId;
        await sbFetch('/rest/v1/profiles?on_conflict=id', {
          method: 'POST',
          token: accessToken,
          prefer: 'resolution=merge-duplicates,return=minimal',
          body: {
            id: uid,
            full_name: acc.fullName,
            email: acc.email,
            payday_mode: acc.paydayMode || 'bimonthly',
            custom_payday: acc.customPayday || null,
            vault_salt: acc.salt
          }
        });

        await sbFetch(`/rest/v1/wallets?user_id=eq.${uid}`, { method: 'DELETE', token: accessToken });
        if (acc.w && acc.w.length) {
          await sbFetch('/rest/v1/wallets?on_conflict=user_id,client_id', {
            method: 'POST',
            token: accessToken,
            prefer: 'resolution=merge-duplicates,return=minimal',
            body: acc.w.map(w => ({
              user_id: uid,
              client_id: w.id,
              name: w.n,
              balance: w.b,
              style: w.style,
              last4: w.last4,
              encrypted_card_vault: w.encrypted_card_vault
            }))
          });
        }

        await sbFetch(`/rest/v1/ledger_entries?user_id=eq.${uid}`, { method: 'DELETE', token: accessToken });
        if (acc.t && acc.t.length) {
          await sbFetch('/rest/v1/ledger_entries?on_conflict=user_id,client_id', {
            method: 'POST',
            token: accessToken,
            prefer: 'resolution=merge-duplicates,return=minimal',
            body: acc.t.map(t => ({
              user_id: uid,
              client_id: t.id,
              wallet_client_id: t.w,
              entry_date: t.d,
              merchant: t.s,
              category: t.c,
              amount: t.a
            }))
          });
        }

        await sbFetch(`/rest/v1/bills?user_id=eq.${uid}`, { method: 'DELETE', token: accessToken });
        if (acc.b && acc.b.length) {
          await sbFetch('/rest/v1/bills?on_conflict=user_id,client_id', {
            method: 'POST',
            token: accessToken,
            prefer: 'resolution=merge-duplicates,return=minimal',
            body: acc.b.map(b => ({
              user_id: uid,
              client_id: b.id,
              name: b.n,
              amount: b.a,
              due_label: b.d
            }))
          });
        }
        return true;
      } catch (e) {
        console.warn('Supabase sync notice:', e.message);
        return false;
      }
    });
    return syncChain;
  }

  async function pullAccountFromSupabase(uid, accessToken) {
    if (!isSupabaseConfigured() || !accessToken || !uid) return null;
    try {
      const profiles = await sbFetch(`/rest/v1/profiles?id=eq.${uid}&select=*`, { token: accessToken });
      const prof = Array.isArray(profiles) ? profiles[0] : null;
      if (!prof) return null;

      const wallets = await sbFetch(`/rest/v1/wallets?user_id=eq.${uid}&order=client_id.asc`, { token: accessToken });
      const entries = await sbFetch(`/rest/v1/ledger_entries?user_id=eq.${uid}&order=client_id.desc`, { token: accessToken });
      const bills = await sbFetch(`/rest/v1/bills?user_id=eq.${uid}&order=client_id.asc`, { token: accessToken });

      const w = (wallets || []).map(x => ({
        id: x.client_id,
        n: x.name,
        b: Number(x.balance),
        style: x.style,
        last4: x.last4,
        encrypted_card_vault: x.encrypted_card_vault
      }));
      const t = (entries || []).map(x => ({
        id: x.client_id,
        d: x.entry_date,
        s: x.merchant,
        c: x.category,
        w: x.wallet_client_id,
        a: Number(x.amount)
      }));
      const b = (bills || []).map(x => ({
        id: x.client_id,
        n: x.name,
        a: Number(x.amount),
        d: x.due_label
      }));
      const maxId = Math.max(20, ...w.map(x => x.id || 0), ...t.map(x => x.id || 0), ...b.map(x => x.id || 0));

      return {
        fullName: prof.full_name,
        email: prof.email,
        paydayMode: prof.payday_mode || 'bimonthly',
        customPayday: prof.custom_payday || '',
        salt: prof.vault_salt,
        w,
        t,
        b,
        n: maxId + 1
      };
    } catch (e) {
      console.warn('Supabase pull notice:', e.message);
      return null;
    }
  }

  global.OWVault = {
    todayISO,
    shiftDaysISO,
    computeNextPayday,
    paydayModeLabel,
    randomSaltHex,
    hashPassword,
    deriveVaultKey,
    encryptVaultPayload,
    decryptVaultPayload,
    getSupabaseConfig,
    setSupabaseConfig,
    isSupabaseConfigured,
    sbFetch,
    loadRegistry,
    saveRegistry,
    listAccounts,
    buildEncryptedWallet,
    hydrateWalletsInMemory,
    createStarterWorkspace,
    syncAccountToSupabase,
    pullAccountFromSupabase,
    STORAGE_SESSION
  };
})(window);
