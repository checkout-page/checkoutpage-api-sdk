it('patches only filled fields', () => {
  const body = customerBody({
    customerId: 'customer',
    name: 'Ada',
    email: '',
    address: { line1: '', city: '' },
    shipping: { address: { line1: '1 High St', city: 'London', country: 'GB' } },
  });
  assert.deepEqual(body, {
    name: 'Ada',
    shipping: { address: { line1: '1 High St', city: 'London', country: 'GB' } },
  });
});

it('rejects an update with nothing filled in', () => {
  assert.throws(
    () => customerBody({ customerId: 'customer' }),
    /Fill in at least one field to update/
  );
});
