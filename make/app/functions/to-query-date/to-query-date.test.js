it('formats dates as UTC ISO strings', () => {
  assert.equal(toQueryDate(new Date('2026-03-04T05:06:07.089Z')), '2026-03-04T05:06:07.089Z');
  assert.equal(toQueryDate('2026-03-04T05:06:07Z'), '2026-03-04T05:06:07.000Z');
});

it('leaves blank and invalid values out', () => {
  assert.equal(toQueryDate(undefined), undefined);
  assert.equal(toQueryDate(null), undefined);
  assert.equal(toQueryDate(''), undefined);
  assert.equal(toQueryDate('not a date'), undefined);
});
