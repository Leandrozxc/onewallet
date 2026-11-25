/* ============================================================================
 * One Wallet · Application Controller, Session Guard, Accessibility & UI Views
 * Coordinates OWMoney, OWDomain, OWParser, OWVault, and OWCards while keeping
 * business rules decoupled from DOM rendering and inline JS handlers.
 * ============================================================================ */
(function (global) {
  'use strict';

  const Money = global.OWMoney;
  const Domain = global.OWDomain;
  const Parser = global.OWParser;
  const Vault = global.OWVault;
  const Cards = global.OWCards;

  const { peso, signed } = Money;
  const { CATEGORIES } = Domain;

  const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

  /* ---------- Icons & Brand Lockup ---------- */
  const icon = (d, cls = 'w-5 h-5', sz = 18) =>
    `<svg width="${sz}" height="${sz}" class="${cls} shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

  const brandLockup = (sub = 'Passbook & Card Vault') => `
    <span class="inline-flex items-center gap-2.5">
      ${Cards.brandLogo('h-8 w-auto', 32)}
      <span class="flex flex-col text-left">
        <span class="text-base font-semibold tracking-[-0.015em] text-ink leading-tight">One Wallet</span>
        ${sub ? `<span class="text-[13px] text-mute leading-tight">${esc(sub)}</span>` : ''}
      </span>
    </span>`;

  const I = {
    today: '<path d="M4 5h16v15H4z"/><path d="M4 9h16M9 3v4M15 3v4"/>',
    wallets: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 14h2"/>',
    ledger: '<path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    import: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
    bills: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    insights: '<path d="M4 19h16"/><path d="M7 15v-4M12 15V7M17 15v-6"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    trash: '<path d="M5 7h14M10 11v6M14 11v6M7 7l1 13h8l1-13M9 7V4h6v3"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.1A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a16 16 0 0 1-3.2 4.3"/><path d="M6.6 6.6C4 8.3 2 12 2 12s3.6 7 10 7a10.6 10.6 0 0 0 5.4-1.4"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>',
    cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9Z"/>',
    check: '<path d="m5 12 5 5L20 7"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
    upload: '<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M5 20h14"/>',
    alert: '<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>'
  };

  /* ---------- Passbook Design Vocabulary (Preserving DESIGN.md) ---------- */
  const C = {
    card: 'bg-card border border-line rounded-card',
    btn: 'inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-ctl bg-ink text-card text-sm font-medium hover:bg-ink-2 active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none transition-[transform,background-color,opacity] duration-100 cursor-pointer',
    btn2: 'inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-ctl bg-card text-ink border border-line text-sm font-medium hover:bg-subtle hover:border-ink/30 active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none transition-[transform,background-color,border-color,opacity] duration-100 cursor-pointer',
    btnDanger: 'inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-ctl bg-alert text-card text-sm font-medium hover:opacity-90 active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none transition-[transform,opacity] duration-100 cursor-pointer',
    link: 'text-sm font-medium text-ink-2 hover:text-ink underline-offset-4 hover:underline cursor-pointer',
    iconBtn: 'inline-flex items-center justify-center w-9 h-9 max-sm:w-11 max-sm:h-11 touch-target rounded-ctl text-mute hover:text-ink hover:bg-subtle cursor-pointer',
    label: 'block text-sm font-medium text-ink mb-1.5',
    input: 'w-full h-10 px-3 rounded-ctl bg-card border border-line text-[15px] text-ink placeholder:text-mute focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink aria-[invalid=true]:border-alert aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-alert',
    cardTitle: 'text-base font-semibold text-ink tracking-[-0.01em]',
    meta: 'text-xs text-mute',
    h1: 'text-[22px] md:text-[24px] leading-tight font-semibold text-ink tracking-[-0.015em] text-balance'
  };

  /* ---------- Session State & In-Memory Vault Key ---------- */
  let sessionVaultKey = null; // Non-extractable AES-GCM-256 CryptoKey (in-memory only)
  let pendingUnlockAfterAction = null;
  let lastModalTrigger = null;

  function createEmptyState() {
    return {
      authenticated: false,
      view: 'login',
      authTab: 'signin',
      authBusy: false,
      accountId: '',
      isDemo: false,
      fullName: '',
      email: '',
      paydayMode: 'bimonthly',
      customPayday: '',
      salt: '',
      sbToken: '',
      sbRefreshToken: '',
      sbExpiresAt: 0,
      sbUserId: '',
      syncState: 'local', // 'local' | 'syncing' | 'synced' | 'pending' | 'error'
      syncMessage: '',
      lastSyncedAt: '',
      storageWarning: '',
      toast: '',
      // Navigation & filter state
      wid: 0,
      fw: 0,
      ledgerQuery: '',
      ledgerCat: '',
      ledgerType: 'all',
      ledgerPeriod: 'all',
      insightsPeriod: 'cycle',
      walletView: 'carousel',
      carouselIdx: 0,
      // Modal & form state (passwords are NEVER placed in draft!)
      modal: '',
      editWid: 0,
      editTxId: 0,
      editBillId: 0,
      payBillId: 0,
      confirmTargetId: 0,
      manualCatPicked: false,
      txDupAck: false,
      importDupAck: false,
      pr: null,
      raw: '',
      draft: {},
      errors: {},
      revealed: {},
      flipped: {},
      copiedId: 0,
      // Domain collections
      budgets: {},
      w: [],
      t: [],
      b: [],
      n: 20
    };
  }

  let S = createEmptyState();

  const val = id => (document.getElementById(id)?.value ?? '').trim();
  const getToday = () => Domain.todayISO();

  function showToast(msg) {
    S.toast = msg;
    const live = document.getElementById('status-toast');
    if (live) {
      live.textContent = msg;
      live.classList.remove('hidden');
    }
    setTimeout(() => {
      if (S.toast === msg) {
        S.toast = '';
        const el = document.getElementById('status-toast');
        if (el) el.classList.add('hidden');
      }
    }, 3200);
  }

  /* Listen to async Supabase cloud sync outcomes */
  Vault.onSyncStatus(ev => {
    if (!S.authenticated || (ev.accountId && ev.accountId !== S.accountId)) return;
    if (ev.refreshedSession?.accessToken) {
      S.sbToken = ev.refreshedSession.accessToken;
      S.sbRefreshToken = ev.refreshedSession.refreshToken || S.sbRefreshToken;
      S.sbExpiresAt = ev.refreshedSession.expiresAt || S.sbExpiresAt;
    }
    if (ev.status === 'syncing') {
      S.syncState = 'syncing';
      S.syncMessage = ev.message;
    } else if (ev.status === 'synced') {
      S.syncState = 'synced';
      S.lastSyncedAt = ev.syncedAt || new Date().toISOString();
      S.syncMessage = ev.message;
    } else if (ev.status === 'error') {
      S.syncState = 'error';
      S.syncMessage = ev.message;
    }
    updateSyncBadgeDOM();
  });

  function updateSyncBadgeDOM() {
    const el = document.getElementById('sync-status-pill');
    if (!el) return;
    const info = describeSyncStatus();
    el.textContent = info.short;
    el.title = info.detail;
  }

  function describeSyncStatus() {
    if (S.isDemo) {
      return {
        short: 'Demo sandbox',
        detail: 'Sample demo workspace stored locally in this browser.',
        dot: 'bg-mute'
      };
    }
    if (!S.sbUserId) {
      return {
        short: 'Saved locally',
        detail: 'Offline-first local passbook · Card vault encrypted with AES-256-GCM.',
        dot: 'bg-ink-2'
      };
    }
    if (S.syncState === 'syncing') {
      return { short: 'Syncing…', detail: 'Synchronizing workspace with Supabase Cloud…', dot: 'bg-accent' };
    }
    if (S.syncState === 'error' || S.syncState === 'pending') {
      return {
        short: 'Pending sync',
        detail: S.syncMessage || 'Saved locally · Waiting to sync changes to Supabase Cloud.',
        dot: 'bg-marigold'
      };
    }
    const timeLabel = S.lastSyncedAt
      ? new Date(S.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
    return {
      short: timeLabel ? `Cloud synced · ${timeLabel}` : 'Cloud synced',
      detail: `Synchronized with Supabase PostgreSQL (RLS isolated)${timeLabel ? ` at ${timeLabel}` : ''}.`,
      dot: 'bg-gain'
    };
  }

  /* ---------- Persistence (Decoupled from Pure Visual Renders!) ---------- */
  function saveWorkspace({ syncCloud = true } = {}) {
    if (!S.authenticated || !S.accountId) return;
    const reg = Vault.loadRegistry();
    const existing = reg[S.accountId] || {};
    const sanitizedWallets = S.w.map(w => ({
      id: Number(w.id),
      n: w.n,
      b: Money.roundMoney(w.b),
      style: w.style || 'gcash',
      last4: String(w.last4 || ''),
      hasCard: Boolean(w.hasCard),
      encrypted_card_vault: w.encrypted_card_vault || ''
    }));

    const hasCloud = Boolean(S.sbUserId && (S.sbToken || S.sbRefreshToken) && Vault.isSupabaseConfigured());
    reg[S.accountId] = {
      ...existing,
      id: S.accountId,
      isDemo: Boolean(S.isDemo),
      fullName: S.fullName,
      email: S.email,
      paydayMode: S.paydayMode || 'bimonthly',
      customPayday: S.customPayday || '',
      salt: S.salt,
      sbUserId: S.sbUserId || existing.sbUserId || '',
      budgets: { ...(S.budgets || {}) },
      w: sanitizedWallets,
      t: S.t,
      b: S.b,
      n: S.n,
      updatedAt: Date.now(),
      pendingSync: hasCloud ? true : Boolean(existing.pendingSync)
    };

    const writeRes = Vault.saveRegistry(reg);
    if (!writeRes.ok) {
      S.storageWarning = writeRes.error;
    } else {
      S.storageWarning = '';
      try {
        localStorage.setItem(Vault.STORAGE_SESSION, JSON.stringify({ accountId: S.accountId }));
      } catch (e) {}
    }

    if (syncCloud && hasCloud) {
      Vault.syncAccountToSupabase(reg[S.accountId], {
        accessToken: S.sbToken,
        refreshToken: S.sbRefreshToken,
        expiresAt: S.sbExpiresAt
      });
    } else if (S.sbUserId && !S.sbToken && !S.sbRefreshToken) {
      S.syncState = 'pending';
      S.syncMessage = 'Saved locally · Sign in again to sync pending changes to Supabase Cloud.';
    }
  }

  /* ---------- Boot, Auth, Legacy KDF Migration & Vault Unlock ---------- */
  async function ensureDemoAccountSeeded() {
    const reg = Vault.loadRegistry();
    if (!reg.demo) {
      const salt = 'v3:a1b2c3d4e5f60718293a4b5c6d7e8f90';
      const pwdHash = await Vault.hashPassword('demo1234', salt);
      const demoKey = await Vault.deriveVaultKey('demo1234', salt);
      const starter = await Vault.createStarterWorkspace({
        preset: 'demo',
        fullName: 'Juan Dela Cruz',
        cryptoKey: demoKey
      });
      reg.demo = {
        id: 'demo',
        isDemo: true,
        fullName: 'Juan Dela Cruz',
        email: 'demo@onewallet.ph',
        paydayMode: 'bimonthly',
        customPayday: '',
        salt,
        pwdHash,
        budgets: { Food: 3500, Transport: 1800 },
        w: starter.w,
        t: starter.t,
        b: starter.b,
        n: 20,
        updatedAt: Date.now()
      };
      Vault.saveRegistry(reg);
    }
    return reg;
  }

  async function bootSession() {
    try {
      const reg = await ensureDemoAccountSeeded();
      let active = null;
      try {
        active = JSON.parse(localStorage.getItem(Vault.STORAGE_SESSION) || 'null');
      } catch (e) {}

      if (!active || !active.accountId || !reg[active.accountId]) {
        // Unauthenticated cold visit: stay cleanly on login screen
        S = { ...createEmptyState(), draft: { 'login-email': 'demo@onewallet.ph' } };
        return;
      }

      const acc = reg[active.accountId];
      if (acc.isDemo || acc.id === 'demo') {
        sessionVaultKey = await Vault.deriveVaultKey('demo1234', acc.salt);
      } else {
        sessionVaultKey = null; // Non-demo reload keeps card secrets locked until password unlock
      }

      const hydratedW = await Vault.hydrateWalletsInMemory(acc.w, sessionVaultKey, acc.fullName);
      S = {
        ...createEmptyState(),
        authenticated: true,
        view: 'today',
        accountId: acc.id,
        isDemo: Boolean(acc.isDemo),
        fullName: acc.fullName,
        email: acc.email,
        paydayMode: acc.paydayMode || 'bimonthly',
        customPayday: acc.customPayday || '',
        salt: acc.salt,
        sbUserId: acc.sbUserId || '',
        syncState: acc.pendingSync ? 'pending' : (acc.sbUserId ? 'synced' : 'local'),
        lastSyncedAt: acc.lastSyncedAt || '',
        syncMessage: acc.lastSyncError || '',
        budgets: { ...(acc.budgets || {}) },
        w: hydratedW,
        t: acc.t || [],
        b: acc.b || [],
        n: acc.n || 20
      };
    } catch (e) {
      S = createEmptyState();
    }
  }

  /**
   * Transparently upgrade legacy v2 accounts (60k PBKDF2, shared salt) to v3
   * (600k PBKDF2, domain-separated auth & vault keys) upon verified sign-in.
   */
  async function upgradeAccountKdfIfLegacy(password, currentSalt, hydratedWallets) {
    const spec = Vault.parseSaltSpec(currentSalt);
    if (spec.version >= 3) {
      const pwdHash = await Vault.hashPassword(password, currentSalt);
      return { salt: currentSalt, pwdHash, key: sessionVaultKey, wallets: hydratedWallets, upgraded: false };
    }
    const newSalt = Vault.randomSaltHex(16, { versioned: true });
    const newPwdHash = await Vault.hashPassword(password, newSalt);
    const newKey = await Vault.deriveVaultKey(password, newSalt);
    const reEncrypted = [];
    for (const w of hydratedWallets) {
      const encMeta = await Vault.buildEncryptedWallet(w, newKey);
      reEncrypted.push({ ...w, ...encMeta, vaultUnlocked: true });
    }
    return { salt: newSalt, pwdHash: newPwdHash, key: newKey, wallets: reEncrypted, upgraded: true };
  }

  async function handleSignIn() {
    if (S.authBusy) return;
    const email = val('login-email').toLowerCase();
    const pwd = document.getElementById('login-pwd')?.value ?? '';
    if (!email || !pwd) {
      return fail(
        { 'login-email': !email ? 'Enter your email.' : '', 'login-pwd': !pwd ? 'Enter your password.' : '' },
        ['login-email']
      );
    }

    S.authBusy = true;
    S.draft = { ...S.draft, 'login-email': email };
    R();

    try {
      const reg = Vault.loadRegistry();
      const canonicalId = Vault.accountKeyForEmail(email);
      const localAcc = reg[canonicalId] || Object.values(reg).find(a => a.email.toLowerCase() === email);

      // 1. Try Supabase Cloud Auth for non-demo accounts when configured
      if (email !== 'demo@onewallet.ph' && Vault.isSupabaseConfigured()) {
        try {
          const authData = await Vault.sbFetch('/auth/v1/token?grant_type=password', {
            method: 'POST',
            body: { email, password: pwd }
          });
          if (authData && authData.access_token && authData.user) {
            const uid = authData.user.id;
            const token = authData.access_token;
            const refreshToken = authData.refresh_token || '';
            const expiresAt = Date.now() + (Number(authData.expires_in || 3600) * 1000);

            // Protect unsynced offline edits: if localAcc has pendingSync, prefer local workspace & push!
            const useLocalPending = Boolean(localAcc && localAcc.pendingSync && (localAcc.w?.length || localAcc.t?.length || localAcc.b?.length));
            const cloudAcc = useLocalPending ? null : await Vault.pullAccountFromSupabase(uid, token);
            const sourceAcc = cloudAcc || localAcc;
            const salt = sourceAcc?.salt || Vault.randomSaltHex(16, { versioned: true });

            sessionVaultKey = await Vault.deriveVaultKey(pwd, salt);
            let hydratedW = sourceAcc
              ? await Vault.hydrateWalletsInMemory(sourceAcc.w, sessionVaultKey, sourceAcc.fullName)
              : [];

            const upgraded = await upgradeAccountKdfIfLegacy(pwd, salt, hydratedW);
            sessionVaultKey = upgraded.key;
            hydratedW = upgraded.wallets;

            S = {
              ...createEmptyState(),
              authenticated: true,
              view: 'today',
              accountId: canonicalId,
              isDemo: false,
              fullName: sourceAcc?.fullName || authData.user.user_metadata?.full_name || email.split('@')[0],
              email,
              paydayMode: sourceAcc?.paydayMode || 'bimonthly',
              customPayday: sourceAcc?.customPayday || '',
              salt: upgraded.salt,
              sbToken: token,
              sbRefreshToken: refreshToken,
              sbExpiresAt: expiresAt,
              sbUserId: uid,
              syncState: useLocalPending || upgraded.upgraded ? 'pending' : 'synced',
              lastSyncedAt: new Date().toISOString(),
              budgets: { ...(localAcc?.budgets || {}) },
              w: hydratedW,
              t: sourceAcc?.t || [],
              b: sourceAcc?.b || [],
              n: sourceAcc?.n || 20
            };

            const nextReg = Vault.loadRegistry();
            nextReg[canonicalId] = {
              ...(nextReg[canonicalId] || {}),
              id: canonicalId,
              email,
              fullName: S.fullName,
              pwdHash: upgraded.pwdHash,
              salt: upgraded.salt,
              sbUserId: uid
            };
            Vault.saveRegistry(nextReg);
            saveWorkspace({ syncCloud: Boolean(useLocalPending || upgraded.upgraded) });
            location.replace('#today');
            return;
          }
        } catch (cloudErr) {
          if (!localAcc) {
            return fail({ 'login-pwd': `Sign-in failed: ${cloudErr.message}` }, ['login-email']);
          }
        }
      }

      // 2. Local Multi-Account Registry Verification
      if (!localAcc) {
        return fail(
          { 'login-email': 'No account found with this email. Switch to Create account to register.' },
          ['login-email']
        );
      }

      const computedHash = await Vault.hashPassword(pwd, localAcc.salt);
      if (localAcc.pwdHash && !Vault.timingSafeEqualHex(computedHash, localAcc.pwdHash)) {
        return fail({ 'login-pwd': 'Incorrect password for this account.' }, ['login-email']);
      }

      sessionVaultKey = await Vault.deriveVaultKey(pwd, localAcc.salt);
      let hydratedW = await Vault.hydrateWalletsInMemory(localAcc.w, sessionVaultKey, localAcc.fullName);
      const upgraded = await upgradeAccountKdfIfLegacy(pwd, localAcc.salt, hydratedW);
      sessionVaultKey = upgraded.key;
      hydratedW = upgraded.wallets;

      if (upgraded.upgraded) {
        const nextReg = Vault.loadRegistry();
        if (nextReg[localAcc.id]) {
          nextReg[localAcc.id].salt = upgraded.salt;
          nextReg[localAcc.id].pwdHash = upgraded.pwdHash;
          Vault.saveRegistry(nextReg);
        }
      }

      S = {
        ...createEmptyState(),
        authenticated: true,
        view: 'today',
        accountId: localAcc.id,
        isDemo: Boolean(localAcc.isDemo),
        fullName: localAcc.fullName,
        email: localAcc.email,
        paydayMode: localAcc.paydayMode || 'bimonthly',
        customPayday: localAcc.customPayday || '',
        salt: upgraded.salt,
        sbUserId: localAcc.sbUserId || '',
        syncState: localAcc.pendingSync ? 'pending' : 'local',
        lastSyncedAt: localAcc.lastSyncedAt || '',
        budgets: { ...(localAcc.budgets || {}) },
        w: hydratedW,
        t: localAcc.t || [],
        b: localAcc.b || [],
        n: localAcc.n || 20
      };
      saveWorkspace({ syncCloud: false });
      location.replace('#today');
    } finally {
      S.authBusy = false;
    }
  }

  async function handleSignUp() {
    if (S.authBusy) return;
    const fullName = val('reg-name');
    const email = val('reg-email').toLowerCase();
    const pwd = document.getElementById('reg-pwd')?.value ?? '';
    const paydayMode = val('reg-payday') || 'bimonthly';
    const preset = val('reg-preset') || 'starter';

    const e = {};
    if (!fullName) e['reg-name'] = 'Enter your name.';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e['reg-email'] = 'Enter a valid email address.';
    if (email === 'demo@onewallet.ph') e['reg-email'] = 'This email is reserved for the Demo sandbox.';
    if (!pwd || pwd.length < 8) e['reg-pwd'] = 'Use at least 8 characters for your vault password.';
    if (Object.keys(e).length) return fail(e, ['reg-name', 'reg-email', 'reg-payday', 'reg-preset']);

    const reg = Vault.loadRegistry();
    const canonicalId = Vault.accountKeyForEmail(email);
    if (reg[canonicalId] || Object.values(reg).some(a => a.email.toLowerCase() === email)) {
      return fail(
        { 'reg-email': 'An account with this email already exists on this device. Sign in instead.' },
        ['reg-name', 'reg-email', 'reg-payday', 'reg-preset']
      );
    }

    S.authBusy = true;
    S.draft = { ...S.draft, 'reg-name': fullName, 'reg-email': email, 'reg-payday': paydayMode, 'reg-preset': preset };
    R();

    try {
      const salt = Vault.randomSaltHex(16, { versioned: true });
      const pwdHash = await Vault.hashPassword(pwd, salt);
      sessionVaultKey = await Vault.deriveVaultKey(pwd, salt);
      const starter = await Vault.createStarterWorkspace({ preset, fullName, cryptoKey: sessionVaultKey });
      const hydratedW = await Vault.hydrateWalletsInMemory(starter.w, sessionVaultKey, fullName);

      let sbToken = '', sbRefreshToken = '', sbExpiresAt = 0, sbUserId = '';
      if (Vault.isSupabaseConfigured()) {
        try {
          const signUpRes = await Vault.sbFetch('/auth/v1/signup', {
            method: 'POST',
            body: { email, password: pwd, data: { full_name: fullName } }
          });
          sbUserId = signUpRes?.user?.id || signUpRes?.id || '';
          sbToken = signUpRes?.access_token || '';
          sbRefreshToken = signUpRes?.refresh_token || '';
          sbExpiresAt = signUpRes?.expires_in ? Date.now() + Number(signUpRes.expires_in) * 1000 : 0;

          if (!sbToken && sbUserId) {
            const tokenRes = await Vault.sbFetch('/auth/v1/token?grant_type=password', {
              method: 'POST',
              body: { email, password: pwd }
            });
            sbToken = tokenRes?.access_token || '';
            sbRefreshToken = tokenRes?.refresh_token || '';
            sbExpiresAt = tokenRes?.expires_in ? Date.now() + Number(tokenRes.expires_in) * 1000 : 0;
          }
        } catch (err) {
          if (/already registered|already exists/i.test(err.message)) {
            return fail(
              { 'reg-email': `Supabase Cloud: ${err.message}` },
              ['reg-name', 'reg-email', 'reg-payday', 'reg-preset']
            );
          }
        }
      }

      reg[canonicalId] = {
        id: canonicalId,
        isDemo: false,
        fullName,
        email,
        paydayMode,
        customPayday: '',
        salt,
        pwdHash,
        sbUserId,
        budgets: {},
        w: starter.w,
        t: starter.t,
        b: starter.b,
        n: starter.n,
        updatedAt: Date.now(),
        pendingSync: Boolean(sbUserId)
      };
      Vault.saveRegistry(reg);

      S = {
        ...createEmptyState(),
        authenticated: true,
        view: 'today',
        accountId: canonicalId,
        isDemo: false,
        fullName,
        email,
        paydayMode,
        customPayday: '',
        salt,
        sbToken,
        sbRefreshToken,
        sbExpiresAt,
        sbUserId,
        syncState: sbUserId ? 'syncing' : 'local',
        budgets: {},
        w: hydratedW,
        t: starter.t,
        b: starter.b,
        n: starter.n
      };

      saveWorkspace({ syncCloud: true });
      location.replace('#today');
    } finally {
      S.authBusy = false;
    }
  }

  async function openDemoAccount() {
    if (S.authBusy) return;
    S.authBusy = true;
    R();
    try {
      const reg = await ensureDemoAccountSeeded();
      const acc = reg.demo;
      sessionVaultKey = await Vault.deriveVaultKey('demo1234', acc.salt);
      const hydratedW = await Vault.hydrateWalletsInMemory(acc.w, sessionVaultKey, acc.fullName);
      S = {
        ...createEmptyState(),
        authenticated: true,
        view: 'today',
        accountId: 'demo',
        isDemo: true,
        fullName: acc.fullName,
        email: acc.email,
        paydayMode: acc.paydayMode || 'bimonthly',
        customPayday: acc.customPayday || '',
        salt: acc.salt,
        syncState: 'local',
        budgets: { ...(acc.budgets || {}) },
        w: hydratedW,
        t: acc.t || [],
        b: acc.b || [],
        n: acc.n || 20
      };
      saveWorkspace({ syncCloud: false });
      location.replace('#today');
    } finally {
      S.authBusy = false;
    }
  }

  async function confirmUnlockVault() {
    const pwd = document.getElementById('unlock-pwd')?.value ?? '';
    if (!pwd) return fail({ 'unlock-pwd': 'Enter your account password to unlock card details.' }, []);
    const reg = Vault.loadRegistry();
    const acc = reg[S.accountId];
    if (!acc) return closeModal();

    if (acc.pwdHash) {
      const computed = await Vault.hashPassword(pwd, acc.salt);
      if (!Vault.timingSafeEqualHex(computed, acc.pwdHash)) {
        return fail({ 'unlock-pwd': 'Incorrect password.' }, []);
      }
    }
    const key = await Vault.deriveVaultKey(pwd, acc.salt);
    const hydrated = await Vault.hydrateWalletsInMemory(acc.w, key, S.fullName);
    const anyCardVault = acc.w.find(w => w.encrypted_card_vault);
    if (anyCardVault) {
      const check = await Vault.decryptVaultPayload(anyCardVault.encrypted_card_vault, key);
      if (!check) return fail({ 'unlock-pwd': 'Incorrect password for this card vault.' }, []);
    }

    sessionVaultKey = key;
    const upgraded = await upgradeAccountKdfIfLegacy(pwd, acc.salt, hydrated);
    sessionVaultKey = upgraded.key;
    S.salt = upgraded.salt;
    S.w = upgraded.wallets;
    if (upgraded.upgraded) {
      acc.salt = upgraded.salt;
      acc.pwdHash = upgraded.pwdHash;
      Vault.saveRegistry(reg);
      saveWorkspace({ syncCloud: true });
    }

    const followUp = pendingUnlockAfterAction;
    pendingUnlockAfterAction = null;
    closeModal();
    if (typeof followUp === 'function') followUp();
    else R();
  }

  function signOut({ switchToSignup = false } = {}) {
    sessionVaultKey = null;
    pendingUnlockAfterAction = null;
    try {
      localStorage.removeItem(Vault.STORAGE_SESSION);
    } catch (e) {}
    S = {
      ...createEmptyState(),
      authTab: switchToSignup ? 'signup' : 'signin',
      draft: switchToSignup ? {} : { 'login-email': 'demo@onewallet.ph' }
    };
    if (location.hash === '#login') R();
    else location.replace('#login');
  }

  /* ---------- Card Security: Auto-Mask on Blur & Visibility Change ---------- */
  function maskSensitiveCardsOnBlur() {
    const hadRevealed = Object.values(S.revealed).some(Boolean);
    const hadFlipped = Object.values(S.flipped).some(Boolean);
    if (hadRevealed || hadFlipped) {
      S.revealed = {};
      S.flipped = {};
      S.copiedId = 0;
      if (S.authenticated && S.view !== 'login') R();
    }
  }

  /* ---------- Navigation & Modals ---------- */
  function go(v) {
    S.revealed = {};
    S.flipped = {};
    if (location.hash === '#' + v) {
      S.view = v;
      S.wid = 0;
      S.pr = null;
      R();
    } else {
      location.hash = v;
    }
  }

  let keepWallet = false;
  function openWallet(id) {
    S.wid = Number(id);
    if (S.view !== 'wallets') {
      keepWallet = true;
      go('wallets');
    } else {
      R();
    }
  }

  function openModal(m, id = 0) {
    if (!S.modal && document.activeElement && document.activeElement !== document.body) {
      lastModalTrigger = document.activeElement;
    }
    S.modal = m;
    S.editWid = 0;
    S.editTxId = 0;
    S.editBillId = 0;
    S.payBillId = 0;
    S.confirmTargetId = 0;
    S.manualCatPicked = false;
    S.txDupAck = false;
    S.draft = {};
    S.errors = {};

    if (m === 'wallet' && id) {
      const w = S.w.find(x => Number(x.id) === Number(id));
      if (!w) return;
      if (!sessionVaultKey && !S.isDemo && w.hasCard) {
        pendingUnlockAfterAction = () => openModal('wallet', id);
        S.modal = 'unlockVault';
        renderModal();
        return;
      }
      S.editWid = Number(id);
      S.draft = {
        wnm: w.n,
        wb: Money.roundMoney(w.b).toFixed(2),
        wstyle: w.style,
        wnum: w.num || (w.last4 ? w.last4 : ''),
        wexp: w.exp || '',
        wcvv: w.cvv || '',
        wholder: w.holder || (S.fullName || '').toUpperCase()
      };
    } else if (m === 'wallet') {
      if (!sessionVaultKey && !S.isDemo) {
        pendingUnlockAfterAction = () => openModal('wallet', 0);
        S.modal = 'unlockVault';
        renderModal();
        return;
      }
      S.draft = {
        wstyle: 'gcash',
        wnm: 'GCash',
        wholder: (S.fullName || 'ONE WALLET USER').toUpperCase()
      };
    } else if (m === 'tx' && id) {
      S.editTxId = Number(id);
      S.manualCatPicked = true;
      const t = S.t.find(x => Number(x.id) === Number(id));
      if (t) {
        S.draft = {
          ty: Money.toCents(t.a) >= 0 ? '1' : '-1',
          am: Math.abs(Money.roundMoney(t.a)).toFixed(2),
          mw: String(t.w),
          mc: t.c,
          nt: t.s,
          tnote: t.note || '',
          td: Domain.normalizeEntryDate(t.d, getToday())
        };
      }
    } else if (m === 'tx') {
      S.draft = {
        ty: '-1',
        td: getToday(),
        mw: String(S.wid || S.w[0]?.id || ''),
        mc: 'Food'
      };
    } else if (m === 'bill' && id) {
      S.editBillId = Number(id);
      const b = S.b.find(x => Number(x.id) === Number(id));
      if (b) {
        S.draft = {
          bn: b.n,
          ba: Money.roundMoney(b.a).toFixed(2),
          bd: b.dueDate || '',
          btext: b.dueDate ? '' : b.d,
          bfreq: b.freq || 'once'
        };
      }
    } else if (m === 'bill') {
      S.draft = { bfreq: 'once', bd: Domain.shiftDaysISO(getToday(), 5) };
    } else if (m === 'payBill' && id) {
      S.payBillId = Number(id);
      const b = S.b.find(x => Number(x.id) === Number(id));
      if (b) {
        S.draft = {
          pw: String(S.w[0]?.id || ''),
          pa: Money.roundMoney(b.a).toFixed(2)
        };
      }
    } else if (m === 'payday') {
      S.draft = {
        pmode: S.paydayMode || 'bimonthly',
        pcustom: S.customPayday || Domain.shiftDaysISO(getToday(), 15),
        pname: S.fullName
      };
    } else if (m === 'supabase') {
      const cfg = Vault.getSupabaseConfig();
      S.draft = { sburl: cfg.url, sbkey: cfg.anonKey };
    } else if (m === 'budgets') {
      const d = {};
      for (const c of CATEGORIES.filter(x => x !== 'Income')) {
        d[`bcap-${c}`] = S.budgets?.[c] ? Money.roundMoney(S.budgets[c]).toFixed(2) : '';
      }
      S.draft = d;
    } else if (m === 'confirmDelTx' || m === 'confirmDelBill' || m === 'confirmDelWallet') {
      S.confirmTargetId = Number(id);
    }

    renderModal();
  }

  function closeModal(mutated = false) {
    const trigger = lastModalTrigger;
    lastModalTrigger = null;
    S.modal = '';
    S.editWid = 0;
    S.editTxId = 0;
    S.editBillId = 0;
    S.payBillId = 0;
    S.confirmTargetId = 0;
    S.txDupAck = false;
    S.draft = {};
    S.errors = {};
    if (mutated) {
      saveWorkspace({ syncCloud: true });
      R();
    } else {
      renderModal();
    }
    if (trigger && trigger.isConnected) trigger.focus();
  }

  function fail(errors, fields = []) {
    S.authBusy = false;
    S.errors = errors;
    const captured = {};
    for (const f of fields) {
      const el = document.getElementById(f);
      if (el && el.type !== 'password') captured[f] = el.value.trim();
    }
    S.draft = { ...S.draft, ...captured };
    if (S.modal) {
      renderModal();
    } else {
      R();
      document.querySelector('[aria-invalid="true"]')?.focus();
    }
  }

  /* ---------- Card Reveal, Flip & 3D Spring Carousel ---------- */
  function toggleReveal(id) {
    const numId = Number(id);
    if (!S.revealed[numId] && !sessionVaultKey && !S.isDemo) {
      pendingUnlockAfterAction = () => {
        S.revealed[numId] = true;
        R();
      };
      openModal('unlockVault');
      return;
    }
    S.revealed[numId] = !S.revealed[numId];
    R();
  }

  function toggleFlip(id) {
    const numId = Number(id);
    S.flipped[numId] = !S.flipped[numId];
    const flp = !!S.flipped[numId];
    document.querySelectorAll(`[data-flip-id="${numId}"]`).forEach(el => {
      el.classList.remove('is-tilting');
      el.style.transform = '';
      el.classList.toggle('is-flipped', flp);
      el.setAttribute('aria-pressed', String(flp));
    });
    document.querySelectorAll(`[data-flip-btn="${numId}"]`).forEach(btn => {
      btn.textContent = btn.dataset.short ? (flp ? 'Front' : 'Spin') : (flp ? 'Show front' : 'Spin card 180°');
    });
  }

  function maskAllCards() {
    S.revealed = {};
    S.flipped = {};
    R();
  }

  function copyCardNum(id) {
    const w = S.w.find(x => Number(x.id) === Number(id));
    const digits = Vault.cleanCardDigits(w?.num || '');
    if (!digits) return;
    try { navigator.clipboard?.writeText(digits); } catch (e) {}
    S.copiedId = Number(id);
    R();
    setTimeout(() => {
      if (S.copiedId === Number(id)) {
        S.copiedId = 0;
        R();
      }
    }, 1800);
  }

  function slotPose(d) {
    const s = d < 0 ? -1 : 1;
    const a = Math.min(2, Math.abs(d));
    if (a <= 1) {
      return {
        tx: s * 58 * a,
        tz: -80 * a,
        sc: 1 - 0.16 * a,
        ry: -s * 22 * a,
        op: 1 - 0.18 * a,
        zi: a < 0.5 ? 30 : 20
      };
    }
    const t = a - 1;
    return {
      tx: s * (58 + 34 * t),
      tz: -80 - 80 * t,
      sc: 0.84 - 0.12 * t,
      ry: -s * (22 + 10 * t),
      op: 0.82 * (1 - t),
      zi: 10
    };
  }

  let cSpring = { pos: 0, vel: 0, target: 0, raf: 0, lastT: 0 };
  let cDrag = { active: false, pointerId: null, startX: 0, startPos: 0, dx: 0, vx: 0, lastX: 0, lastT: 0, moved: false };

  function circularDiff(i, pos, len) {
    if (len <= 1) return 0;
    let d = ((i - pos) % len + len) % len;
    if (len === 2) {
      if (d > 1) d -= 2;
    } else if (d > len / 2) {
      d -= len;
    }
    return d;
  }

  function renderCarouselFrame(pos) {
    const len = S.w.length;
    if (!len) return;
    document.querySelectorAll('[data-slot-idx]').forEach(slot => {
      const i = Number(slot.dataset.slotIdx);
      const d = circularDiff(i, pos, len);
      const p = slotPose(d);
      slot.style.transform = `translate3d(${p.tx.toFixed(2)}%, 0, ${p.tz.toFixed(1)}px) scale(${p.sc.toFixed(3)}) rotateY(${p.ry.toFixed(2)}deg)`;
      slot.style.opacity = p.op.toFixed(3);
      slot.style.zIndex = String(p.zi);
      slot.style.pointerEvents = Math.abs(d) >= 1.85 ? 'none' : '';
    });
  }

  function stepCarouselSpring(now) {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cSpring.pos = cSpring.target;
      cSpring.vel = 0;
      cSpring.raf = 0;
      renderCarouselFrame(cSpring.pos);
      return;
    }
    const dt = Math.min(0.032, cSpring.lastT ? (now - cSpring.lastT) / 1000 : 0.016);
    cSpring.lastT = now;
    const w = 17.45, damp = 33.16;
    const disp = cSpring.pos - cSpring.target;
    const acc = -w * w * disp - damp * cSpring.vel;
    cSpring.vel += acc * dt;
    cSpring.pos += cSpring.vel * dt;
    if (Math.abs(cSpring.target - cSpring.pos) < 0.0015 && Math.abs(cSpring.vel) < 0.008) {
      cSpring.pos = cSpring.target;
      cSpring.vel = 0;
      cSpring.raf = 0;
      cSpring.lastT = 0;
      renderCarouselFrame(cSpring.pos);
      return;
    }
    renderCarouselFrame(cSpring.pos);
    cSpring.raf = requestAnimationFrame(stepCarouselSpring);
  }

  function startCarouselSpring() {
    if (!cSpring.raf) {
      cSpring.lastT = 0;
      cSpring.raf = requestAnimationFrame(stepCarouselSpring);
    }
  }

  function syncCarouselChrome() {
    const len = S.w.length;
    if (!len) return;
    const activeIdx = ((S.carouselIdx || 0) % len + len) % len;
    document.querySelectorAll('[data-slot-idx]').forEach(slot => {
      const i = Number(slot.dataset.slotIdx);
      const cw = S.w[i];
      if (!cw) return;
      const d = Math.round(circularDiff(i, activeIdx, len));
      const isCenter = d === 0;
      const flipper = slot.querySelector('[data-flip-id]');
      if (flipper) {
        flipper.classList.toggle('cursor-pointer', isCenter);
        flipper.setAttribute('tabindex', isCenter ? '0' : '-1');
        if (!isCenter) {
          flipper.classList.remove('is-tilting');
          flipper.style.transform = '';
        }
      }
    });
    document.querySelectorAll('[data-dot-idx]').forEach(btn => {
      const i = Number(btn.dataset.dotIdx);
      const on = i === activeIdx;
      btn.setAttribute('aria-pressed', String(on));
      const bar = btn.querySelector('[data-dot-bar]');
      if (bar) {
        bar.className = `block w-6 h-2 rounded-full transition-[transform,background-color] duration-200 ${on ? 'scale-x-100 bg-ink' : 'scale-x-50 bg-track'}`;
      }
    });
    const sum = document.getElementById('carousel-summary');
    if (sum) sum.innerHTML = renderCarouselSummary(S.w[activeIdx]);
  }

  function spinCard(delta) {
    const len = S.w.length;
    if (!len) return;
    if (document.querySelector('[data-slot-idx]')) {
      cSpring.target = Math.round(cSpring.target) + delta;
      S.carouselIdx = ((cSpring.target % len) + len) % len;
      syncCarouselChrome();
      startCarouselSpring();
    } else {
      S.carouselIdx = ((S.carouselIdx || 0) + delta + len) % len;
      cSpring.pos = cSpring.target = S.carouselIdx;
      R();
    }
  }

  function goCard(idx) {
    const len = S.w.length;
    if (!len) return;
    const nextIdx = Math.max(0, Math.min(len - 1, idx));
    if (document.querySelector('[data-slot-idx]')) {
      const curIdx = ((Math.round(cSpring.target) % len) + len) % len;
      const step = Math.round(circularDiff(nextIdx, curIdx, len));
      cSpring.target = Math.round(cSpring.target) + step;
      S.carouselIdx = nextIdx;
      syncCarouselChrome();
      startCarouselSpring();
    } else {
      S.carouselIdx = nextIdx;
      cSpring.pos = cSpring.target = nextIdx;
      R();
    }
  }

  /* ---------- Mutations Using Pure Domain Operations ---------- */
  function saveTx() {
    const direction = Number(val('ty')) >= 0 ? 1 : -1;
    const amount = val('am');
    const walletId = val('mw');
    const category = val('mc') || (direction > 0 ? 'Income' : 'Others');
    const merchant = val('nt');
    const note = val('tnote');
    const date = val('td') || getToday();
    const fields = ['ty', 'am', 'mw', 'mc', 'nt', 'tnote', 'td'];

    // Duplicate warning on manual create (unless already acknowledged)
    if (!S.editTxId && !S.txDupAck) {
      const parsedAmt = Money.parseMoneyInput(amount, { allowZero: false, allowNegative: false });
      if (parsedAmt.ok && merchant) {
        const dup = Domain.findDuplicateTransaction(
          { walletId, signedAmount: direction * parsedAmt.value, merchant, date },
          S.t,
          getToday()
        );
        if (dup) {
          S.txDupAck = true;
          return fail(
            { am: `Similar entry already exists on ${Domain.formatShortDate(dup.tx.d)} (${dup.tx.s}, ${signed(dup.tx.a)}). Click Save entry again to confirm.` },
            fields
          );
        }
      }
    }

    const res = S.editTxId
      ? Domain.updateTransaction(S, S.editTxId, { walletId, amount, direction, merchant, category, date, note })
      : Domain.recordTransaction(S, { walletId, amount, direction, merchant, category, date, note, src: 'manual' });

    if (!res.ok) return fail(res.errors, fields);
    S = res.state;
    closeModal(true);
  }

  async function saveWallet() {
    const name = val('wnm');
    const balParse = Money.parseMoneyInput(val('wb'), {
      allowBlank: true,
      blankValue: 0,
      allowZero: true,
      allowNegative: true,
      label: 'Balance'
    });
    const style = S.draft.wstyle || 'gcash';
    const rawNum = val('wnum');
    const rawExp = val('wexp');
    const rawCvv = val('wcvv');
    const holder = (val('wholder') || S.fullName || 'ONE WALLET USER').toUpperCase();
    const fields = ['wnm', 'wb', 'wnum', 'wexp', 'wcvv', 'wholder'];

    const cardCheck = Vault.validateCardFields({ num: rawNum, exp: rawExp, cvv: rawCvv });
    const errors = { ...cardCheck.errors };
    if (!name) errors.wnm = 'Give this wallet or card a name.';
    if (!balParse.ok) errors.wb = balParse.error;
    // Prevent duplicate wallet names when creating a new wallet
    if (!S.editWid && name && S.w.some(w => w.n.trim().toLowerCase() === name.toLowerCase())) {
      errors.wnm = 'A wallet with this name already exists.';
    }
    if (Object.keys(errors).length) return fail(errors, fields);

    if (!sessionVaultKey) {
      if (S.isDemo) {
        sessionVaultKey = await Vault.deriveVaultKey('demo1234', S.salt);
      } else {
        pendingUnlockAfterAction = () => saveWallet();
        S.modal = 'unlockVault';
        renderModal();
        return;
      }
    }

    const targetId = S.editWid || ++S.n;
    const last4 = cardCheck.digits.length >= 4 ? cardCheck.digits.slice(-4) : '';
    const encMeta = await Vault.buildEncryptedWallet(
      {
        id: targetId,
        n: name,
        b: balParse.value,
        style,
        num: cardCheck.digits.length >= 12 ? cardCheck.digits : '',
        last4,
        exp: cardCheck.exp,
        cvv: cardCheck.cvv,
        holder
      },
      sessionVaultKey
    );

    const fullHydrated = {
      ...encMeta,
      vaultUnlocked: true,
      num: cardCheck.digits.length >= 12 ? cardCheck.digits : '',
      exp: cardCheck.exp,
      cvv: cardCheck.cvv,
      holder
    };

    if (S.editWid) {
      const existing = S.w.find(x => Number(x.id) === Number(S.editWid));
      if (existing) {
        const previousBalance = Money.roundMoney(existing.b);
        // Update metadata first keeping previous balance, then record reconciliation if balance changed!
        Object.assign(existing, { ...fullHydrated, b: previousBalance });
        if (Money.toCents(balParse.value) !== Money.toCents(previousBalance)) {
          const rec = Domain.reconcileWallet(S, existing.id, balParse.value, getToday());
          if (rec.ok) S = rec.state;
        }
      }
    } else {
      S.w = [...S.w, fullHydrated];
    }

    closeModal(true);
  }

  function saveBill() {
    const res = Domain.upsertBill(
      S,
      {
        billId: S.editBillId,
        name: val('bn'),
        amount: val('ba'),
        dueDate: val('bd'),
        dueText: val('btext'),
        freq: val('bfreq') || 'once'
      },
      getToday()
    );
    if (!res.ok) return fail(res.errors, ['bn', 'ba', 'bd', 'btext', 'bfreq']);
    S = res.state;
    closeModal(true);
  }

  function confirmPayBill() {
    const res = Domain.settleBill(
      S,
      { billId: S.payBillId, walletId: val('pw'), paymentAmount: val('pa') },
      getToday()
    );
    if (!res.ok) return fail(res.errors, ['pw', 'pa']);
    S = res.state;
    const msg = res.outcome === 'partial'
      ? 'Partial bill payment recorded · Remaining balance kept set aside.'
      : res.outcome === 'rolled'
        ? 'Recurring bill paid · Next due date scheduled.'
        : 'Bill paid and recorded in your ledger.';
    closeModal(true);
    showToast(msg);
  }

  function saveReconcile() {
    const res = Domain.reconcileWallet(S, S.wid, val('rb'), getToday());
    if (!res.ok) return fail(res.errors, ['rb']);
    S = res.state;
    closeModal(true);
    if (res.diff !== 0) showToast(`Balance adjusted by ${signed(res.diff)}.`);
  }

  function savePaydaySettings() {
    const fullName = val('pname') || S.fullName;
    const mode = val('pmode') || 'bimonthly';
    const custom = val('pcustom') || '';
    if (mode === 'custom' && (!Domain.isValidISODate(custom) || custom < getToday())) {
      return fail({ pcustom: 'Pick today or a future payday date.' }, ['pname', 'pmode', 'pcustom']);
    }
    S.fullName = fullName;
    S.paydayMode = mode;
    S.customPayday = mode === 'custom' ? custom : '';
    closeModal(true);
  }

  function saveBudgets() {
    const nextBudgets = {};
    const errors = {};
    const fields = [];
    for (const c of CATEGORIES.filter(x => x !== 'Income')) {
      const fid = `bcap-${c}`;
      fields.push(fid);
      const raw = val(fid);
      if (!raw) continue;
      const p = Money.parseMoneyInput(raw, { allowZero: true, allowNegative: false, label: `${c} budget` });
      if (!p.ok) errors[fid] = p.error;
      else if (p.cents > 0) nextBudgets[c] = p.value;
    }
    if (Object.keys(errors).length) return fail(errors, fields);
    S.budgets = nextBudgets;
    closeModal(true);
    showToast('Category spending limits saved.');
  }

  function saveSupabaseSettings() {
    const url = val('sburl');
    const key = val('sbkey');
    Vault.setSupabaseConfig(url, key);
    closeModal(true);
    showToast(url && key ? 'Supabase Cloud endpoint updated.' : 'Reverted to default Supabase project.');
  }

  function executeConfirmedDeleteTx() {
    const res = Domain.removeTransaction(S, S.confirmTargetId);
    if (res.ok) S = res.state;
    closeModal(true);
  }

  function executeConfirmedDeleteBill() {
    S.b = S.b.filter(b => Number(b.id) !== Number(S.confirmTargetId));
    closeModal(true);
  }

  function executeConfirmedDeleteWallet(purgeTransactions) {
    const targetId = S.confirmTargetId;
    const res = Domain.removeWallet(S, targetId, { purgeTransactions });
    if (res.ok) {
      S = res.state;
      if (Number(S.wid) === Number(targetId)) S.wid = 0;
      if (S.carouselIdx >= S.w.length) S.carouselIdx = Math.max(0, S.w.length - 1);
    }
    closeModal(true);
  }

  async function resetDemoData() {
    localStorage.removeItem(Vault.STORAGE_ACCOUNTS);
    localStorage.removeItem(Vault.STORAGE_SESSION);
    await ensureDemoAccountSeeded();
    closeModal(false);
    await openDemoAccount();
    showToast('Workspace reset to fresh demo defaults.');
  }

  function deleteCurrentAccount() {
    if (S.isDemo) return;
    const deletedId = S.accountId;
    Vault.deleteAccountFromRegistry(deletedId);
    closeModal(false);
    signOut();
  }

  /* ---------- SMS / Notification Import Workflow ---------- */
  function readAlert() {
    S.raw = document.getElementById('raw')?.value ?? S.raw;
    S.importDupAck = false;
    S.errors = {};
    const parsed = Parser.parseAlert(S.raw, {
      wallets: S.w,
      existingTransactions: S.t,
      today: getToday()
    });
    S.pr = parsed;
    if (parsed.valid) {
      S.draft = {
        'imp-dir': String(parsed.dir),
        'imp-amt': parsed.a.toFixed(2),
        'imp-merch': parsed.s,
        'imp-cat': parsed.c,
        'imp-date': parsed.d,
        'imp-wal': String(parsed.w || S.w[0]?.id || ''),
        'imp-ref': parsed.ref || ''
      };
    }
    R();
  }

  function confirmAlertImport() {
    if (!S.pr || !S.pr.valid) return;
    const direction = Number(val('imp-dir')) >= 0 ? 1 : -1;
    const amount = val('imp-amt');
    const merchant = val('imp-merch');
    const category = val('imp-cat');
    const date = val('imp-date');
    const walletId = val('imp-wal');
    const ref = val('imp-ref');
    const fields = ['imp-dir', 'imp-amt', 'imp-merch', 'imp-cat', 'imp-date', 'imp-wal', 'imp-ref'];

    const amtCheck = Money.parseMoneyInput(amount, { allowZero: false, allowNegative: false, label: 'Amount' });
    const errors = {};
    if (!amtCheck.ok) errors['imp-amt'] = amtCheck.error;
    if (!merchant) errors['imp-merch'] = 'Enter a merchant or sender name.';
    if (!Domain.isValidISODate(date)) errors['imp-date'] = 'Enter a valid date.';
    if (!S.w.some(w => Number(w.id) === Number(walletId))) {
      errors['imp-wal'] = S.w.length ? 'Select a destination wallet.' : 'Create a wallet first in Wallets & Cards.';
    }
    if (Object.keys(errors).length) return fail(errors, fields);

    // Check duplicate against live edited fields
    const dup = Domain.findDuplicateTransaction(
      { walletId, signedAmount: direction * amtCheck.value, merchant, date, ref },
      S.t,
      getToday()
    );
    if (dup && !S.importDupAck) {
      S.importDupAck = true;
      return fail(
        {
          'imp-amt': dup.reason === 'reference'
            ? `Reference ${dup.tx.ref} was already imported (${dup.tx.s}, ${signed(dup.tx.a)}). Click Add to ledger again only if this is separate.`
            : `Matching entry already exists on ${Domain.formatShortDate(dup.tx.d)} (${dup.tx.s}, ${signed(dup.tx.a)}). Click Add to ledger again to confirm.`
        },
        fields
      );
    }

    const res = Domain.recordTransaction(S, {
      walletId,
      amount: amtCheck.value,
      direction,
      merchant,
      category,
      date,
      note: S.pr.provider ? `Imported via ${S.pr.provider}` : 'Imported alert',
      src: 'import',
      ref
    });
    if (!res.ok) {
      return fail({ 'imp-amt': res.errors.am || res.errors.mw || 'Check parsed fields.' }, fields);
    }

    S = res.state;
    S.pr = null;
    S.raw = '';
    S.importDupAck = false;
    S.draft = {};
    saveWorkspace({ syncCloud: true });
    go('ledger');
    showToast('Alert imported into your passbook ledger.');
  }

  /* ---------- Data Portability: CSV Export & JSON Backup / Restore ---------- */
  function triggerDownload(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handleExportCSV(listOverride = null) {
    const rows = Array.isArray(listOverride) ? listOverride : getFilteredLedgerEntries();
    const csv = Domain.exportTransactionsCSV(rows, S.w, getToday());
    triggerDownload(`onewallet-ledger-${getToday()}.csv`, csv, 'text/csv;charset=utf-8');
    showToast(`Exported ${rows.length} ledger entr${rows.length === 1 ? 'y' : 'ies'} to CSV.`);
  }

  function handleExportBackup() {
    saveWorkspace({ syncCloud: false });
    const reg = Vault.loadRegistry();
    const acc = reg[S.accountId] || S;
    const backup = Domain.createWorkspaceBackup(acc);
    triggerDownload(
      `onewallet-backup-${getToday()}.json`,
      JSON.stringify(backup, null, 2),
      'application/json;charset=utf-8'
    );
    showToast('Workspace JSON backup downloaded.');
  }

  async function handleRestoreBackupFile(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const check = Domain.validateWorkspaceBackup(text);
      if (!check.ok) {
        showToast(check.error);
        return;
      }
      const d = check.data;
      const hydratedW = await Vault.hydrateWalletsInMemory(d.w, sessionVaultKey, S.fullName);
      S = {
        ...S,
        paydayMode: d.paydayMode,
        customPayday: d.customPayday,
        budgets: d.budgets,
        w: hydratedW,
        t: d.t,
        b: d.b,
        n: d.n,
        wid: 0,
        carouselIdx: 0
      };
      saveWorkspace({ syncCloud: true });
      R();
      showToast(`Restored ${d.w.length} wallets, ${d.t.length} entries, and ${d.b.length} bills.`);
    } catch (e) {
      showToast('Could not read the selected backup file.');
    }
  }

  /* ---------- UI Building Blocks ---------- */
  const field = (id, label, input, hint = '') => {
    const err = S.errors[id];
    return `<div class="mb-4">
      <label class="${C.label}" for="${id}">${label}</label>
      ${input}
      ${err ? `<p id="${id}-err" class="mt-1.5 text-xs text-alert">${esc(err)}</p>` : hint ? `<p class="mt-1.5 ${C.meta}">${hint}</p>` : ''}
    </div>`;
  };
  const inputAttrs = id =>
    `id="${id}" name="${id}" class="${C.input}" ${S.errors[id] ? `aria-invalid="true" aria-describedby="${id}-err"` : ''}`;
  const draft = (id, fallback = '') => esc(S.draft[id] ?? fallback);
  const walletOptions = sel => S.w.length
    ? S.w.map(w => `<option value="${w.id}" ${Number(w.id) === Number(sel) ? 'selected' : ''}>${esc(w.n)} (${peso(w.b)})</option>`).join('')
    : '<option value="">No wallets yet</option>';

  const walletDisplayName = tx => {
    const found = S.w.find(x => Number(x.id) === Number(tx.w));
    return esc(found ? found.n : (tx.walletLabel || 'Archived wallet'));
  };

  function sourceBadge(tx) {
    if (Domain.isAdjustmentEntry(tx)) {
      return '<span class="px-1.5 py-0.5 rounded bg-subtle text-[11px] font-medium text-ink-2">Reconciled</span>';
    }
    if (tx.src === 'import') {
      return '<span class="px-1.5 py-0.5 rounded bg-subtle text-[11px] font-medium text-ink-2">Imported</span>';
    }
    if (tx.src === 'bill') {
      return '<span class="px-1.5 py-0.5 rounded bg-subtle text-[11px] font-medium text-ink-2">Bill</span>';
    }
    return '';
  }

  function billUrgencyBadge(bill, today = getToday()) {
    if (!bill.dueDate || !Domain.isValidISODate(bill.dueDate)) return '';
    const diff = Domain.daysBetweenISO(today, bill.dueDate);
    if (diff < 0) return `<span class="tnum text-[11px] font-semibold px-1.5 py-0.5 rounded bg-subtle text-alert">Overdue ${Math.abs(diff)}d</span>`;
    if (diff === 0) return '<span class="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-subtle text-marigold">Due today</span>';
    if (diff <= 3) return `<span class="tnum text-[11px] font-medium px-1.5 py-0.5 rounded bg-subtle text-marigold">In ${diff}d</span>`;
    return `<span class="tnum text-[11px] text-mute">In ${diff}d</span>`;
  }

  function renderFlippableCard(w, { revealed = false, flipped = false, active = true } = {}) {
    const holderFallback = (S.fullName || '').toUpperCase();
    return `<div data-flip-id="${w.id}" ${active ? `data-action="flip-card" data-id="${w.id}" role="button" tabindex="0" aria-pressed="${flipped}" aria-label="${esc(w.n)} card. Press Enter or click to spin 180 degrees"` : 'tabindex="-1"'} class="card-flipper ${flipped ? 'is-flipped' : ''} ${active ? 'cursor-pointer' : ''}">
      <div class="card-face-front">${Cards.renderCardFace(w, { revealed, copiedId: S.copiedId, fallbackHolder: holderFallback })}<div class="card-sheen" aria-hidden="true"></div></div>
      <div class="card-face-back">${Cards.renderCardBack(w, { revealed, copiedId: S.copiedId, fallbackHolder: holderFallback })}</div>
    </div>`;
  }

  function renderCarouselSummary(activeW) {
    if (!activeW) return '';
    const posTotal = Money.sumMoney(S.w, w => (Money.toCents(w.b) > 0 ? w.b : 0));
    const st = Cards.getCardStyle(activeW.style);
    const activeRev = !!S.revealed[activeW.id];
    const activeFlp = !!S.flipped[activeW.id];
    const cardTxs = Domain.sortTransactions(S.t.filter(t => Number(t.w) === Number(activeW.id)), getToday());
    const activeCount = cardTxs.length;
    const activeShare = Money.pctShare(Money.toCents(activeW.b) > 0 ? activeW.b : 0, posTotal);
    const recentTxs = cardTxs.slice(0, 4);
    const hasSecrets = Boolean(activeW.hasCard || activeW.num || activeW.exp || activeW.cvv);

    return `<div class="grid gap-4 lg:grid-cols-[1.05fr_1.15fr] items-stretch">
      <article class="${C.card} p-5 flex flex-col justify-between gap-4">
        <div>
          <div class="flex items-start justify-between gap-3 pb-3 border-b border-line">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span data-ui class="w-5 h-3.5 rounded-[3px] shrink-0 inline-block" style="background-color:${st.bg}"></span>
                <h2 class="text-base font-semibold text-ink truncate">${esc(activeW.n)}</h2>
                ${activeW.last4 ? `<span class="tnum text-xs text-mute">••${esc(activeW.last4)}</span>` : ''}
              </div>
              <p class="text-[13px] text-mute mt-0.5">${esc(st.name)} · ${activeCount} entr${activeCount === 1 ? 'y' : 'ies'} · ${activeShare}% of positive funds</p>
            </div>
            <span class="tnum text-[24px] leading-none font-semibold ${Money.toCents(activeW.b) < 0 ? 'text-alert' : 'text-ink'} shrink-0">${Money.toCents(activeW.b) < 0 ? '− ' + peso(activeW.b) : peso(activeW.b)}</span>
          </div>

          <div class="mt-3">
            <div class="flex justify-between text-xs text-mute mb-1.5 tnum">
              <span>Share of ${peso(posTotal)} positive funds</span>
              <span class="font-medium text-ink">${activeShare}%</span>
            </div>
            <div class="h-1.5 rounded-full bg-track overflow-hidden">
              <span class="block h-full rounded-full bg-ink" style="width:${activeShare}%"></span>
            </div>
          </div>

          <dl class="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 pt-3 border-t border-line text-xs">
            <div class="flex justify-between gap-2"><dt class="text-mute">Network</dt><dd class="font-medium text-ink">${esc(st.netLabel)}</dd></div>
            <div class="flex justify-between gap-2"><dt class="text-mute">Vault</dt><dd class="font-medium text-ink">${hasSecrets ? 'AES-256-GCM' : 'Passbook only'}</dd></div>
            <div class="flex justify-between gap-2"><dt class="text-mute">Cardholder</dt><dd class="font-medium text-ink truncate">${activeRev ? esc(activeW.holder || S.fullName) : (hasSecrets ? 'Masked' : '—')}</dd></div>
            <div class="flex justify-between gap-2"><dt class="text-mute">Valid thru</dt><dd class="tnum font-medium text-ink">${hasSecrets ? (activeRev ? esc(activeW.exp || '—') : '••/••') : '—'}</dd></div>
          </dl>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-line">
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" data-flip-btn="${activeW.id}" data-action="flip-card" data-id="${activeW.id}" class="${C.btn2}">${activeFlp ? 'Show front' : 'Spin card 180°'}</button>
            ${hasSecrets ? `<button type="button" data-action="reveal-card" data-id="${activeW.id}" class="${C.btn2}">${icon(activeRev ? I.eyeOff : I.eye, 'w-4 h-4', 16)}${activeRev ? 'Hide info' : 'Check card info'}</button>` : ''}
            <button type="button" data-action="open-modal" data-modal="wallet" data-id="${activeW.id}" class="${C.link} text-sm px-1">${hasSecrets ? 'Edit card' : 'Add card details'}</button>
          </div>
          <button type="button" data-action="open-wallet" data-id="${activeW.id}" class="${C.btn}">Open ledger${icon(I.chevron, 'w-4 h-4', 16)}</button>
        </div>
      </article>

      <section class="${C.card} p-5 flex flex-col justify-between" aria-label="Recent activity for ${esc(activeW.n)}">
        <div>
          <div class="flex items-center justify-between gap-2 pb-3 border-b border-line">
            <h3 class="${C.cardTitle}">Recent ${esc(activeW.n)} activity</h3>
            <button type="button" data-action="add-tx-for-wallet" data-id="${activeW.id}" class="${C.link} text-xs inline-flex items-center gap-1">${icon(I.plus, 'w-3.5 h-3.5', 14)}Add entry</button>
          </div>
          ${recentTxs.length ? `<ul class="divide-y divide-line/60 mt-1">
            ${recentTxs.map(t => `<li class="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div class="min-w-0">
                <p class="font-medium text-ink truncate">${esc(t.s)}</p>
                <p class="${C.meta} truncate">${esc(t.c)} · ${Domain.formatShortDate(t.d, getToday())}</p>
              </div>
              <span class="tnum font-semibold whitespace-nowrap ${Money.toCents(t.a) > 0 ? 'text-gain' : 'text-ink'}">${signed(t.a)}</span>
            </li>`).join('')}
          </ul>` : `<div class="py-8 text-center">
            <p class="${C.meta} mb-3">No recorded entries on ${esc(activeW.n)} yet.</p>
            <button type="button" data-action="add-tx-for-wallet" data-id="${activeW.id}" class="${C.btn2}">${icon(I.plus, 'w-4 h-4', 16)}Record first entry</button>
          </div>`}
        </div>
        <div class="flex items-center justify-between pt-3 mt-2 border-t border-line text-xs text-mute">
          <span>Showing ${recentTxs.length} of ${activeCount} entr${activeCount === 1 ? 'y' : 'ies'}</span>
          <button type="button" data-action="open-wallet" data-id="${activeW.id}" class="${C.link} text-xs">Full ${esc(activeW.n)} ledger & reconciliation →</button>
        </div>
      </section>
    </div>`;
  }

  function txRow(t, editable) {
    const badge = sourceBadge(t);
    return `<li class="flex items-center gap-3 py-3 border-b border-line/60 last:border-b-0">
      <span class="w-8 h-8 rounded-full bg-subtle text-ink-2 text-xs font-semibold flex items-center justify-center shrink-0" aria-hidden="true">${esc((t.s || '?').charAt(0).toUpperCase())}</span>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="text-sm font-medium text-ink truncate">${esc(t.s)}</span>
          ${badge}
        </div>
        <div class="${C.meta} truncate">${esc(t.c)} · ${walletDisplayName(t)}${t.note ? ` · ${esc(t.note)}` : ''}${t.ref ? ` · Ref ${esc(t.ref)}` : ''}</div>
      </div>
      <span class="tnum text-sm font-semibold whitespace-nowrap ${Money.toCents(t.a) > 0 ? 'text-gain' : 'text-ink'}">${signed(t.a)}</span>
      ${editable ? `
        <button type="button" data-action="open-modal" data-modal="tx" data-id="${t.id}" class="${C.iconBtn}" aria-label="Edit ${esc(t.s)}">${icon(I.edit, 'w-4 h-4', 16)}</button>
        <button type="button" data-action="open-modal" data-modal="confirmDelTx" data-id="${t.id}" class="${C.iconBtn} -mr-1.5" aria-label="Delete ${esc(t.s)}, ${signed(t.a)}">${icon(I.trash, 'w-4 h-4', 16)}</button>` : ''}
    </li>`;
  }

  function ledgerList(list, { editable = false, limit = Infinity, empty = 'No entries yet.', clearFilterBtn = false } = {}) {
    const today = getToday();
    const sorted = Domain.sortTransactions(list, today).slice(0, limit);
    if (!sorted.length) {
      return `<div class="py-8 text-center">
        <p class="${C.meta}">${esc(empty)}</p>
        ${clearFilterBtn ? `<button type="button" data-action="clear-ledger-filters" class="${C.btn2} mt-3">Clear filters</button>` : ''}
      </div>`;
    }
    const groups = [];
    for (const t of sorted) {
      const iso = Domain.normalizeEntryDate(t.d, today);
      const last = groups.at(-1);
      if (last && last.iso === iso) last.items.push(t);
      else groups.push({ iso, items: [t] });
    }
    return groups.map(g => `<section class="mt-4 first:mt-1">
      <div class="flex items-center justify-between pb-1 border-b border-line/50">
        <h3 class="text-xs font-semibold text-ink-2">${esc(Domain.formatDayHeading(g.iso, today))}</h3>
        <span class="tnum text-[11px] text-mute">${g.items.length} entr${g.items.length === 1 ? 'y' : 'ies'}</span>
      </div>
      <ul>${g.items.map(t => txRow(t, editable)).join('')}</ul>
    </section>`).join('');
  }

  function getFilteredLedgerEntries() {
    const today = getToday();
    let list = Domain.filterTransactionsByPeriod(S.t, S.ledgerPeriod, {
      today,
      paydayMode: S.paydayMode,
      customPayday: S.customPayday
    });
    if (S.fw) list = list.filter(t => Number(t.w) === Number(S.fw));
    if (S.ledgerCat) list = list.filter(t => t.c === S.ledgerCat);
    if (S.ledgerType === 'in') list = list.filter(t => Money.toCents(t.a) > 0 && !Domain.isAdjustmentEntry(t));
    else if (S.ledgerType === 'out') list = list.filter(t => Money.toCents(t.a) < 0 && !Domain.isAdjustmentEntry(t));
    else if (S.ledgerType === 'adj') list = list.filter(t => Domain.isAdjustmentEntry(t));

    const q = S.ledgerQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(t => {
        const wName = (S.w.find(w => Number(w.id) === Number(t.w))?.n || t.walletLabel || '').toLowerCase();
        const amtStr = Math.abs(Money.roundMoney(t.a)).toFixed(2);
        return (
          String(t.s || '').toLowerCase().includes(q) ||
          String(t.note || '').toLowerCase().includes(q) ||
          String(t.c || '').toLowerCase().includes(q) ||
          String(t.ref || '').toLowerCase().includes(q) ||
          wName.includes(q) ||
          amtStr.includes(q)
        );
      });
    }
    return list;
  }

  function renderLedgerResultsFragment() {
    const list = getFilteredLedgerEntries();
    const lIn = Money.sumMoney(list.filter(t => Money.toCents(t.a) > 0 && !Domain.isAdjustmentEntry(t)), t => t.a);
    const lOut = Money.sumMoney(list.filter(t => Money.toCents(t.a) < 0 && !Domain.isAdjustmentEntry(t)), t => Math.abs(t.a));
    const lNet = Money.subMoney(lIn, lOut);
    const hasFilters = Boolean(S.fw || S.ledgerQuery.trim() || S.ledgerCat || S.ledgerType !== 'all' || S.ledgerPeriod !== 'all');

    return `
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs text-mute tnum">
        <span>Showing <strong class="text-ink font-semibold">${list.length}</strong> of ${S.t.length} entries${hasFilters ? ` · <button type="button" data-action="clear-ledger-filters" class="${C.link} text-xs">Reset filters</button>` : ''}</span>
        <div class="flex flex-wrap items-center gap-3">
          <span>In <strong class="text-gain font-semibold">+${peso(lIn)}</strong></span>
          <span>Out <strong class="text-ink font-semibold">−${peso(lOut)}</strong></span>
          <span>Net <strong class="font-semibold ${Money.toCents(lNet) >= 0 ? 'text-gain' : 'text-ink'}">${signed(lNet, { neutralZero: true })}</strong></span>
        </div>
      </div>
      <section class="${C.card} p-4 sm:p-5">
        ${ledgerList(list, {
          editable: true,
          empty: hasFilters ? 'No ledger entries match your active search or filters.' : 'No entries yet. Add an entry or paste an SMS alert.',
          clearFilterBtn: hasFilters
        })}
      </section>`;
  }

  const pageHead = (title, sub, actions = '') => `
    <header class="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-line">
      <div>
        ${sub ? `<p class="text-xs font-medium text-mute mb-0.5">${sub}</p>` : ''}
        <h1 class="${C.h1}">${title}</h1>
      </div>
      ${actions ? `<div class="flex flex-wrap items-center gap-2">${actions}</div>` : ''}
    </header>`;

  const cardHead = (title, action = '') =>
    `<div class="flex items-center justify-between gap-2 mb-1.5"><h2 class="${C.cardTitle}">${title}</h2>${action}</div>`;

  const longDate = () => {
    const [y, m, d] = getToday().split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  };

  /* ---------- Dialogs ---------- */
  const dialogShell = (title, body, actions) => `
    <div class="flex items-center justify-between mb-4 pb-3 border-b border-line">
      <h2 id="modal-title" class="text-lg font-semibold text-ink">${title}</h2>
      <button type="button" data-action="close-modal" class="${C.iconBtn} -mr-1.5" aria-label="Close dialog">${icon(I.close, 'w-4 h-4', 16)}</button>
    </div>
    ${body}
    <div class="flex flex-wrap items-center justify-end gap-2.5 mt-6 pt-3 border-t border-line">${actions}</div>`;

  const cancelBtn = `<button type="button" data-action="close-modal" class="${C.btn2}">Cancel</button>`;

  const M = {
    tx: () => {
      const curType = S.draft.ty === '1' ? '1' : '-1';
      return dialogShell(
        S.editTxId ? 'Edit ledger entry' : 'Add ledger entry',
        `<div class="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
          ${field('ty', 'Type', `<select ${inputAttrs('ty')} data-change="tx-type"><option value="-1" ${curType === '-1' ? 'selected' : ''}>Expense</option><option value="1" ${curType === '1' ? 'selected' : ''}>Income</option></select>`)}
          ${field('am', 'Amount (PHP)', `<input ${inputAttrs('am')} type="number" inputmode="decimal" step="0.01" min="0.01" placeholder="0.00" value="${draft('am')}" data-autofocus>`)}
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
          ${field('nt', 'Merchant or counterparty', `<input ${inputAttrs('nt')} data-input="tx-merchant" placeholder="e.g. Jollibee, Meralco, Salary" value="${draft('nt')}">`)}
          ${field('mc', 'Category', `<select ${inputAttrs('mc')} data-change="tx-cat">${CATEGORIES.map(c => `<option value="${c}" ${S.draft.mc === c ? 'selected' : ''}>${c}</option>`).join('')}</select>`)}
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
          ${field('mw', 'Wallet', `<select ${inputAttrs('mw')}>${walletOptions(S.draft.mw)}</select>`)}
          ${field('td', 'Date', `<input ${inputAttrs('td')} type="date" value="${draft('td', getToday())}">`)}
        </div>
        ${field('tnote', 'Note', `<input ${inputAttrs('tnote')} maxlength="140" placeholder="Optional memo or reference" value="${draft('tnote')}">`)}`,
        `${cancelBtn}<button type="button" data-action="save-tx" data-primary-submit class="${C.btn}">${S.editTxId ? 'Update entry' : 'Save entry'}</button>`
      );
    },

    wallet: () => {
      const selStyle = S.draft.wstyle || 'gcash';
      const groups = ['Digital Banks & E-Wallets', 'Credit & Bank Cards'];
      const editingWallet = S.editWid ? S.w.find(x => Number(x.id) === Number(S.editWid)) : null;
      return dialogShell(
        S.editWid ? 'Edit wallet & card vault' : 'Add wallet or card',
        `<div class="mb-4">
          <p class="text-sm font-medium text-ink mb-1">Card or passbook design</p>
          <p class="${C.meta} mb-2.5">Card numbers, expiry, and CVV are optional—when entered, they are encrypted in-browser with AES-256-GCM.</p>
          <div class="max-h-[200px] overflow-y-auto pr-1 space-y-3 border border-line rounded-ctl p-2.5 bg-paper">
            ${groups.map(g => `
              <div>
                <p class="text-xs font-semibold text-ink-2 mb-2">${g}</p>
                <div class="grid grid-cols-2 gap-2">
                  ${Cards.CARD_STYLES.filter(s => s.group === g).map(st => `
                    <button type="button" data-action="pick-card-style" data-style="${st.id}" class="text-left rounded-ctl p-0.5 cursor-pointer ${selStyle === st.id ? 'ring-2 ring-ink' : 'opacity-90 hover:opacity-100'}" aria-pressed="${selStyle === st.id}" aria-label="${esc(st.name)}">
                      ${Cards.renderCardFace({ style: st.id, n: st.bank }, { mini: true })}
                    </button>`).join('')}
                </div>
              </div>`).join('')}
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
          ${field('wnm', 'Wallet or card name', `<input ${inputAttrs('wnm')} placeholder="e.g. GCash, BPI Platinum" value="${draft('wnm')}" data-autofocus>`)}
          ${field('wb', editingWallet ? 'Current balance (records adjustment)' : 'Starting balance', `<input ${inputAttrs('wb')} type="number" inputmode="decimal" step="0.01" placeholder="0.00" value="${draft('wb')}">`)}
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
          ${field('wnum', 'Card number or last 4 (optional)', `<input ${inputAttrs('wnum')} inputmode="numeric" maxlength="19" placeholder="Leave blank for passbook" value="${draft('wnum')}">`)}
          ${field('wholder', 'Account / cardholder name', `<input ${inputAttrs('wholder')} placeholder="JUAN DELA CRUZ" value="${draft('wholder', (S.fullName || '').toUpperCase())}">`)}
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
          ${field('wexp', 'Expiry MM/YY (optional)', `<input ${inputAttrs('wexp')} maxlength="5" placeholder="MM/YY" value="${draft('wexp')}">`)}
          ${field('wcvv', 'Security code / CVV (optional)', `<input ${inputAttrs('wcvv')} inputmode="numeric" maxlength="4" placeholder="Optional" value="${draft('wcvv')}">`)}
        </div>
        ${editingWallet?.encrypted_card_vault ? `<p class="text-xs text-mute truncate bg-subtle px-3 py-2 rounded-ctl">Vault ciphertext: <code>${esc(editingWallet.encrypted_card_vault.slice(0, 52))}…</code></p>` : ''}`,
        `${S.editWid ? `<button type="button" data-action="open-modal" data-modal="confirmDelWallet" data-id="${S.editWid}" class="${C.btnDanger} mr-auto">Delete…</button>` : ''}${cancelBtn}<button type="button" data-action="save-wallet" data-primary-submit class="${C.btn}">Save</button>`
      );
    },

    bill: () => {
      const curFreq = S.draft.bfreq || 'once';
      return dialogShell(
        S.editBillId ? 'Edit quarantined bill' : 'Set aside a bill',
        `${field('bn', 'Bill name', `<input ${inputAttrs('bn')} placeholder="e.g. Meralco, Converge Wi-Fi, Rent" value="${draft('bn')}" data-autofocus>`)}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
          ${field('ba', 'Reserved amount (PHP)', `<input ${inputAttrs('ba')} type="number" inputmode="decimal" step="0.01" min="0.01" placeholder="0.00" value="${draft('ba')}">`)}
          ${field('bd', 'Due date', `<input ${inputAttrs('bd')} type="date" value="${draft('bd')}">`, 'Optional calendar due date')}
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
          ${field('bfreq', 'Schedule', `<select ${inputAttrs('bfreq')}>
            <option value="once" ${curFreq === 'once' ? 'selected' : ''}>One-time before payday</option>
            <option value="monthly" ${curFreq === 'monthly' ? 'selected' : ''}>Monthly recurring</option>
            <option value="bimonthly" ${curFreq === 'bimonthly' ? 'selected' : ''}>Bi-monthly (every 15 days)</option>
          </select>`)}
          ${field('btext', 'Custom due note (if no date)', `<input ${inputAttrs('btext')} placeholder="Before payday" value="${draft('btext')}">`)}
        </div>
        <p class="${C.meta}">Reserved bills are quarantined from your wallet balances before daily safe-to-spend is calculated.</p>`,
        `${cancelBtn}<button type="button" data-action="save-bill" data-primary-submit class="${C.btn}">${S.editBillId ? 'Update bill' : 'Set aside'}</button>`
      );
    },

    payBill: () => {
      const b = S.b.find(x => Number(x.id) === Number(S.payBillId));
      if (!b) return '';
      const selWid = Number(S.draft.pw || S.w[0]?.id || 0);
      const selWal = S.w.find(w => Number(w.id) === selWid);
      const payCheck = Money.parseMoneyInput(S.draft.pa ?? b.a, { allowZero: false, allowNegative: false });
      const payVal = payCheck.ok ? payCheck.value : b.a;
      const isPartial = Money.toCents(payVal) > 0 && Money.toCents(payVal) < Money.toCents(b.a);
      const afterBal = selWal ? Money.subMoney(selWal.b, payVal) : 0;

      return dialogShell(
        `Pay ${esc(b.n)}`,
        `<p class="text-sm text-ink-2 mb-4">Records a <strong class="font-semibold text-ink">Bills</strong> ledger outflow today and deducts it from your chosen wallet. ${isPartial ? `Paying less than ${peso(b.a)} keeps the remaining <strong class="tnum text-ink">${peso(Money.subMoney(b.a, payVal))}</strong> reserved.` : b.freq !== 'once' ? `Because this bill repeats (${esc(b.freq)}), settling it rolls its due date forward automatically.` : 'Settling the full amount clears this quarantined bill.'}</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
          ${field('pw', 'Pay from wallet', `<select ${inputAttrs('pw')} data-change="paybill-preview">${walletOptions(selWid)}</select>`)}
          ${field('pa', 'Payment amount (PHP)', `<input ${inputAttrs('pa')} data-input="paybill-preview" type="number" inputmode="decimal" step="0.01" min="0.01" value="${draft('pa', Money.roundMoney(b.a).toFixed(2))}" data-autofocus>`)}
        </div>
        ${selWal ? `<div class="rounded-ctl bg-paper border border-line p-3 text-xs flex items-center justify-between tnum">
          <span class="text-ink-2">${esc(selWal.n)} balance after payment</span>
          <strong class="font-semibold ${Money.toCents(afterBal) < 0 ? 'text-alert' : 'text-ink'}">${Money.toCents(afterBal) < 0 ? '− ' + peso(afterBal) : peso(afterBal)}</strong>
        </div>` : `<p class="text-xs text-alert">Create a wallet first before paying a bill.</p>`}`,
        `${cancelBtn}<button type="button" data-action="confirm-pay-bill" data-primary-submit class="${C.btn}" ${!S.w.length ? 'disabled' : ''}>Confirm payment</button>`
      );
    },

    payday: () => {
      const curMode = S.draft.pmode || S.paydayMode || 'bimonthly';
      return dialogShell(
        'Profile & payday cycle',
        `${field('pname', 'Display name', `<input ${inputAttrs('pname')} value="${draft('pname', S.fullName)}" data-autofocus>`)}
        ${field('pmode', 'Payday schedule', `
          <select id="pmode" class="${C.input}" data-change="payday-mode">
            <option value="bimonthly" ${curMode === 'bimonthly' ? 'selected' : ''}>15th & 30th (Bi-monthly PH standard)</option>
            <option value="monthly-15" ${curMode === 'monthly-15' ? 'selected' : ''}>Every 15th of the month</option>
            <option value="monthly-30" ${curMode === 'monthly-30' ? 'selected' : ''}>Every 30th / end of the month</option>
            <option value="custom" ${curMode === 'custom' ? 'selected' : ''}>Custom target payday date</option>
          </select>`, `Today is ${Domain.formatShortDate(getToday(), getToday())}. Safe-to-spend funds divide evenly across days until payday.`)}
        ${curMode === 'custom' ? field('pcustom', 'Target payday date', `<input ${inputAttrs('pcustom')} type="date" min="${getToday()}" value="${draft('pcustom', S.customPayday || Domain.shiftDaysISO(getToday(), 15))}">`) : ''}`,
        `${cancelBtn}<button type="button" data-action="save-payday" data-primary-submit class="${C.btn}">Save schedule</button>`
      );
    },

    budgets: () => dialogShell(
      'Cycle category spending limits',
      `<p class="text-sm text-ink-2 mb-4">Set optional spending caps per category for the selected period. Leave any category blank to track without a limit.</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
        ${CATEGORIES.filter(c => c !== 'Income').map((c, idx) =>
          field(`bcap-${c}`, `${c} limit (PHP)`, `<input ${inputAttrs(`bcap-${c}`)} type="number" inputmode="decimal" step="0.01" min="0" placeholder="No limit" value="${draft(`bcap-${c}`)}" ${idx === 0 ? 'data-autofocus' : ''}>`)
        ).join('')}
      </div>`,
      `${cancelBtn}<button type="button" data-action="save-budgets" data-primary-submit class="${C.btn}">Save limits</button>`
    ),

    supabase: () => dialogShell(
      'Supabase Cloud configuration',
      `<p class="text-sm text-ink-2 mb-4">Connect your Supabase Project URL and public Anon Key to sync profiles, wallets, ledger entries, and bills with PostgreSQL Row-Level Security. Card vault secrets are always encrypted client-side before leaving your browser.</p>
      ${field('sburl', 'Supabase Project URL', `<input ${inputAttrs('sburl')} placeholder="https://your-project.supabase.co" value="${draft('sburl')}" data-autofocus>`)}
      ${field('sbkey', 'Supabase Anon Public Key', `<input ${inputAttrs('sbkey')} placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." value="${draft('sbkey')}">`, 'Run supabase/schema.sql in your Supabase SQL Editor for atomic transactional sync.')}`,
      `${cancelBtn}<button type="button" data-action="save-supabase" data-primary-submit class="${C.btn}">Save connection</button>`
    ),

    reconcile: () => {
      const w = S.w.find(x => Number(x.id) === Number(S.wid));
      if (!w) return '';
      return dialogShell(
        `Reconcile ${esc(w.n)} balance`,
        `<p class="text-sm text-ink-2 mb-4">One Wallet currently records <strong class="tnum font-semibold text-ink">${peso(w.b)}</strong>. Enter the exact balance shown in your ${esc(w.n)} app—we’ll record an auditable adjustment entry for any difference.</p>
        ${field('rb', 'Actual balance in app (PHP)', `<input ${inputAttrs('rb')} type="number" inputmode="decimal" step="0.01" placeholder="${Money.roundMoney(w.b).toFixed(2)}" value="${draft('rb')}" data-autofocus>`)}`,
        `${cancelBtn}<button type="button" data-action="save-reconcile" data-primary-submit class="${C.btn}">Save correction</button>`
      );
    },

    unlockVault: () => dialogShell(
      'Unlock encrypted card vault',
      `<p class="text-sm text-ink-2 mb-4">For your security, your AES-256-GCM vault key is kept in memory only and cleared on page reload. Enter the password for <strong class="font-semibold text-ink">${esc(S.email)}</strong> to decrypt or edit card numbers and CVV codes.</p>
      ${field('unlock-pwd', 'Account password', `<input ${inputAttrs('unlock-pwd')} type="password" autocomplete="current-password" placeholder="••••••••" data-autofocus>`)}`,
      `${cancelBtn}<button type="button" data-action="confirm-unlock-vault" data-primary-submit class="${C.btn}">Unlock vault</button>`
    ),

    confirmDelTx: () => {
      const t = S.t.find(x => Number(x.id) === Number(S.confirmTargetId));
      if (!t) return '';
      return dialogShell(
        'Delete ledger entry?',
        `<p class="text-sm text-ink-2">Removing <strong class="font-semibold text-ink">${esc(t.s)}</strong> (<span class="tnum font-semibold">${signed(t.a)}</span> on ${esc(Domain.formatShortDate(t.d, getToday()))}) will reverse its effect on <strong class="font-semibold text-ink">${walletDisplayName(t)}</strong>.</p>`,
        `${cancelBtn}<button type="button" data-action="exec-del-tx" data-autofocus class="${C.btnDanger}">Delete entry</button>`
      );
    },

    confirmDelBill: () => {
      const b = S.b.find(x => Number(x.id) === Number(S.confirmTargetId));
      if (!b) return '';
      return dialogShell(
        'Remove set-aside bill?',
        `<p class="text-sm text-ink-2">Remove <strong class="font-semibold text-ink">${esc(b.n)}</strong> (<span class="tnum font-semibold">${peso(b.a)}</span>) without recording a payment? That amount will return to your safe-to-spend balance.</p>`,
        `${cancelBtn}<button type="button" data-action="exec-del-bill" data-autofocus class="${C.btnDanger}">Remove bill</button>`
      );
    },

    confirmDelWallet: () => {
      const w = S.w.find(x => Number(x.id) === Number(S.confirmTargetId));
      if (!w) return '';
      const count = S.t.filter(t => Number(t.w) === Number(w.id)).length;
      return dialogShell(
        `Delete ${esc(w.n)}?`,
        `<p class="text-sm text-ink-2 mb-3">This removes <strong class="font-semibold text-ink">${esc(w.n)}</strong> (<span class="tnum font-semibold">${peso(w.b)}</span>) and its encrypted card vault.</p>
        ${count ? `<p class="text-xs text-mute bg-paper border border-line rounded-ctl p-3">${count} historical ledger entr${count === 1 ? 'y' : 'ies'} reference this wallet. Keeping entries preserves past cashflow and category insights under “${esc(w.n)}”.</p>` : ''}`,
        `${cancelBtn}
        ${count ? `<button type="button" data-action="exec-del-wallet-purge" class="${C.btn2} !text-alert !border-alert/40">Delete wallet & ${count} entries</button>` : ''}
        <button type="button" data-action="exec-del-wallet-keep" data-autofocus class="${C.btnDanger}">${count ? 'Delete wallet (keep history)' : 'Delete wallet'}</button>`
      );
    },

    confirmDelAccount: () => dialogShell(
      'Remove account from this device?',
      `<p class="text-sm text-ink-2">This removes <strong class="font-semibold text-ink">${esc(S.fullName)} (${esc(S.email)})</strong> from local storage on this browser. Export a backup first if you haven’t synced to Supabase Cloud.</p>`,
      `${cancelBtn}<button type="button" data-action="exec-del-account" data-autofocus class="${C.btnDanger}">Remove local account</button>`
    ),

    reset: () => dialogShell(
      'Reset all local workspaces & demo data?',
      `<p class="text-sm text-ink-2">This clears all locally stored accounts in this browser and restores the fresh Demo workspace. This action cannot be undone.</p>`,
      `${cancelBtn}<button type="button" data-action="exec-reset-all" data-autofocus class="${C.btnDanger}">Reset browser data</button>`
    )
  };

  /* ---------- Views ---------- */
  const V = {
    login: () => {
      const isSignup = S.authTab === 'signup';
      const savedAccs = Vault.listAccounts();
      const sbConnected = Vault.isSupabaseConfigured();
      const busyAttr = S.authBusy ? 'disabled aria-busy="true"' : '';
      const today = getToday();
      const previewRunway = Domain.computePaydayState(today, 'bimonthly', '');
      const pdShort = Domain.formatShortDate(previewRunway.paydayISO, today);

      return `
        <main id="main" class="min-h-dvh flex items-center justify-center p-4 md:p-8">
          <div class="w-full max-w-[1140px] grid gap-5 lg:grid-cols-[1.14fr_1fr] items-stretch">
            <section class="${C.card} p-5 sm:p-6 flex flex-col justify-between">
              <div>
                <div class="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-line">
                  ${brandLockup('Passbook & Encrypted Card Vault')}
                  <span class="tnum text-[13px] font-medium px-3 py-1 rounded-full bg-subtle text-ink-2">Next payday · ${esc(pdShort)} (${previewRunway.daysLeft}d)</span>
                </div>

                <h1 class="${C.h1} mb-2">Know what you can safely spend today.</h1>
                <p class="text-sm text-ink-2 mb-5">One Wallet unifies Philippine bank cards and digital wallets into an achromatic passbook ledger, quarantines bills due before payday, and encrypts card credentials client-side with AES-256-GCM.</p>

                <div data-ui class="rounded-card border border-line bg-paper p-4 mb-4">
                  <div class="flex items-center justify-between text-[13px] text-ink-2 mb-1">
                    <span class="inline-flex items-center gap-1.5 font-semibold text-ink"><span class="w-2 h-2 rounded-full bg-gain"></span>Daily safe-to-spend passbook</span>
                    <span class="tnum text-mute">15th & 30th cycle</span>
                  </div>
                  <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 my-1">
                    <p class="tnum text-[24px] font-semibold tracking-[-0.02em] text-ink whitespace-nowrap">₱183.40 <span class="text-[13px] font-normal text-mute">/ day</span></p>
                    <span class="tnum text-[13px] text-ink-2">₱2,751.00 free · ₱1,499.00 bills set aside</span>
                  </div>
                  <div class="h-2 rounded-full bg-track overflow-hidden flex gap-0.5 mt-2" aria-hidden="true">
                    <span class="block h-full bg-gain" style="width:65%"></span>
                    <span class="block h-full bg-marigold" style="width:35%"></span>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-3">
                  ${Cards.renderCardFace({ style: 'gcash', n: 'GCash' }, { mini: true })}
                  ${Cards.renderCardFace({ style: 'bpi-plat', n: 'BPI' }, { mini: true })}
                </div>
              </div>

              <dl class="grid grid-cols-3 gap-3 pt-4 mt-5 border-t border-line text-[13px]">
                <div><dt class="font-semibold text-ink">AES-256-GCM</dt><dd class="text-mute">Zero-knowledge vault</dd></div>
                <div><dt class="font-semibold text-ink">Centavo Exact</dt><dd class="text-mute">Fixed-point PH math</dd></div>
                <div><dt class="font-semibold text-ink">Supabase RLS</dt><dd class="text-mute">Transactional sync</dd></div>
              </dl>
            </section>

            <section class="${C.card} p-5 sm:p-6 flex flex-col justify-between">
              <div>
                <div class="flex items-center justify-between pb-4 mb-4 border-b border-line">
                  <h2 class="${C.cardTitle}">Workspace access</h2>
                  <button type="button" data-action="open-modal" data-modal="supabase" class="${C.link} text-[13px] inline-flex items-center gap-1 touch-pill">
                    ${icon(I.cloud, 'w-3.5 h-3.5', 14)}${sbConnected ? 'Cloud endpoint ready' : 'Configure Cloud'}
                  </button>
                </div>

                <div role="tablist" aria-label="Account access" class="grid grid-cols-2 gap-1 p-1 rounded-ctl bg-subtle mb-4">
                  <button type="button" id="tab-signin" role="tab" data-action="switch-auth-tab" data-tab="signin" aria-selected="${!isSignup}" aria-controls="auth-tabpanel" tabindex="${!isSignup ? '0' : '-1'}" class="h-9 max-sm:h-10 rounded-[6px] text-sm font-medium cursor-pointer ${!isSignup ? 'bg-card text-ink font-semibold' : 'text-ink-2 hover:text-ink'}">Sign in</button>
                  <button type="button" id="tab-signup" role="tab" data-action="switch-auth-tab" data-tab="signup" aria-selected="${isSignup}" aria-controls="auth-tabpanel" tabindex="${isSignup ? '0' : '-1'}" class="h-9 max-sm:h-10 rounded-[6px] text-sm font-medium cursor-pointer ${isSignup ? 'bg-card text-ink font-semibold' : 'text-ink-2 hover:text-ink'}">Create account</button>
                </div>

                <div id="auth-tabpanel" role="tabpanel" aria-labelledby="${!isSignup ? 'tab-signin' : 'tab-signup'}">
                  ${!isSignup ? `
                    ${field('login-email', 'Email', `<input ${inputAttrs('login-email')} type="email" autocomplete="username" placeholder="name@email.com" value="${draft('login-email', 'demo@onewallet.ph')}">`)}
                    ${field('login-pwd', 'Password', `<input ${inputAttrs('login-pwd')} type="password" autocomplete="current-password" placeholder="••••••••" value="${S.draft['login-email'] === 'demo@onewallet.ph' || !S.draft['login-email'] ? 'demo1234' : ''}">`, 'Derives your in-memory PBKDF2-SHA256 (600k) vault key')}
                    <div class="flex flex-col gap-2 mt-2">
                      <button type="button" data-action="signin" ${busyAttr} class="${C.btn} w-full">${S.authBusy ? 'Signing in & unlocking vault…' : 'Sign in to workspace'}</button>
                      <button type="button" data-action="open-demo" ${busyAttr} class="${C.btn2} w-full">Open Demo Sandbox (Juan Dela Cruz)</button>
                    </div>
                  ` : `
                    ${field('reg-name', 'Full name', `<input ${inputAttrs('reg-name')} placeholder="e.g. Maria Santos" value="${draft('reg-name')}">`)}
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
                      ${field('reg-email', 'Email', `<input ${inputAttrs('reg-email')} type="email" autocomplete="email" placeholder="maria@email.ph" value="${draft('reg-email')}">`)}
                      ${field('reg-pwd', 'Password', `<input ${inputAttrs('reg-pwd')} type="password" autocomplete="new-password" placeholder="Min. 8 characters">`, 'Never stored in plaintext')}
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-3">
                      ${field('reg-payday', 'Payday schedule', `
                        <select id="reg-payday" class="${C.input}">
                          <option value="bimonthly" ${S.draft['reg-payday'] === 'bimonthly' ? 'selected' : ''}>15th & 30th (Bi-monthly)</option>
                          <option value="monthly-15" ${S.draft['reg-payday'] === 'monthly-15' ? 'selected' : ''}>Every 15th</option>
                          <option value="monthly-30" ${S.draft['reg-payday'] === 'monthly-30' ? 'selected' : ''}>Every 30th / month-end</option>
                        </select>`)}
                      ${field('reg-preset', 'Starting setup', `
                        <select id="reg-preset" class="${C.input}">
                          <option value="starter" ${S.draft['reg-preset'] === 'starter' ? 'selected' : ''}>4 PH Wallets (₱0.00)</option>
                          <option value="blank" ${S.draft['reg-preset'] === 'blank' ? 'selected' : ''}>Blank Workspace</option>
                          <option value="demo" ${S.draft['reg-preset'] === 'demo' ? 'selected' : ''}>Sample Demo Data</option>
                        </select>`)}
                    </div>
                    <button type="button" data-action="signup" ${busyAttr} class="${C.btn} w-full mt-1">${S.authBusy ? 'Creating encrypted workspace…' : 'Create encrypted account'}</button>
                  `}
                </div>
              </div>

              <div class="pt-4 mt-4 border-t border-line">
                <p class="text-[13px] font-medium text-mute mb-2">Accounts on this browser (${savedAccs.length || 1})</p>
                <div class="flex flex-wrap gap-2">
                  ${(savedAccs.length ? savedAccs : [{ fullName: 'Juan Dela Cruz', email: 'demo@onewallet.ph', isDemo: true }]).map(a =>
                    `<button type="button" data-action="prefill-account" data-email="${esc(a.email)}" class="h-8 px-3 touch-pill rounded-full text-[13px] font-medium border border-line bg-paper hover:border-ink/40 cursor-pointer">${esc(a.fullName)} · ${esc(a.isDemo ? 'Demo' : a.email)}</button>`
                  ).join('')}
                </div>
              </div>
            </section>
          </div>
        </main>`;
    },

    today: () => {
      const today = getToday();
      const r = Domain.computeRunwaySummary({
        wallets: S.w,
        bills: S.b,
        transactions: S.t,
        today,
        paydayMode: S.paydayMode,
        customPayday: S.customPayday
      });
      const pdShort = Domain.formatShortDate(r.paydayISO, today);
      const nb = S.b.length;
      const isShortfall = r.status === 'shortfall';
      const borderColor = isShortfall ? 'border-l-alert' : r.status === 'over-daily' ? 'border-l-marigold' : 'border-l-gain';
      const dotColor = isShortfall ? 'bg-alert' : r.status === 'over-daily' ? 'bg-marigold' : 'bg-gain';

      const posBase = Money.toCents(r.totalBalance) > 0 ? r.totalBalance : 0;
      const freePct = Money.pctShare(r.safeToSpend, posBase);
      const resPct = posBase > 0 ? Math.min(100 - freePct, Money.pctShare(r.reservedBills, posBase)) : (nb ? 100 : 0);

      // Sort upcoming bills by dueDate ascending when available
      const sortedBills = [...S.b].sort((a, b) => {
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return 0;
      });

      return `
        ${pageHead('Today', `${longDate()} · ${esc(S.fullName)} · ${Domain.paydayModeLabel(S.paydayMode)}`, `
          <button type="button" data-action="open-modal" data-modal="payday" class="${C.btn2}">Payday</button>
          <button type="button" data-action="nav" data-view="import" class="${C.btn2}">Import SMS</button>
          <button type="button" data-action="open-modal" data-modal="tx" class="${C.btn}">${icon(I.plus, 'w-4 h-4', 16)}Add entry</button>`)}

        ${r.customExpired ? `
          <div role="status" class="${C.card} border-l-[3px] border-l-marigold px-4 py-3 mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span class="text-ink-2">Your custom payday date (<strong class="tnum text-ink">${esc(r.expiredCustomDate || S.customPayday)}</strong>) has passed. Showing standard 15th & 30th horizon until updated.</span>
            <button type="button" data-action="open-modal" data-modal="payday" class="${C.link} text-xs font-semibold">Update payday →</button>
          </div>` : ''}

        <section class="${C.card} border-l-[3px] ${borderColor} p-5 mb-5" aria-labelledby="runway-label">
          <div class="grid gap-6 lg:grid-cols-[1.28fr_1fr] items-center">
            <div>
              <div class="flex flex-wrap items-center gap-2 mb-1">
                <span class="w-2 h-2 rounded-full ${dotColor}" aria-hidden="true"></span>
                <p id="runway-label" class="text-sm font-semibold text-ink">Daily spending allowance</p>
                <span class="tnum text-xs text-mute">· ${r.isPaydayToday ? `Payday today · Next ${esc(pdShort)} (${r.daysLeft}d)` : `${r.daysLeft} day${r.daysLeft === 1 ? '' : 's'} until ${esc(pdShort)}`}</span>
              </div>

              <div class="flex items-baseline gap-2 my-1">
                <p class="tnum text-[38px] md:text-[42px] leading-[1.08] font-semibold tracking-[-0.025em] ${isShortfall ? 'text-alert' : 'text-ink'}">${peso(r.dailyAllowance)}</p>
                <span class="text-sm text-mute font-medium">/ day</span>
              </div>

              ${isShortfall ? `
                <p class="text-sm text-alert font-medium mb-4">Reserved bills exceed wallet funds by <span class="tnum font-semibold">${peso(r.billShortfall)}</span>. Top up a wallet or review upcoming bills before spending.</p>
              ` : `
                <p class="text-sm text-ink-2 mb-4 tnum">
                  Spent today: <strong class="font-semibold text-ink">${peso(r.spentToday)}</strong>
                  ${Money.toCents(r.dailyAllowance) > 0
                    ? (Money.toCents(r.remainingToday) >= 0
                        ? ` · <span class="text-gain font-medium">${peso(r.remainingToday)} left in today’s allowance</span>`
                        : ` · <span class="text-marigold font-medium">${peso(Math.abs(r.remainingToday))} over today’s pace</span>`)
                    : ''}
                </p>
              `}

              <div>
                <div class="flex justify-between text-xs text-ink-2 mb-1.5 tnum">
                  <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-gain" aria-hidden="true"></span>Safe to spend · ${freePct}%</span>
                  <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full ${isShortfall ? 'bg-alert' : 'bg-marigold'}" aria-hidden="true"></span>Bills quarantined · ${isShortfall ? '>100%' : `${resPct}%`}</span>
                </div>
                <div class="h-2.5 rounded-full bg-track overflow-hidden flex gap-0.5" role="img" aria-label="${freePct}% safe to spend, ${resPct}% quarantined for bills">
                  <span class="block h-full bg-gain" style="width:${freePct}%"></span>
                  <span class="block h-full ${isShortfall ? 'bg-alert' : 'bg-marigold'}" style="width:${resPct}%"></span>
                </div>
              </div>
            </div>

            <dl class="tnum text-sm max-lg:border-t max-lg:pt-4 lg:border-l border-line lg:pl-6 space-y-2.5">
              <div class="flex justify-between gap-2"><dt class="text-ink-2">Total across ${S.w.length} wallet${S.w.length === 1 ? '' : 's'}</dt><dd class="font-medium ${Money.toCents(r.totalBalance) < 0 ? 'text-alert' : 'text-ink'}">${Money.toCents(r.totalBalance) < 0 ? '− ' + peso(r.totalBalance) : peso(r.totalBalance)}</dd></div>
              <div class="flex justify-between gap-2 border-b border-line pb-2.5"><dt class="text-ink-2">Quarantined (${nb} bill${nb === 1 ? '' : 's'})</dt><dd class="font-medium text-marigold">− ${peso(r.reservedBills)}</dd></div>
              ${isShortfall
                ? `<div class="flex justify-between gap-2 pt-0.5"><dt class="text-alert font-medium">Bill coverage shortfall</dt><dd class="font-semibold text-alert">− ${peso(r.billShortfall)}</dd></div>`
                : `<div class="flex justify-between gap-2 pt-0.5"><dt class="text-ink-2">Safe to spend until ${esc(pdShort)}</dt><dd class="font-medium text-gain">${peso(r.safeToSpend)}</dd></div>`}
              <div class="flex justify-between gap-2 pt-2 border-t border-line font-semibold text-ink"><dt>Daily allowance (÷ ${r.daysLeft}d)</dt><dd>${peso(r.dailyAllowance)} / day</dd></div>
            </dl>
          </div>
        </section>

        <div class="grid gap-4 lg:grid-cols-[1.28fr_1fr] items-stretch">
          <section class="${C.card} p-4 sm:p-5 flex flex-col justify-between h-full">
            <div>
              ${cardHead('Recent ledger', `<a href="#ledger" class="${C.link}">All entries</a>`)}
              ${ledgerList(S.t, { limit: 6, empty: 'No entries yet. Add an entry or paste an SMS notification.' })}
            </div>
            <div class="flex items-center justify-between pt-2.5 mt-2 border-t border-line text-xs text-mute">
              <span class="tnum">Showing ${Math.min(6, S.t.length)} of ${S.t.length} entries</span>
              <a href="#import" class="${C.link} text-xs">Import SMS alert →</a>
            </div>
          </section>

          <div class="flex flex-col gap-4 h-full">
            <section class="${C.card} p-4 sm:p-5">
              ${cardHead('Wallets & Cards', `<button type="button" data-action="open-modal" data-modal="wallet" class="${C.link} inline-flex items-center gap-1">${icon(I.plus, 'w-3.5 h-3.5', 14)}Add</button>`)}
              <ul class="mt-2 space-y-2.5">
                ${S.w.map(w => {
                  const st = Cards.getCardStyle(w.style);
                  const share = Money.pctShare(Money.toCents(w.b) > 0 ? w.b : 0, r.positiveWalletTotal);
                  return `<li>
                    <button type="button" data-action="open-wallet" data-id="${w.id}" class="w-full text-left group cursor-pointer" aria-label="${esc(w.n)}, ${peso(w.b)}. Open wallet">
                      <span class="flex items-center justify-between text-sm gap-2">
                        <span class="inline-flex items-center gap-2 min-w-0">
                          <span data-ui class="w-6 h-4 rounded-[3px] shrink-0 inline-flex items-center px-1" style="background-color:${st.bg}"><span class="w-1.5 h-1 rounded-[1px]" style="background-color:${st.accent}"></span></span>
                          <span class="font-medium text-ink group-hover:underline underline-offset-4 truncate">${esc(w.n)}</span>
                          ${w.last4 ? `<span class="tnum text-xs text-mute">••${esc(w.last4)}</span>` : ''}
                        </span>
                        <span class="tnum font-medium ${Money.toCents(w.b) < 0 ? 'text-alert' : 'text-ink'} shrink-0">${Money.toCents(w.b) < 0 ? '− ' + peso(w.b) : peso(w.b)}</span>
                      </span>
                      <span class="block h-1 mt-1.5 rounded-full bg-track overflow-hidden"><span class="block h-full rounded-full bg-ink" style="width:${share}%"></span></span>
                    </button>
                  </li>`;
                }).join('') || `<li class="py-3 ${C.meta}">No wallets yet. Add your first wallet to track balances.</li>`}
              </ul>
              <div class="flex justify-between text-sm font-semibold pt-2.5 mt-3 border-t border-line">
                <span>Total balance</span>
                <span class="tnum ${Money.toCents(r.totalBalance) < 0 ? 'text-alert' : 'text-ink'}">${Money.toCents(r.totalBalance) < 0 ? '− ' + peso(r.totalBalance) : peso(r.totalBalance)}</span>
              </div>
            </section>

            <section class="${C.card} p-4 sm:p-5 flex-1 flex flex-col justify-between">
              <div>
                ${cardHead('Quarantined bills', `<a href="#bills" class="${C.link}">Manage</a>`)}
                <ul class="divide-y divide-line/60 mt-1">
                  ${sortedBills.map(b => `<li class="flex items-center justify-between text-sm py-2.5 gap-2">
                    <span class="min-w-0 flex items-center gap-1.5 flex-wrap">
                      <span class="font-medium text-ink truncate">${esc(b.n)}</span>
                      <span class="text-xs text-mute">· ${esc(b.d)}</span>
                      ${billUrgencyBadge(b, today)}
                    </span>
                    <span class="flex items-center gap-2.5 shrink-0">
                      <span class="tnum font-medium text-ink">${peso(b.a)}</span>
                      <button type="button" data-action="open-modal" data-modal="payBill" data-id="${b.id}" class="${C.link} text-xs font-semibold">Pay</button>
                    </span>
                  </li>`).join('') || `<li class="py-4 ${C.meta}">No bills quarantined. Set aside upcoming bills to keep daily safe-to-spend accurate.</li>`}
                </ul>
              </div>
            </section>
          </div>
        </div>`;
    },

    wallets: () => {
      const w = S.w.find(x => Number(x.id) === Number(S.wid));
      const today = getToday();
      if (w) {
        const list = Domain.sortTransactions(S.t.filter(t => Number(t.w) === Number(w.id)), today);
        const rev = !!S.revealed[w.id];
        const flp = !!S.flipped[w.id];
        const hasSecrets = Boolean(w.hasCard || w.num || w.exp || w.cvv);
        const st = Cards.getCardStyle(w.style);

        return `
          <button type="button" data-action="close-wallet-detail" class="${C.link} inline-flex items-center gap-1 mb-3 -ml-1">${icon(I.back, 'w-4 h-4', 16)}All wallets & cards</button>
          ${pageHead(esc(w.n), `${esc(st.name)} · ${hasSecrets ? 'AES-256-GCM encrypted card vault' : 'Passbook account'}`, `
            <button type="button" data-action="open-modal" data-modal="wallet" data-id="${w.id}" class="${C.btn2}">${icon(I.card, 'w-4 h-4', 16)}${hasSecrets ? 'Edit card & info' : 'Edit / add card'}</button>
            <button type="button" data-action="open-modal" data-modal="reconcile" class="${C.btn2}">Reconcile balance</button>
            <button type="button" data-action="add-tx-for-wallet" data-id="${w.id}" class="${C.btn}">${icon(I.plus, 'w-4 h-4', 16)}Add entry</button>`)}

          <div class="grid gap-4 lg:grid-cols-[1.08fr_1fr] items-stretch mb-5">
            <section class="${C.card} p-3.5 flex flex-col justify-between gap-3">
              <div class="card-stage">${renderFlippableCard(w, { revealed: rev, flipped: flp, active: true })}</div>
              <div class="px-1.5 pt-1 flex flex-wrap items-center justify-between gap-2">
                <span class="text-xs sm:text-sm text-mute">${rev ? 'Decrypted in session memory · Auto-masks on tab switch' : 'Click or press Enter on card to spin 180°'}</span>
                <div class="flex items-center gap-3">
                  <button type="button" data-flip-btn="${w.id}" data-action="flip-card" data-id="${w.id}" class="${C.link} text-sm font-semibold">${flp ? 'Show front' : 'Spin card 180°'}</button>
                  ${hasSecrets ? `<button type="button" data-action="reveal-card" data-id="${w.id}" class="${C.link} inline-flex items-center gap-1.5 text-sm font-semibold">
                    ${icon(rev ? I.eyeOff : I.eye, 'w-4 h-4', 16)}${rev ? 'Hide card info' : 'Reveal card info'}
                  </button>` : ''}
                </div>
              </div>
            </section>

            <section class="${C.card} p-5 flex flex-col justify-between">
              <div>
                <p class="text-sm font-medium text-ink-2">Recorded balance</p>
                <p class="tnum text-[36px] leading-tight font-semibold tracking-[-0.02em] my-1 ${Money.toCents(w.b) < 0 ? 'text-alert' : 'text-ink'}">${Money.toCents(w.b) < 0 ? '− ' + peso(w.b) : peso(w.b)}</p>
                <p class="text-sm text-mute">${list.length} recorded entr${list.length === 1 ? 'y' : 'ies'}. Whenever your physical or mobile banking app balance drifts, use <strong>Reconcile balance</strong> to log an auditable adjustment.</p>
              </div>
              <dl class="pt-3 mt-3 border-t border-line space-y-1.5 text-xs text-mute">
                <div class="flex justify-between"><span>Card vault status</span><strong class="font-medium text-ink">${hasSecrets ? (sessionVaultKey || S.isDemo ? 'Unlocked in memory (AES-256-GCM)' : 'Locked at rest (password required)') : 'No card credentials stored'}</strong></div>
                <div class="flex justify-between"><span>Auto-protection</span><strong class="font-medium text-ink">Masks on navigation & window blur</strong></div>
              </dl>
            </section>
          </div>

          <section class="${C.card} p-4 sm:p-5">
            ${cardHead(`${esc(w.n)} ledger history`)}
            ${ledgerList(list, { editable: true, empty: `No entries recorded for ${esc(w.n)} yet.` })}
          </section>`;
      }

      const tot = Money.sumMoney(S.w, x => x.b);
      const posTot = Money.sumMoney(S.w, x => (Money.toCents(x.b) > 0 ? x.b : 0));
      const anyRevealed = Object.values(S.revealed).some(Boolean);
      const isGrid = S.walletView === 'grid';
      const len = S.w.length;
      const activeIdx = len ? ((S.carouselIdx || 0) % len + len) % len : 0;
      if (!cSpring.raf && !cDrag.active) {
        cSpring.pos = cSpring.target = activeIdx;
      }
      const activeW = len ? S.w[activeIdx] : null;

      return `
        ${pageHead('Wallets & Cards', `${len} account${len === 1 ? '' : 's'} · ${Money.toCents(tot) < 0 ? '− ' + peso(tot) : peso(tot)} total · Zero-knowledge AES-256-GCM card vault`, `
          <div role="group" aria-label="Wallet layout" class="inline-flex p-1 rounded-ctl bg-subtle border border-line">
            <button type="button" data-action="set-wallet-view" data-mode="carousel" aria-pressed="${!isGrid}" class="h-8 px-3 rounded-[6px] text-xs font-medium cursor-pointer ${!isGrid ? 'bg-card text-ink font-semibold' : 'text-ink-2 hover:text-ink'}">Carousel</button>
            <button type="button" data-action="set-wallet-view" data-mode="grid" aria-pressed="${isGrid}" class="h-8 px-3 rounded-[6px] text-xs font-medium cursor-pointer ${isGrid ? 'bg-card text-ink font-semibold' : 'text-ink-2 hover:text-ink'}">Grid</button>
          </div>
          ${anyRevealed ? `<button type="button" data-action="mask-all-cards" class="${C.btn2}">${icon(I.eyeOff, 'w-4 h-4', 16)}Mask all</button>` : ''}
          <button type="button" data-action="open-modal" data-modal="wallet" class="${C.btn}">${icon(I.plus, 'w-4 h-4', 16)}Add wallet or card</button>`)}

        <div class="flex flex-wrap items-center justify-between gap-2 pb-4 mb-5 border-b border-line text-sm text-ink-2">
          <span class="inline-flex items-center gap-2">${icon(I.lock, 'w-4 h-4', 16)}<span><strong class="font-semibold text-ink">Encrypted folio:</strong> Swipe or use arrow keys to switch cards; click or press Enter on the front card to flip 180°.</span></span>
          <span class="tnum text-[13px] font-medium text-mute">${anyRevealed ? 'Card info revealed · Auto-masks on blur' : 'All card numbers masked'}</span>
        </div>

        ${!len ? `<div class="${C.card} p-8 text-center">
          <p class="${C.meta} mb-3">No wallets or cards in this workspace yet.</p>
          <button type="button" data-action="open-modal" data-modal="wallet" class="${C.btn}">${icon(I.plus, 'w-4 h-4', 16)}Add first wallet or card</button>
        </div>` : !isGrid ? `
          <section class="mb-5" aria-label="Card folio carousel" data-carousel-keys tabindex="0">
            <div data-carousel-stage class="card-stage card-stage-box relative h-[205px] sm:h-[268px] md:h-[282px] flex items-center justify-center overflow-hidden select-none rounded-card bg-subtle/60 border border-line">
              ${S.w.map((cw, i) => {
                const diff = circularDiff(i, activeIdx, len);
                const p = slotPose(diff);
                const abs = Math.abs(diff);
                const isCenter = diff === 0;
                return `<div data-slot-idx="${i}" ${!isCenter && abs <= 1 ? `data-action="go-card" data-idx="${i}"` : ''} class="card-slot absolute w-[236px] sm:w-[396px] md:w-[430px]" style="transform:translate3d(${p.tx}%, 0, ${p.tz}px) scale(${p.sc}) rotateY(${p.ry}deg);opacity:${p.op};z-index:${p.zi};${abs >= 1.85 ? 'pointer-events:none;' : ''}">
                  ${renderFlippableCard(cw, { revealed: !!S.revealed[cw.id], flipped: !!S.flipped[cw.id], active: isCenter })}
                </div>`;
              }).join('')}

              ${len > 1 ? `
                <button type="button" data-action="spin-card" data-delta="-1" class="absolute left-1 sm:left-3 z-40 w-9 h-9 sm:w-10 sm:h-10 touch-target rounded-full bg-card/95 border border-line text-ink hover:bg-subtle active:scale-[0.97] transition-transform duration-100 inline-flex items-center justify-center cursor-pointer" aria-label="Previous card">${icon(I.back, 'w-4 h-4', 16)}</button>
                <button type="button" data-action="spin-card" data-delta="1" class="absolute right-1 sm:right-3 z-40 w-9 h-9 sm:w-10 sm:h-10 touch-target rounded-full bg-card/95 border border-line text-ink hover:bg-subtle active:scale-[0.97] transition-transform duration-100 inline-flex items-center justify-center cursor-pointer" aria-label="Next card">${icon(I.chevron, 'w-4 h-4', 16)}</button>
              ` : ''}
            </div>

            ${len > 1 ? `
              <div class="flex items-center justify-center gap-1 mt-2" role="group" aria-label="Choose active card">
                ${S.w.map((cw, i) => `<button type="button" data-dot-idx="${i}" data-action="go-card" data-idx="${i}" aria-pressed="${i === activeIdx}" aria-label="Select ${esc(cw.n)}" class="h-9 px-1.5 touch-target inline-flex items-center justify-center cursor-pointer">
                  <span data-dot-bar class="block w-6 h-2 rounded-full transition-[transform,background-color] duration-200 ${i === activeIdx ? 'scale-x-100 bg-ink' : 'scale-x-50 bg-track'}"></span>
                </button>`).join('')}
              </div>` : ''}
          </section>

          <div id="carousel-summary">${renderCarouselSummary(activeW)}</div>
        ` : `
          <div class="grid gap-4 md:grid-cols-2 items-stretch">
            ${S.w.map(cw => {
              const count = S.t.filter(t => Number(t.w) === Number(cw.id)).length;
              const rev = !!S.revealed[cw.id];
              const flp = !!S.flipped[cw.id];
              const share = Money.pctShare(Money.toCents(cw.b) > 0 ? cw.b : 0, posTot);
              const hasSecrets = Boolean(cw.hasCard || cw.num || cw.exp || cw.cvv);
              return `<article class="${C.card} p-3.5 flex flex-col justify-between gap-3">
                <div class="card-stage grid-card-stage">${renderFlippableCard(cw, { revealed: rev, flipped: flp, active: true })}</div>
                <div class="px-1.5 flex flex-col gap-2.5">
                  <div class="flex items-baseline justify-between gap-2">
                    <div class="min-w-0 truncate">
                      <span class="text-base font-semibold text-ink">${esc(cw.n)}</span>
                      <span class="text-[13px] text-mute ml-1.5">· ${count} entr${count === 1 ? 'y' : 'ies'} (${share}%)</span>
                    </div>
                    <span class="tnum text-lg font-semibold ${Money.toCents(cw.b) < 0 ? 'text-alert' : 'text-ink'} shrink-0">${Money.toCents(cw.b) < 0 ? '− ' + peso(cw.b) : peso(cw.b)}</span>
                  </div>
                  <div class="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-line">
                    <div class="flex flex-wrap items-center gap-3">
                      ${hasSecrets ? `<button type="button" data-action="reveal-card" data-id="${cw.id}" class="${C.link} inline-flex items-center gap-1 text-sm font-semibold">
                        ${icon(rev ? I.eyeOff : I.eye, 'w-4 h-4', 16)}${rev ? 'Hide info' : 'Check info'}
                      </button>` : ''}
                      <button type="button" data-flip-btn="${cw.id}" data-short="1" data-action="flip-card" data-id="${cw.id}" class="${C.link} text-sm">${flp ? 'Front' : 'Spin'}</button>
                      <button type="button" data-action="open-modal" data-modal="wallet" data-id="${cw.id}" class="${C.link} text-sm">Edit</button>
                    </div>
                    <button type="button" data-action="open-wallet" data-id="${cw.id}" class="${C.link} inline-flex items-center gap-1 text-sm font-semibold">
                      Open ledger${icon(I.chevron, 'w-4 h-4', 16)}
                    </button>
                  </div>
                </div>
              </article>`;
            }).join('')}
          </div>
        `}`;
    },

    ledger: () => {
      const chip = (id, label) =>
        `<button type="button" role="radio" data-action="filter-ledger-wallet" data-wid="${id}" aria-checked="${Number(S.fw) === Number(id)}" tabindex="${Number(S.fw) === Number(id) ? '0' : '-1'}" class="h-9 px-3.5 touch-pill rounded-full text-xs font-medium border cursor-pointer ${Number(S.fw) === Number(id) ? 'bg-ink text-card border-ink' : 'bg-card text-ink-2 border-line hover:border-ink/40 hover:text-ink'}">${label}</button>`;

      return `
        ${pageHead('Ledger', `${S.t.length} total recorded entr${S.t.length === 1 ? 'y' : 'ies'}`, `
          <button type="button" data-action="export-csv" class="${C.btn2}" ${!S.t.length ? 'disabled' : ''}>${icon(I.download, 'w-4 h-4', 16)}Export CSV</button>
          <button type="button" data-action="open-modal" data-modal="tx" class="${C.btn}">${icon(I.plus, 'w-4 h-4', 16)}Add entry</button>`)}

        <section class="${C.card} p-4 mb-4 space-y-3" aria-label="Search and filter ledger">
          <div class="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
            <div class="relative">
              <label for="ledger-q" class="sr-only">Search ledger</label>
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-mute pointer-events-none">${icon(I.search, 'w-4 h-4', 16)}</span>
              <input id="ledger-q" type="search" data-input="ledger-search" value="${esc(S.ledgerQuery)}" placeholder="Search merchant, note, ref, amount…" class="${C.input} pl-9">
            </div>
            <div>
              <label for="ledger-cat" class="sr-only">Filter by category</label>
              <select id="ledger-cat" data-change="ledger-filter" class="${C.input}">
                <option value="">All categories</option>
                ${CATEGORIES.map(c => `<option value="${c}" ${S.ledgerCat === c ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
            </div>
            <div>
              <label for="ledger-type" class="sr-only">Filter by direction</label>
              <select id="ledger-type" data-change="ledger-filter" class="${C.input}">
                <option value="all" ${S.ledgerType === 'all' ? 'selected' : ''}>All entry types</option>
                <option value="out" ${S.ledgerType === 'out' ? 'selected' : ''}>Expenses only</option>
                <option value="in" ${S.ledgerType === 'in' ? 'selected' : ''}>Income only</option>
                <option value="adj" ${S.ledgerType === 'adj' ? 'selected' : ''}>Reconciliations</option>
              </select>
            </div>
            <div>
              <label for="ledger-period" class="sr-only">Filter by period</label>
              <select id="ledger-period" data-change="ledger-filter" class="${C.input}">
                <option value="all" ${S.ledgerPeriod === 'all' ? 'selected' : ''}>All dates</option>
                <option value="cycle" ${S.ledgerPeriod === 'cycle' ? 'selected' : ''}>Current payday cycle</option>
                <option value="month" ${S.ledgerPeriod === 'month' ? 'selected' : ''}>This calendar month</option>
                <option value="30d" ${S.ledgerPeriod === '30d' ? 'selected' : ''}>Last 30 days</option>
              </select>
            </div>
          </div>

          <div role="radiogroup" aria-label="Filter by wallet" class="flex flex-wrap gap-2 pt-1">
            ${chip(0, 'All wallets')}
            ${S.w.map(w => chip(w.id, esc(w.n))).join('')}
          </div>
        </section>

        <div id="ledger-results-root">${renderLedgerResultsFragment()}</div>`;
    },

    import: () => {
      const p = S.pr;
      return `
        ${pageHead('Import alert', 'Verify and convert a payment SMS or app notification into a ledger entry')}
        <section class="${C.card} p-5 mb-5">
          <label class="${C.label}" for="raw">1. Paste transaction SMS or push notification</label>
          <textarea id="raw" rows="3" data-input="raw-sms" class="${C.input} h-auto py-2.5 leading-relaxed resize-y" placeholder="GCash: You have paid ₱189.00 to Jollibee. Ref. No. 5012 884 991.">${esc(S.raw)}</textarea>
          <div class="flex flex-wrap items-center justify-between gap-3 mt-4">
            <div class="flex items-center gap-2">
              <button type="button" data-action="read-alert" class="${C.btn}">Parse notification</button>
              ${S.raw ? `<button type="button" data-action="clear-alert" class="${C.btn2}">Clear</button>` : ''}
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="${C.meta}">Samples:</span>
              ${Parser.SAMPLES.map((s, i) =>
                `<button type="button" data-action="fill-sample" data-idx="${i}" class="h-8 px-3 touch-pill rounded-full text-xs font-medium border border-line bg-subtle/60 hover:border-ink/40 cursor-pointer">${esc(s.label)}</button>`
              ).join('')}
            </div>
          </div>
        </section>

        ${p ? (!p.valid ? `
          <div role="alert" class="${C.card} border-l-[3px] border-l-alert p-4 flex items-start gap-3 text-sm text-alert">
            ${icon(I.alert, 'w-5 h-5 mt-0.5', 18)}
            <div>
              <p class="font-semibold">Notification was not imported</p>
              <p class="text-ink-2 mt-0.5">${esc(p.err)}</p>
            </div>
          </div>
        ` : `
          <section class="${C.card} p-5" aria-labelledby="parsed-heading">
            <div class="flex flex-wrap items-center justify-between gap-2 pb-3 mb-4 border-b border-line">
              <div>
                <h2 id="parsed-heading" class="${C.cardTitle}">2. Verify & confirm extracted details</h2>
                <p class="${C.meta}">Review or edit any field below before recording to your passbook.</p>
              </div>
              <div class="flex items-center gap-2">
                <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-subtle text-ink">${esc(p.provider)}</span>
                <span class="px-2.5 py-1 rounded-full text-xs font-medium ${p.confidence === 'high' ? 'bg-subtle text-gain' : 'bg-subtle text-marigold'}">${p.confidence === 'high' ? 'High confidence' : 'Needs verification'}</span>
              </div>
            </div>

            ${p.warnings?.length ? `
              <div role="status" class="rounded-ctl border border-marigold/40 bg-paper p-3 mb-4 text-xs text-ink-2 space-y-1">
                ${p.warnings.map(w => `<p class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-marigold shrink-0"></span>${esc(w)}</p>`).join('')}
              </div>` : ''}

            ${p.duplicate ? `
              <div role="status" class="rounded-ctl border border-alert/40 bg-paper p-3 mb-4 text-xs text-alert font-medium">
                Potential duplicate detected: ${esc(p.duplicate.tx.s)} (${signed(p.duplicate.tx.a)}) on ${esc(Domain.formatShortDate(p.duplicate.tx.d, getToday()))}${p.duplicate.tx.ref ? ` · Ref ${esc(p.duplicate.tx.ref)}` : ''}.
              </div>` : ''}

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-x-3">
              ${field('imp-dir', 'Transaction type', `<select ${inputAttrs('imp-dir')}>
                <option value="-1" ${S.draft['imp-dir'] === '-1' ? 'selected' : ''}>Expense (−)</option>
                <option value="1" ${S.draft['imp-dir'] === '1' ? 'selected' : ''}>Income (+)</option>
              </select>`)}
              ${field('imp-amt', 'Amount (PHP)', `<input ${inputAttrs('imp-amt')} type="number" inputmode="decimal" step="0.01" min="0.01" value="${draft('imp-amt')}">`)}
              ${field('imp-date', 'Transaction date', `<input ${inputAttrs('imp-date')} type="date" value="${draft('imp-date', getToday())}">`)}
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-x-3">
              ${field('imp-merch', 'Merchant or sender', `<input ${inputAttrs('imp-merch')} value="${draft('imp-merch')}">`)}
              ${field('imp-cat', 'Category', `<select ${inputAttrs('imp-cat')}>${CATEGORIES.map(c => `<option value="${c}" ${S.draft['imp-cat'] === c ? 'selected' : ''}>${c}</option>`).join('')}</select>`)}
              ${field('imp-ref', 'Reference no. (optional)', `<input ${inputAttrs('imp-ref')} placeholder="Ref / Trace ID" value="${draft('imp-ref')}">`)}
            </div>

            <div class="flex flex-wrap items-end justify-between gap-3 pt-2 border-t border-line">
              <div class="flex-1 min-w-[220px]">
                ${field('imp-wal', '3. Destination wallet', `<select ${inputAttrs('imp-wal')}>${walletOptions(S.draft['imp-wal'])}</select>`).replace('mb-4', 'mb-0')}
              </div>
              <button type="button" data-action="confirm-alert" class="${C.btn}" ${!S.w.length ? 'disabled' : ''}>Confirm & add to ledger</button>
            </div>
          </section>
        `) : ''}`;
    },

    bills: () => {
      const today = getToday();
      const r = Domain.computeRunwaySummary({
        wallets: S.w,
        bills: S.b,
        transactions: S.t,
        today,
        paydayMode: S.paydayMode,
        customPayday: S.customPayday
      });
      const pdShort = Domain.formatShortDate(r.paydayISO, today);
      const posTot = Money.toCents(r.totalBalance) > 0 ? r.totalBalance : 0;
      const resPct = posTot > 0 ? Math.min(100, Money.pctShare(r.reservedBills, posTot)) : (S.b.length ? 100 : 0);

      const sortedBills = [...S.b].sort((a, b) => {
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return 0;
      });

      return `
        ${pageHead('Bills', `${peso(r.reservedBills)} quarantined before ${esc(pdShort)}`, `
          <button type="button" data-action="open-modal" data-modal="bill" class="${C.btn}">${icon(I.plus, 'w-4 h-4', 16)}Set aside a bill</button>`)}

        <div class="grid gap-4 lg:grid-cols-[1.45fr_1fr] items-start">
          <section class="${C.card}">
            <ul class="divide-y divide-line">
              ${sortedBills.map(b => `<li class="flex flex-wrap sm:flex-nowrap items-center gap-3 px-4 sm:px-5 py-3.5">
                <div class="flex-1 min-w-[160px]">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-sm font-semibold text-ink">${esc(b.n)}</span>
                    ${b.freq && b.freq !== 'once' ? `<span class="text-[11px] font-medium px-1.5 py-0.5 rounded bg-subtle text-ink-2">${b.freq === 'monthly' ? 'Monthly' : 'Bi-monthly'}</span>` : ''}
                    ${billUrgencyBadge(b, today)}
                  </div>
                  <span class="block ${C.meta}">Due ${esc(b.d)}</span>
                </div>
                <span class="tnum text-sm font-semibold text-ink ml-auto">${peso(b.a)}</span>
                <div class="flex items-center gap-1">
                  <button type="button" data-action="open-modal" data-modal="payBill" data-id="${b.id}" class="${C.btn2} h-9 px-3 touch-pill text-xs">${icon(I.check, 'w-3.5 h-3.5', 14)}Pay bill</button>
                  <button type="button" data-action="open-modal" data-modal="bill" data-id="${b.id}" class="${C.iconBtn}" aria-label="Edit ${esc(b.n)}">${icon(I.edit, 'w-4 h-4', 16)}</button>
                  <button type="button" data-action="open-modal" data-modal="confirmDelBill" data-id="${b.id}" class="${C.iconBtn} -mr-1.5" aria-label="Remove ${esc(b.n)}">${icon(I.trash, 'w-4 h-4', 16)}</button>
                </div>
              </li>`).join('') || `<li class="p-8 text-center ${C.meta}">No bills set aside yet. Add rent, utilities, or subscriptions so your daily allowance stays honest.</li>`}
            </ul>
            ${S.b.length ? `<div class="flex justify-between px-5 py-3.5 border-t border-line text-sm font-semibold"><span>Total set aside</span><span class="tnum">${peso(r.reservedBills)}</span></div>` : ''}
          </section>

          <aside class="${C.card} p-5 space-y-4">
            ${cardHead('Payday bill coverage', `<span class="tnum text-xs text-mute">${r.daysLeft}d left</span>`)}
            <div>
              <div class="flex justify-between text-xs text-mute mb-1.5 tnum">
                <span>Reserved for ${S.b.length} bill${S.b.length === 1 ? '' : 's'}</span>
                <span class="font-semibold ${r.status === 'shortfall' ? 'text-alert' : 'text-ink'}">${r.status === 'shortfall' ? 'Exceeds balance' : `${resPct}% of total`}</span>
              </div>
              <div class="h-2 rounded-full bg-track overflow-hidden">
                <span class="block h-full rounded-full ${r.status === 'shortfall' ? 'bg-alert' : 'bg-marigold'}" style="width:${resPct}%"></span>
              </div>
            </div>
            <dl class="tnum text-sm space-y-2.5 pt-2 border-t border-line">
              <div class="flex justify-between"><dt class="text-ink-2">Total wallet balance</dt><dd class="font-medium text-ink">${peso(r.totalBalance)}</dd></div>
              <div class="flex justify-between"><dt class="text-ink-2">Quarantined bills</dt><dd class="font-medium text-marigold">− ${peso(r.reservedBills)}</dd></div>
              ${r.status === 'shortfall'
                ? `<div class="flex justify-between pt-2 border-t border-line font-semibold text-alert"><dt>Coverage shortfall</dt><dd>− ${peso(r.billShortfall)}</dd></div>`
                : `<div class="flex justify-between pt-2 border-t border-line font-semibold text-ink"><dt>Safe to spend until ${esc(pdShort)}</dt><dd class="text-gain">${peso(r.safeToSpend)}</dd></div>`}
            </dl>
          </aside>
        </div>`;
    },

    insights: () => {
      const today = getToday();
      const ins = Domain.computeInsightsSummary(S.t, S.w, S.budgets, {
        today,
        period: S.insightsPeriod,
        paydayMode: S.paydayMode,
        customPayday: S.customPayday
      });
      const runway = Domain.computeRunwaySummary({
        wallets: S.w,
        bills: S.b,
        transactions: S.t,
        today,
        paydayMode: S.paydayMode,
        customPayday: S.customPayday
      });
      const maxCat = ins.categories.length ? ins.categories[0].spent : 1;
      const bar = (pct, cls = 'bg-ink') =>
        `<span class="block h-1.5 rounded-full bg-track overflow-hidden"><span class="block h-full rounded-full ${cls}" style="width:${Math.min(100, Math.max(0, pct))}%"></span></span>`;

      const periods = [
        ['cycle', 'Payday cycle'],
        ['month', 'This month'],
        ['30d', 'Last 30d'],
        ['all', 'All time']
      ];

      return `
        ${pageHead('Insights', `Cashflow, category breakdown & spending limits (${ins.entryCount} entries in range)`, `
          <div role="group" aria-label="Insights period" class="inline-flex p-1 rounded-ctl bg-subtle border border-line">
            ${periods.map(([k, l]) => `<button type="button" data-action="set-insights-period" data-period="${k}" aria-pressed="${S.insightsPeriod === k}" class="h-8 px-2.5 rounded-[6px] text-xs font-medium cursor-pointer ${S.insightsPeriod === k ? 'bg-card text-ink font-semibold' : 'text-ink-2 hover:text-ink'}">${l}</button>`).join('')}
          </div>
          <button type="button" data-action="open-modal" data-modal="budgets" class="${C.btn2}">Category limits</button>`)}

        <div class="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-4">
          <div class="${C.card} p-4">
            <p class="${C.meta}">Net cashflow</p>
            <p class="tnum text-[22px] leading-tight font-semibold tracking-[-0.02em] mt-1 ${Money.toCents(ins.netCashflow) >= 0 ? 'text-gain' : 'text-ink'}">${signed(ins.netCashflow, { neutralZero: true })}</p>
          </div>
          <div class="${C.card} p-4">
            <p class="${C.meta}">Outflow vs. income</p>
            <p class="tnum text-[22px] leading-tight font-semibold tracking-[-0.02em] text-ink mt-1">${ins.spendRatioPct !== null ? `${ins.spendRatioPct}%` : 'No income'}</p>
          </div>
          <div class="${C.card} p-4">
            <p class="${C.meta}">Top expense category</p>
            <p class="text-[22px] leading-tight font-semibold tracking-[-0.02em] text-marigold mt-1 truncate">${ins.topCategory ? `${esc(ins.topCategory.category)} (${ins.topCategory.sharePct}%)` : '—'}</p>
          </div>
          <div class="${C.card} p-4">
            <p class="${C.meta}">Daily safe allowance</p>
            <p class="tnum text-[22px] leading-tight font-semibold tracking-[-0.02em] ${runway.status === 'shortfall' ? 'text-alert' : 'text-gain'} mt-1">${peso(runway.dailyAllowance)}</p>
          </div>
        </div>

        <div class="grid gap-4 lg:grid-cols-2 items-start mb-4">
          <section class="${C.card} p-5">
            ${cardHead('Money in vs. money out')}
            <div class="mt-3 space-y-4 tnum text-sm">
              <div>
                <div class="flex justify-between mb-1.5"><span class="text-ink-2">Money in</span><span class="font-semibold text-gain">+${peso(ins.totalIn)}</span></div>
                ${bar(Money.toCents(ins.totalIn) > 0 ? 100 : 0, 'bg-gain')}
              </div>
              <div>
                <div class="flex justify-between mb-1.5"><span class="text-ink-2">Money out</span><span class="font-semibold text-ink">−${peso(ins.totalOut)}</span></div>
                ${bar(ins.spendRatioPct !== null ? ins.spendRatioPct : (Money.toCents(ins.totalOut) > 0 ? 100 : 0), ins.spendRatioPct !== null && ins.spendRatioPct > 100 ? 'bg-alert' : 'bg-ink')}
              </div>
            </div>
            <p class="${C.meta} pt-3 mt-4 border-t border-line">
              ${ins.spendRatioPct !== null
                ? `You have spent ${ins.spendRatioPct}% of recorded inflows in this period (reconciliations excluded).`
                : Money.toCents(ins.totalOut) > 0
                  ? `${peso(ins.totalOut)} spent with no recorded income in this timeframe.`
                  : 'No inflows or outflows recorded in this timeframe yet.'}
            </p>
          </section>

          <section class="${C.card} p-5">
            ${cardHead('Spending by category', `<button type="button" data-action="open-modal" data-modal="budgets" class="${C.link} text-xs">Edit limits</button>`)}
            <ul class="mt-3 space-y-3.5 tnum text-sm">
              ${ins.categories.map((item, idx) => {
                const overCap = item.budgetPct !== null && item.budgetPct > 100;
                const nearCap = item.budgetPct !== null && item.budgetPct >= 80 && item.budgetPct <= 100;
                const barCls = overCap ? 'bg-alert' : nearCap || idx === 0 ? 'bg-marigold' : 'bg-ink';
                const pctWidth = item.budgetPct !== null ? item.budgetPct : Money.pctShare(item.spent, maxCat);
                return `<li>
                  <div class="flex justify-between gap-2 mb-1">
                    <span class="text-ink font-medium">${esc(item.category)} <span class="text-xs text-mute font-normal">· ${item.sharePct}%</span></span>
                    <span class="font-semibold ${overCap ? 'text-alert' : 'text-ink'}">${peso(item.spent)}${Money.toCents(item.budgetCap) > 0 ? ` <span class="text-xs font-normal text-mute">/ ${peso(item.budgetCap)} (${item.budgetPct}%)</span>` : ''}</span>
                  </div>
                  ${bar(pctWidth, barCls)}
                </li>`;
              }).join('') || `<li class="${C.meta} py-4">No categorized expenses in this period.</li>`}
            </ul>
            <p class="${C.meta} pt-3 mt-4 border-t border-line">Total outflow in period: <span class="tnum font-semibold text-ink">${peso(ins.totalOut)}</span></p>
          </section>
        </div>

        <div class="grid gap-4 lg:grid-cols-2 items-start">
          <section class="${C.card} p-5">
            ${cardHead('Largest expenses')}
            ${ins.largestExpenses.length ? `<ul class="divide-y divide-line/60 mt-1">
              ${ins.largestExpenses.map(t => `<li class="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div class="min-w-0">
                  <p class="font-medium text-ink truncate">${esc(t.s)}</p>
                  <p class="${C.meta} truncate">${esc(t.c)} · ${walletDisplayName(t)} · ${Domain.formatShortDate(t.d, today)}</p>
                </div>
                <span class="tnum font-semibold text-ink shrink-0">${signed(t.a)}</span>
              </li>`).join('')}
            </ul>` : `<p class="${C.meta} py-4">No expenses recorded in this period.</p>`}
          </section>

          <section class="${C.card} p-5">
            ${cardHead('Wallet distribution')}
            ${ins.walletDistribution.length ? `<ul class="space-y-3 mt-3 text-sm tnum">
              ${ins.walletDistribution.map(w => `<li>
                <div class="flex justify-between mb-1">
                  <span class="text-ink-2 font-medium">${esc(w.name)}</span>
                  <span class="font-semibold ${Money.toCents(w.balance) < 0 ? 'text-alert' : 'text-ink'}">${Money.toCents(w.balance) < 0 ? '− ' + peso(w.balance) : peso(w.balance)} <span class="text-xs font-normal text-mute">(${w.sharePct}%)</span></span>
                </div>
                ${bar(w.sharePct, 'bg-ink')}
              </li>`).join('')}
            </ul>` : `<p class="${C.meta} py-4">Add wallets to view balance distribution.</p>`}
          </section>
        </div>`;
    },

    settings: () => {
      const sbCfg = Vault.getSupabaseConfig();
      const accounts = Vault.listAccounts();
      const syncInfo = describeSyncStatus();
      const today = getToday();
      const pdState = Domain.computePaydayState(today, S.paydayMode, S.customPayday);
      const pdShort = Domain.formatShortDate(pdState.paydayISO, today);

      return `
        ${pageHead('Settings & Accounts', `${esc(S.fullName)} (${esc(S.email)})`)}
        <div class="space-y-4">
          <section class="${C.card} divide-y divide-line">
            <div class="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <p class="text-sm font-semibold text-ink">Profile & payday schedule</p>
                <p class="${C.meta}">Schedule: ${Domain.paydayModeLabel(S.paydayMode)} · Next payday: ${esc(pdShort)} (${pdState.daysLeft}d)</p>
              </div>
              <button type="button" data-action="open-modal" data-modal="payday" class="${C.btn2}">Configure…</button>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <div class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full ${syncInfo.dot}"></span>
                  <p class="text-sm font-semibold text-ink">Persistence & Supabase Cloud (${esc(syncInfo.short)})</p>
                </div>
                <p class="${C.meta} mt-0.5">${esc(syncInfo.detail)}</p>
                ${sbCfg.url ? `<p class="${C.meta} mt-0.5">Endpoint: ${esc(sbCfg.url)}</p>` : ''}
              </div>
              <div class="flex flex-wrap gap-2">
                ${S.sbUserId && (S.sbToken || S.sbRefreshToken) ? `<button type="button" data-action="sync-now" class="${C.btn2}">Sync now</button>` : ''}
                <button type="button" data-action="open-modal" data-modal="supabase" class="${C.btn2}">Cloud endpoint…</button>
              </div>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <p class="text-sm font-semibold text-ink">Data portability & backups</p>
                <p class="${C.meta}">Export ledger entries to spreadsheet CSV or save an encrypted-vault JSON workspace backup.</p>
              </div>
              <div class="flex flex-wrap gap-2">
                <button type="button" data-action="export-all-csv" class="${C.btn2}">${icon(I.download, 'w-4 h-4', 16)}Export CSV</button>
                <button type="button" data-action="export-backup" class="${C.btn2}">${icon(I.download, 'w-4 h-4', 16)}Backup JSON</button>
                <label class="${C.btn2} cursor-pointer">
                  ${icon(I.upload, 'w-4 h-4', 16)}Restore JSON
                  <input type="file" accept=".json,application/json" data-change="restore-backup-file" class="sr-only">
                </label>
              </div>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <p class="text-sm font-semibold text-ink">Card vault security</p>
                <p class="${C.meta}">PBKDF2-SHA256 (${Vault.KDF_ITERATIONS_V3.toLocaleString()} iterations, domain-separated salts) + AES-256-GCM · ${sessionVaultKey || S.isDemo ? 'Unlocked in memory' : 'Locked at rest'}.</p>
              </div>
              <div class="flex flex-wrap gap-2">
                ${!S.isDemo && !sessionVaultKey ? `<button type="button" data-action="open-modal" data-modal="unlockVault" class="${C.btn2}">Unlock card vault</button>` : ''}
                ${!S.isDemo && sessionVaultKey ? `<button type="button" data-action="lock-vault-now" class="${C.btn2}">Lock card vault</button>` : ''}
              </div>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <p class="text-sm font-semibold text-ink">Switch account or sign out (${accounts.length} on this browser)</p>
                <p class="${C.meta}">Signing out clears your in-memory vault key and locks workspace routes.</p>
              </div>
              <div class="flex flex-wrap gap-2">
                <button type="button" data-action="signup-from-settings" class="${C.btn2}">Create new account</button>
                <button type="button" data-action="signout" class="${C.btn}">Switch / Sign out</button>
              </div>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <p class="text-sm font-semibold text-ink">${S.isDemo ? 'Reset demo workspace' : 'Delete or reset local data'}</p>
                <p class="${C.meta}">${S.isDemo ? 'Restore original sample wallets, entries, and bills.' : 'Remove this account from this browser or reset all local storage.'}</p>
              </div>
              <div class="flex flex-wrap gap-2">
                ${!S.isDemo ? `<button type="button" data-action="open-modal" data-modal="confirmDelAccount" class="${C.btn2} !border-alert/50 !text-alert hover:!bg-alert/5">Remove this account…</button>` : ''}
                <button type="button" data-action="open-modal" data-modal="reset" class="${C.btn2} !border-alert/50 !text-alert hover:!bg-alert/5">Reset all…</button>
              </div>
            </div>
          </section>
        </div>`;
    },

    help: () => `
      ${pageHead('Help', 'How One Wallet calculates daily runway & protects card secrets')}
      <div class="grid gap-4 lg:grid-cols-2 items-start">
        <section class="${C.card} p-5">
          ${cardHead('How the daily spending allowance works')}
          <ol class="mt-2 space-y-2.5 text-sm text-ink-2 list-decimal pl-5">
            <li>Add each bank account, e-wallet, or cash passbook with its real balance.</li>
            <li>Set aside upcoming bills due before your next payday—One Wallet quarantines those funds immediately.</li>
            <li>Your remaining safe-to-spend funds are divided conservatively (floored to the centavo) across the exact calendar days until payday.</li>
            <li>When you pay a bill, choose <strong>Pay bill</strong> to deduct from a wallet, log a <code>Bills</code> ledger entry, and settle (or roll forward) the bill atomically.</li>
          </ol>
        </section>
        <section class="${C.card} p-5">
          ${cardHead('Security, privacy & reconciliation')}
          <dl class="mt-2 space-y-3 text-sm">
            <div><dt class="font-semibold text-ink">Are card numbers or CVVs readable in storage?</dt><dd class="text-ink-2">Never. Optional card credentials are encrypted in your browser using <code>AES-256-GCM</code> with a non-extractable key derived via <code>PBKDF2-SHA256</code> (600,000 iterations, domain-separated from authentication hashes).</dd></div>
            <div><dt class="font-semibold text-ink">What happens if cloud sync loses connection?</dt><dd class="text-ink-2">Changes are saved locally first and marked pending. Cloud sync uses transactional/upsert-first writes so an interrupted connection never wipes existing cloud records.</dd></div>
            <div><dt class="font-semibold text-ink">A wallet balance drifted from my bank app.</dt><dd class="text-ink-2">Open the wallet and click <strong>Reconcile balance</strong>. One Wallet adds an auditable <code>Balance correction</code> entry for the exact difference.</dd></div>
          </dl>
        </section>
      </div>`,

    more: () => `
      ${pageHead('More', 'All passbook & vault sections')}
      <section class="${C.card}">
        <ul class="divide-y divide-line">
          ${[
            ['wallets', 'Wallets & Cards'],
            ['insights', 'Insights & Budgets'],
            ['settings', 'Settings, Backups & Accounts'],
            ['help', 'Help & Security Guide']
          ].map(([k, l]) => `<li><a href="#${k}" class="flex items-center justify-between px-5 py-3.5 text-sm font-medium hover:bg-subtle/60">${l}<span class="text-mute">${icon(I.chevron, 'w-4 h-4', 16)}</span></a></li>`).join('')}
        </ul>
      </section>`
  };

  /* ---------- Application Shell & Rendering ---------- */
  const NAV = [
    ['today', 'Today', I.today],
    ['wallets', 'Wallets & Cards', I.wallets],
    ['ledger', 'Ledger', I.ledger],
    ['import', 'Import alert', I.import],
    ['bills', 'Bills', I.bills],
    ['insights', 'Insights', I.insights]
  ];
  const NAV2 = [
    ['settings', 'Settings', I.settings],
    ['help', 'Help', I.help]
  ];
  const TABS = [
    ['today', 'Today', I.today],
    ['wallets', 'Wallets', I.wallets],
    ['ledger', 'Ledger', I.ledger],
    ['bills', 'Bills', I.bills],
    ['more', 'More', I.menu]
  ];
  const MORE_GROUP = ['more', 'import', 'insights', 'settings', 'help'];

  const navLink = ([k, l]) => {
    const on = S.view === k;
    const count = k === 'bills' && S.b.length ? S.b.length : 0;
    return `<a href="#${k}" ${on ? 'aria-current="page"' : ''} class="relative inline-flex items-center gap-1.5 h-12 px-3 text-[13px] transition-colors duration-150 ${on ? 'font-semibold text-ink' : 'font-normal text-ink-2 hover:text-ink'}">
      <span>${l}</span>
      ${count ? `<span class="tnum text-xs font-medium px-1.5 py-0.5 rounded-full ${on ? 'bg-subtle text-ink' : 'bg-paper text-ink-2 border border-line'}">${count}</span>` : ''}
      ${on ? '<span class="absolute inset-x-3 bottom-0 h-[2px] rounded-t-full bg-gain" aria-hidden="true"></span>' : ''}
    </a>`;
  };

  function renderModal() {
    const modalRoot = document.getElementById('modal-root');
    if (!modalRoot) return;
    if (!S.modal || !M[S.modal]) {
      modalRoot.innerHTML = '';
      return;
    }
    const content = M[S.modal]();
    if (!content) {
      modalRoot.innerHTML = '';
      return;
    }
    modalRoot.innerHTML = `
      <div data-modal-backdrop class="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center sm:p-4">
        <div role="dialog" aria-modal="true" aria-labelledby="modal-title" class="dialog-in w-full sm:w-[520px] max-h-[90dvh] overflow-y-auto bg-card border border-line rounded-t-card sm:rounded-card p-5 sm:p-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          ${content}
        </div>
      </div>`;
    const firstErr = modalRoot.querySelector('[aria-invalid="true"]');
    (firstErr || modalRoot.querySelector('[data-autofocus]') || modalRoot.querySelector('[role="dialog"] button'))?.focus();
  }

  function R() {
    const shell = document.getElementById('shell-root') || document.getElementById('app');
    if (!shell) return;

    if (!S.authenticated || S.view === 'login') {
      shell.innerHTML = V.login();
      document.title = 'Sign in · One Wallet';
      renderModal();
      return;
    }

    const label = [...NAV, ...NAV2, ['more', 'More']].find(n => n[0] === S.view)?.[1] ?? 'One Wallet';
    document.title = `${label} · One Wallet`;
    const today = getToday();
    const pdState = Domain.computePaydayState(today, S.paydayMode, S.customPayday);
    const pdShort = Domain.formatShortDate(pdState.paydayISO, today);
    const syncInfo = describeSyncStatus();

    shell.innerHTML = `
      <a href="#main" class="skip-link">Skip to main content</a>
      <div class="min-h-dvh bg-paper flex flex-col">
        <header class="sticky top-0 z-30 bg-card border-b border-line">
          <div class="w-full max-w-[1160px] mx-auto h-12 px-4 sm:px-6 flex items-center justify-between gap-3">
            <a href="#today" class="flex items-center gap-2 shrink-0">
              ${Cards.brandLogo('h-6 w-auto', 24)}
              <span class="text-sm font-semibold tracking-[-0.015em] text-ink">One Wallet</span>
            </a>

            <nav aria-label="Main navigation" class="max-md:hidden flex items-center gap-0.5">
              ${NAV.map(navLink).join('')}
            </nav>

            <div class="flex items-center gap-2 shrink-0">
              <a href="#settings" id="sync-status-pill" title="${esc(syncInfo.detail)}" class="max-lg:hidden tnum text-[11px] font-medium px-2.5 h-7 rounded-full border border-line bg-paper text-ink-2 hover:text-ink inline-flex items-center">${esc(syncInfo.short)}</a>
              <button type="button" data-action="open-modal" data-modal="payday" class="tnum text-xs font-medium px-2.5 h-7 rounded-full bg-subtle text-ink hover:bg-track active:scale-[0.98] transition-[transform,background-color] duration-100 inline-flex items-center gap-1.5 cursor-pointer">
                <span class="w-1.5 h-1.5 rounded-full ${pdState.customExpired ? 'bg-marigold' : 'bg-gain'}" aria-hidden="true"></span>
                <span>Payday ${esc(pdShort)} · ${pdState.daysLeft}d</span>
              </button>
              <a href="#help" aria-label="Help" ${S.view === 'help' ? 'aria-current="page"' : ''} class="max-md:hidden inline-flex items-center justify-center w-8 h-8 rounded-full text-xs ${S.view === 'help' ? 'bg-subtle text-ink font-semibold' : 'text-ink-2 hover:text-ink hover:bg-subtle'} transition-colors duration-150">${icon(I.help, 'w-4 h-4', 16)}</a>
              <a href="#settings" aria-label="Settings (${esc(S.fullName)})" ${S.view === 'settings' ? 'aria-current="page"' : ''} class="max-md:hidden inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-line text-xs font-medium ${S.view === 'settings' ? 'bg-ink text-card border-ink' : 'bg-card text-ink-2 hover:text-ink hover:bg-subtle'} transition-colors duration-150">
                ${icon(I.settings, 'w-3.5 h-3.5', 14)}
                <span class="max-lg:hidden truncate max-w-[96px]">${esc(S.fullName.split(' ')[0])}</span>
              </a>
            </div>
          </div>
        </header>

        ${S.storageWarning ? `<div role="alert" class="bg-alert text-card text-xs px-4 py-2 text-center">Local storage warning: ${esc(S.storageWarning)}</div>` : ''}

        <main id="main" tabindex="-1" class="w-full max-w-[1160px] mx-auto px-4 sm:px-6 pt-5 sm:pt-6 pb-24 md:pb-10 focus:outline-none">
          ${V[S.view]()}
        </main>

        <div id="status-toast" role="status" aria-live="polite" class="${S.toast ? '' : 'hidden'} fixed bottom-20 md:bottom-5 right-4 z-40 max-w-sm rounded-ctl bg-ink text-card px-3.5 py-2.5 text-xs font-medium border border-line">${esc(S.toast)}</div>
      </div>

      <nav aria-label="Mobile navigation" class="md:hidden fixed inset-x-0 bottom-0 z-30 bg-card border-t border-line grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        ${TABS.map(([k, l, ic]) => {
          const on = S.view === k || (k === 'more' && MORE_GROUP.includes(S.view));
          return `<a href="#${k}" ${on ? 'aria-current="page"' : ''} class="flex flex-col items-center justify-center gap-0.5 h-15 text-xs ${on ? 'text-ink font-semibold' : 'text-mute'}">
            <span class="relative">${icon(ic, 'w-5 h-5', 20)}${on ? '<span class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3.5 h-[2px] rounded-full bg-ink" aria-hidden="true"></span>' : ''}</span>
            <span class="mt-1">${l}</span>
          </a>`;
        }).join('')}
      </nav>`;

    renderModal();
  }

  /* ---------- Delegated Event System (Zero Inline JS Handlers) ---------- */
  function handleActionClick(e) {
    // Backdrop click closes modal
    if (e.target?.hasAttribute?.('data-modal-backdrop')) {
      closeModal();
      return;
    }

    const el = e.target?.closest?.('[data-action]');
    if (!el) return;
    const act = el.dataset.action;

    // Prevent card-flip parent from firing when clicking internal Copy button
    if (act === 'copy-card') {
      e.stopPropagation();
      copyCardNum(el.dataset.id);
      return;
    }

    switch (act) {
      case 'switch-auth-tab':
        S.authTab = el.dataset.tab === 'signup' ? 'signup' : 'signin';
        S.errors = {};
        R();
        break;
      case 'prefill-account': {
        const email = el.dataset.email || '';
        S.authTab = 'signin';
        S.draft = { 'login-email': email };
        S.errors = {};
        R();
        document.getElementById('login-pwd')?.focus();
        break;
      }
      case 'signin':
        handleSignIn();
        break;
      case 'signup':
        handleSignUp();
        break;
      case 'open-demo':
        openDemoAccount();
        break;
      case 'signout':
        signOut({ switchToSignup: false });
        break;
      case 'signup-from-settings':
        signOut({ switchToSignup: true });
        break;
      case 'nav':
        go(el.dataset.view || 'today');
        break;
      case 'open-modal':
        openModal(el.dataset.modal, Number(el.dataset.id || 0));
        break;
      case 'close-modal':
        closeModal(false);
        break;
      case 'open-wallet':
        openWallet(el.dataset.id);
        break;
      case 'close-wallet-detail':
        S.wid = 0;
        S.revealed = {};
        S.flipped = {};
        R();
        break;
      case 'add-tx-for-wallet':
        S.wid = Number(el.dataset.id || 0) || S.wid;
        openModal('tx');
        S.draft.mw = String(el.dataset.id || S.w[0]?.id || '');
        renderModal();
        break;
      case 'set-wallet-view':
        S.walletView = el.dataset.mode === 'grid' ? 'grid' : 'carousel';
        R();
        break;
      case 'flip-card':
        if (!cDrag.moved) toggleFlip(el.dataset.id);
        break;
      case 'reveal-card':
        toggleReveal(el.dataset.id);
        break;
      case 'mask-all-cards':
        maskAllCards();
        break;
      case 'spin-card':
        e.stopPropagation();
        spinCard(Number(el.dataset.delta || 1));
        break;
      case 'go-card':
        if (!cDrag.moved) goCard(Number(el.dataset.idx || 0));
        break;
      case 'pick-card-style': {
        const styleId = el.dataset.style;
        const st = Cards.getCardStyle(styleId);
        const curName = val('wnm');
        const isPreset = !curName || Cards.CARD_STYLES.some(x =>
          x.bank.toLowerCase() === curName.toLowerCase() ||
          x.name.toLowerCase() === curName.toLowerCase() ||
          `${x.bank} ${x.tier}`.toLowerCase() === curName.toLowerCase()
        );
        S.draft = {
          ...S.draft,
          wnm: isPreset ? st.bank : curName,
          wb: val('wb'),
          wnum: val('wnum'),
          wexp: val('wexp'),
          wcvv: val('wcvv'),
          wholder: val('wholder') || (S.fullName || '').toUpperCase(),
          wstyle: styleId
        };
        renderModal();
        break;
      }
      case 'save-tx':
        saveTx();
        break;
      case 'save-wallet':
        saveWallet();
        break;
      case 'save-bill':
        saveBill();
        break;
      case 'confirm-pay-bill':
        confirmPayBill();
        break;
      case 'save-reconcile':
        saveReconcile();
        break;
      case 'save-payday':
        savePaydaySettings();
        break;
      case 'save-budgets':
        saveBudgets();
        break;
      case 'save-supabase':
        saveSupabaseSettings();
        break;
      case 'confirm-unlock-vault':
        confirmUnlockVault();
        break;
      case 'lock-vault-now':
        sessionVaultKey = null;
        S.revealed = {};
        S.flipped = {};
        S.w = S.w.map(w => ({ ...w, vaultUnlocked: false, num: '', exp: '', cvv: '' }));
        R();
        showToast('Card vault locked in memory.');
        break;
      case 'exec-del-tx':
        executeConfirmedDeleteTx();
        break;
      case 'exec-del-bill':
        executeConfirmedDeleteBill();
        break;
      case 'exec-del-wallet-keep':
        executeConfirmedDeleteWallet(false);
        break;
      case 'exec-del-wallet-purge':
        executeConfirmedDeleteWallet(true);
        break;
      case 'exec-del-account':
        deleteCurrentAccount();
        break;
      case 'exec-reset-all':
        resetDemoData();
        break;
      case 'filter-ledger-wallet':
        S.fw = Number(el.dataset.wid || 0);
        R();
        break;
      case 'clear-ledger-filters':
        S.fw = 0;
        S.ledgerQuery = '';
        S.ledgerCat = '';
        S.ledgerType = 'all';
        S.ledgerPeriod = 'all';
        R();
        break;
      case 'fill-sample': {
        const sample = Parser.SAMPLES[Number(el.dataset.idx || 0)];
        if (sample) {
          S.raw = sample.text;
          S.pr = null;
          R();
          document.getElementById('raw')?.focus();
        }
        break;
      }
      case 'clear-alert':
        S.raw = '';
        S.pr = null;
        S.errors = {};
        R();
        document.getElementById('raw')?.focus();
        break;
      case 'read-alert':
        readAlert();
        break;
      case 'confirm-alert':
        confirmAlertImport();
        break;
      case 'set-insights-period':
        S.insightsPeriod = el.dataset.period || 'cycle';
        R();
        break;
      case 'export-csv':
        handleExportCSV();
        break;
      case 'export-all-csv':
        handleExportCSV(S.t);
        break;
      case 'export-backup':
        handleExportBackup();
        break;
      case 'sync-now': {
        const reg = Vault.loadRegistry();
        if (reg[S.accountId]) {
          Vault.syncAccountToSupabase(
            reg[S.accountId],
            { accessToken: S.sbToken, refreshToken: S.sbRefreshToken, expiresAt: S.sbExpiresAt },
            true
          );
        }
        break;
      }
    }
  }

  function handleDelegatedInput(e) {
    const kind = e.target.dataset.input;
    if (!kind) return;
    if (kind === 'ledger-search') {
      S.ledgerQuery = e.target.value;
      const resultsRoot = document.getElementById('ledger-results-root');
      if (resultsRoot) resultsRoot.innerHTML = renderLedgerResultsFragment();
    } else if (kind === 'raw-sms') {
      S.raw = e.target.value;
    } else if (kind === 'tx-merchant') {
      S.txDupAck = false;
      if (!S.manualCatPicked && !S.editTxId) {
        const dir = Number(val('ty')) >= 0 ? 1 : -1;
        const suggested = Domain.inferCategory(e.target.value, dir, S.t);
        const catSelect = document.getElementById('mc');
        if (catSelect && suggested) catSelect.value = suggested;
      }
    } else if (kind === 'paybill-preview') {
      S.draft.pw = val('pw');
      S.draft.pa = e.target.value;
    }
  }

  function handleDelegatedChange(e) {
    const kind = e.target.dataset.change;
    if (!kind) return;
    if (kind === 'ledger-filter') {
      S.ledgerCat = document.getElementById('ledger-cat')?.value ?? '';
      S.ledgerType = document.getElementById('ledger-type')?.value ?? 'all';
      S.ledgerPeriod = document.getElementById('ledger-period')?.value ?? 'all';
      const resultsRoot = document.getElementById('ledger-results-root');
      if (resultsRoot) resultsRoot.innerHTML = renderLedgerResultsFragment();
    } else if (kind === 'tx-type') {
      S.txDupAck = false;
      const dir = Number(e.target.value) >= 0 ? 1 : -1;
      const catSelect = document.getElementById('mc');
      if (catSelect && !S.manualCatPicked) {
        catSelect.value = dir > 0 ? 'Income' : Domain.inferCategory(val('nt'), -1, S.t);
      }
    } else if (kind === 'tx-cat') {
      S.manualCatPicked = true;
    } else if (kind === 'payday-mode') {
      S.draft.pmode = e.target.value;
      S.draft.pname = val('pname');
      renderModal();
    } else if (kind === 'paybill-preview') {
      S.draft.pw = val('pw');
      S.draft.pa = val('pa');
      renderModal();
    } else if (kind === 'restore-backup-file') {
      const file = e.target.files?.[0];
      if (file) handleRestoreBackupFile(file);
      e.target.value = '';
    }
  }

  /* ---------- Pointer & Keyboard Listeners ---------- */
  const canHoverTilt = () => typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let listenersBound = false;
  function setupListeners() {
    if (listenersBound) return;
    listenersBound = true;
    document.addEventListener('click', handleActionClick);
    document.addEventListener('input', handleDelegatedInput);
    document.addEventListener('change', handleDelegatedChange);

    // Card hover tilt & carousel drag
    document.addEventListener('pointerdown', e => {
      const stage = e.target.closest('[data-carousel-stage]');
      if (!stage) return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (e.target.closest('button, a')) return;
      if (cSpring.raf) { cancelAnimationFrame(cSpring.raf); cSpring.raf = 0; }
      cSpring.vel = 0;
      cDrag = { active: true, pointerId: e.pointerId, startX: e.clientX, startPos: cSpring.pos, dx: 0, vx: 0, lastX: e.clientX, lastT: performance.now(), moved: false };
      try { stage.setPointerCapture(e.pointerId); } catch (_) {}
    });

    document.addEventListener('pointermove', e => {
      if (cDrag.active && e.pointerId === cDrag.pointerId) {
        const now = performance.now();
        const dt = Math.max(0.004, (now - cDrag.lastT) / 1000);
        const instVx = (e.clientX - cDrag.lastX) / dt;
        cDrag.vx = cDrag.vx * 0.4 + instVx * 0.6;
        cDrag.lastX = e.clientX;
        cDrag.lastT = now;
        cDrag.dx = e.clientX - cDrag.startX;
        if (Math.abs(cDrag.dx) > 6) cDrag.moved = true;
        if (cDrag.moved && S.w.length > 1) {
          cSpring.pos = cDrag.startPos - cDrag.dx / 240;
          renderCarouselFrame(cSpring.pos);
        }
        return;
      }
      const flipper = e.target.closest('[data-flip-id]');
      if (flipper && canHoverTilt() && !cSpring.raf && !flipper.classList.contains('is-flipped')) {
        if (flipper.closest('[data-slot-idx]') && !flipper.classList.contains('cursor-pointer')) return;
        const r = flipper.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        flipper.classList.add('is-tilting');
        flipper.style.transform = `rotateX(${((0.5 - py) * 5.5).toFixed(2)}deg) rotateY(${((px - 0.5) * 6.5).toFixed(2)}deg)`;
      }
    });

    const finishDrag = e => {
      if (!cDrag.active || e.pointerId !== cDrag.pointerId) return;
      const { dx, vx, startPos, moved } = cDrag;
      const stale = performance.now() - cDrag.lastT > 80;
      cDrag = { active: false, pointerId: null, startX: 0, startPos: 0, dx: 0, vx: 0, lastX: 0, lastT: 0, moved: false };
      const len = S.w.length;
      if (moved && len > 1) {
        cSpring.vel = stale ? 0 : -vx / 240;
        if (Math.abs(dx) > 38 || (!stale && Math.abs(vx) > 220)) {
          const dir = (Math.abs(dx) > 38 ? dx < 0 : vx < 0) ? 1 : -1;
          cSpring.target = Math.round(startPos) + dir;
        } else {
          cSpring.target = Math.round(cSpring.pos);
        }
        S.carouselIdx = ((cSpring.target % len) + len) % len;
        syncCarouselChrome();
        startCarouselSpring();
      }
    };
    document.addEventListener('pointerup', finishDrag);
    document.addEventListener('pointercancel', () => {
      cDrag = { active: false, pointerId: null, startX: 0, startPos: 0, dx: 0, vx: 0, lastX: 0, lastT: 0, moved: false };
    });
    document.addEventListener('pointerout', e => {
      const flipper = e.target.closest?.('[data-flip-id]');
      if (flipper && !flipper.contains(e.relatedTarget)) {
        flipper.classList.remove('is-tilting');
        if (!flipper.classList.contains('is-flipped')) flipper.style.transform = '';
      }
    });

    // Keyboard: card flip Enter/Space, carousel arrows, roving tablist/radiogroup, modal Escape & Tab trap
    window.addEventListener('keydown', e => {
      if (!S.modal) {
        // Flip focused card with Enter or Space
        const flipEl = e.target?.closest?.('[data-flip-id][role="button"]');
        if (flipEl && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          toggleFlip(flipEl.dataset.id);
          return;
        }
        // Carousel Left/Right arrows
        if (e.target?.closest?.('[data-carousel-keys]') && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
          e.preventDefault();
          spinCard(e.key === 'ArrowRight' ? 1 : -1);
          return;
        }
        // Submit login/signup on Enter inside auth inputs
        if (S.view === 'login' && e.key === 'Enter' && e.target?.matches?.('#auth-tabpanel input')) {
          e.preventDefault();
          if (S.authTab === 'signup') handleSignUp();
          else handleSignIn();
          return;
        }
        // Roving keyboard navigation on tablists & radiogroups
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
          const group = e.target?.closest?.('[role="tablist"], [role="radiogroup"]');
          if (group) {
            const role = group.getAttribute('role') === 'tablist' ? '[role="tab"]' : '[role="radio"]';
            const items = [...group.querySelectorAll(role)];
            const idx = items.indexOf(e.target);
            if (idx !== -1 && items.length > 1) {
              e.preventDefault();
              const nextIdx = e.key === 'Home'
                ? 0
                : e.key === 'End'
                  ? items.length - 1
                  : (idx + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
              items[nextIdx].click();
              const updatedGroup = document.querySelector(`[role="${group.getAttribute('role')}"]`);
              updatedGroup?.querySelectorAll(role)?.[nextIdx]?.focus();
              return;
            }
          }
        }
        return;
      }

      // Active modal keyboard handling
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal(false);
        return;
      }
      if (e.key === 'Enter' && e.target?.matches?.('[role="dialog"] input:not([type="file"])')) {
        e.preventDefault();
        document.querySelector('[role="dialog"] [data-primary-submit]')?.click();
        return;
      }
      if (e.key === 'Tab') {
        const focusable = [...document.querySelectorAll('[role="dialog"] :is(button:not([disabled]),input:not(.sr-only),select,textarea,a[href])')];
        if (!focusable.length) return;
        if (e.shiftKey && document.activeElement === focusable[0]) {
          e.preventDefault();
          focusable.at(-1).focus();
        } else if (!e.shiftKey && document.activeElement === focusable.at(-1)) {
          e.preventDefault();
          focusable[0].focus();
        }
      }
    });

    // Auto-mask revealed card details when tab is hidden or window loses focus
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) maskSensitiveCardsOnBlur();
    });
    window.addEventListener('blur', maskSensitiveCardsOnBlur);

    // Retry pending cloud synchronization automatically when network reconnects
    window.addEventListener('online', () => {
      if (!S.authenticated || !S.accountId) return;
      const reg = Vault.loadRegistry();
      const acc = reg[S.accountId];
      if (acc && acc.pendingSync && S.sbUserId && (S.sbToken || S.sbRefreshToken)) {
        Vault.syncAccountToSupabase(acc, {
          accessToken: S.sbToken,
          refreshToken: S.sbRefreshToken,
          expiresAt: S.sbExpiresAt
        }, true);
      }
    });
  }

  /* ---------- Hash Router with Strict Auth Guard ---------- */
  const ALIAS = {
    dash: 'today',
    wal: 'wallets',
    tx: 'ledger',
    imp: 'import',
    bill: 'bills',
    ins: 'insights',
    set: 'settings'
  };

  function route() {
    let v = location.hash.slice(1);
    if (ALIAS[v]) {
      location.replace('#' + ALIAS[v]);
      return;
    }
    if (!V[v]) v = S.authenticated ? 'today' : 'login';

    // Strict authentication guard: unauthenticated sessions cannot view protected routes
    if (!S.authenticated && v !== 'login') {
      S.view = 'login';
      location.replace('#login');
      R();
      return;
    }

    const changed = S.view !== v;
    S.view = v;
    S.modal = '';
    if (changed) {
      S.pr = null;
      S.revealed = {};
      S.flipped = {};
      if (!keepWallet) S.wid = 0;
    }
    keepWallet = false;
    R();
    if (changed && typeof window.scrollTo === 'function') window.scrollTo(0, 0);
  }

  function initApp() {
    setupListeners();
    window.addEventListener('hashchange', route);
    return bootSession().finally(route);
  }

  global.OWApp = {
    initApp,
    getState: () => S,
    route,
    signOut,
    openModal,
    closeModal
  };

  if (typeof document !== 'undefined' && !global.__OW_DISABLE_AUTOBOOT__) {
    initApp();
  }
})(typeof window !== 'undefined' ? window : globalThis);
