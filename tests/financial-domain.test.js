'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Money = require('../src/money.js');
const Domain = require('../src/domain.js');

test('Monetary precision: eliminates IEEE-754 floating-point cent drift', () => {
  assert.equal(Money.addMoney(0.1, 0.2), 0.3);
  assert.equal(Money.subMoney(1000.1, 999.9), 0.2);
  assert.equal(Money.toCents(19.99), 1999);
  assert.equal(Money.toCents('₱1,299.45'), 129945);
  assert.equal(Money.sumMoney([0.1, 0.2, 0.3, 19.99, -0.59]), 20);
  // Conservative floor division prevents overspending across days
  assert.equal(Money.divMoneyFloor(100, 3), 33.33);
  assert.equal(Money.peso(2751), '₱2,751.00');
  assert.equal(Money.signed(-189.5), '− ₱189.50');
  assert.equal(Money.signed(12000), '+ ₱12,000.00');
});

test('Monetary validation: rejects sub-cent decimals, NaN, negative unsigned inputs, and overflow', () => {
  assert.equal(Money.parseMoneyInput('12.999').ok, false);
  assert.equal(Money.parseMoneyInput('abc').ok, false);
  assert.equal(Money.parseMoneyInput('0').ok, false);
  assert.equal(Money.parseMoneyInput('0', { allowZero: true }).ok, true);
  assert.equal(Money.parseMoneyInput('-50').ok, false);
  assert.equal(Money.parseMoneyInput('-50', { allowNegative: true }).value, -50);
  assert.equal(Money.parseMoneyInput('1e20').ok, false);
  assert.equal(Money.parseMoneyInput('1,500.50').value, 1500.5);
});

test('Payday calculations: handles 15th, 30th, Feb 28, leap Feb 29, 31-day months, payday-today, and custom dates', () => {
  // Before 15th
  const s1 = Domain.computePaydayState('2026-11-10', 'bimonthly');
  assert.equal(s1.paydayISO, '2026-11-15');
  assert.equal(s1.daysLeft, 5);
  assert.equal(s1.isPaydayToday, false);

  // Exact 15th (payday today -> advances horizon to 30th while marking isPaydayToday)
  const s2 = Domain.computePaydayState('2026-11-15', 'bimonthly');
  assert.equal(s2.isPaydayToday, true);
  assert.equal(s2.paydayISO, '2026-11-30');
  assert.equal(s2.daysLeft, 15);

  // 31-day month after 30th (Jan 31 -> Feb 15)
  const s3 = Domain.computePaydayState('2026-01-31', 'bimonthly');
  assert.equal(s3.paydayISO, '2026-02-15');
  assert.equal(s3.daysLeft, 15);

  // Non-leap February (28 days)
  const febNonLeap = Domain.computePaydayState('2026-02-20', 'bimonthly');
  assert.equal(febNonLeap.paydayISO, '2026-02-28');
  assert.equal(febNonLeap.daysLeft, 8);

  // Leap-year February (29 days in 2028)
  const febLeap = Domain.computePaydayState('2028-02-20', 'bimonthly');
  assert.equal(febLeap.paydayISO, '2028-02-29');
  assert.equal(febLeap.daysLeft, 9);

  // Monthly-30 rolling from Jan 30 into non-leap Feb 28
  const m30Feb = Domain.computePaydayState('2026-01-30', 'monthly-30');
  assert.equal(m30Feb.isPaydayToday, true);
  assert.equal(m30Feb.paydayISO, '2026-02-28');
  assert.equal(m30Feb.daysLeft, 29);

  // Year rollover Dec 30 -> Jan 15
  const decRoll = Domain.computePaydayState('2026-12-30', 'bimonthly');
  assert.equal(decRoll.paydayISO, '2027-01-15');
  assert.equal(decRoll.daysLeft, 16);

  // Custom date today vs future vs past
  const custFuture = Domain.computePaydayState('2026-11-25', 'custom', '2026-12-05');
  assert.equal(custFuture.paydayISO, '2026-12-05');
  assert.equal(custFuture.daysLeft, 10);
  assert.equal(custFuture.customExpired, false);

  const custToday = Domain.computePaydayState('2026-11-25', 'custom', '2026-11-25');
  assert.equal(custToday.isPaydayToday, true);
  assert.equal(custToday.daysLeft, 1);
  assert.equal(custToday.customExpired, false);

  const custPast = Domain.computePaydayState('2026-11-25', 'custom', '2026-11-01');
  assert.equal(custPast.customExpired, true);
  assert.equal(custPast.expiredCustomDate, '2026-11-01');
});

test('Runway summary: computes exact daily allowance, today spending, and exposes bill shortfalls', () => {
  const base = Domain.computeRunwaySummary({
    wallets: [{ id: 1, b: 1200 }, { id: 2, b: 2100 }, { id: 3, b: 800 }, { id: 4, b: 150 }],
    bills: [{ id: 1, a: 1299 }, { id: 2, a: 200 }],
    transactions: [{ id: 1, d: '2026-11-15', s: 'Jollibee', c: 'Food', w: 1, a: -189 }],
    today: '2026-11-15',
    paydayMode: 'bimonthly'
  });
  assert.equal(base.totalBalance, 4250);
  assert.equal(base.reservedBills, 1499);
  assert.equal(base.safeToSpend, 2751);
  assert.equal(base.daysLeft, 15);
  assert.equal(base.dailyAllowance, 183.4);
  assert.equal(base.spentToday, 189);
  assert.equal(base.remainingToday, -5.6);
  assert.equal(base.status, 'over-daily');

  // Shortfall scenario: bills exceed wallet balances
  const deficit = Domain.computeRunwaySummary({
    wallets: [{ id: 1, b: 900 }],
    bills: [{ id: 1, a: 1500 }],
    transactions: [],
    today: '2026-11-20',
    paydayMode: 'bimonthly'
  });
  assert.equal(deficit.billShortfall, 600);
  assert.equal(deficit.safeToSpend, 0);
  assert.equal(deficit.dailyAllowance, 0);
  assert.equal(deficit.status, 'shortfall');
});

test('Ledger CRUD & wallet consistency: add, edit amount, move wallet, delete, and reconcile', () => {
  let state = {
    w: [
      { id: 1, n: 'GCash', b: 1000.1 },
      { id: 2, n: 'Maya', b: 500.2 }
    ],
    t: [],
    b: [],
    n: 10
  };

  // 1. Add expense on GCash
  const add1 = Domain.recordTransaction(state, {
    walletId: 1,
    amount: '199.95',
    direction: -1,
    merchant: 'jollibee',
    category: 'Food',
    date: '2026-11-25'
  });
  assert.equal(add1.ok, true);
  state = add1.state;
  assert.equal(state.w[0].b, 800.15);
  assert.equal(state.t[0].s, 'Jollibee');

  // 2. Edit transaction: change amount AND switch wallet from GCash (1) to Maya (2)
  const txId = add1.entry.id;
  const edit = Domain.updateTransaction(state, txId, {
    walletId: 2,
    amount: '250.20',
    direction: -1,
    merchant: 'Jollibee Delivery',
    category: 'Food',
    date: '2026-11-24'
  });
  assert.equal(edit.ok, true);
  state = edit.state;
  assert.equal(state.w[0].b, 1000.1); // Restored exactly on GCash!
  assert.equal(state.w[1].b, 250);    // Deducted cleanly on Maya!
  assert.equal(state.t[0].d, '2026-11-24');

  // 3. Reconcile Maya to 300.00 -> adds +50.00 Balance correction
  const rec = Domain.reconcileWallet(state, 2, '300.00', '2026-11-25');
  assert.equal(rec.ok, true);
  state = rec.state;
  assert.equal(state.w[1].b, 300);
  assert.equal(rec.diff, 50);
  assert.equal(Domain.isAdjustmentEntry(rec.entry), true);

  // 4. Delete the Jollibee entry -> reverses -250.20 on Maya -> 550.20
  const del = Domain.removeTransaction(state, txId);
  assert.equal(del.ok, true);
  state = del.state;
  assert.equal(state.w[1].b, 550.2);
});

test('Bill settlement: supports full settlement, partial payment, recurring rollover, and missing-wallet guard', () => {
  let state = {
    w: [{ id: 1, n: 'GCash', b: 2000 }],
    t: [],
    b: [
      { id: 10, n: 'Wi-Fi', a: 1299, baseAmount: 1299, dueDate: '2026-11-30', freq: 'once', d: 'Nov 30' },
      { id: 11, n: 'Spotify', a: 200, baseAmount: 200, dueDate: '2026-11-28', freq: 'monthly', d: 'Nov 28' }
    ],
    n: 20
  };

  // Partial payment of ₱500 toward ₱1,299 Wi-Fi keeps ₱799 reserved!
  const part = Domain.settleBill(state, { billId: 10, walletId: 1, paymentAmount: '500.00' }, '2026-11-25');
  assert.equal(part.ok, true);
  assert.equal(part.outcome, 'partial');
  state = part.state;
  assert.equal(state.w[0].b, 1500);
  assert.equal(state.b.find(b => b.id === 10).a, 799);

  // Pay remaining ₱799 -> removes one-time bill
  const rest = Domain.settleBill(state, { billId: 10, walletId: 1, paymentAmount: '799.00' }, '2026-11-25');
  assert.equal(rest.ok, true);
  assert.equal(rest.outcome, 'settled');
  state = rest.state;
  assert.equal(state.w[0].b, 701);
  assert.equal(state.b.find(b => b.id === 10), undefined);

  // Pay recurring Spotify bill -> rolls due date forward 1 month instead of vanishing
  const roll = Domain.settleBill(state, { billId: 11, walletId: 1, paymentAmount: '200.00' }, '2026-11-25');
  assert.equal(roll.ok, true);
  assert.equal(roll.outcome, 'rolled');
  state = roll.state;
  assert.equal(state.w[0].b, 501);
  assert.equal(state.b.find(b => b.id === 11).dueDate, '2026-12-28');

  // Invalid wallet leaves state completely untouched
  const bad = Domain.settleBill(state, { billId: 11, walletId: 999, paymentAmount: '200.00' }, '2026-11-25');
  assert.equal(bad.ok, false);
  assert.equal(state.w[0].b, 501);
});

test('CSV export & JSON backup validation: neutralizes spreadsheet formula injection and validates schema', () => {
  const csv = Domain.exportTransactionsCSV(
    [{ id: 1, d: '2026-11-25', s: '=CMD|" /C calc"!A0', c: 'Others', w: 1, a: -100, note: 'Has "quotes", comma' }],
    [{ id: 1, n: 'GCash' }],
    '2026-11-25'
  );
  assert.ok(csv.includes("'=CMD|\"\" /C calc\"\"!A0"));
  assert.ok(csv.includes('"Has ""quotes"", comma"'));

  const backup = Domain.createWorkspaceBackup({
    fullName: 'Maria Santos',
    email: 'maria@email.ph',
    paydayMode: 'monthly-15',
    w: [{ id: 1, n: 'GCash', b: 1250.5, style: 'gcash', last4: '', encrypted_card_vault: 'aes256gcm:abc:def' }],
    t: [{ id: 2, d: '2026-11-25', s: 'Jollibee', c: 'Food', w: 1, a: -189 }],
    b: [{ id: 3, n: 'Rent', a: 8000, d: '2026-12-01' }]
  });
  const validated = Domain.validateWorkspaceBackup(JSON.stringify(backup));
  assert.equal(validated.ok, true);
  assert.equal(validated.data.w[0].b, 1250.5);
  assert.equal(Domain.validateWorkspaceBackup('{"wrong":true}').ok, false);
});
