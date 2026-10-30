function couponBody(parameters) {
  const filled = (value) => value !== undefined && value !== null && value !== '';
  const ids = (list) =>
    Array.isArray(list) ? list.filter((id) => typeof id === 'string' && id !== '') : [];
  const p = parameters || {};

  const body = { label: p.label, code: p.code, duration: p.duration };
  if (p.duration === 'repeating' && filled(p.durationInMonths))
    body.durationInMonths = Number(p.durationInMonths);
  if (p.discountType === 'amount') {
    if (filled(p.amountOff)) body.amountOff = Number(p.amountOff);
    if (filled(p.currency)) body.currency = String(p.currency).toLowerCase();
  } else if (filled(p.percentOff)) {
    body.percentOff = Number(p.percentOff);
  }
  if (filled(p.maxRedemptions)) body.maxRedemptions = Number(p.maxRedemptions);

  const isDate = Object.prototype.toString.call(p.redeemBy) === '[object Date]';
  if (isDate || (typeof p.redeemBy === 'string' && p.redeemBy !== '')) {
    const date = new Date(p.redeemBy);
    if (!isNaN(date.getTime())) body.redeemBy = date.toISOString();
  }

  for (const flag of ['appliesToSetupFee', 'appliesToTicketFees'])
    if (filled(p[flag])) body[flag] = p[flag] === true || p[flag] === 'true';

  const rules = (p.rules || [])
    .filter((rule) => rule && filled(rule.pageId))
    .map((rule) => {
      const out = {
        pageId: rule.pageId,
        appliesTo: filled(rule.appliesTo) ? rule.appliesTo : 'wholeOrder',
      };
      for (const key of ['priceIds', 'ticketTypeIds']) {
        const list = ids(rule[key]);
        if (list.length) out[key] = list;
      }
      return out;
    });
  if (rules.length) body.rules = rules;
  return body;
}
