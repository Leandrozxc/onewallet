/* ============================================================================
 * One Wallet · Hardened Web Crypto Vault, Multi-Account Store & Safe Cloud Sync
 * - Domain-separated PBKDF2-SHA256 (600,000 iterations) + legacy v2 migration
 * - Client-side AES-256-GCM card vault with optional cardless wallet support
 * - Non-destructive Supabase sync (atomic RPC + upsert-first fallback + retry)
 * ============================================================================ */
(function (global) {
  'use strict';

  const Money = global.OWMoney || (typeof require === 'function' ? require('./money.js') : null);
  const Domain = global.OWDomain || (typeof require === 'function' ? require('./domain.js') : null);

  const STORAGE_ACCOUNTS = 'onewallet_accounts_v2';
  const STORAGE_SESSION = 'onewallet_active_session_v2';
  const STORAGE_SB_CFG = 'onewallet_supabase_cfg_v1';

  const KDF_ITERATIONS_V3 = 600000;
  const KDF_ITERATIONS_V2 = 60000;

  /* Default Live Supabase Cloud Project (One Wallet · ap-southeast-1) */
  const DEFAULT_SUPABASE = {
    url: 'https://jcuxcrxmpvmliewpnewe.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjdXhjcnhtcHZtbGlld3BuZXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3MjQxMzgsImV4cCI6MjExMDMwMDEzOH0.IoyhWd1dq1uj88vnSmAbB6orDYXaxGUiF5qI8wdJmks'
  };

  /* ---------- Pluggable Storage Adapter (Browser localStorage + Node Tests) ---------- */
  const memoryStore = new Map();
  let customStorage = null;

  function getStorage() {
    if (customStorage) return customStorage;
    if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
    return {
      getItem: k => (memoryStore.has(k) ? memoryStore.get(k) : null),
      setItem: (k, v) => { memoryStore.set(k, String(v)); },
      removeItem: k => { memoryStore.delete(k); },
      clear: () => { memoryStore.clear(); }
    };
  }

  function setStorageAdapter(adapter) {
    customStorage = adapter || null;
  }

  /* ---------- 1. Date & Payday Façade (delegating to OWDomain) ---------- */
  const todayISO = () => Domain.todayISO();
  const shiftDaysISO = (iso, delta) => Domain.shiftDaysISO(iso, delta);
  const computeNextPayday = (baseISO, mode, customDate) => Domain.computeNextPayday(baseISO, mode, customDate);
  const computePaydayState = (baseISO, mode, customDate) => Domain.computePaydayState(baseISO, mode, customDate);
  const paydayModeLabel = mode => Domain.paydayModeLabel(mode);

  /* ---------- 2. Web Crypto API: Domain-Separated PBKDF2 & AES-256-GCM ---------- */
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const bytesToHex = buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  const hexToBytes = hex => {
    const clean = String(hex || '').replace(/[^0-9a-f]/gi, '');
    const even = clean.length % 2 === 0 ? clean : '0' + clean;
    const out = new Uint8Array(even.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(even.slice(i * 2, i * 2 + 2), 16);
    return out;
  };
  const bytesToB64 = buf => {
    if (typeof btoa === 'function') {
      let bin = '';
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return btoa(bin);
    }
    return Buffer.from(buf).toString('base64');
  };
  const b64ToBytes = b64 => {
    if (typeof atob === 'function') {
      const bin = atob(b64);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    return new Uint8Array(Buffer.from(b64, 'base64'));
  };

  function parseSaltSpec(saltStr) {
    const raw = String(saltStr || '').trim();
    if (raw.startsWith('v3:')) {
      return { version: 3, rawHex: raw.slice(3), iterations: KDF_ITERATIONS_V3, serialized: raw };
    }
    return { version: 2, rawHex: raw, iterations: KDF_ITERATIONS_V2, serialized: raw };
  }

  function randomSaltHex(len = 16, { versioned = true } = {}) {
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    const hex = bytesToHex(arr);
    return versioned ? `v3:${hex}` : hex;
  }

  /**
   * Domain-separated password verification hash.
   * In v3, uses salt 'ow-auth-v3:<hex>' at 600,000 iterations so pwdHash in
   * localStorage is cryptographically independent of the AES-256-GCM vault key.
   */
  async function hashPassword(password, saltStr, { iterationsOverride = 0 } = {}) {
    const spec = parseSaltSpec(saltStr);
    const baseKey = await crypto.subtle.importKey('raw', enc.encode(String(password)), 'PBKDF2', false, ['deriveBits']);
    const saltBytes = spec.version >= 3
      ? enc.encode(`ow-auth-v3:${spec.rawHex}`)
      : hexToBytes(spec.rawHex);
    const iterations = iterationsOverride || spec.iterations;
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
      baseKey,
      256
    );
    return bytesToHex(bits);
  }

  /**
   * Constant-time string comparison for hex password digests.
   */
  function timingSafeEqualHex(a, b) {
    const sa = String(a || '');
    const sb = String(b || '');
    if (!sa || sa.length !== sb.length) return false;
    let diff = 0;
    for (let i = 0; i < sa.length; i++) {
      diff |= sa.charCodeAt(i) ^ sb.charCodeAt(i);
    }
    return diff === 0;
  }

  /**
   * Domain-separated non-extractable AES-256-GCM CryptoKey derivation.
   * In v3, uses salt 'ow-vault-v3:<hex>' at 600,000 iterations.
   */
  async function deriveVaultKey(password, saltStr, { iterationsOverride = 0 } = {}) {
    const spec = parseSaltSpec(saltStr);
    const baseKey = await crypto.subtle.importKey('raw', enc.encode(String(password)), 'PBKDF2', false, ['deriveKey']);
    const saltBytes = spec.version >= 3
      ? enc.encode(`ow-vault-v3:${spec.rawHex}`)
      : hexToBytes(spec.rawHex);
    const iterations = iterationsOverride || spec.iterations;
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encryptVaultPayload(secretObj, cryptoKey) {
    if (!cryptoKey) throw new Error('Vault encryption key is locked. Sign in to unlock your card vault.');
    const iv = new Uint8Array(12);
    crypto.getRandomValues(iv);
    const pt = enc.encode(JSON.stringify(secretObj));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, pt);
    return `aes256gcm:${bytesToHex(iv)}:${bytesToB64(ct)}`;
  }

  async function decryptVaultPayload(payloadStr, cryptoKey) {
    if (!payloadStr || typeof payloadStr !== 'string' || !payloadStr.startsWith('aes256gcm:') || !cryptoKey) {
      return null;
    }
    try {
      const parts = payloadStr.split(':');
      if (parts.length !== 3) return null;
      const [, ivHex, ctB64] = parts;
      if (ivHex.length !== 24 || !ctB64) return null;
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

  /* ---------- 3. Card Credential Validation & Optional Vault Hydration ---------- */
  function cleanCardDigits(raw) {
    return String(raw ?? '').replace(/\D/g, '').slice(0, 19);
  }

  function validateCardFields({ num = '', exp = '', cvv = '' } = {}) {
    const digits = cleanCardDigits(num);
    const cleanExp = String(exp ?? '').trim();
    const cleanCvv = String(cvv ?? '').replace(/\D/g, '').slice(0, 4);
    const errors = {};

    // Allow completely blank (cardless wallet) OR 4-digit last4 reference OR 12–19 digit card number
    if (digits.length > 0 && digits.length !== 4 && (digits.length < 12 || digits.length > 19)) {
      errors.wnum = 'Enter a full 12–19 digit card/account number, only the last 4 digits, or leave blank.';
    }
    if (cleanExp && !/^(0[1-9]|1[0-2])\/\d{2}$/.test(cleanExp)) {
      errors.wexp = 'Use MM/YY format (e.g. 08/29), or leave blank.';
    }
    if (cleanCvv && (cleanCvv.length < 3 || cleanCvv.length > 4)) {
      errors.wcvv = 'CVV must be 3 or 4 digits, or leave blank.';
    }
    return {
      ok: Object.keys(errors).length === 0,
      errors,
      digits,
      exp: cleanExp,
      cvv: cleanCvv,
      hasCard: digits.length >= 12 || Boolean(cleanCvv) || Boolean(cleanExp)
    };
  }

  /**
   * Build an encrypted wallet record without fabricating fake card numbers,
   * expiry dates, or CVV codes when user input is omitted.
   */
  async function buildEncryptedWallet(rawWallet, cryptoKey) {
    const digits = cleanCardDigits(rawWallet.num);
    const hasFullNum = digits.length >= 12;
    const last4 = digits.length >= 4
      ? digits.slice(-4)
      : String(rawWallet.last4 || '').replace(/\D/g, '').slice(-4);
    const exp = String(rawWallet.exp ?? '').trim();
    const cvv = String(rawWallet.cvv ?? '').replace(/\D/g, '').slice(0, 4);
    const holder = String(rawWallet.holder ?? '').trim().toUpperCase();
    const hasCard = Boolean(hasFullNum || exp || cvv);

    const encrypted_card_vault = await encryptVaultPayload(
      { num: hasFullNum ? digits : '', exp, cvv, holder, hasCard },
      cryptoKey
    );

    return {
      id: Number(rawWallet.id),
      n: String(rawWallet.n || 'Wallet').trim(),
      b: Money.roundMoney(rawWallet.b),
      style: rawWallet.style || 'gcash',
      last4,
      hasCard,
      encrypted_card_vault
    };
  }

  async function hydrateWalletsInMemory(storedWallets, cryptoKey, fallbackHolder = '') {
    const out = [];
    for (const w of storedWallets || []) {
      let secret = null;
      let vaultUnlocked = false;
      if (w.encrypted_card_vault && cryptoKey) {
        secret = await decryptVaultPayload(w.encrypted_card_vault, cryptoKey);
        vaultUnlocked = Boolean(secret);
      }
      const secretDigits = cleanCardDigits(secret?.num || '');
      const storedLast4 = String(w.last4 ?? '').replace(/\D/g, '').slice(-4);
      const last4 = secretDigits.length >= 4
        ? secretDigits.slice(-4)
        : (storedLast4 === '0000' && !secretDigits ? '' : storedLast4);
      const hasCard = secret
        ? Boolean(secret.hasCard ?? (secretDigits.length >= 12 || secret.exp || secret.cvv))
        : Boolean(w.hasCard ?? Boolean(last4));

      out.push({
        id: Number(w.id ?? w.client_id),
        n: String(w.n || w.name || 'Wallet'),
        b: Money.roundMoney(w.b ?? w.balance ?? 0),
        style: w.style || 'gcash',
        last4,
        hasCard,
        vaultUnlocked,
        encrypted_card_vault: w.encrypted_card_vault || '',
        num: secretDigits,
        exp: secret?.exp ?? '',
        cvv: secret?.cvv ?? '',
        holder: secret?.holder ?? (fallbackHolder ? String(fallbackHolder).toUpperCase() : '')
      });
    }
    return out;
  }

  /* ---------- 4. Supabase Cloud REST, Auth & Token Refresh ---------- */
  let customFetch = null;
  function setFetchAdapter(fn) {
    customFetch = fn || null;
  }

  function getSupabaseConfig() {
    try {
      const saved = JSON.parse(getStorage().getItem(STORAGE_SB_CFG) || 'null');
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
      getStorage().removeItem(STORAGE_SB_CFG);
      return DEFAULT_SUPABASE;
    }
    const cfg = { url: cleanUrl, anonKey: cleanKey };
    getStorage().setItem(STORAGE_SB_CFG, JSON.stringify(cfg));
    return cfg;
  }

  function isSupabaseConfigured() {
    const cfg = getSupabaseConfig();
    return Boolean(cfg && cfg.url && cfg.anonKey);
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
    const fetchImpl = customFetch || fetch;
    const res = await fetchImpl(`${url}${path}`, {
      method,
      headers,
      body: body !== null && body !== undefined ? JSON.stringify(body) : undefined
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
    if (!res.ok) {
      const msg = data?.msg || data?.error_description || data?.message || data?.error || `Supabase HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.code = data?.code || '';
      throw err;
    }
    return data;
  }

  async function refreshSupabaseSession(refreshToken) {
    if (!refreshToken || !isSupabaseConfigured()) return null;
    try {
      const data = await sbFetch('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        body: { refresh_token: refreshToken }
      });
      if (data && data.access_token) {
        return {
          accessToken: data.access_token,
          refreshToken: data.refresh_token || refreshToken,
          expiresAt: Date.now() + (Number(data.expires_in || 3600) * 1000),
          userId: data.user?.id || ''
        };
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  /* ---------- 5. Multi-Account Registry & Deduplicated Identity ---------- */
  function accountKeyForEmail(email) {
    const clean = String(email || '').trim().toLowerCase();
    if (!clean || clean === 'demo@onewallet.ph') return 'demo';
    return `acc:${clean}`;
  }

  function normalizeAccountRecord(acc, fallbackId = '') {
    if (!acc || typeof acc !== 'object') return null;
    const today = todayISO();
    const email = String(acc.email || '').trim().toLowerCase();
    const canonicalId = acc.isDemo || email === 'demo@onewallet.ph'
      ? 'demo'
      : (email ? accountKeyForEmail(email) : String(acc.id || fallbackId));

    return {
      ...acc,
      id: canonicalId,
      email,
      fullName: String(acc.fullName || 'One Wallet User'),
      paydayMode: ['bimonthly', 'monthly-15', 'monthly-30', 'custom'].includes(acc.paydayMode) ? acc.paydayMode : 'bimonthly',
      customPayday: acc.customPayday || '',
      budgets: acc.budgets && typeof acc.budgets === 'object' ? { ...acc.budgets } : {},
      w: Array.isArray(acc.w) ? acc.w : [],
      t: Domain.sortTransactions(
        (acc.t || []).map(t => ({
          ...t,
          d: Domain.normalizeEntryDate(t.d || t.fullDate, today),
          a: Money.roundMoney(t.a)
        })),
        today
      ),
      b: (acc.b || []).map(b => Domain.hydrateBillRecord(b, today)),
      n: Number(acc.n) || 20,
      pendingSync: Boolean(acc.pendingSync),
      lastSyncedAt: acc.lastSyncedAt || '',
      lastSyncError: acc.lastSyncError || ''
    };
  }

  function loadRegistry() {
    try {
      const raw = JSON.parse(getStorage().getItem(STORAGE_ACCOUNTS) || '{}');
      if (!raw || typeof raw !== 'object') return {};
      const deduped = {};
      for (const [k, val] of Object.entries(raw)) {
        const norm = normalizeAccountRecord(val, k);
        if (!norm) continue;
        const existing = deduped[norm.id];
        if (!existing) {
          deduped[norm.id] = norm;
        } else {
          // Prefer whichever record was updated more recently or holds pending local edits
          const preferNew = (norm.pendingSync && !existing.pendingSync) ||
            (Number(norm.updatedAt || 0) >= Number(existing.updatedAt || 0));
          deduped[norm.id] = preferNew
            ? { ...existing, ...norm, pwdHash: norm.pwdHash || existing.pwdHash, sbUserId: norm.sbUserId || existing.sbUserId }
            : { ...norm, ...existing, pwdHash: existing.pwdHash || norm.pwdHash, sbUserId: existing.sbUserId || norm.sbUserId };
        }
      }
      return deduped;
    } catch (e) {
      return {};
    }
  }

  function saveRegistry(reg) {
    try {
      getStorage().setItem(STORAGE_ACCOUNTS, JSON.stringify(reg));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e?.message || 'Browser storage is full or unavailable.' };
    }
  }

  function deleteAccountFromRegistry(accountId) {
    const reg = loadRegistry();
    if (!reg[accountId]) return false;
    delete reg[accountId];
    saveRegistry(reg);
    try {
      const active = JSON.parse(getStorage().getItem(STORAGE_SESSION) || 'null');
      if (active && active.accountId === accountId) {
        getStorage().removeItem(STORAGE_SESSION);
      }
    } catch (e) {}
    return true;
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
      cloudSynced: Boolean(acc.sbUserId && !acc.pendingSync),
      pendingSync: Boolean(acc.pendingSync),
      lastSyncedAt: acc.lastSyncedAt || '',
      walletCount: (acc.w || []).length
    }));
  }

  /**
   * Create starter workspace.
   * Real accounts ('starter' or 'blank') NEVER receive fake card numbers, expiries, or CVVs.
   * Only explicit 'demo' preset populates sample demo card data and transactions.
   */
  async function createStarterWorkspace({ preset = 'starter', fullName = 'Juan Dela Cruz', cryptoKey }) {
    const holder = String(fullName || 'ONE WALLET USER').trim().toUpperCase();
    const td = todayISO();
    const yd = shiftDaysISO(td, -1);

    if (preset === 'blank') {
      return { w: [], t: [], b: [], budgets: {}, n: 10 };
    }

    const isDemo = preset === 'demo';
    const rawWallets = isDemo
      ? [
          { id: 1, n: 'GCash', b: 1200, style: 'gcash', num: '5399640288104821', exp: '08/29', cvv: '418', holder },
          { id: 2, n: 'Maya', b: 2100, style: 'maya-black', num: '4532710499201104', exp: '11/28', cvv: '903', holder },
          { id: 3, n: 'GoTyme', b: 800, style: 'gotyme', num: '4288190033417762', exp: '04/30', cvv: '625', holder },
          { id: 4, n: 'Cash', b: 150, style: 'cash', num: '', exp: '', cvv: '', holder }
        ]
      : [
          { id: 1, n: 'GCash', b: 0, style: 'gcash', num: '', exp: '', cvv: '', holder },
          { id: 2, n: 'Maya', b: 0, style: 'maya-black', num: '', exp: '', cvv: '', holder },
          { id: 3, n: 'GoTyme', b: 0, style: 'gotyme', num: '', exp: '', cvv: '', holder },
          { id: 4, n: 'Cash', b: 0, style: 'cash', num: '', exp: '', cvv: '', holder }
        ];

    const w = [];
    for (const rw of rawWallets) {
      w.push(await buildEncryptedWallet(rw, cryptoKey));
    }

    const t = isDemo
      ? [
          { id: 1, d: td, s: 'Jollibee', c: 'Food', w: 1, walletLabel: 'GCash', a: -189, note: 'Lunch meal', src: 'manual', ref: '' },
          { id: 2, d: td, s: 'Payroll credit', c: 'Income', w: 2, walletLabel: 'Maya', a: 12000, note: '15th payroll', src: 'manual', ref: '' },
          { id: 3, d: yd, s: 'Data load', c: 'Load', w: 1, walletLabel: 'GCash', a: -50, note: '', src: 'manual', ref: '' },
          { id: 4, d: yd, s: 'Grab', c: 'Transport', w: 1, walletLabel: 'GCash', a: -140, note: 'Commute', src: 'manual', ref: '' }
        ]
      : [];

    const due1 = shiftDaysISO(td, 5);
    const due2 = shiftDaysISO(td, 9);
    const b = isDemo
      ? [
          { id: 1, n: 'Home Wi-Fi', a: 1299, baseAmount: 1299, dueDate: due1, freq: 'monthly', d: Domain.formatShortDate(due1, td) },
          { id: 2, n: 'Spotify', a: 200, baseAmount: 200, dueDate: due2, freq: 'monthly', d: Domain.formatShortDate(due2, td) }
        ]
      : [];

    return { w, t, b, budgets: {}, n: 20 };
  }

  /* ---------- 6. Ledger Entry Cloud Serialization (Backward Compatible) ---------- */
  function serializeEntryMerchant(tx) {
    const base = String(tx.s || 'Entry').trim();
    const meta = {};
    if (tx.note) meta.n = tx.note;
    if (tx.src && tx.src !== 'manual') meta.s = tx.src;
    if (tx.ref) meta.r = tx.ref;
    if (tx.walletLabel) meta.wl = tx.walletLabel;
    if (!Object.keys(meta).length) return base;
    return `${base}\u001F${JSON.stringify(meta)}`;
  }

  function deserializeEntryMerchant(rawMerchant) {
    const s = String(rawMerchant || '');
    const sepIdx = s.indexOf('\u001F');
    if (sepIdx === -1) {
      return { merchant: s, note: '', src: 'manual', ref: '', walletLabel: '' };
    }
    const merchant = s.slice(0, sepIdx);
    try {
      const meta = JSON.parse(s.slice(sepIdx + 1));
      return {
        merchant,
        note: String(meta?.n || ''),
        src: String(meta?.s || 'manual'),
        ref: String(meta?.r || ''),
        walletLabel: String(meta?.wl || '')
      };
    } catch (e) {
      return { merchant, note: '', src: 'manual', ref: '', walletLabel: '' };
    }
  }

  /* ---------- 7. Safe, Non-Destructive Supabase Cloud Synchronization ---------- */
  let syncChain = Promise.resolve();
  let lastSyncFingerprint = '';
  let rpcSyncAvailable = null; // null = unknown, true = supported, false = fallback to upsert+prune
  let syncStatusListener = null;

  function onSyncStatus(fn) {
    syncStatusListener = typeof fn === 'function' ? fn : null;
  }

  function emitSyncStatus(payload) {
    if (syncStatusListener) {
      try { syncStatusListener(payload); } catch (e) {}
    }
  }

  function buildWorkspaceFingerprint(acc) {
    return JSON.stringify({
      u: acc.sbUserId,
      n: acc.fullName,
      pm: acc.paydayMode,
      cp: acc.customPayday,
      s: acc.salt,
      w: (acc.w || []).map(w => [w.id, w.n, Money.roundMoney(w.b), w.style, w.last4, w.encrypted_card_vault]),
      t: (acc.t || []).map(t => [t.id, t.w, t.d, t.s, t.c, Money.roundMoney(t.a), t.note || '', t.src || 'manual', t.ref || '']),
      b: (acc.b || []).map(b => [b.id, b.n, Money.roundMoney(b.a), Domain.serializeBillDueLabel(b)])
    });
  }

  async function syncViaUpsertAndTargetedPrune(uid, acc, token) {
    // 1. Upsert profile first
    await sbFetch('/rest/v1/profiles?on_conflict=id', {
      method: 'POST',
      token,
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: {
        id: uid,
        full_name: acc.fullName,
        email: acc.email,
        payday_mode: acc.paydayMode || 'bimonthly',
        custom_payday: Domain.isValidISODate(acc.customPayday) ? acc.customPayday : null,
        vault_salt: acc.salt
      }
    });

    // 2. Wallets: UPSERT current records FIRST, then delete ONLY removed client_ids
    const walletRows = (acc.w || []).map(w => ({
      user_id: uid,
      client_id: Number(w.id),
      name: w.n,
      balance: Money.roundMoney(w.b),
      style: w.style || 'gcash',
      last4: w.last4 || '0000',
      encrypted_card_vault: w.encrypted_card_vault
    }));
    if (walletRows.length) {
      await sbFetch('/rest/v1/wallets?on_conflict=user_id,client_id', {
        method: 'POST',
        token,
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: walletRows
      });
      const keepIds = walletRows.map(r => r.client_id).join(',');
      await sbFetch(`/rest/v1/wallets?user_id=eq.${uid}&client_id=not.in.(${keepIds})`, {
        method: 'DELETE',
        token
      });
    } else {
      await sbFetch(`/rest/v1/wallets?user_id=eq.${uid}`, { method: 'DELETE', token });
    }

    // 3. Ledger entries: UPSERT current records FIRST, then delete ONLY removed client_ids
    const entryRows = (acc.t || []).map(t => ({
      user_id: uid,
      client_id: Number(t.id),
      wallet_client_id: Number(t.w),
      entry_date: Domain.normalizeEntryDate(t.d),
      merchant: serializeEntryMerchant(t),
      category: t.c || 'Others',
      amount: Money.roundMoney(t.a)
    }));
    if (entryRows.length) {
      await sbFetch('/rest/v1/ledger_entries?on_conflict=user_id,client_id', {
        method: 'POST',
        token,
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: entryRows
      });
      const keepIds = entryRows.map(r => r.client_id).join(',');
      await sbFetch(`/rest/v1/ledger_entries?user_id=eq.${uid}&client_id=not.in.(${keepIds})`, {
        method: 'DELETE',
        token
      });
    } else {
      await sbFetch(`/rest/v1/ledger_entries?user_id=eq.${uid}`, { method: 'DELETE', token });
    }

    // 4. Bills: UPSERT current records FIRST, then delete ONLY removed client_ids
    const billRows = (acc.b || []).map(b => ({
      user_id: uid,
      client_id: Number(b.id),
      name: b.n,
      amount: Money.roundMoney(b.a),
      due_label: Domain.serializeBillDueLabel(b)
    }));
    if (billRows.length) {
      await sbFetch('/rest/v1/bills?on_conflict=user_id,client_id', {
        method: 'POST',
        token,
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: billRows
      });
      const keepIds = billRows.map(r => r.client_id).join(',');
      await sbFetch(`/rest/v1/bills?user_id=eq.${uid}&client_id=not.in.(${keepIds})`, {
        method: 'DELETE',
        token
      });
    } else {
      await sbFetch(`/rest/v1/bills?user_id=eq.${uid}`, { method: 'DELETE', token });
    }
  }

  function syncAccountToSupabase(acc, sessionAuth, force = false) {
    const tokenIn = typeof sessionAuth === 'string' ? sessionAuth : (sessionAuth?.accessToken || '');
    const refreshToken = typeof sessionAuth === 'object' ? (sessionAuth?.refreshToken || '') : '';
    const expiresAt = typeof sessionAuth === 'object' ? (sessionAuth?.expiresAt || 0) : 0;

    if (!isSupabaseConfigured() || (!tokenIn && !refreshToken) || !acc?.sbUserId) {
      return Promise.resolve({ ok: false, skipped: true });
    }

    const fp = buildWorkspaceFingerprint(acc);
    if (!force && !acc.pendingSync && fp === lastSyncFingerprint) {
      return Promise.resolve({ ok: true, cached: true });
    }

    syncChain = syncChain.then(async () => {
      emitSyncStatus({ status: 'syncing', accountId: acc.id, message: 'Syncing with Supabase Cloud…' });
      let activeToken = tokenIn;
      let refreshedSession = null;

      try {
        if ((!activeToken || (expiresAt && Date.now() >= expiresAt - 60000)) && refreshToken) {
          refreshedSession = await refreshSupabaseSession(refreshToken);
          if (refreshedSession?.accessToken) activeToken = refreshedSession.accessToken;
        }
        if (!activeToken) throw new Error('Cloud session expired. Sign in again to resume cloud sync.');

        const uid = acc.sbUserId;
        const runSyncWithToken = async tok => {
          if (rpcSyncAvailable !== false) {
            try {
              await sbFetch('/rest/v1/rpc/sync_user_workspace', {
                method: 'POST',
                token: tok,
                body: {
                  p_full_name: acc.fullName,
                  p_email: acc.email,
                  p_payday_mode: acc.paydayMode || 'bimonthly',
                  p_custom_payday: Domain.isValidISODate(acc.customPayday) ? acc.customPayday : null,
                  p_vault_salt: acc.salt,
                  p_wallets: (acc.w || []).map(w => ({
                    client_id: Number(w.id),
                    name: w.n,
                    balance: Money.roundMoney(w.b),
                    style: w.style || 'gcash',
                    last4: w.last4 || '0000',
                    encrypted_card_vault: w.encrypted_card_vault
                  })),
                  p_entries: (acc.t || []).map(t => ({
                    client_id: Number(t.id),
                    wallet_client_id: Number(t.w),
                    entry_date: Domain.normalizeEntryDate(t.d),
                    merchant: serializeEntryMerchant(t),
                    category: t.c || 'Others',
                    amount: Money.roundMoney(t.a)
                  })),
                  p_bills: (acc.b || []).map(b => ({
                    client_id: Number(b.id),
                    name: b.n,
                    amount: Money.roundMoney(b.a),
                    due_label: Domain.serializeBillDueLabel(b)
                  }))
                }
              });
              rpcSyncAvailable = true;
              return;
            } catch (rpcErr) {
              // If RPC is not installed yet on remote DB, seamlessly fall back to upsert+prune
              if (rpcErr.status === 404 || rpcErr.code === 'PGRST202' || /sync_user_workspace/i.test(rpcErr.message)) {
                rpcSyncAvailable = false;
              } else {
                throw rpcErr;
              }
            }
          }
          await syncViaUpsertAndTargetedPrune(uid, acc, tok);
        };

        try {
          await runSyncWithToken(activeToken);
        } catch (firstErr) {
          // Retry once with refreshed JWT if 401 Unauthorized
          if (firstErr.status === 401 && refreshToken && !refreshedSession) {
            refreshedSession = await refreshSupabaseSession(refreshToken);
            if (refreshedSession?.accessToken) {
              activeToken = refreshedSession.accessToken;
              await runSyncWithToken(activeToken);
            } else {
              throw firstErr;
            }
          } else {
            throw firstErr;
          }
        }

        // Mark fingerprint synced ONLY AFTER every cloud write completed!
        lastSyncFingerprint = fp;
        const syncedAt = new Date().toISOString();
        const reg = loadRegistry();
        if (reg[acc.id]) {
          reg[acc.id].pendingSync = false;
          reg[acc.id].cloudSynced = true;
          reg[acc.id].lastSyncedAt = syncedAt;
          reg[acc.id].lastSyncError = '';
          saveRegistry(reg);
        }
        emitSyncStatus({
          status: 'synced',
          accountId: acc.id,
          syncedAt,
          refreshedSession,
          message: 'All changes saved to Supabase Cloud'
        });
        return { ok: true, syncedAt, refreshedSession };
      } catch (e) {
        const errMsg = e?.message || 'Cloud synchronization failed.';
        const reg = loadRegistry();
        if (reg[acc.id]) {
          reg[acc.id].pendingSync = true;
          reg[acc.id].lastSyncError = errMsg;
          saveRegistry(reg);
        }
        emitSyncStatus({
          status: 'error',
          accountId: acc.id,
          error: errMsg,
          message: `Saved locally · Cloud sync pending (${errMsg})`
        });
        return { ok: false, error: errMsg };
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

      const [wallets, entries, bills] = await Promise.all([
        sbFetch(`/rest/v1/wallets?user_id=eq.${uid}&order=client_id.asc`, { token: accessToken }),
        sbFetch(`/rest/v1/ledger_entries?user_id=eq.${uid}&order=client_id.desc`, { token: accessToken }),
        sbFetch(`/rest/v1/bills?user_id=eq.${uid}&order=client_id.asc`, { token: accessToken })
      ]);

      const today = todayISO();
      const w = (wallets || []).map(x => ({
        id: Number(x.client_id),
        n: x.name,
        b: Money.roundMoney(x.balance),
        style: x.style || 'gcash',
        last4: x.last4 === '0000' ? '' : (x.last4 || ''),
        encrypted_card_vault: x.encrypted_card_vault
      }));
      const t = Domain.sortTransactions((entries || []).map(x => {
        const unpacked = deserializeEntryMerchant(x.merchant);
        return {
          id: Number(x.client_id),
          d: Domain.normalizeEntryDate(x.entry_date, today),
          s: unpacked.merchant,
          c: x.category || 'Others',
          w: Number(x.wallet_client_id),
          walletLabel: unpacked.walletLabel,
          a: Money.roundMoney(x.amount),
          note: unpacked.note,
          src: unpacked.src,
          ref: unpacked.ref
        };
      }), today);
      const b = (bills || []).map(x => Domain.hydrateBillRecord({
        id: Number(x.client_id),
        n: x.name,
        a: Money.roundMoney(x.amount),
        due_label: x.due_label
      }, today));

      const maxId = Math.max(
        20,
        ...w.map(x => x.id || 0),
        ...t.map(x => x.id || 0),
        ...b.map(x => x.id || 0)
      );

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
      return null;
    }
  }

  function _resetSyncStateForTests() {
    syncChain = Promise.resolve();
    lastSyncFingerprint = '';
    rpcSyncAvailable = null;
  }

  const OWVault = {
    KDF_ITERATIONS_V3,
    KDF_ITERATIONS_V2,
    STORAGE_ACCOUNTS,
    STORAGE_SESSION,
    STORAGE_SB_CFG,
    todayISO,
    shiftDaysISO,
    computeNextPayday,
    computePaydayState,
    paydayModeLabel,
    parseSaltSpec,
    randomSaltHex,
    hashPassword,
    timingSafeEqualHex,
    deriveVaultKey,
    encryptVaultPayload,
    decryptVaultPayload,
    cleanCardDigits,
    validateCardFields,
    buildEncryptedWallet,
    hydrateWalletsInMemory,
    getSupabaseConfig,
    setSupabaseConfig,
    isSupabaseConfigured,
    sbFetch,
    refreshSupabaseSession,
    accountKeyForEmail,
    loadRegistry,
    saveRegistry,
    deleteAccountFromRegistry,
    listAccounts,
    createStarterWorkspace,
    serializeEntryMerchant,
    deserializeEntryMerchant,
    syncAccountToSupabase,
    pullAccountFromSupabase,
    onSyncStatus,
    setStorageAdapter,
    setFetchAdapter,
    _resetSyncStateForTests
  };

  global.OWVault = OWVault;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OWVault;
  }
})(typeof window !== 'undefined' ? window : globalThis);
