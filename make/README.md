# Checkout Page for Make

Connect [Checkout Page](https://checkoutpage.com) to [Make](https://www.make.com), the
automation tool. Start a scenario when someone books a ticket, pays or fills in a form. Add
attendees, create coupons and look up customers, without writing code. It is for organizations
that already use Make to send their sales and sign-ups to spreadsheets, email and other apps.

## Install

The Make app is in private beta. Email support@checkoutpage.com for the invite link, then open
the link while you are signed in to Make. The Checkout Page modules then appear when you add a
module to a scenario and search for "Checkout Page".

Once Make has reviewed the app, you will find it by searching for Checkout Page in Make, with
no invite link.

## Connection

1. In the Checkout Page dashboard, go to **Settings**, **Developers**, **API keys** and create
   an API key.
2. In Make, add any Checkout Page module and select **Create a connection**.
3. Paste the key into **API key** and save.

Make checks the key when you save the connection. A key from test mode only reads and writes
test data.

Under the advanced settings, leave **API base URL** as `https://api.checkoutpage.com` unless
Checkout Page support gave you another URL.

## Modules

| Module                            | What it does                                                                                    |
| --------------------------------- | ----------------------------------------------------------------------------------------------- |
| Watch payments                    | Triggers when a payment is created, paid or abandoned.                                          |
| Watch bookings                    | Triggers when an event booking is created, paid or abandoned.                                   |
| Watch tickets                     | Triggers when a ticket is created for an event.                                                 |
| Watch subscriptions               | Triggers when a subscription is created or changes status.                                      |
| Watch submissions                 | Triggers when a form submission is created or updated.                                          |
| Watch customers                   | Triggers when a customer is created or updated.                                                 |
| Watch checkout pages and products | Triggers when a checkout page or product is created or updated.                                 |
| Create a booking                  | Adds an attendee to an event, recorded as complimentary or to be paid by invoice or on arrival. |
| Create a coupon                   | Creates a coupon for checkout pages and events.                                                 |
| Update a customer                 | Changes a customer's details. Empty fields are left as they are.                                |
| Search payments, bookings, ...    | Returns the records that match your filters, up to the limit you set. See the list below.       |
| Get a payment, a booking, ...     | Returns one record by its ID. See the list below.                                               |
| Make an API call                  | Calls any seller API endpoint with your connection, for anything the other modules don't cover. |

The searches are **Search payments**, **Search bookings**, **Search subscriptions**, **Search
subscription payments**, **Search submissions**, **Search customers**, **Search checkout
pages**, **Search events**, **Search forms**, **Search products**, **Search coupons**,
**Search tickets** and **Search invoices**. Each one has filters, such as a status, an event, a
customer or a date range. **Limit** is 10 by default.

The gets are **Get a payment**, **Get a booking**, **Get a subscription**, **Get a subscription
payment**, **Get a submission**, **Get an invoice**, **Get a customer**, **Get a checkout
page**, **Get an event**, **Get a form** and **Get a product**.

Where a module asks for an event, checkout page, form, customer or coupon, pick it from the
list or map its ID. Amounts are in the smallest currency unit, such as cents.

### Add an attendee

**Create a booking** books tickets on an event without taking a card payment. Pick the event
from the list, so that its ticket types and fields load. Then add:

- **Tickets**: one row per ticket type, with how many. For a pay what you want ticket, set
  **Pay what you want amount** in the smallest currency unit.
- **Fields**: a value for each of the event's fields. Always include the email field, because
  the attendee's customer record is created from it. Fields with no value are left out.
  Each field takes the value you map to it. For an address field, map an object with the
  address lines, city, state, postal code and country.
- **Record as**: required. Choose **Complimentary** (no charge), **To be paid by invoice** or
  **To be paid on arrival**.
- **Coupon**: optional. A complimentary booking ignores the coupon.

### Create a coupon

**Create a coupon** makes a percentage or fixed-amount coupon. For an amount off, also set the
three-letter **Currency**, such as `usd`. **Duration** says how long the discount applies to a
subscription: once, for a number of months, or forever.

With no rules, the coupon works on every checkout page and event and discounts the whole order.
To limit where it works, add a row under **Rules** for each checkout page or event, with its ID
and what the coupon discounts there:

- **Whole order**: everything in the order.
- **Prices** (checkout pages): works when the customer buys one of the prices in **Price IDs**,
  and discounts that price only. Leave **Price IDs** empty for every price.
- **Tickets** (events): works when the customer buys one of the ticket types in **Ticket type
  IDs**, and discounts those tickets only. Leave **Ticket type IDs** empty for every ticket
  type.

Setup fees and ticket fees are discounted only when **Applies to setup fee** or **Applies to
ticket fees** is on.

## Triggers

Each Watch module starts a scenario as soon as something happens in your account. When you add
one, Make asks you to create a webhook and choose its events. Every event the module covers is
selected by default:

| Trigger                           | Events                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------ |
| Watch payments                    | Payment created, paid, abandoned                                                           |
| Watch bookings                    | Booking created, paid, abandoned                                                           |
| Watch tickets                     | Ticket created                                                                             |
| Watch subscriptions               | Subscription created, trialing, scheduled, active, completed, canceled, expired, abandoned |
| Watch submissions                 | Submission created, updated                                                                |
| Watch customers                   | Customer created, updated                                                                  |
| Watch checkout pages and products | Checkout page created, updated, product created, updated                                   |

When you save the webhook, Make adds it to your Checkout Page account, named after your
scenario, for example "Make: New bookings to Google Sheets". When you delete the webhook in
Make, Make removes it from your account too. You don't need to set anything up in the
dashboard.

Each bundle has the event, its ID and time, and the record, such as the payment. Payment,
booking and subscription events also have a **Recovery URL** for abandoned checkouts.

Things to know:

- An account can have up to 10 webhooks, and each webhook in Make uses one. Remove the ones
  you no longer use in the Checkout Page dashboard under **Settings**, **Developers**,
  **Webhooks**.
- Deliveries carry a secret header that Make checks when it can.
- Make ignores the test delivery you send from the Checkout Page dashboard. To try a trigger,
  select **Run once** in Make, then make a test booking or payment.

## Examples

Step-by-step scenarios are in [examples/make](../examples/make/README.md): payments to a
Google Sheets row, attendees from a form, and a welcome coupon for every new customer.

## Contributing

The app's source is in `app/`, in the local file format of Make's Make Apps Editor extension
for VS Code. Run the tests with `npm ci && npm test`. Deploying needs that extension and a Make
API token with the `sdk-apps:read` and `sdk-apps:write` scopes. See [CLAUDE.md](CLAUDE.md) for
how to add a module, deploy and release.

## Help

- API reference: [checkoutpage.com/docs](https://checkoutpage.com/docs)
- Issues: [GitHub](https://github.com/checkout-page/checkoutpage-api-sdk/issues)
- Email: support@checkoutpage.com

This app is part of the
[Checkout Page developer tools](https://github.com/checkout-page/checkoutpage-api-sdk). MIT
License.
