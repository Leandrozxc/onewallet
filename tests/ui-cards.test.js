'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Cards = require('../src/cards.js');

test('Card Styles & Rendering: all 16 PH card styles define valid names and never leak unescaped HTML or fake CVVs', () => {
  assert.equal(Cards.CARD_STYLES.length, 16);
  for (const st of Cards.CARD_STYLES) {
    assert.ok(st.id && st.name && st.bank && st.netLabel, `Missing metadata on card style ${st.id}`);
    assert.notEqual(st.name, 'undefined');
  }

  // Cardless wallet renders passbook state without fabricating 08/29 or 418
  const cardlessHtml = Cards.renderCardFace(
    { id: 1, n: 'My Cash <script>alert(1)</script>', style: 'cash', hasCard: false, num: '', exp: '', cvv: '', last4: '' },
    { revealed: true }
  );
  assert.ok(!cardlessHtml.includes('<script>'));
  assert.ok(cardlessHtml.includes('&lt;script&gt;'));
  assert.ok(cardlessHtml.includes('CASH PASSBOOK'));
  assert.ok(!cardlessHtml.includes('418'));
  assert.ok(!cardlessHtml.includes('08/29'));

  // Masked vs revealed card number formatting
  const carded = { id: 2, n: 'BPI Platinum', style: 'bpi-plat', hasCard: true, num: '5399640288104821', last4: '4821', exp: '11/29', cvv: '842', holder: 'MARIA SANTOS' };
  const maskedHtml = Cards.renderCardFace(carded, { revealed: false });
  assert.ok(maskedHtml.includes('•••• •••• •••• 4821'));
  assert.ok(!maskedHtml.includes('5399 6402'));
  assert.ok(!maskedHtml.includes('842'));

  const revealedHtml = Cards.renderCardFace(carded, { revealed: true });
  assert.ok(revealedHtml.includes('5399 6402 8810 4821'));
  assert.ok(revealedHtml.includes('11/29'));
  assert.ok(revealedHtml.includes('842'));
});
