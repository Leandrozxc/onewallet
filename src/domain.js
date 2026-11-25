/* ============================================================================
 * One Wallet · Financial Domain, Payday/Runway Math, Ledger & Portability
 * Pure, side-effect-free domain rules shared by browser UI and automated tests.
 * ============================================================================ */
(function (global) {
  'use strict';

  const Money = global.OWMoney || (typeof require === 'function' ? require('./money.js') : null);

  const CATEGORIES = ['Food', 'Transport', 'Load', 'Bills', 'Income', 'Others'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const BILL_FREQUENCIES = ['once', 'bimonthly', 'monthly'];

  const pad2 = n => (n < 10 ? '0' : '') + n;

  /* ---------- 1. Timezone-Safe Calendar & ISO Date Utilities ---------- */
  function daysInMonth(year, month1Based) {
    return new Date(Date.UTC(year, month1Based, 0)).getUTCDate();
  }

  function isValidISODate(str) {
    if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
    const [y, m, d] = str.split('-').map(Number);
    if (y < 1970 || y > 2100 || m < 1 || m > 12 || d < 1) return false;
    return d <= daysInMonth(y, m);
  }

  function toISODate(dateObj) {
    return `${dateObj.getFullYear()}-${pad2(dateObj.getMonth() + 1)}-${pad2(dateObj.getDate())}`;
  }

  function todayISO() {
    return toISODate(new Date());
  }

  function shiftDaysISO(isoDate, deltaDays) {
    if (!isValidISODate(isoDate)) return isoDate;
    const [y, m, d] = isoDate.split('-').map(Number);
    const utc = new Date(Date.UTC(y, m - 1, d + Number(deltaDays || 0)));
    return `${utc.getUTCFullYear()}-${pad2(utc.getUTCMonth() + 1)}-${pad2(utc.getUTCDate())}`;
  }

  function shiftMonthsISO(isoDate, deltaMonths) {
    if (!isValidISODate(isoDate)) return isoDate;
    const [y, m, d] = isoDate.split('-').map(Number);
    const totalMonths = (y * 12 + (m - 1)) + Number(deltaMonths || 0);
    const ny = Math.floor(totalMonths / 12);
    const nm = (totalMonths % 12) + 1;
    const nd = Math.min(d, daysInMonth(ny, nm));
    return `${ny}-${pad2(nm)}-${pad2(nd)}`;
  }

  /**
   * Exact calendar-day difference (endISO - startISO) immune to local DST shifts.
   */
  function daysBetweenISO(startISO, endISO) {
    if (!isValidISODate(startISO) || !isValidISODate(endISO)) return 0;
    const [y1, m1, d1] = startISO.split('-').map(Number);
    const [y2, m2, d2] = endISO.split('-').map(Number);
    const t1 = Date.UTC(y1, m1 - 1, d1);
    const t2 = Date.UTC(y2, m2 - 1, d2);
    return Math.round((t2 - t1) / 86400000);
  }

  /**
   * Normalize legacy 'MM-DD' or full 'YYYY-MM-DD' entry dates to full 'YYYY-MM-DD'.
   * If a legacy 'MM-DD' is >31 days ahead of referenceISO in the current year
   * (e.g. '12-28' viewed on '2027-01-05'), infer the previous year.
   */
  function normalizeEntryDate(rawDate, referenceISO = todayISO()) {
    const ref = isValidISODate(referenceISO) ? referenceISO : todayISO();
    const s = String(rawDate ?? '').trim();
    if (isValidISODate(s)) return s;
    const m = s.match(/^(\d{2})-(\d{2})$/);
    if (m) {
      const refYear = Number(ref.slice(0, 4));
      const candidateThisYear = `${refYear}-${m[1]}-${m[2]}`;
      if (isValidISODate(candidateThisYear)) {
        if (daysBetweenISO(ref, candidateThisYear) > 31) {
          const prev = `${refYear - 1}-${m[1]}-${m[2]}`;
          if (isValidISODate(prev)) return prev;
        }
        return candidateThisYear;
      }
      // Feb 29 legacy entry viewed in a non-leap year: find most recent leap year
      if (m[1] === '02' && m[2] === '29') {
        for (let y = refYear; y >= refYear - 4; y--) {
          if (isValidISODate(`${y}-02-29`)) return `${y}-02-29`;
        }
      }
    }
    return ref;
  }

  function formatShortDate(dateStr, referenceISO = todayISO()) {
    if (!dateStr) return '';
    const s = String(dateStr).trim();
    if (isValidISODate(s)) {
      const [y, m, d] = s.split('-').map(Number);
      const refYear = Number(String(referenceISO || '').slice(0, 4));
      return y && refYear && y !== refYear
        ? `${MONTHS[m - 1]} ${d}, ${y}`
        : `${MONTHS[m - 1]} ${d}`;
    }
    const mmdd = s.match(/^(\d{1,2})-(\d{1,2})$/);
    if (mmdd) {
      const m = Number(mmdd[1]), d = Number(mmdd[2]);
      if (MONTHS[m - 1] && d >= 1 && d <= 31) return `${MONTHS[m - 1]} ${d}`;
    }
    return s;
  }

  function formatDayHeading(isoDate, referenceISO = todayISO()) {
    const full = normalizeEntryDate(isoDate, referenceISO);
    const yd = shiftDaysISO(referenceISO, -1);
    const short = formatShortDate(full, referenceISO);
    if (full === referenceISO) return `Today · ${short}`;
    if (full === yd) return `Yesterday · ${short}`;
    return short;
  }

  /* ---------- 2. Payday Cycle & Daily Runway Calculator ---------- */
  function computePaydayState(baseISO, mode = 'bimonthly', customDate = '') {
    const today = isValidISODate(baseISO) ? baseISO : todayISO();
    const [y, m, d] = today.split('-').map(Number);
    const lastDay = daysInMonth(y, m);
    const endDay = Math.min(30, lastDay);

    if (mode === 'custom') {
      if (isValidISODate(customDate)) {
        if (customDate > today) {
          return {
            paydayISO: customDate,
            daysLeft: Math.max(1, daysBetweenISO(today, customDate)),
            isPaydayToday: false,
            customExpired: false,
            effectiveMode: 'custom',
            cycleStartISO: shiftDaysISO(customDate, -15) < today ? shiftDaysISO(customDate, -15) : shiftDaysISO(today, -14)
          };
        }
        if (customDate === today) {
          return {
            paydayISO: customDate,
            daysLeft: 1,
            isPaydayToday: true,
            customExpired: false,
            effectiveMode: 'custom',
            cycleStartISO: shiftDaysISO(today, -14)
          };
        }
        // Custom target date is in the past: flag explicitly instead of silent override
        const fallback = computePaydayState(today, 'bimonthly', '');
        return {
          ...fallback,
          customExpired: true,
          expiredCustomDate: customDate,
          effectiveMode: 'custom-expired'
        };
      }
      const fallback = computePaydayState(today, 'bimonthly', '');
      return { ...fallback, customExpired: Boolean(customDate), effectiveMode: 'custom-unset' };
    }

    if (mode === 'monthly-15') {
      const isPaydayToday = d === 15;
      let paydayISO, cycleStartISO;
      if (d < 15) {
        paydayISO = `${y}-${pad2(m)}-15`;
        const prevM = m === 1 ? 12 : m - 1;
        const prevY = m === 1 ? y - 1 : y;
        cycleStartISO = `${prevY}-${pad2(prevM)}-15`;
      } else {
        const nextM = m === 12 ? 1 : m + 1;
        const nextY = m === 12 ? y + 1 : y;
        paydayISO = `${nextY}-${pad2(nextM)}-15`;
        cycleStartISO = `${y}-${pad2(m)}-15`;
      }
      return {
        paydayISO,
        daysLeft: Math.max(1, daysBetweenISO(today, paydayISO)),
        isPaydayToday,
        customExpired: false,
        effectiveMode: 'monthly-15',
        cycleStartISO
      };
    }

    if (mode === 'monthly-30') {
      const isPaydayToday = d === endDay;
      let paydayISO, cycleStartISO;
      if (d < endDay) {
        paydayISO = `${y}-${pad2(m)}-${pad2(endDay)}`;
        const prevM = m === 1 ? 12 : m - 1;
        const prevY = m === 1 ? y - 1 : y;
        const prevEnd = Math.min(30, daysInMonth(prevY, prevM));
        cycleStartISO = `${prevY}-${pad2(prevM)}-${pad2(prevEnd)}`;
      } else {
        const nextM = m === 12 ? 1 : m + 1;
        const nextY = m === 12 ? y + 1 : y;
        const nextEnd = Math.min(30, daysInMonth(nextY, nextM));
        paydayISO = `${nextY}-${pad2(nextM)}-${pad2(nextEnd)}`;
        cycleStartISO = `${y}-${pad2(m)}-${pad2(endDay)}`;
      }
      return {
        paydayISO,
        daysLeft: Math.max(1, daysBetweenISO(today, paydayISO)),
        isPaydayToday,
        customExpired: false,
        effectiveMode: 'monthly-30',
        cycleStartISO
      };
    }

    // Default 'bimonthly': 15th & 30th (or Feb 28/29)
    const isPaydayToday = d === 15 || d === endDay;
    let paydayISO, cycleStartISO;
    if (d < 15) {
      paydayISO = `${y}-${pad2(m)}-15`;
      const prevM = m === 1 ? 12 : m - 1;
      const prevY = m === 1 ? y - 1 : y;
      const prevEnd = Math.min(30, daysInMonth(prevY, prevM));
      cycleStartISO = `${prevY}-${pad2(prevM)}-${pad2(prevEnd)}`;
    } else if (d < endDay) {
      paydayISO = `${y}-${pad2(m)}-${pad2(endDay)}`;
      cycleStartISO = `${y}-${pad2(m)}-15`;
    } else {
      const nextM = m === 12 ? 1 : m + 1;
      const nextY = m === 12 ? y + 1 : y;
      paydayISO = `${nextY}-${pad2(nextM)}-15`;
      cycleStartISO = `${y}-${pad2(m)}-${pad2(endDay)}`;
    }

    return {
      paydayISO,
      daysLeft: Math.max(1, daysBetweenISO(today, paydayISO)),
      isPaydayToday,
      customExpired: false,
      effectiveMode: 'bimonthly',
      cycleStartISO
    };
  }

  function computeNextPayday(baseISO, mode = 'bimonthly', customDate = '') {
    return computePaydayState(baseISO, mode, customDate).paydayISO;
  }

  function paydayModeLabel(mode) {
    if (mode === 'monthly-15') return 'Every 15th of the month';
    if (mode === 'monthly-30') return 'Every 30th / end of month';
    if (mode === 'custom') return 'Custom target date';
    return '15th & 30th (Bi-monthly)';
  }

  function isAdjustmentEntry(tx) {
    return Boolean(tx && (tx.src === 'reconcile' || tx.s === 'Balance correction'));
  }

  function computeRunwaySummary({
    wallets = [],
    bills = [],
    transactions = [],
    today = todayISO(),
    paydayMode = 'bimonthly',
    customPayday = ''
  } = {}) {
    const payday = computePaydayState(today, paydayMode, customPayday);
    const totalBalance = Money.sumMoney(wallets, w => w.b);
    const positiveWalletTotal = Money.sumMoney(wallets, w => (Money.toCents(w.b) > 0 ? w.b : 0));
    const reservedBills = Money.sumMoney(bills, b => b.a);
    const netAfterBills = Money.subMoney(totalBalance, reservedBills);
    const billShortfall = Money.toCents(netAfterBills) < 0 ? Money.roundMoney(Math.abs(netAfterBills)) : 0;
    const safeToSpend = Money.toCents(netAfterBills) > 0 ? netAfterBills : 0;
    const dailyAllowance = Money.divMoneyFloor(safeToSpend, payday.daysLeft);

    // Discretionary spending recorded today (excluding balance corrections & settled reserved bills)
    const spentToday = Money.sumMoney(
      transactions.filter(t => {
        if (!t || Money.toCents(t.a) >= 0 || isAdjustmentEntry(t)) return false;
        if (t.src === 'bill' || /\(Bill paid\)$/i.test(String(t.s || ''))) return false;
        return normalizeEntryDate(t.d, today) === today;
      }),
      t => Math.abs(t.a)
    );
    const remainingToday = Money.subMoney(dailyAllowance, spentToday);

    let status = 'healthy';
    if (Money.toCents(billShortfall) > 0) status = 'shortfall';
    else if (Money.toCents(safeToSpend) === 0 && (wallets.length > 0 || bills.length > 0)) status = 'depleted';
    else if (Money.toCents(remainingToday) < 0 && Money.toCents(dailyAllowance) > 0) status = 'over-daily';

    return {
      ...payday,
      totalBalance,
      positiveWalletTotal,
      reservedBills,
      netAfterBills,
      billShortfall,
      safeToSpend,
      dailyAllowance,
      spentToday,
      remainingToday,
      status
    };
  }

  /* ---------- 3. Merchant Normalization, Categorization & Dedup ---------- */
  const MERCHANT_RULES = [
    { re: /\bjollibee\b/i, name: 'Jollibee', cat: 'Food' },
    { re: /\b(?:mcdonald'?s|mcdo)\b/i, name: "McDonald's", cat: 'Food' },
    { re: /\b7[- ]?eleven\b|\b711\b/i, name: '7-Eleven', cat: 'Food' },
    { re: /\bstarbucks\b/i, name: 'Starbucks', cat: 'Food' },
    { re: /\bchowking\b/i, name: 'Chowking', cat: 'Food' },
    { re: /\bmang inasal\b/i, name: 'Mang Inasal', cat: 'Food' },
    { re: /\bgrab\s*food\b|\bfoodpanda\b/i, name: null, cat: 'Food' },
    { re: /\b(?:coffee|cafe|bakery|milk\s?tea|restaurant|resto|diner|eatery|chicken)\b/i, name: null, cat: 'Food' },
    { re: /\bgrab\b/i, name: 'Grab', cat: 'Transport' },
    { re: /\bangkas\b/i, name: 'Angkas', cat: 'Transport' },
    { re: /\bjoyride\b/i, name: 'JoyRide', cat: 'Transport' },
    { re: /\b(?:move\s?it|beep|mrt|lrt|autosweep|easytrip|petron|shell|caltex|jeep|bus|tricycle|taxi)\b/i, name: null, cat: 'Transport' },
    { re: /\b(?:globe|smart|dito|gomo|tnt|tm)\b.*\bload\b|\b(?:data|prepaid|promo)\s*load\b|^\s*load\s*$/i, name: null, cat: 'Load' },
    { re: /\bmeralco\b/i, name: 'Meralco', cat: 'Bills' },
    { re: /\bconverge\b/i, name: 'Converge ICT', cat: 'Bills' },
    { re: /\bpldt\b/i, name: 'PLDT Home', cat: 'Bills' },
    { re: /\bmaynilad\b/i, name: 'Maynilad', cat: 'Bills' },
    { re: /\bmanila water\b/i, name: 'Manila Water', cat: 'Bills' },
    { re: /\bnetflix(?:\.com)?\b/i, name: 'Netflix', cat: 'Bills' },
    { re: /\bspotify\b/i, name: 'Spotify', cat: 'Bills' },
    { re: /\b(?:wi-?fi|electric|electricity|water bill|internet|rent|postpaid|insurance)\b/i, name: null, cat: 'Bills' },
    { re: /\b(?:salary|payroll|stipend|allowance|dividend|freelance|bonus)\b/i, name: null, cat: 'Income' }
  ];

  function normalizeMerchant(raw) {
    const cleaned = String(raw ?? '')
      .replace(/\s+/g, ' ')
      .replace(/\s+(?:Ref\.?|Reference|Trace)\s*[:#-]?\s*[\w-]+.*$/i, '')
      .replace(/^[\s.,:;-]+|[\s,:;-]+$/g, '')
      .trim();
    if (!cleaned) return '';
    for (const rule of MERCHANT_RULES) {
      if (rule.name && rule.re.test(cleaned) && cleaned.length <= rule.name.length + 6) {
        return rule.name;
      }
    }
    return cleaned;
  }

  function inferCategory(text, direction = -1, existingTransactions = []) {
    if (Number(direction) > 0) return 'Income';
    const probe = String(text ?? '').trim();
    if (!probe) return 'Others';

    // 1. Check user's own previous categorizations for the same merchant
    const normLower = normalizeMerchant(probe).toLowerCase();
    if (normLower && Array.isArray(existingTransactions)) {
      const prior = existingTransactions.find(t =>
        t &&
        Money.toCents(t.a) < 0 &&
        !isAdjustmentEntry(t) &&
        CATEGORIES.includes(t.c) &&
        t.c !== 'Income' &&
        String(t.s || '').trim().toLowerCase() === normLower
      );
      if (prior) return prior.c;
    }

    // 2. Match curated Philippine merchant & keyword heuristics
    for (const rule of MERCHANT_RULES) {
      if (rule.cat !== 'Income' && rule.re.test(probe)) return rule.cat;
    }
    if (/\b(?:globe|smart|dito|gomo)\b/i.test(probe)) return 'Load';
    return 'Others';
  }

  function sortTransactions(list, referenceISO = todayISO()) {
    return [...(list || [])].sort((a, b) => {
      const da = normalizeEntryDate(a.d, referenceISO);
      const db = normalizeEntryDate(b.d, referenceISO);
      if (da !== db) return db.localeCompare(da);
      return (Number(b.id) || 0) - (Number(a.id) || 0);
    });
  }

  function findDuplicateTransaction(candidate, existingTransactions = [], referenceISO = todayISO()) {
    if (!candidate || !Array.isArray(existingTransactions)) return null;
    const candRef = String(candidate.ref || '').trim().replace(/\s+/g, '').toUpperCase();
    const candCents = Money.toCents(candidate.signedAmount ?? candidate.a);
    const candDate = normalizeEntryDate(candidate.date ?? candidate.d, referenceISO);
    const candMerch = normalizeMerchant(candidate.merchant ?? candidate.s).toLowerCase();
    const candWid = Number(candidate.walletId ?? candidate.w);

    for (const tx of existingTransactions) {
      if (!tx) continue;
      if (candidate.ignoreId && Number(tx.id) === Number(candidate.ignoreId)) continue;
      const txRef = String(tx.ref || '').trim().replace(/\s+/g, '').toUpperCase();
      if (candRef && candRef.length >= 4 && txRef && candRef === txRef) {
        return { reason: 'reference', tx };
      }
      if (
        Money.toCents(tx.a) === candCents &&
        normalizeEntryDate(tx.d, referenceISO) === candDate &&
        normalizeMerchant(tx.s).toLowerCase() === candMerch &&
        (!candWid || Number(tx.w) === candWid)
      ) {
        return { reason: 'details', tx };
      }
    }
    return null;
  }

  /* ---------- 4. Atomic Ledger, Wallet & Bill Domain Operations ---------- */
  function cloneWorkspaceSlice(state) {
    return {
      w: (state.w || []).map(w => ({ ...w })),
      t: (state.t || []).map(t => ({ ...t })),
      b: (state.b || []).map(b => ({ ...b })),
      budgets: { ...(state.budgets || {}) },
      n: Number(state.n) || 20
    };
  }

  function recordTransaction(state, {
    walletId,
    amount,
    direction = -1,
    merchant = '',
    category = 'Others',
    date = todayISO(),
    note = '',
    src = 'manual',
    ref = ''
  }) {
    const errors = {};
    const parsedAmt = Money.parseMoneyInput(amount, { allowZero: false, allowNegative: false, label: 'Amount' });
    if (!parsedAmt.ok) errors.am = parsedAmt.error;

    const wid = Number(walletId);
    const next = cloneWorkspaceSlice(state);
    const wallet = next.w.find(w => Number(w.id) === wid);
    if (!wallet) {
      errors.mw = next.w.length ? 'Select a valid wallet.' : 'Add a wallet first before recording an entry.';
    }
    const dir = Number(direction) >= 0 ? 1 : -1;
    const cleanDate = String(date || todayISO()).trim();
    if (!isValidISODate(cleanDate)) {
      errors.td = 'Enter a valid calendar date (YYYY-MM-DD).';
    }
    if (Object.keys(errors).length) return { ok: false, errors };

    const signedAmt = dir > 0 ? parsedAmt.value : -parsedAmt.value;
    const cleanCat = CATEGORIES.includes(category) ? category : (dir > 0 ? 'Income' : 'Others');
    const cleanLabel = normalizeMerchant(merchant) || (dir > 0 ? 'Income' : 'Expense');
    const entry = {
      id: ++next.n,
      d: cleanDate,
      s: cleanLabel,
      c: cleanCat,
      w: wallet.id,
      walletLabel: wallet.n,
      a: signedAmt,
      note: String(note || '').trim(),
      src: src || 'manual',
      ref: String(ref || '').trim()
    };

    wallet.b = Money.addMoney(wallet.b, signedAmt);
    next.t = sortTransactions([entry, ...next.t], todayISO());
    return { ok: true, state: { ...state, ...next }, entry };
  }

  function updateTransaction(state, txId, {
    walletId,
    amount,
    direction = -1,
    merchant = '',
    category = 'Others',
    date = todayISO(),
    note = ''
  }) {
    const errors = {};
    const parsedAmt = Money.parseMoneyInput(amount, { allowZero: false, allowNegative: false, label: 'Amount' });
    if (!parsedAmt.ok) errors.am = parsedAmt.error;

    const next = cloneWorkspaceSlice(state);
    const existing = next.t.find(x => Number(x.id) === Number(txId));
    if (!existing) return { ok: false, errors: { am: 'Transaction no longer exists.' } };

    const newWid = Number(walletId);
    const newWallet = next.w.find(w => Number(w.id) === newWid);
    if (!newWallet) errors.mw = 'Select a valid destination wallet.';

    const cleanDate = String(date || '').trim();
    if (!isValidISODate(cleanDate)) errors.td = 'Enter a valid calendar date (YYYY-MM-DD).';

    if (Object.keys(errors).length) return { ok: false, errors };

    const dir = Number(direction) >= 0 ? 1 : -1;
    const signedAmt = dir > 0 ? parsedAmt.value : -parsedAmt.value;
    const cleanCat = CATEGORIES.includes(category) ? category : (dir > 0 ? 'Income' : 'Others');
    const cleanLabel = normalizeMerchant(merchant) || (dir > 0 ? 'Income' : 'Expense');

    // Atomically reverse old wallet impact and apply new wallet impact
    const oldWallet = next.w.find(w => Number(w.id) === Number(existing.w));
    if (oldWallet) {
      oldWallet.b = Money.subMoney(oldWallet.b, existing.a);
    }
    newWallet.b = Money.addMoney(newWallet.b, signedAmt);

    Object.assign(existing, {
      w: newWallet.id,
      walletLabel: newWallet.n,
      a: signedAmt,
      s: cleanLabel,
      c: cleanCat,
      d: cleanDate,
      note: String(note ?? existing.note ?? '').trim()
    });
    next.t = sortTransactions(next.t, todayISO());
    return { ok: true, state: { ...state, ...next }, entry: existing };
  }

  function removeTransaction(state, txId) {
    const next = cloneWorkspaceSlice(state);
    const target = next.t.find(x => Number(x.id) === Number(txId));
    if (!target) return { ok: false, errors: { id: 'Entry not found.' } };

    const wallet = next.w.find(w => Number(w.id) === Number(target.w));
    if (wallet) {
      wallet.b = Money.subMoney(wallet.b, target.a);
    }
    next.t = next.t.filter(x => Number(x.id) !== Number(txId));
    return { ok: true, state: { ...state, ...next }, removed: target };
  }

  function reconcileWallet(state, walletId, realBalanceInput, today = todayISO()) {
    const parsed = Money.parseMoneyInput(realBalanceInput, {
      allowZero: true,
      allowNegative: true,
      label: 'Balance'
    });
    if (!parsed.ok) return { ok: false, errors: { rb: parsed.error } };

    const next = cloneWorkspaceSlice(state);
    const wallet = next.w.find(w => Number(w.id) === Number(walletId));
    if (!wallet) return { ok: false, errors: { rb: 'Wallet not found.' } };

    const previousBalance = Money.roundMoney(wallet.b);
    const diff = Money.subMoney(parsed.value, previousBalance);
    if (Money.toCents(diff) === 0) {
      return { ok: true, state: { ...state, ...next }, entry: null, diff: 0 };
    }

    const entry = {
      id: ++next.n,
      d: isValidISODate(today) ? today : todayISO(),
      s: 'Balance correction',
      c: 'Others',
      w: wallet.id,
      walletLabel: wallet.n,
      a: diff,
      note: `Adjusted ${wallet.n} from ${Money.peso(previousBalance)} to ${Money.peso(parsed.value)}`,
      src: 'reconcile',
      ref: ''
    };
    wallet.b = parsed.value;
    next.t = sortTransactions([entry, ...next.t], today);
    return { ok: true, state: { ...state, ...next }, entry, diff };
  }

  function removeWallet(state, walletId, { purgeTransactions = false } = {}) {
    const next = cloneWorkspaceSlice(state);
    const wallet = next.w.find(w => Number(w.id) === Number(walletId));
    if (!wallet) return { ok: false, errors: { id: 'Wallet not found.' } };

    next.w = next.w.filter(w => Number(w.id) !== Number(walletId));
    if (purgeTransactions) {
      next.t = next.t.filter(t => Number(t.w) !== Number(walletId));
    } else {
      next.t = next.t.map(t => (
        Number(t.w) === Number(walletId)
          ? { ...t, walletLabel: t.walletLabel || wallet.n }
          : t
      ));
    }
    return { ok: true, state: { ...state, ...next }, removed: wallet };
  }

  /* ---------- 5. Bills: Due Parsing, Serialization & Atomic Settlement ---------- */
  function serializeBillDueLabel(bill) {
    const freq = BILL_FREQUENCIES.includes(bill.freq) ? bill.freq : 'once';
    const dueDate = isValidISODate(bill.dueDate) ? bill.dueDate : '';
    const baseLabel = String(bill.d || '').trim() || (dueDate ? formatShortDate(dueDate) : 'Before payday');
    if (!dueDate && freq === 'once') return baseLabel;
    const baseAmt = Money.toCents(bill.baseAmount) > 0 ? Money.roundMoney(bill.baseAmount) : Money.roundMoney(bill.a);
    return `${dueDate || baseLabel}::${freq}::${baseAmt}`;
  }

  function hydrateBillRecord(rawBill, referenceISO = todayISO()) {
    const rawLabel = String(rawBill.due_label ?? rawBill.d ?? 'Before payday').trim();
    let dueDate = isValidISODate(rawBill.dueDate) ? rawBill.dueDate : '';
    let freq = BILL_FREQUENCIES.includes(rawBill.freq) ? rawBill.freq : 'once';
    let baseAmount = Money.roundMoney(rawBill.baseAmount ?? rawBill.a ?? rawBill.amount ?? 0);
    let displayLabel = rawLabel;

    if (rawLabel.includes('::')) {
      const [partDate, partFreq, partBase] = rawLabel.split('::');
      if (isValidISODate(partDate)) {
        dueDate = partDate;
        displayLabel = formatShortDate(partDate, referenceISO);
      } else {
        displayLabel = partDate || 'Before payday';
      }
      if (BILL_FREQUENCIES.includes(partFreq)) freq = partFreq;
      if (partBase && Number.isFinite(Number(partBase)) && Number(partBase) > 0) {
        baseAmount = Money.roundMoney(Number(partBase));
      }
    } else if (isValidISODate(rawLabel)) {
      dueDate = rawLabel;
      displayLabel = formatShortDate(rawLabel, referenceISO);
    } else if (/^\d{2}-\d{2}$/.test(rawLabel)) {
      dueDate = normalizeEntryDate(rawLabel, referenceISO);
      displayLabel = formatShortDate(dueDate, referenceISO);
    }

    const amount = Money.roundMoney(rawBill.a ?? rawBill.amount ?? 0);
    return {
      id: rawBill.id ?? rawBill.client_id,
      n: String(rawBill.n ?? rawBill.name ?? 'Bill').trim(),
      a: amount,
      baseAmount: Money.toCents(baseAmount) > 0 ? baseAmount : amount,
      dueDate,
      freq,
      d: dueDate ? formatShortDate(dueDate, referenceISO) : (displayLabel || 'Before payday')
    };
  }

  function upsertBill(state, {
    billId = 0,
    name = '',
    amount = '',
    dueDate = '',
    dueText = '',
    freq = 'once'
  }, today = todayISO()) {
    const errors = {};
    const cleanName = String(name ?? '').trim();
    if (!cleanName) errors.bn = 'Name the bill.';
    const parsedAmt = Money.parseMoneyInput(amount, { allowZero: false, allowNegative: false, label: 'Bill amount' });
    if (!parsedAmt.ok) errors.ba = parsedAmt.error;

    const cleanDue = String(dueDate ?? '').trim();
    if (cleanDue && !isValidISODate(cleanDue)) {
      errors.bd = 'Pick a valid due date or leave it blank.';
    }
    if (Object.keys(errors).length) return { ok: false, errors };

    const next = cloneWorkspaceSlice(state);
    const cleanFreq = BILL_FREQUENCIES.includes(freq) ? freq : 'once';
    const label = cleanDue ? formatShortDate(cleanDue, today) : (String(dueText || '').trim() || 'Before payday');

    if (billId) {
      const existing = next.b.find(b => Number(b.id) === Number(billId));
      if (!existing) return { ok: false, errors: { bn: 'Bill not found.' } };
      Object.assign(existing, {
        n: cleanName,
        a: parsedAmt.value,
        baseAmount: parsedAmt.value,
        dueDate: cleanDue,
        freq: cleanFreq,
        d: label
      });
      return { ok: true, state: { ...state, ...next }, bill: existing };
    }

    const created = {
      id: ++next.n,
      n: cleanName,
      a: parsedAmt.value,
      baseAmount: parsedAmt.value,
      dueDate: cleanDue,
      freq: cleanFreq,
      d: label
    };
    next.b.push(created);
    return { ok: true, state: { ...state, ...next }, bill: created };
  }

  function advanceRecurringDueDate(dueDate, freq, today = todayISO()) {
    const base = isValidISODate(dueDate) ? dueDate : today;
    if (freq === 'monthly') return shiftMonthsISO(base, 1);
    if (freq === 'bimonthly') return shiftDaysISO(base, 15);
    return base;
  }

  function settleBill(state, { billId, walletId, paymentAmount }, today = todayISO()) {
    const next = cloneWorkspaceSlice(state);
    const bill = next.b.find(b => Number(b.id) === Number(billId));
    if (!bill) return { ok: false, errors: { pa: 'This bill was already settled or removed.' } };

    const wallet = next.w.find(w => Number(w.id) === Number(walletId));
    if (!wallet) {
      return {
        ok: false,
        errors: { pw: next.w.length ? 'Choose a valid wallet to pay from.' : 'Add a wallet before paying a bill.' }
      };
    }

    const parsedAmt = Money.parseMoneyInput(paymentAmount, {
      allowZero: false,
      allowNegative: false,
      label: 'Payment amount'
    });
    if (!parsedAmt.ok) return { ok: false, errors: { pa: parsedAmt.error } };

    const payCents = parsedAmt.cents;
    const billCents = Money.toCents(bill.a);
    const isPartial = payCents < billCents;

    // 1. Record the ledger payment entry and update wallet balance first
    const entry = {
      id: ++next.n,
      d: isValidISODate(today) ? today : todayISO(),
      s: isPartial ? `${bill.n} (Partial bill payment)` : `${bill.n} (Bill paid)`,
      c: 'Bills',
      w: wallet.id,
      walletLabel: wallet.n,
      a: -parsedAmt.value,
      note: isPartial
        ? `Paid ${Money.peso(parsedAmt.value)} of ${Money.peso(bill.a)} reserved`
        : `Settled ${bill.n}`,
      src: 'bill',
      ref: `BILL-${bill.id}-${today}-${next.n}`
    };
    wallet.b = Money.subMoney(wallet.b, parsedAmt.value);
    next.t = sortTransactions([entry, ...next.t], today);

    // 2. Adjust, roll forward, or clear the bill
    let outcome = 'settled';
    if (isPartial) {
      bill.a = Money.subMoney(bill.a, parsedAmt.value);
      outcome = 'partial';
    } else if (bill.freq === 'monthly' || bill.freq === 'bimonthly') {
      const nextDue = advanceRecurringDueDate(bill.dueDate || today, bill.freq, today);
      bill.dueDate = nextDue;
      bill.d = formatShortDate(nextDue, today);
      bill.a = Money.toCents(bill.baseAmount) > 0 ? Money.roundMoney(bill.baseAmount) : parsedAmt.value;
      outcome = 'rolled';
    } else {
      next.b = next.b.filter(b => Number(b.id) !== Number(bill.id));
      outcome = 'settled';
    }

    return { ok: true, state: { ...state, ...next }, entry, outcome };
  }

  /* ---------- 6. Insights & Period Filtering ---------- */
  function filterTransactionsByPeriod(transactions, period = 'cycle', {
    today = todayISO(),
    paydayMode = 'bimonthly',
    customPayday = ''
  } = {}) {
    const all = sortTransactions(transactions || [], today);
    if (period === 'all') return all;
    if (period === 'month') {
      const ym = today.slice(0, 7);
      return all.filter(t => normalizeEntryDate(t.d, today).slice(0, 7) === ym);
    }
    if (period === '30d') {
      const start = shiftDaysISO(today, -29);
      return all.filter(t => {
        const d = normalizeEntryDate(t.d, today);
        return d >= start && d <= shiftDaysISO(today, 365);
      });
    }
    // Default 'cycle': entries since current payday cycle start
    const { cycleStartISO } = computePaydayState(today, paydayMode, customPayday);
    return all.filter(t => normalizeEntryDate(t.d, today) >= cycleStartISO);
  }

  function computeInsightsSummary(transactions, wallets = [], budgets = {}, options = {}) {
    const today = options.today || todayISO();
    const period = options.period || 'cycle';
    const scoped = filterTransactionsByPeriod(transactions, period, options);

    const byCategoryCents = {};
    let incomeCents = 0;
    let expenseCents = 0;
    const expenses = [];

    for (const t of scoped) {
      if (!t || isAdjustmentEntry(t)) continue;
      const c = Money.toCents(t.a);
      if (c > 0) {
        incomeCents += c;
      } else if (c < 0) {
        const abs = Math.abs(c);
        expenseCents += abs;
        const cat = CATEGORIES.includes(t.c) ? t.c : 'Others';
        byCategoryCents[cat] = (byCategoryCents[cat] || 0) + abs;
        expenses.push(t);
      }
    }

    const totalIn = Money.fromCents(incomeCents);
    const totalOut = Money.fromCents(expenseCents);
    const netCashflow = Money.fromCents(incomeCents - expenseCents);
    const categories = Object.entries(byCategoryCents)
      .map(([cat, cents]) => {
        const spent = Money.fromCents(cents);
        const cap = Money.roundMoney(budgets?.[cat] || 0);
        const capPct = Money.toCents(cap) > 0 ? Math.round((cents / Money.toCents(cap)) * 100) : null;
        return {
          category: cat,
          spent,
          sharePct: expenseCents > 0 ? Math.round((cents / expenseCents) * 100) : 0,
          budgetCap: cap,
          budgetPct: capPct
        };
      })
      .sort((a, b) => Money.toCents(b.spent) - Money.toCents(a.spent));

    const largestExpenses = [...expenses]
      .sort((a, b) => Math.abs(Money.toCents(b.a)) - Math.abs(Money.toCents(a.a)))
      .slice(0, 5);

    const posWalletSum = Money.sumMoney(wallets, w => (Money.toCents(w.b) > 0 ? w.b : 0));
    const walletDistribution = (wallets || []).map(w => ({
      id: w.id,
      name: w.n,
      style: w.style,
      balance: Money.roundMoney(w.b),
      sharePct: Money.pctShare(Money.toCents(w.b) > 0 ? w.b : 0, posWalletSum)
    }));

    return {
      period,
      entryCount: scoped.length,
      totalIn,
      totalOut,
      netCashflow,
      spendRatioPct: incomeCents > 0 ? Math.round((expenseCents / incomeCents) * 100) : null,
      topCategory: categories[0] || null,
      categories,
      largestExpenses,
      walletDistribution
    };
  }

  /* ---------- 7. Data Portability (CSV Export & Validated Backup) ---------- */
  function csvCell(value) {
    let s = String(value ?? '');
    // Prevent spreadsheet formula injection while preserving negative numbers
    if (/^[=+@\t\r]/.test(s) || (/^-[^0-9]/.test(s))) {
      s = `'${s}`;
    }
    if (/[",\r\n]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  function exportTransactionsCSV(transactions = [], wallets = [], referenceISO = todayISO()) {
    const walletMap = new Map((wallets || []).map(w => [Number(w.id), w.n]));
    const header = ['Date', 'Merchant', 'Category', 'Wallet', 'Type', 'Amount (PHP)', 'Source', 'Reference', 'Note'];
    const sorted = sortTransactions(transactions, referenceISO);
    const lines = [header.join(',')];

    for (const t of sorted) {
      const iso = normalizeEntryDate(t.d, referenceISO);
      const cents = Money.toCents(t.a);
      const type = isAdjustmentEntry(t) ? 'Adjustment' : (cents >= 0 ? 'Income' : 'Expense');
      const walletLabel = walletMap.get(Number(t.w)) || t.walletLabel || 'Archived wallet';
      const amtStr = Money.fromCents(cents).toFixed(2);
      lines.push([
        csvCell(iso),
        csvCell(t.s || ''),
        csvCell(t.c || 'Others'),
        csvCell(walletLabel),
        csvCell(type),
        csvCell(amtStr),
        csvCell(t.src || 'manual'),
        csvCell(t.ref || ''),
        csvCell(t.note || '')
      ].join(','));
    }
    return '\uFEFF' + lines.join('\r\n');
  }

  function createWorkspaceBackup(accountRecord) {
    return {
      schema: 'onewallet-backup-v1',
      exportedAt: new Date().toISOString(),
      account: {
        fullName: String(accountRecord.fullName || 'One Wallet User'),
        email: String(accountRecord.email || ''),
        paydayMode: accountRecord.paydayMode || 'bimonthly',
        customPayday: accountRecord.customPayday || '',
        budgets: { ...(accountRecord.budgets || {}) },
        w: (accountRecord.w || []).map(w => ({
          id: Number(w.id),
          n: String(w.n || 'Wallet'),
          b: Money.roundMoney(w.b),
          style: String(w.style || 'gcash'),
          last4: String(w.last4 || ''),
          hasCard: Boolean(w.hasCard),
          encrypted_card_vault: String(w.encrypted_card_vault || '')
        })),
        t: sortTransactions(accountRecord.t || []).map(t => ({
          id: Number(t.id),
          d: normalizeEntryDate(t.d),
          s: String(t.s || 'Entry'),
          c: CATEGORIES.includes(t.c) ? t.c : 'Others',
          w: Number(t.w),
          walletLabel: String(t.walletLabel || ''),
          a: Money.roundMoney(t.a),
          note: String(t.note || ''),
          src: String(t.src || 'manual'),
          ref: String(t.ref || '')
        })),
        b: (accountRecord.b || []).map(b => hydrateBillRecord(b))
      }
    };
  }

  function validateWorkspaceBackup(rawJson) {
    let parsed = rawJson;
    if (typeof rawJson === 'string') {
      try {
        parsed = JSON.parse(rawJson);
      } catch (e) {
        return { ok: false, error: 'Selected file is not valid JSON.' };
      }
    }
    if (!parsed || typeof parsed !== 'object' || parsed.schema !== 'onewallet-backup-v1' || !parsed.account) {
      return { ok: false, error: 'Unrecognized backup format. Expected a One Wallet backup (.json).' };
    }
    const acc = parsed.account;
    if (!Array.isArray(acc.w) || !Array.isArray(acc.t) || !Array.isArray(acc.b)) {
      return { ok: false, error: 'Backup file is incomplete (missing wallets, ledger, or bills arrays).' };
    }
    const wallets = acc.w.map((w, idx) => ({
      id: Number(w.id) || (idx + 1),
      n: String(w.n || `Wallet ${idx + 1}`).trim().slice(0, 60),
      b: Money.roundMoney(w.b),
      style: String(w.style || 'gcash'),
      last4: String(w.last4 || '').replace(/\D/g, '').slice(-4),
      hasCard: Boolean(w.hasCard),
      encrypted_card_vault: typeof w.encrypted_card_vault === 'string' ? w.encrypted_card_vault : ''
    }));
    const transactions = sortTransactions(acc.t.map((t, idx) => ({
      id: Number(t.id) || (idx + 100),
      d: normalizeEntryDate(t.d),
      s: String(t.s || 'Entry').trim().slice(0, 120),
      c: CATEGORIES.includes(t.c) ? t.c : 'Others',
      w: Number(t.w) || (wallets[0]?.id ?? 0),
      walletLabel: String(t.walletLabel || ''),
      a: Money.roundMoney(t.a),
      note: String(t.note || '').trim().slice(0, 240),
      src: String(t.src || 'manual'),
      ref: String(t.ref || '').trim().slice(0, 64)
    })));
    const bills = acc.b.map((b, idx) => hydrateBillRecord({ ...b, id: Number(b.id) || (idx + 500) }));
    const budgets = {};
    if (acc.budgets && typeof acc.budgets === 'object') {
      for (const [k, v] of Object.entries(acc.budgets)) {
        if (CATEGORIES.includes(k) && Money.toCents(v) > 0) budgets[k] = Money.roundMoney(v);
      }
    }
    const maxId = Math.max(
      20,
      ...wallets.map(x => x.id || 0),
      ...transactions.map(x => x.id || 0),
      ...bills.map(x => x.id || 0)
    );
    return {
      ok: true,
      data: {
        paydayMode: ['bimonthly', 'monthly-15', 'monthly-30', 'custom'].includes(acc.paydayMode) ? acc.paydayMode : 'bimonthly',
        customPayday: isValidISODate(acc.customPayday) ? acc.customPayday : '',
        budgets,
        w: wallets,
        t: transactions,
        b: bills,
        n: maxId + 1
      }
    };
  }

  const OWDomain = {
    CATEGORIES,
    MONTHS,
    BILL_FREQUENCIES,
    daysInMonth,
    isValidISODate,
    toISODate,
    todayISO,
    shiftDaysISO,
    shiftMonthsISO,
    daysBetweenISO,
    normalizeEntryDate,
    formatShortDate,
    formatDayHeading,
    computePaydayState,
    computeNextPayday,
    paydayModeLabel,
    isAdjustmentEntry,
    computeRunwaySummary,
    normalizeMerchant,
    inferCategory,
    sortTransactions,
    findDuplicateTransaction,
    recordTransaction,
    updateTransaction,
    removeTransaction,
    reconcileWallet,
    removeWallet,
    serializeBillDueLabel,
    hydrateBillRecord,
    upsertBill,
    settleBill,
    filterTransactionsByPeriod,
    computeInsightsSummary,
    exportTransactionsCSV,
    createWorkspaceBackup,
    validateWorkspaceBackup
  };

  global.OWDomain = OWDomain;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OWDomain;
  }
})(typeof window !== 'undefined' ? window : globalThis);
