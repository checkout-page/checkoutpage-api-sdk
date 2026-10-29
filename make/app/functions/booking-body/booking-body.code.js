function bookingBody(parameters) {
  const filled = (value) => value !== undefined && value !== null && value !== '';
  const p = parameters || {};
  const tickets = {};
  const ticketPwywAmounts = {};
  for (const row of p.tickets || []) {
    if (!row || !filled(row.ticketTypeId)) continue;
    const quantity = filled(row.quantity) ? Number(row.quantity) : 1;
    if (!(quantity > 0)) continue;
    tickets[row.ticketTypeId] = (tickets[row.ticketTypeId] || 0) + quantity;
    if (filled(row.pwywAmount)) ticketPwywAmounts[row.ticketTypeId] = Number(row.pwywAmount);
  }
  if (!Object.keys(tickets).length) throw new Error('Add at least one ticket');

  const body = {
    eventId: p.eventId,
    tickets,
    fields: (p.fields || [])
      .filter((field) => field && filled(field.fieldId) && filled(field.value))
      .map((field) => ({ fieldId: field.fieldId, value: field.value })),
  };
  if (filled(p.complimentary))
    body.complimentary = p.complimentary === true || p.complimentary === 'true';
  if (filled(p.couponId)) body.couponId = p.couponId;
  if (filled(p.manualType)) body.paymentOption = { manualType: p.manualType };
  if (Object.keys(ticketPwywAmounts).length) body.ticketPwywAmounts = ticketPwywAmounts;
  return body;
}
