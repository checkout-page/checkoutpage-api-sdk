import { expect, it } from 'vitest';
import { loadApp } from './app';
import { loadFunction } from './functions';

const app = loadApp();
const toQueryBoolean = loadFunction('toQueryBoolean');
const toQueryDate = loadFunction('toQueryDate');

it.each([
  [true, 'true'],
  [false, 'false'],
  ['true', 'true'],
  [undefined, undefined],
  [null, undefined],
  ['', undefined],
])('toQueryBoolean(%j) -> %j', (v, out) => expect(toQueryBoolean(v)).toBe(out));

it('formats dates as UTC ISO strings', () => {
  expect(toQueryDate(new Date('2026-03-04T05:06:07.089Z'))).toBe('2026-03-04T05:06:07.089Z');
  expect(toQueryDate('2026-03-04T05:06:07Z')).toBe('2026-03-04T05:06:07.000Z');
});

it.each([undefined, null, '', 'not a date'])('toQueryDate(%j) is undefined', (v) =>
  expect(toQueryDate(v)).toBeUndefined()
);

it('registers every function in makecomapp.json', () => {
  expect(
    app
      .byType('function')
      .map((f) => f.id)
      .sort()
  ).toEqual(['bookingBody', 'couponBody', 'customerBody', 'toQueryBoolean', 'toQueryDate']);
});
