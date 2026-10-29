it('turns booleans into query strings', () => {
  assert.equal(toQueryBoolean(true), 'true');
  assert.equal(toQueryBoolean(false), 'false');
  assert.equal(toQueryBoolean('true'), 'true');
  assert.equal(toQueryBoolean('false'), 'false');
});

it('leaves blank values out', () => {
  assert.equal(toQueryBoolean(undefined), undefined);
  assert.equal(toQueryBoolean(null), undefined);
  assert.equal(toQueryBoolean(''), undefined);
});
