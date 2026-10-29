const booking = (overrides) =>
  bookingBody(
    Object.assign(
      {
        eventId: 'event',
        tickets: [{ ticketTypeId: 'adult', quantity: 1 }],
        fields: [{ fieldId: 'email', value: 'a@b.co' }],
      },
      overrides
    )
  );

it('sums ticket rows per ticket type', () => {
  const body = booking({
    tickets: [
      { ticketTypeId: 'adult', quantity: 1 },
      { ticketTypeId: 'adult', quantity: 2 },
    ],
    recordAs: 'complimentary',
  });
  assert.deepEqual(body, {
    eventId: 'event',
    tickets: { adult: 3 },
    fields: [{ fieldId: 'email', value: 'a@b.co' }],
    complimentary: true,
  });
});

it('records a complimentary booking without a payment option', () => {
  const body = booking({ recordAs: 'complimentary' });
  assert.equal(body.complimentary, true);
  assert.equal('paymentOption' in body, false);
});

it('records invoice and on arrival bookings as a manual payment option', () => {
  for (const manualType of ['invoice', 'cash_on_delivery']) {
    const body = booking({ recordAs: manualType });
    assert.deepEqual(body.paymentOption, { manualType });
    assert.equal('complimentary' in body, false);
  }
});

it('sends pay what you want amounts and a coupon on a manual booking', () => {
  const body = booking({
    tickets: [{ ticketTypeId: 'adult', quantity: 1, pwywAmount: 1500 }],
    recordAs: 'invoice',
    couponId: 'coupon',
  });
  assert.deepEqual(body.ticketPwywAmounts, { adult: 1500 });
  assert.equal(body.couponId, 'coupon');
});

it('drops the coupon from a complimentary booking', () => {
  assert.equal('couponId' in booking({ recordAs: 'complimentary', couponId: 'coupon' }), false);
});

it('rejects a booking with no way to record it', () => {
  assert.throws(() => booking({}), /Choose how to record the booking/);
  assert.throws(() => booking({ recordAs: 'paid' }), /Choose how to record the booking/);
});

it('rejects a booking without tickets', () => {
  assert.throws(
    () => booking({ tickets: [], recordAs: 'complimentary' }),
    /Add at least one ticket/
  );
});
