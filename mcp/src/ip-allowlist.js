// Minimal IPv4 CIDR matcher. No dependency needed for this - it's a handful
// of bitwise operations. Used to restrict /mcp-public/<secret> to Anthropic's
// published outbound range even though this Worker runs on a workers.dev
// subdomain, where Cloudflare's zone-level WAF Custom Rules do not apply
// (workers.dev is Cloudflare's own zone, not one in this account). Cloudflare
// still gives every Worker request a trustworthy client IP via the
// CF-Connecting-IP header (set by Cloudflare's edge, not forgeable by the
// client), so the check happens here in the Worker itself.

function ipv4ToInt(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const byte = Number(part);
    if (byte < 0 || byte > 255) return null;
    n = (n << 8) | byte;
  }
  return n >>> 0;
}

function ipInCidr(ip, cidr) {
  const [rangeIp, prefixStr] = cidr.split('/');
  const prefix = prefixStr === undefined ? 32 : Number(prefixStr);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
  const ipInt = ipv4ToInt(ip);
  const rangeInt = ipv4ToInt(rangeIp);
  if (ipInt === null || rangeInt === null) return false;
  if (prefix === 0) return true;
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

// cidrListCsv: comma-separated CIDR blocks, e.g. env.ANTHROPIC_EGRESS_CIDRS.
// Returns true (allow) when cidrListCsv is empty/unset - the allowlist is an
// optional extra layer on top of the path secret, not a replacement for it,
// so a missing/blank config does not lock the endpoint out entirely.
export function isAllowedIp(ip, cidrListCsv) {
  if (!cidrListCsv || !cidrListCsv.trim()) return true;
  if (!ip) return false;
  const cidrs = cidrListCsv.split(',').map(s => s.trim()).filter(Boolean);
  return cidrs.some(cidr => ipInCidr(ip, cidr));
}

export { ipInCidr };
