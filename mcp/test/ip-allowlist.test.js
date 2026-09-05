import test from 'node:test';
import assert from 'node:assert/strict';
import { ipInCidr, isAllowedIp } from '../src/ip-allowlist.js';

test('ipInCidr matches addresses inside Anthropic\'s published range', () => {
  assert.equal(ipInCidr('160.79.104.1', '160.79.104.0/21'), true);
  assert.equal(ipInCidr('160.79.111.254', '160.79.104.0/21'), true); // last usable-ish address in the /21
  assert.equal(ipInCidr('160.79.104.0', '160.79.104.0/21'), true); // network address itself
});

test('ipInCidr rejects addresses outside the range', () => {
  assert.equal(ipInCidr('160.79.112.1', '160.79.104.0/21'), false); // one address past the /21
  assert.equal(ipInCidr('160.79.103.255', '160.79.104.0/21'), false); // one address before it
  assert.equal(ipInCidr('8.8.8.8', '160.79.104.0/21'), false);
});

test('ipInCidr handles /32 exact match and malformed input safely', () => {
  assert.equal(ipInCidr('1.2.3.4', '1.2.3.4/32'), true);
  assert.equal(ipInCidr('1.2.3.5', '1.2.3.4/32'), false);
  assert.equal(ipInCidr('not-an-ip', '160.79.104.0/21'), false);
  assert.equal(ipInCidr('160.79.104.1', 'not-a-cidr'), false);
  assert.equal(ipInCidr('', '160.79.104.0/21'), false);
});

test('isAllowedIp allows everything when the allowlist is unset or blank (opt-in layer)', () => {
  assert.equal(isAllowedIp('1.2.3.4', undefined), true);
  assert.equal(isAllowedIp('1.2.3.4', ''), true);
  assert.equal(isAllowedIp('1.2.3.4', '   '), true);
});

test('isAllowedIp denies a missing client IP once an allowlist is configured', () => {
  assert.equal(isAllowedIp(null, '160.79.104.0/21'), false);
  assert.equal(isAllowedIp(undefined, '160.79.104.0/21'), false);
});

test('isAllowedIp supports multiple comma-separated CIDRs', () => {
  const list = '160.79.104.0/21, 203.0.113.0/24';
  assert.equal(isAllowedIp('160.79.105.1', list), true);
  assert.equal(isAllowedIp('203.0.113.50', list), true);
  assert.equal(isAllowedIp('198.51.100.1', list), false);
});
