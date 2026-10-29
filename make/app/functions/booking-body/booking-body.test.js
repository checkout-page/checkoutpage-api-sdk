it('sums ticket rows per ticket type', () => {
  const body = bookingBody({
    eventId: 'event',
    tickets: [
      { ticketTypeId: 'adult', quantity: 1 },
      { ticketTypeId: 'adult', quantity: 2 },
    ],
    fields: [{ fieldId: 'email', value: 'a@b.co' }],
  });
  assert.deepEqual(body, {
    eventId: 'event',
    tickets: { adult: 3 },
    fields: [{ fieldId: 'email', value: 'a@b.co' }],
  });
});

it('records a manual payment and pay what you want amounts', () => {
  const body = bookingBody({
    eventId: 'event',
    tickets: [{ ticketTypeId: 'adult', quantity: 1, pwywAmount: 1500 }],
    fields: [{ fieldId: 'email', value: 'a@b.co' }],
    manualType: 'invoice',
    complimentary: false,
    couponId: '',
  });
  assert.deepEqual(body.paymentOption, { manualType: 'invoice' });
  assert.deepEqual(body.ticketPwywAmounts, { adult: 1500 });
  assert.equal(body.complimentary, false);
  assert.equal('couponId' in body, false);
});

it('rejects a booking without tickets', () => {
  assert.throws(
    () => bookingBody({ eventId: 'event', tickets: [], fields: [] }),
    /Add at least one ticket/
  );
});
