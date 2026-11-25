/* ============================================================================
 * One Wallet · Philippine Payment SMS & Notification Parser
 * Supports GCash, Maya, GoTyme, BDO, BPI, UnionBank, InstaPay/PESONet & generic
 * PH peso notifications. Rejects OTPs, failed/declined alerts & balance checks.
 * ============================================================================ */
(function (global) {
  'use strict';

  const Money = global.OWMoney || (typeof require === 'function' ? require('./money.js') : null);
  const Domain = global.OWDomain || (typeof require === 'function' ? require('./domain.js') : null);

  const PROVIDERS = [
    { id: 'gcash', label: 'GCash', re: /\bgcash\b/i },
    { id: 'maya', label: 'Maya', re: /\b(?:maya|paymaya)\b/i },
    { id: 'gotyme', label: 'GoTyme', re: /\bgotyme\b/i },
    { id: 'bpi', label: 'BPI', re: /\bbpi\b/i },
    { id: 'bdo', label: 'BDO', re: /\bbdo\b/i },
    { id: 'unionbank', label: 'UnionBank', re: /\b(?:unionbank|ubp)\b/i },
    { id: 'metrobank', label: 'Metrobank', re: /\bmetrobank\b/i },
    { id: 'rcbc', label: 'RCBC', re: /\brcbc\b/i },
    { id: 'cimb', label: 'CIMB', re: /\bcimb\b/i },
    { id: 'instapay', label: 'InstaPay', re: /\binstapay\b/i },
    { id: 'pesonet', label: 'PESONet', re: /\bpesonet\b/i }
  ];

  const REJECT_PATTERNS = [
    {
      kind: 'otp',
      re: /\b(?:OTP|one[- ]time\s+(?:pin|password)|verification\s+code|security\s+code)\b|never\s+share\s+your\s+(?:otp|mpin|pin|code)/i,
      err: 'This looks like a security or OTP message, not a completed transaction.'
    },
    {
      kind: 'failed',
      re: /\b(?:failed|declined|unsuccessful|could\s+not\s+be\s+processed|unable\s+to\s+process|insufficient\s+(?:balance|funds)|transaction\s+(?:cancelled|canceled|timed\s+out|rejected))\b/i,
      err: 'This notification reports a failed, declined, or cancelled transaction, so nothing was added.'
    },
    {
      kind: 'promo',
      re: /\b(?:pre-qualified|apply\s+now|loan\s+offer|get\s+up\s+to|cashback\s+voucher|promo\s+runs|min\.\s*spend)\b/i,
      err: 'This looks like a promotional offer rather than a completed transaction.'
    }
  ];

  function detectProvider(text) {
    for (const p of PROVIDERS) {
      if (p.re.test(text)) return p;
    }
    return null;
  }

  function extractPesoAmount(text) {
    // Match ₱1,234.56, PHP 1,234.56, Php189, or P1,234.00 when preceded by currency context
    const patterns = [
      /(?:₱|PHP|Php)\s*([\d,]+(?:\.\d{1,2})?)(?!\.\d)/,
      /\b(?:paid|sent|received|credited|debited|transferred|amount(?:\s+of)?|charged|worth)\s+P\s*([\d,]+(?:\.\d{1,2})?)(?!\.\d)/i
    ];
    for (const re of patterns) {
      const m = text.match(re);
      if (m && m[1]) {
        const clean = m[1].replace(/,/g, '');
        const parsed = Money.parseMoneyInput(clean, { allowZero: false, allowNegative: false, label: 'Amount' });
        if (parsed.ok) return parsed.value;
      }
    }
    return null;
  }

  function extractReference(text) {
    const m = text.match(/\b(?:Ref(?:\.\s*No\.?|\.|erence(?:\s*No\.?)?)?|Trace\s*No\.?|Txn\s*ID)\s*[:#-]?\s*([A-Z0-9][A-Z0-9 -]{3,24})/i);
    if (!m || !m[1]) return '';
    return m[1].trim().replace(/[.,;\s]+$/, '');
  }

  function extractDate(text, today = Domain.todayISO()) {
    const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    if (iso && Domain.isValidISODate(iso[1])) return iso[1];

    const mdy = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);
    if (mdy) {
      const m = String(Number(mdy[1])).padStart(2, '0');
      const d = String(Number(mdy[2])).padStart(2, '0');
      const cand = `${mdy[3]}-${m}-${d}`;
      if (Domain.isValidISODate(cand)) return cand;
    }

    const named = text.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})(?:,\s*(20\d{2}))?\b/i);
    if (named) {
      const mIdx = Domain.MONTHS.findIndex(x => x.toLowerCase() === named[1].slice(0, 3).toLowerCase());
      if (mIdx !== -1) {
        const yr = named[3] || today.slice(0, 4);
        const cand = `${yr}-${String(mIdx + 1).padStart(2, '0')}-${String(Number(named[2])).padStart(2, '0')}`;
        if (Domain.isValidISODate(cand)) return cand;
      }
    }
    return today;
  }

  function extractCounterparty(text, direction) {
    // Strip trailing Ref / balance sentences first so dots inside merchants (e.g. Netflix.com, JUAN D.) survive!
    const stripped = text
      .replace(/\s+(?:Your\s+(?:new\s+)?balance|Avail\.?\s*bal|Ref(?:\.\s*No\.?|\.|erence)?|Trace\s*No\.?)\b.*$/i, '')
      .trim();

    const patterns = direction > 0
      ? [
          /\b(?:from|by)\s+([A-Za-z0-9][\w.&'*+/ -]{0,48}?)(?=\s+(?:on|via|with|using)\s+|\s*[.!?;]|$)/i,
          /\b([A-Za-z0-9][\w.&' -]{1,36}?)\s+sent\s+you\b/i
        ]
      : [
          /\b(?:to|at|for|merchant:)\s+([A-Za-z0-9][\w.&'*+/ -]{0,48}?)(?=\s+(?:on|via|using|from\s+acct|acct)\s+|\s*[.!?;]|$)/i
        ];

    // Also try general to/from/at if direction was ambiguous
    patterns.push(/\b(?:to|from|at)\s+([A-Za-z0-9][\w.&'*+/ -]{0,48}?)(?=\s+(?:on|via|with|using)\s+|\s*[.!?;]|$)/i);

    for (const re of patterns) {
      const m = stripped.match(re);
      if (m && m[1]) {
        const cleaned = m[1]
          .replace(/\s+\d{2}[/-]\d{2}[/-]\d{2,4}.*$/, '')
          .replace(/[.,;:]+$/, '')
          .trim();
        if (cleaned && !/^(?:your\s+account|your\s+wallet|gcash|maya|gotyme)$/i.test(cleaned)) {
          return Domain.normalizeMerchant(cleaned);
        }
      }
    }
    return '';
  }

  function matchWalletId(text, provider, wallets = []) {
    if (!Array.isArray(wallets) || !wallets.length) return 0;
    // 1. Direct match against user's custom wallet name
    for (const w of wallets) {
      const name = String(w.n || '').trim();
      if (name && new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)) {
        return w.id;
      }
    }
    // 2. Match detected provider to wallet name or card style
    if (provider) {
      const byStyleOrName = wallets.find(w =>
        String(w.n || '').toLowerCase().includes(provider.id) ||
        String(w.style || '').toLowerCase().startsWith(provider.id)
      );
      if (byStyleOrName) return byStyleOrName.id;
    }
    return wallets[0].id;
  }

  function parseAlert(rawText, {
    wallets = [],
    existingTransactions = [],
    today = Domain.todayISO()
  } = {}) {
    const text = String(rawText ?? '').trim();
    if (!text) {
      return {
        valid: false,
        err: 'Paste a payment SMS or app notification first, or try one of the samples below.'
      };
    }

    for (const rule of REJECT_PATTERNS) {
      if (rule.re.test(text)) {
        return { valid: false, kind: rule.kind, err: rule.err };
      }
    }

    const inRe = /\b(?:received|credited|cash[- ]?in|cashed\s+in|deposited|deposit|sent\s+you|refunded|refund|incoming)\b/i;
    const outRe = /\b(?:paid|sent(?!\s+you)|transferred\s+to|purchase[d]?|debited|cash[- ]?out|cashed\s+out|charged|bought|payment\s+(?:of|to)|deducted)\b/i;
    const hasIn = inRe.test(text);
    const hasOut = outRe.test(text);

    // Pure balance inquiry check (has "balance" and peso amount, but zero transaction action verbs)
    if (!hasIn && !hasOut && /\b(?:available\s+balance|current\s+balance|balance\s+is|bal\s*:)\b/i.test(text)) {
      return {
        valid: false,
        kind: 'balance_inquiry',
        err: 'This message only reports an account balance rather than an income or expense transaction.'
      };
    }

    const amount = extractPesoAmount(text);
    if (amount === null) {
      return {
        valid: false,
        kind: 'missing_amount',
        err: 'Could not detect a valid PHP amount (e.g., “₱189.00” or “PHP 1,500.00”). Check the pasted text.'
      };
    }

    const provider = detectProvider(text);
    const ambiguousDirection = (hasIn && hasOut) || (!hasIn && !hasOut);
    const dir = hasIn && !hasOut ? 1 : -1;
    const counterparty = extractCounterparty(text, dir);
    const merchant = counterparty || (dir > 0 ? 'Incoming transfer' : 'Unknown merchant');
    const ref = extractReference(text);
    const date = extractDate(text, today);
    const walletId = matchWalletId(text, provider, wallets);
    const category = Domain.inferCategory(counterparty || text, dir, existingTransactions);

    const warnings = [];
    if (ambiguousDirection) {
      warnings.push('Transaction direction (Income vs. Expense) could not be confirmed from the wording—please verify the Type field below.');
    }
    if (!counterparty) {
      warnings.push('Merchant or sender name was not clearly stated—review or edit the merchant name before saving.');
    }

    const duplicate = Domain.findDuplicateTransaction(
      {
        walletId,
        signedAmount: dir * amount,
        merchant,
        date,
        ref
      },
      existingTransactions,
      today
    );

    return {
      valid: true,
      confidence: ambiguousDirection || !counterparty ? 'review' : 'high',
      ambiguousDirection,
      provider: provider ? provider.label : 'General PHP Alert',
      providerId: provider ? provider.id : '',
      a: amount,
      dir,
      s: merchant,
      c: category,
      d: date,
      w: walletId,
      ref,
      warnings,
      duplicate
    };
  }

  const SAMPLES = [
    {
      label: 'GCash',
      text: 'GCash: You have paid ₱189.00 to Jollibee. Ref. No. 5012 884 991.'
    },
    {
      label: 'Maya',
      text: 'Maya: You received PHP 1,500.00 from Juan Dela Cruz on 11/25/2026. Ref 9941204.'
    },
    {
      label: 'GoTyme',
      text: 'GoTyme: You sent ₱350.00 to Grab. Ref 88231.'
    },
    {
      label: 'BPI / 7-Eleven',
      text: 'BPI Alert: PHP 145.50 was paid at 7-Eleven. Trace No. 774102.'
    }
  ];

  const OWParser = {
    PROVIDERS,
    SAMPLES,
    parseAlert,
    detectProvider,
    extractPesoAmount,
    extractReference,
    extractDate,
    extractCounterparty
  };

  global.OWParser = OWParser;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OWParser;
  }
})(typeof window !== 'undefined' ? window : globalThis);
