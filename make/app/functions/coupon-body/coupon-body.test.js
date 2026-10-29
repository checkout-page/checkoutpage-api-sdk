it('sends only the chosen discount', () => {
  const body = couponBody({
    label: 'Spring',
    code: 'SPRING',
    discountType: 'percent',
    percentOff: 10,
    amountOff: 500,
    currency: 'usd',
    duration: 'once',
    durationInMonths: 3,
  });
  assert.deepEqual(body, { label: 'Spring', code: 'SPRING', duration: 'once', percentOff: 10 });
});

it('sends an amount off with its currency and months for a repeating coupon', () => {
  const body = couponBody({
    label: 'Spring',
    code: 'SPRING',
    discountType: 'amount',
    amountOff: 500,
    currency: 'USD',
    duration: 'repeating',
    durationInMonths: 2,
  });
  assert.equal(body.amountOff, 500);
  assert.equal(body.currency, 'usd');
  assert.equal(body.durationInMonths, 2);
  assert.equal('percentOff' in body, false);
});

it('keeps rules with a checkout page or event and never sends pageIds', () => {
  const body = couponBody({
    label: 'Spring',
    code: 'SPRING',
    duration: 'once',
    percentOff: 10,
    redeemBy: '2026-12-31T23:59:00Z',
    rules: [{ pageId: 'page', appliesTo: 'prices', priceIds: ['price', ''] }, { pageId: '' }],
  });
  assert.deepEqual(body.rules, [{ pageId: 'page', appliesTo: 'prices', priceIds: ['price'] }]);
  assert.equal(body.redeemBy, '2026-12-31T23:59:00.000Z');
  assert.equal('pageIds' in body, false);
});
