'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Vault = require('../src/vault-cloud.js');

function createMockStorage() {
  const map = new Map();
  return {
    map,
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: k => { map.delete(k); },
    clear: () => { map.clear(); }
  };
}

const hexToBytes = hex => {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
};

test('Card Vault Crypto: v3 password hash and AES-256-GCM vault key are cryptographically domain-separated', async () => {
  const salt = Vault.randomSaltHex(16, { versioned: true });
  assert.ok(salt.startsWith('v3:'));

  // Use faster iteration override in unit test while exercising exact v3 domain-separation logic
  const pwdHash = await Vault.hashPassword('MyStrongPass#2026', salt, { iterationsOverride: 10000 });
  const vaultKey = await Vault.deriveVaultKey('MyStrongPass#2026', salt, { iterationsOverride: 10000 });

  const ct = await Vault.encryptVaultPayload(
    { num: '4532891023414821', exp: '08/29', cvv: '418', holder: 'MARIA SANTOS' },
    vaultKey
  );
  assert.ok(ct.startsWith('aes256gcm:'));

  // Attempt to import pwdHash directly as an AES-GCM key MUST FAIL to decrypt ct!
  const attackerKeyFromPwdHash = await crypto.subtle.importKey(
    'raw',
    hexToBytes(pwdHash),
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  const attackerAttempt = await Vault.decryptVaultPayload(ct, attackerKeyFromPwdHash);
  assert.equal(attackerAttempt, null);

  // Legitimate vaultKey decrypts cleanly, and tampered ciphertext is rejected by GCM tag check
  const decrypted = await Vault.decryptVaultPayload(ct, vaultKey);
  assert.equal(decrypted.num, '4532891023414821');
  assert.equal(decrypted.cvv, '418');

  const tampered = ct.slice(0, -4) + (ct.endsWith('AAAA') ? 'BBBB' : 'AAAA');
  assert.equal(await Vault.decryptVaultPayload(tampered, vaultKey), null);
});

test('Cardless Wallets: never fabricates default PAN, expiry, or CVV when omitted', async () => {
  const salt = Vault.randomSaltHex(16, { versioned: true });
  const key = await Vault.deriveVaultKey('VaultPass!99', salt, { iterationsOverride: 5000 });

  const starter = await Vault.createStarterWorkspace({
    preset: 'starter',
    fullName: 'Maria Santos',
    cryptoKey: key
  });
  assert.equal(starter.w.length, 4);
  for (const w of starter.w) {
    assert.equal(w.last4, '');
    assert.equal(w.hasCard, false);
  }

  const hydrated = await Vault.hydrateWalletsInMemory(starter.w, key, 'Maria Santos');
  for (const hw of hydrated) {
    assert.equal(hw.num, '');
    assert.equal(hw.exp, '');
    assert.equal(hw.cvv, '');
    assert.equal(hw.last4, '');
  }
});

test('Cloud Sync Resilience: failed network write NEVER wipes existing cloud rows and preserves retry', async () => {
  const store = createMockStorage();
  Vault.setStorageAdapter(store);
  Vault._resetSyncStateForTests();

  const acc = {
    id: 'acc:maria@email.ph',
    sbUserId: '11111111-2222-3333-4444-555555555555',
    fullName: 'Maria Santos',
    email: 'maria@email.ph',
    paydayMode: 'bimonthly',
    customPayday: '',
    salt: 'v3:00112233445566778899aabbccddeeff',
    w: [{ id: 1, n: 'GCash', b: 1500, style: 'gcash', last4: '', encrypted_card_vault: 'aes256gcm:00112233445566778899aabb:dGVzdA==' }],
    t: [{ id: 2, w: 1, d: '2026-11-25', s: 'Jollibee', c: 'Food', a: -189, note: 'Lunch', src: 'import', ref: 'REF123' }],
    b: [{ id: 3, n: 'Wi-Fi', a: 1299, dueDate: '2026-11-30', freq: 'monthly', d: 'Nov 30' }],
    pendingSync: true
  };
  Vault.saveRegistry({ [acc.id]: acc });

  const calls = [];
  let shouldFailPost = true;

  Vault.setFetchAdapter(async (url, opts) => {
    calls.push({ method: opts.method, url });
    if (url.includes('/rpc/sync_user_workspace')) {
      return {
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ code: 'PGRST202', message: 'Could not find function sync_user_workspace' })
      };
    }
    if (shouldFailPost && url.includes('/rest/v1/wallets?on_conflict=')) {
      return {
        ok: false,
        status: 503,
        text: async () => JSON.stringify({ message: 'Service temporarily unavailable' })
      };
    }
    return { ok: true, status: 200, text: async () => '' };
  });

  // 1st attempt fails during wallets POST upsert: verify ZERO DELETE calls were issued!
  const firstRes = await Vault.syncAccountToSupabase(acc, { accessToken: 'tok_valid' });
  assert.equal(firstRes.ok, false);
  assert.equal(calls.some(c => c.method === 'DELETE'), false);
  assert.equal(Vault.loadRegistry()[acc.id].pendingSync, true);

  // 2nd attempt with identical data MUST retry (stale fingerprint bug fixed!) and succeed
  shouldFailPost = false;
  calls.length = 0;
  const secondRes = await Vault.syncAccountToSupabase(acc, { accessToken: 'tok_valid' });
  assert.equal(secondRes.ok, true);
  assert.equal(Vault.loadRegistry()[acc.id].pendingSync, false);

  // Verify targeted prune uses client_id=not.in.(...) AFTER POST upsert, never blind DELETE before POST
  const walletPostIdx = calls.findIndex(c => c.method === 'POST' && c.url.includes('/rest/v1/wallets'));
  const walletDelIdx = calls.findIndex(c => c.method === 'DELETE' && c.url.includes('/rest/v1/wallets'));
  assert.ok(walletPostIdx !== -1 && walletDelIdx > walletPostIdx);
  assert.ok(calls[walletDelIdx].url.includes('client_id=not.in.(1)'));

  Vault.setFetchAdapter(null);
  Vault.setStorageAdapter(null);
});

test('Account Registry: deduplicates legacy acc_<timestamp> and email keys while isolating accounts', () => {
  const store = createMockStorage();
  Vault.setStorageAdapter(store);

  store.setItem(Vault.STORAGE_ACCOUNTS, JSON.stringify({
    acc_17000001: { id: 'acc_17000001', email: 'user1@email.ph', fullName: 'User One', w: [{ id: 1, n: 'GCash', b: 100 }], updatedAt: 100 },
    'user1@email.ph': { id: 'user1@email.ph', email: 'user1@email.ph', fullName: 'User One', w: [{ id: 1, n: 'GCash', b: 250 }], updatedAt: 200 },
    'acc:user2@email.ph': { id: 'acc:user2@email.ph', email: 'user2@email.ph', fullName: 'User Two', w: [{ id: 1, n: 'Maya', b: 900 }], updatedAt: 150 }
  }));

  const reg = Vault.loadRegistry();
  const list = Vault.listAccounts();
  assert.equal(list.length, 2);
  assert.equal(reg['acc:user1@email.ph'].w[0].b, 250);
  assert.equal(reg['acc:user2@email.ph'].w[0].b, 900);

  Vault.setStorageAdapter(null);
});

test('Cloud Sync Auth Recovery: refreshes expired JWT on HTTP 401 and completes sync cleanly', async () => {
  const store = createMockStorage();
  Vault.setStorageAdapter(store);
  Vault._resetSyncStateForTests();

  const acc = {
    id: 'acc:jwt@email.ph',
    sbUserId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    fullName: 'JWT User',
    email: 'jwt@email.ph',
    paydayMode: 'bimonthly',
    customPayday: '',
    salt: 'v3:00112233445566778899aabbccddeeff',
    w: [],
    t: [],
    b: [],
    pendingSync: true
  };
  Vault.saveRegistry({ [acc.id]: acc });

  let refreshCalled = false;
  Vault.setFetchAdapter(async (url, opts) => {
    if (url.includes('grant_type=refresh_token')) {
      refreshCalled = true;
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          access_token: 'fresh_access_token_2',
          refresh_token: 'fresh_refresh_token_2',
          expires_in: 3600
        })
      };
    }
    if (opts.headers?.Authorization === 'Bearer expired_token_1') {
      return {
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ message: 'JWT expired' })
      };
    }
    // Succeed with fresh_access_token_2 via atomic RPC!
    assert.equal(opts.headers?.Authorization, 'Bearer fresh_access_token_2');
    return { ok: true, status: 200, text: async () => '' };
  });

  const res = await Vault.syncAccountToSupabase(acc, {
    accessToken: 'expired_token_1',
    refreshToken: 'valid_refresh_token_1',
    expiresAt: Date.now() + 300000
  });
  assert.equal(refreshCalled, true);
  assert.equal(res.ok, true);
  assert.equal(res.refreshedSession.accessToken, 'fresh_access_token_2');

  Vault.setFetchAdapter(null);
  Vault.setStorageAdapter(null);
});
