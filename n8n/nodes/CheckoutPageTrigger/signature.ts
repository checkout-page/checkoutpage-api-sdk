import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const SIGNATURE_HEADER = /^sha256=([0-9a-f]{64})$/i;

export function computeSignature(rawBody: Buffer | string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
}

/**
 * Checks `X-Webhook-Signature: sha256=<hex HMAC-SHA256 of the raw body>` against the
 * webhook's secret. Only the raw bytes are signed, so a re-serialized body never matches.
 */
export function verifySignature(
  rawBody: Buffer | string | undefined,
  header: unknown,
  secret: unknown
): boolean {
  if (rawBody === undefined || typeof header !== 'string') return false;
  if (typeof secret !== 'string' || !secret) return false;

  const match = SIGNATURE_HEADER.exec(header.trim());
  if (!match) return false;

  const received = Buffer.from(match[1], 'hex');
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  if (received.length !== expected.length) return false;
  return timingSafeEqual(received, expected);
}

export function generateSecret(): string {
  return randomBytes(32).toString('hex');
}
