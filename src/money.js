/* ============================================================================
 * One Wallet · Integer-Centavo Monetary Arithmetic & Input Validation
 * Eliminates IEEE-754 floating-point drift across balances, ledger, bills,
 * reconciliations, runway calculations, and financial summaries.
 * ============================================================================ */
(function (global) {
  'use strict';

  const MAX_AMOUNT_CENTS = 99999999999; // ₱999,999,999.99

  /**
   * Convert a numeric or currency-formatted value to exact integer centavos.
   * Uses EPSILON-nudged magnitude rounding so 19.99 * 100 -> 1999 reliably.
   */
  function toCents(value) {
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return 0;
      const sign = value < 0 ? -1 : 1;
      return sign * Math.round((Math.abs(value) + Number.EPSILON) * 100);
    }
    if (typeof value === 'string') {
      const cleaned = value.replace(/[₱,\s]/g, '').replace(/^PHP/i, '').trim();
      if (!cleaned) return 0;
      const num = Number(cleaned);
      if (!Number.isFinite(num)) return 0;
      const sign = num < 0 ? -1 : 1;
      return sign * Math.round((Math.abs(num) + Number.EPSILON) * 100);
    }
    return 0;
  }

  /**
   * Convert integer centavos back to a normalized 2-decimal JavaScript Number.
   */
  function fromCents(cents) {
    if (!Number.isFinite(cents)) return 0;
    const rounded = Math.round(cents);
    if (rounded === 0) return 0; // Avoid -0
    return Number((rounded / 100).toFixed(2));
  }

  function roundMoney(value) {
    return fromCents(toCents(value));
  }

  function addMoney(a, b) {
    return fromCents(toCents(a) + toCents(b));
  }

  function subMoney(a, b) {
    return fromCents(toCents(a) - toCents(b));
  }

  function sumMoney(items, selector = x => x) {
    if (!Array.isArray(items) || !items.length) return 0;
    let totalCents = 0;
    for (let i = 0; i < items.length; i++) {
      totalCents += toCents(selector(items[i], i));
    }
    return fromCents(totalCents);
  }

  /**
   * Conservative division in centavos (floors positive results so daily
   * allowance * days never exceeds available safe-to-spend funds).
   */
  function divMoneyFloor(amount, divisor) {
    const d = Number(divisor);
    if (!Number.isFinite(d) || d <= 0) return 0;
    const cents = toCents(amount);
    if (cents <= 0) return 0;
    return fromCents(Math.floor(cents / d));
  }

  /**
   * Strictly validate user-entered monetary text (up to 2 decimal places).
   */
  function parseMoneyInput(raw, {
    allowBlank = false,
    blankValue = 0,
    allowZero = false,
    allowNegative = false,
    label = 'Amount'
  } = {}) {
    const str = String(raw ?? '').replace(/[₱,\s]/g, '').replace(/^PHP/i, '').trim();
    if (!str) {
      if (allowBlank) return { ok: true, value: roundMoney(blankValue), cents: toCents(blankValue) };
      return { ok: false, error: `Enter a valid ${label.toLowerCase()}.` };
    }
    if (!/^-?\d+(?:\.\d{1,2})?$/.test(str)) {
      if (/^-?\d+\.\d{3,}$/.test(str)) {
        return { ok: false, error: `${label} can have at most 2 decimal places (centavos).` };
      }
      return { ok: false, error: `Enter a valid numeric ${label.toLowerCase()}.` };
    }
    const num = Number(str);
    if (!Number.isFinite(num)) {
      return { ok: false, error: `Enter a finite ${label.toLowerCase()}.` };
    }
    const cents = toCents(num);
    if (Math.abs(cents) > MAX_AMOUNT_CENTS) {
      return { ok: false, error: `${label} exceeds the maximum supported balance.` };
    }
    if (!allowNegative && cents < 0) {
      return { ok: false, error: `${label} cannot be negative.` };
    }
    if (!allowZero && cents === 0) {
      return { ok: false, error: `Enter ${label.toLowerCase() === 'amount' ? 'an amount' : 'a value'} greater than ₱0.00.` };
    }
    return { ok: true, value: fromCents(cents), cents };
  }

  function peso(n) {
    const abs = Math.abs(fromCents(toCents(n)));
    return '₱' + abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function signed(n, { neutralZero = false } = {}) {
    const cents = toCents(n);
    if (cents === 0 && neutralZero) return peso(0);
    return (cents < 0 ? '− ' : '+ ') + peso(fromCents(cents));
  }

  function pctShare(part, whole) {
    const w = toCents(whole);
    const p = toCents(part);
    if (w <= 0 || p <= 0) return 0;
    return Math.min(100, Math.round((p / w) * 100));
  }

  const OWMoney = {
    MAX_AMOUNT_CENTS,
    toCents,
    fromCents,
    roundMoney,
    addMoney,
    subMoney,
    sumMoney,
    divMoneyFloor,
    parseMoneyInput,
    peso,
    signed,
    pctShare
  };

  global.OWMoney = OWMoney;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OWMoney;
  }
})(typeof window !== 'undefined' ? window : globalThis);
