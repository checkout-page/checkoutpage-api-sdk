# Checkout Page for n8n

Connect [Checkout Page](https://checkoutpage.com) to [n8n](https://n8n.io), the workflow
automation tool. Start a workflow when someone books a ticket or pays, add attendees, create
coupons and look up customers, without writing code.

This package has two nodes:

- **Checkout Page Trigger** starts a workflow when something happens in your account, such as a
  new booking or a paid payment.
- **Checkout Page** reads and changes your data: bookings, payments, customers, coupons,
  subscriptions, events, checkout pages and forms.

The Checkout Page node also works as a tool for n8n's AI agents.

## Install

In n8n:

1. Open **Settings > Community nodes**.
2. Select **Install**.
3. Enter `n8n-nodes-checkoutpage` and confirm.

The nodes then appear in the nodes panel when you search for "Checkout Page".

## Credentials

1. In the Checkout Page dashboard, open **Settings > API keys** and create a key.
2. In n8n, add a **Checkout Page API** credential and paste the key into **API Key**.
3. Leave **Base URL** as `https://api.checkoutpage.com`.

n8n checks the key when you save the credential. A key from test mode only reads and writes test
data.

## Operations

| Resource      | Operations                              |
| ------------- | --------------------------------------- |
| Booking       | Create (add an attendee), get, get many |
| Payment       | Get, get many                           |
| Customer      | Get, get many, update                   |
| Coupon        | Create, get many                        |
| Subscription  | Get, get many                           |
| Event         | Get, get many                           |
| Checkout page | Get, get many                           |
| Form          | Get, get many                           |

"Get many" can return every record or stop at a limit. Each one has filters, such as a booking's
status, its event, a customer or a date range.

"Get" and "get many" return a short version of each record by default, with up to 10 of the
fields you are most likely to use, such as the name, email, amount, status and date. Turn off
**Simplify** to get every field.

To get one customer, event, checkout page or form, pick it from a searchable list or enter its
ID.

### Add an attendee

**Booking > Create** books tickets on an event without taking a card payment. Pick the event
from the list, where you can search by name, or switch to **By ID** and paste or map the event
ID. Then add:

- **Tickets**: a ticket type and how many.
- **Fields**: a value for each of the event's fields. Always include the email field, because
  the attendee's customer record is created from it. Multi-select and address fields can't be
  set from n8n yet, so an event that requires one can't be booked from here.

Under **Additional fields** you can make the booking complimentary (no charge), record it as
paid by invoice or cash on delivery, or apply a coupon.

### Create a coupon

**Coupon > Create** makes a percentage or fixed-amount coupon. With no rules, it works on every
checkout page and event and discounts the whole order. To limit where it works, add a row under
**Rules** for each checkout page or event, with its ID and what the coupon discounts there:

- **Whole order**: everything in the order. On a checkout page that is the product at any price
  and every order bump. On an event it is every ticket and add-on.
- **Prices** (checkout pages): works when the customer buys one of the prices in **Price IDs**,
  and discounts that price only. Leave **Price IDs** empty for every price.
- **Tickets** (events): works when the customer buys one of the ticket types in **Ticket type
  IDs**, and discounts those tickets only. Leave **Ticket type IDs** empty for every ticket type.

Setup fees and ticket fees are discounted only when **Applies to setup fee** or **Applies to
ticket fees** is on, under **Additional fields**.

## The trigger

Pick one or more events, such as **Booking Created** or **Payment Paid**. When you activate the
workflow, the node registers a webhook in your Checkout Page account. When you deactivate it, the
node removes the webhook again. You don't need to set anything up in the dashboard.

Every delivery is signed. The node checks the signature and ignores anything that Checkout Page
did not send.

Each run gets one item with the event, for example:

```json
{
  "event": "booking.created",
  "data": {
    "booking": { "id": "...", "customerName": "Ada Lovelace", "eventTitle": "Summer camp" }
  },
  "sellerId": "...",
  "timestamp": "2026-10-22T12:00:00.000Z",
  "eventId": "...",
  "api_version": "v1"
}
```

Things to know:

- Checkout Page only sends webhooks to `https` addresses. A local n8n on `http://localhost` needs
  a public https address, such as a tunnel.
- An account can have up to 10 webhooks. Each active workflow with this trigger uses one, and so
  does each test run while it is listening.
- To try the trigger, select **Listen for test event**, then make a test booking or payment.

## Examples

### New booking to a Google Sheets row

1. Add a **Checkout Page Trigger** with the event **Booking Created**.
2. Add a **Google Sheets** node with the operation **Append Row**.
3. Map columns to the booking, for example `{{ $json.data.booking.customerName }}`,
   `{{ $json.data.booking.customerEmail }}`, `{{ $json.data.booking.eventTitle }}` and
   `{{ $json.data.booking.amount / 100 }}`. Amounts are in the smallest currency unit, such as
   cents, so divide by 100 only for two-decimal currencies such as USD, GBP or EUR. For
   zero-decimal currencies such as JPY, use `{{ $json.data.booking.amount }}` as it is. The
   currency is in `{{ $json.data.booking.currency }}`.
4. Activate the workflow. Every new booking becomes a row.

### A welcome coupon for every new customer

1. Add a **Checkout Page Trigger** with the event **Customer Created**.
2. Add a **Checkout Page** node: **Coupon > Create**.
   - **Label**: `Welcome {{ $json.data.customer.email }}`
   - **Code**: `WELCOME-{{ $json.data.customer.id.slice(-6).toUpperCase() }}`
   - **Discount type**: Percentage, **Percent off**: 10, **Duration**: Once
   - Under **Additional fields**, set **Max redemptions** to 1.
3. Add an email node, such as Gmail, to send the code to `{{ $('Checkout Page Trigger').item.json.data.customer.email }}`.

More recipes are in
[examples/n8n](https://github.com/checkout-page/checkoutpage-api-sdk/tree/main/examples/n8n).

## Help

- API reference: [docs.checkoutpage.com](https://docs.checkoutpage.com)
- Issues: [GitHub](https://github.com/checkout-page/checkoutpage-api-sdk/issues)
- Email: support@checkoutpage.com

This package is part of the
[Checkout Page developer tools](https://github.com/checkout-page/checkoutpage-api-sdk). MIT
License.
