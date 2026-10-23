import * as crypto from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  computeSignature,
  generateSecret,
  verifySignature,
} from '../nodes/CheckoutPageTrigger/signature';

vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>();
  return { ...actual, timingSafeEqual: vi.fn(actual.timingSafeEqual) };
});

// A fixed vector computed the Node way:
// crypto.createHmac('sha256', SECRET).update(BODY).digest('hex')
const SECRET = 'test-vector-secret';
const BODY =
  '{"event":"booking.created","data":{"id":"65f1a2b3c4d5e6f708192a3b"},"seller_id":"65f1a2b3c4d5e6f708192a00","sellerId":"65f1a2b3c4d5e6f708192a00","timestamp":"2026-10-22T12:00:00.000Z","event_id":"evt_1","eventId":"evt_1","api_version":"v1"}';
const DIGEST = 'a87ba47ce3f486c17e495be6912860f8bebf31dc6f03fcbcb1652e93b5bc16a3';

describe('signature', () => {
  beforeEach(() => {
    vi.mocked(crypto.timingSafeEqual).mockClear();
  });

  it('matches the fixed vector', () => {
    expect(crypto.createHmac('sha256', SECRET).update(BODY).digest('hex')).toBe(DIGEST);
    expect(computeSignature(BODY, SECRET)).toBe(`sha256=${DIGEST}`);
    expect(computeSignature(Buffer.from(BODY), SECRET)).toBe(`sha256=${DIGEST}`);
  });

  it('verifies the fixed vector from a Buffer or a string', () => {
    expect(verifySignature(Buffer.from(BODY), `sha256=${DIGEST}`, SECRET)).toBe(true);
    expect(verifySignature(BODY, `sha256=${DIGEST}`, SECRET)).toBe(true);
    expect(verifySignature(BODY, `  sha256=${DIGEST}  `, SECRET)).toBe(true);
  });

  it('compares with crypto.timingSafeEqual', () => {
    expect(verifySignature(BODY, `sha256=${DIGEST}`, SECRET)).toBe(true);
    expect(crypto.timingSafeEqual).toHaveBeenCalledTimes(1);

    const wrong = `sha256=${'0'.repeat(64)}`;
    expect(verifySignature(BODY, wrong, SECRET)).toBe(false);
    expect(crypto.timingSafeEqual).toHaveBeenCalledTimes(2);
  });

  it('rejects a body that was re-serialized', () => {
    const reserialized = JSON.stringify(JSON.parse(BODY), null, 2);
    expect(verifySignature(reserialized, `sha256=${DIGEST}`, SECRET)).toBe(false);
  });

  it('rejects a tampered body, a wrong secret and a missing secret', () => {
    expect(verifySignature(BODY.replace('evt_1', 'evt_2'), `sha256=${DIGEST}`, SECRET)).toBe(false);
    expect(verifySignature(BODY, `sha256=${DIGEST}`, 'another-secret')).toBe(false);
    expect(verifySignature(BODY, `sha256=${DIGEST}`, '')).toBe(false);
    expect(verifySignature(BODY, `sha256=${DIGEST}`, undefined)).toBe(false);
  });

  it.each([
    undefined,
    '',
    DIGEST,
    `sha1=${DIGEST}`,
    `sha256=${DIGEST.slice(1)}`,
    `sha256=${DIGEST}00`,
    ['x'],
  ])('rejects header %j without comparing', (header) => {
    expect(verifySignature(BODY, header, SECRET)).toBe(false);
    expect(crypto.timingSafeEqual).not.toHaveBeenCalled();
  });

  it('rejects a missing raw body', () => {
    expect(verifySignature(undefined, `sha256=${DIGEST}`, SECRET)).toBe(false);
  });

  it('generates 64-character hex secrets within the API limit of 10 to 100', () => {
    const secret = generateSecret();
    expect(secret).toMatch(/^[0-9a-f]{64}$/);
    expect(generateSecret()).not.toBe(secret);
  });
});
