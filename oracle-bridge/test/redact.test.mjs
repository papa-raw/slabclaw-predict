/// redact.test.mjs — seller / PII redaction before Walrus publish.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactPII, hasPlaintextSeller } from '../redact.mjs';

function sampleBundle() {
  return {
    cardIds: ['jp-vs-091'],
    consensus: {
      'jp-vs-091': {
        cardId: 'jp-vs-091',
        consensusPriceCents: 1512000,
        contributingSources: [{ platform: 'ebay', priceCents: 1512000, seller: 'CardKing99' }],
      },
    },
    agentSignals: {
      ebay: {
        signals: [{
          cardId: 'jp-vs-091',
          priceCents: 1512000,
          flags: ['seller:CardKing99', 'price_jump_2.1x'],
          comps: [
            { priceCents: 1500000, seller: 'CardKing99' },
            { priceCents: 1520000, seller: 'CardKing99' },
            { priceCents: 1525000, seller: 'CardKing99' },
            { priceCents: 1510000, seller: 'OtherSeller' },
          ],
        }],
      },
    },
  };
}

test('strips plaintext seller from comps and replaces with stable hash token', () => {
  const out = redactPII(sampleBundle());
  const comps = out.agentSignals.ebay.signals[0].comps;
  for (const c of comps) {
    assert.ok(!('seller' in c) || String(c.seller).startsWith('sh_'), `seller not hashed: ${c.seller}`);
  }
  // Same seller -> same token within a bundle (concentration stays detectable)
  assert.equal(comps[0].seller, comps[1].seller);
  assert.equal(comps[1].seller, comps[2].seller);
  // Different seller -> different token
  assert.notEqual(comps[0].seller, comps[3].seller);
});

test('rewrites "seller:<name>" flags to hashed tokens, keeps non-seller flags', () => {
  const out = redactPII(sampleBundle());
  const flags = out.agentSignals.ebay.signals[0].flags;
  const sellerFlag = flags.find((f) => f.startsWith('seller:'));
  assert.match(sellerFlag, /^seller:sh_[0-9a-f]{12}$/);
  assert.ok(flags.includes('price_jump_2.1x'), 'non-seller flag preserved');
});

test('derives concentration metric so the manipulation signal survives redaction', () => {
  const out = redactPII(sampleBundle());
  const conc = out.agentSignals.ebay.signals[0].sellerConcentration;
  assert.ok(conc, 'sellerConcentration present');
  assert.equal(conc.distinctSellers, 2);
  assert.equal(conc.sampleSize, 4);
  assert.equal(conc.topSellerShare, 0.75); // 3 of 4 from one seller
});

test('hasPlaintextSeller: true on raw, false on redacted', () => {
  const raw = sampleBundle();
  assert.equal(hasPlaintextSeller(raw), true);
  assert.equal(hasPlaintextSeller(redactPII(raw)), false);
});

test('redaction is consensus-neutral (prices untouched)', () => {
  const out = redactPII(sampleBundle());
  assert.equal(out.consensus['jp-vs-091'].consensusPriceCents, 1512000);
  assert.equal(out.agentSignals.ebay.signals[0].priceCents, 1512000);
});

test('also scrubs seller inside consensus.contributingSources', () => {
  const out = redactPII(sampleBundle());
  const src = out.consensus['jp-vs-091'].contributingSources[0];
  assert.ok(!src.seller || String(src.seller).startsWith('sh_'));
});

test('does not mutate the input bundle (returns a deep copy)', () => {
  const raw = sampleBundle();
  redactPII(raw);
  assert.equal(raw.agentSignals.ebay.signals[0].comps[0].seller, 'CardKing99');
  assert.equal(raw.agentSignals.ebay.signals[0].flags[0], 'seller:CardKing99');
});

test('stamps a redaction marker for auditability', () => {
  const out = redactPII(sampleBundle());
  assert.equal(out.redaction.applied, true);
  assert.equal(out.redaction.scope, 'seller-pii');
});

test('handles null / primitive inputs without throwing', () => {
  assert.equal(redactPII(null), null);
  assert.equal(redactPII(42), 42);
  assert.equal(hasPlaintextSeller(null), false);
});
