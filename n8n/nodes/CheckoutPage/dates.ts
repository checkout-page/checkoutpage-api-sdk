const ZONELESS =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3})\d*)?)?)?$/;

function offsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const wall = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second')
  );
  return wall - Math.floor(instant / 1000) * 1000;
}

function toDateString(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString();
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as { toISO?: unknown }).toISO === 'function'
  ) {
    return String((value as { toISO: () => unknown }).toISO());
  }
  if (typeof value === 'string') return value.trim();
  return undefined;
}

/**
 * The API accepts only UTC timestamps ending in `Z`. n8n's date picker sends a zoneless
 * `YYYY-MM-DDTHH:mm:ss`, which means wall time in the workflow's timezone.
 */
export function toUtcIso(value: unknown, timeZone: string): string | undefined {
  const text = toDateString(value);
  if (!text) return undefined;

  const match = ZONELESS.exec(text);
  if (!match) {
    const time = Date.parse(text);
    return Number.isNaN(time) ? undefined : new Date(time).toISOString();
  }

  const [, year, month, day, hour = '0', minute = '0', second = '0', ms = '0'] = match;
  const wall = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    Number(ms.padEnd(3, '0'))
  );
  if (Number.isNaN(wall)) return undefined;

  // The offset at the wall time read as UTC can differ from the one at the real instant
  // near a DST change, so correct once with the offset at the first guess.
  const firstOffset = offsetMs(wall, timeZone);
  let instant = wall - firstOffset;
  const secondOffset = offsetMs(instant, timeZone);
  if (secondOffset !== firstOffset) instant = wall - secondOffset;
  return new Date(instant).toISOString();
}
