function customerBody(parameters) {
  const filled = (value) => value !== undefined && value !== null && value !== '';
  const pick = (source, keys) => {
    const out = {};
    for (const key of keys) if (source && filled(source[key])) out[key] = source[key];
    return Object.keys(out).length ? out : undefined;
  };
  const ADDRESS = ['line1', 'line2', 'city', 'state', 'postalCode', 'country'];
  const p = parameters || {};

  const body = pick(p, ['name', 'email', 'phone', 'companyName', 'billingEmail']) || {};
  const address = pick(p.address, ADDRESS);
  if (address) body.address = address;
  const shipping = pick(p.shipping, ['name', 'phone']) || {};
  const shippingAddress = pick(p.shipping && p.shipping.address, ADDRESS);
  if (shippingAddress) shipping.address = shippingAddress;
  if (Object.keys(shipping).length) body.shipping = shipping;

  if (!Object.keys(body).length) throw new Error('Fill in at least one field to update');
  return body;
}
