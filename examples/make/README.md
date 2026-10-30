# Make examples

Scenarios for the [Checkout Page app for Make](../../make/README.md). Each one starts from a
Checkout Page module. The app is in private beta: ask support@checkoutpage.com for the invite
link, then create a Checkout Page connection with an API key from **Settings**, **Developers**,
**API keys** in the dashboard.

In the steps below, `1.` is the first module in the scenario and `2.` the second, as Make shows
them when you map a value.

## Watch payments to a Google Sheets row

Keep a live list of payments in a spreadsheet.

1. **Checkout Page**, **Watch payments**. Create a webhook and keep only the event **Payment
   paid**.
2. **Google Sheets**, **Add a row**. Map the columns:
   - Name: `{{1.payment.customerName}}`
   - Email: `{{1.payment.customerEmail}}`
   - Product: `{{1.payment.productTitle}}`
   - Amount: `{{1.payment.amount / 100}}` for two-decimal currencies such as USD or GBP.
     Amounts are in the smallest currency unit, so for zero-decimal currencies such as JPY use
     `{{1.payment.amount}}`.
   - Currency: `{{1.payment.currency}}`
   - Paid at: `{{1.payment.createdAt}}`
3. Turn the scenario on. Every paid payment becomes a row.

## Add an attendee from a form

Book everyone who fills in a sign-up form onto an event.

1. **Checkout Page**, **Watch submissions**. Create a webhook and keep only the event
   **Submission created**.
2. A filter after the trigger, so only one form books people: **Form ID** (`1.submission.pageId`)
   equal to your form's ID.
3. **Checkout Page**, **Create a booking**:
   - Event: choose it from the list
   - Tickets: one row with the ticket type and quantity 1
   - Fields: the event's email field set to `{{1.submission.customerEmail}}`, and its name
     field set to `{{1.submission.customerName}}`
   - Record as: **Complimentary** for free places, or **To be paid by invoice**

## A welcome coupon for every new customer

1. **Checkout Page**, **Watch customers**. Create a webhook and keep only the event **Customer
   created**.
2. **Checkout Page**, **Create a coupon**:
   - Label: `Welcome {{1.customer.email}}`
   - Code: `WELCOME-{{upper(substring(1.customer.id; 18; 24))}}`
   - Discount type: Percentage off, percentage off 10, duration Once
   - Maximum redemptions: 1
3. **Gmail**, **Send an email** (or any email module): send `{{2.code}}` to
   `{{1.customer.email}}`.
