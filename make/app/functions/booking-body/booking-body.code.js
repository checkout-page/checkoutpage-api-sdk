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
  if (p.recordAs === 'complimentary') body.complimentary = true;
  else if (p.recordAs === 'invoice' || p.recordAs === 'cash_on_delivery')
    body.paymentOption = { manualType: p.recordAs };
  else throw new Error('Choose how to record the booking');
  if (filled(p.couponId) && !body.complimentary) body.couponId = p.couponId;
  if (Object.keys(ticketPwywAmounts).length) body.ticketPwywAmounts = ticketPwywAmounts;
  return body;
}
