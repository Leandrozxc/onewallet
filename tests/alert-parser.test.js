'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Parser = require('../src/alert-parser.js');

const SAMPLE_WALLETS = [
  { id: 1, n: 'GCash', style: 'gcash' },
  { id: 2, n: 'Maya', style: 'maya-black' },
  { id: 3, n: 'GoTyme', style: 'gotyme' },
  { id: 4, n: 'BPI Savings', style: 'bpi-gold' }
];

test('SMS Parser: accurately extracts GCash, Maya, GoTyme, and BPI notifications', () => {
  const gcash = Parser.parseAlert(
    'GCash: You have paid ₱189.00 to Jollibee. Ref. No. 5012 884 991.',
    { wallets: SAMPLE_WALLETS, today: '2026-11-25' }
  );
  assert.equal(gcash.valid, true);
  assert.equal(gcash.provider, 'GCash');
  assert.equal(gcash.dir, -1);
  assert.equal(gcash.a, 189);
  assert.equal(gcash.s, 'Jollibee');
  assert.equal(gcash.c, 'Food');
  assert.equal(gcash.w, 1);
  assert.equal(gcash.ref, '5012 884 991');

  const maya = Parser.parseAlert(
    'Maya: You received PHP 1,500.00 from Juan Dela Cruz on 11/20/2026. Ref 9941204.',
    { wallets: SAMPLE_WALLETS, today: '2026-11-25' }
  );
  assert.equal(maya.valid, true);
  assert.equal(maya.provider, 'Maya');
  assert.equal(maya.dir, 1);
  assert.equal(maya.a, 1500);
  assert.equal(maya.s, 'Juan Dela Cruz');
  assert.equal(maya.c, 'Income');
  assert.equal(maya.d, '2026-11-20');
  assert.equal(maya.w, 2);

  const gotyme = Parser.parseAlert(
    'GoTyme: You sent ₱350.00 to Grab. Ref 88231.',
    { wallets: SAMPLE_WALLETS, today: '2026-11-25' }
  );
  assert.equal(gotyme.valid, true);
  assert.equal(gotyme.provider, 'GoTyme');
  assert.equal(gotyme.dir, -1);
  assert.equal(gotyme.s, 'Grab');
  assert.equal(gotyme.c, 'Transport');
  assert.equal(gotyme.w, 3);
});

test('SMS Parser: handles digit-leading and dot-containing merchants like 7-Eleven and Netflix.com', () => {
  const sevenEleven = Parser.parseAlert(
    'BPI Alert: PHP 145.50 was paid at 7-Eleven. Trace No. 774102.',
    { wallets: SAMPLE_WALLETS, today: '2026-11-25' }
  );
  assert.equal(sevenEleven.valid, true);
  assert.equal(sevenEleven.s, '7-Eleven');
  assert.equal(sevenEleven.c, 'Food');
  assert.equal(sevenEleven.w, 4);
  assert.equal(sevenEleven.ref, '774102');

  const netflix = Parser.parseAlert(
    'Maya: You paid PHP 549.00 at Netflix.com. Ref 112233.',
    { wallets: SAMPLE_WALLETS, today: '2026-11-25' }
  );
  assert.equal(netflix.valid, true);
  assert.equal(netflix.s, 'Netflix');
  assert.equal(netflix.c, 'Bills');
});

test('SMS Parser: rejects OTPs, failed/declined transactions, promos, and balance inquiries', () => {
  const otp = Parser.parseAlert(
    'GCash: Your OTP for your PHP 500.00 payment is 482910. Never share your MPIN or OTP.',
    { wallets: SAMPLE_WALLETS }
  );
  assert.equal(otp.valid, false);
  assert.equal(otp.kind, 'otp');

  const failed = Parser.parseAlert(
    'GCash: Your payment of ₱1,299.00 to Meralco FAILED due to insufficient balance.',
    { wallets: SAMPLE_WALLETS }
  );
  assert.equal(failed.valid, false);
  assert.equal(failed.kind, 'failed');

  const balanceOnly = Parser.parseAlert(
    'BPI: Your available balance is PHP 14,230.15 as of Nov 25.',
    { wallets: SAMPLE_WALLETS }
  );
  assert.equal(balanceOnly.valid, false);
  assert.equal(balanceOnly.kind, 'balance_inquiry');

  const noAmount = Parser.parseAlert('Hello world, reminder to pay rent tomorrow.', { wallets: SAMPLE_WALLETS });
  assert.equal(noAmount.valid, false);
  assert.equal(noAmount.kind, 'missing_amount');
});

test('SMS Parser: flags ambiguous notifications for user review and detects duplicate imports', () => {
  const ambiguous = Parser.parseAlert(
    'GCash notification: ₱250.00 adjustment Ref 55102.',
    { wallets: SAMPLE_WALLETS, today: '2026-11-25' }
  );
  assert.equal(ambiguous.valid, true);
  assert.equal(ambiguous.ambiguousDirection, true);
  assert.equal(ambiguous.confidence, 'review');
  assert.ok(ambiguous.warnings.length > 0);

  const dupCheck = Parser.parseAlert(
    'GCash: You have paid ₱189.00 to Jollibee. Ref. No. 5012 884 991.',
    {
      wallets: SAMPLE_WALLETS,
      existingTransactions: [
        { id: 9, d: '2026-11-25', s: 'Jollibee', c: 'Food', w: 1, a: -189, ref: '5012 884 991' }
      ],
      today: '2026-11-25'
    }
  );
  assert.equal(dupCheck.valid, true);
  assert.ok(dupCheck.duplicate);
  assert.equal(dupCheck.duplicate.reason, 'reference');
});
