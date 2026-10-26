# n8n examples

Recipes for the [Checkout Page n8n nodes](../../n8n/README.md). Each one starts from a
**Checkout Page Trigger** or a **Checkout Page** node. Install the nodes first: in n8n, open
**Settings > Community nodes** and install `n8n-nodes-checkoutpage`.

## New booking to a Google Sheets row

Keep a live attendee list in a spreadsheet.

1. **Checkout Page Trigger**, event **Booking Created**.
2. **Google Sheets**, operation **Append Row**. Map the columns:
   - Name: `{{ $json.data.booking.customerName }}`
   - Email: `{{ $json.data.booking.customerEmail }}`
   - Event: `{{ $json.data.booking.eventTitle }}`
   - Amount: `{{ $json.data.booking.amount / 100 }}` for two-decimal currencies such as USD or
     GBP. Amounts are in the smallest currency unit, so for zero-decimal currencies such as JPY
     use `{{ $json.data.booking.amount }}`.
   - Currency: `{{ $json.data.booking.currency }}`
   - Booked at: `{{ $json.data.booking.createdAt }}`

## A welcome coupon for every new customer

1. **Checkout Page Trigger**, event **Customer Created**.
2. **Checkout Page**, **Coupon > Create**:
   - Label: `Welcome {{ $json.data.customer.email }}`
   - Code: `WELCOME-{{ $json.data.customer.id.slice(-6).toUpperCase() }}`
   - Discount type: Percentage, percent off 10, duration Once
   - Additional fields: Max redemptions 1
3. **Gmail** (or any email node): send the code to the new customer.

## Add attendees from a form or spreadsheet

Book people onto an event from rows you already have, such as a sign-up sheet.

1. **Google Sheets**, operation **Get Rows**.
2. **Checkout Page**, **Booking > Create**:
   - Event: choose it from the list
   - Tickets: the ticket type, quantity 1
   - Fields: the event's email field set to `{{ $json.Email }}`, and its name field set to
     `{{ $json.Name }}`
   - Additional fields: turn on **Complimentary** for free places, or set **Payment type** to
     Invoice

## Daily list of paid payments

1. **Schedule Trigger**, every day.
2. **Checkout Page**, **Payment > Get Many**, Return All on, with the filters **Status** Paid
   and **Created After** `{{ $now.minus({ days: 1 }).toUTC().toISO() }}`. A date from the date
   picker works too: the node reads it in the workflow's timezone.
3. Send the list to Slack or email.

## Look up a customer from an AI agent

Add the **Checkout Page** node as a tool on an **AI Agent** node. The agent can then answer
questions such as "has ada@example.com booked the summer camp?" by searching customers and
bookings.
