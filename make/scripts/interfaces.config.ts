export interface DataSource {
  key: string;
  method: 'GET';
  path: string;
  items: boolean;
}

export interface Target {
  module: string;
  method: 'GET';
  path: string;
  items: boolean;
  exclude?: string[];
  labels?: Record<string, string>;
  wrap?: { event: true; key?: string; recoveryUrl?: boolean; data?: DataSource[] };
}

type Labels = Record<string, string>;

const CHECKOUT_PAGE: Labels = { pageId: 'Checkout page ID', pageSlug: 'Checkout page slug' };
const EVENT: Labels = { pageId: 'Event ID', pageSlug: 'Event slug' };
const FORM: Labels = { pageId: 'Form ID', pageSlug: 'Form slug' };
const UPSELL: Labels = { upsellPageId: 'Upsell checkout page ID' };
const REDIRECT: Labels = { redirectPageId: 'Redirect checkout page ID' };
const PAGE_EXCLUDE = ['themeOverrides', 'formLayout', 'funnelSteps', 'trackingCodes', 'images'];

const under = (key: string, values: Record<string, string>): Labels =>
  Object.fromEntries(Object.entries(values).map(([path, label]) => [`${key}.${path}`, label]));

const trigger = (
  module: string,
  path: string,
  key: string,
  opts: { recoveryUrl?: boolean; labels?: Labels } = {}
): Target => ({
  module,
  method: 'GET',
  path,
  items: true,
  ...(opts.labels ? { labels: under(key, opts.labels) } : {}),
  wrap: { event: true, key, ...(opts.recoveryUrl ? { recoveryUrl: true } : {}) },
});

const search = (
  module: string,
  path: string,
  opts: { labels?: Labels; exclude?: string[] } = {}
): Target => ({
  module,
  method: 'GET',
  path,
  items: true,
  ...(opts.exclude ? { exclude: opts.exclude } : {}),
  ...(opts.labels ? { labels: opts.labels } : {}),
});

export const targets: Target[] = [
  trigger('watchPayments', '/v1/payments/', 'payment', {
    recoveryUrl: true,
    labels: { ...CHECKOUT_PAGE, ...UPSELL },
  }),
  trigger('watchBookings', '/v1/bookings/', 'booking', {
    recoveryUrl: true,
    labels: { ...EVENT, ...UPSELL },
  }),
  trigger('watchTickets', '/v1/tickets/', 'ticket', { labels: { pageId: EVENT.pageId } }),
  trigger('watchSubscriptions', '/v1/subscriptions/', 'subscription', {
    recoveryUrl: true,
    labels: { ...CHECKOUT_PAGE, ...UPSELL },
  }),
  trigger('watchSubmissions', '/v1/submissions/', 'submission', { labels: FORM }),
  trigger('watchCustomers', '/v1/customers/', 'customer'),
  {
    module: 'watchPagesAndProducts',
    method: 'GET',
    path: '/v1/checkout-pages/',
    items: true,
    exclude: PAGE_EXCLUDE.map((name) => `checkoutPage.${name}`),
    labels: under('checkoutPage', REDIRECT),
    wrap: {
      event: true,
      data: [
        { key: 'checkoutPage', method: 'GET', path: '/v1/checkout-pages/', items: true },
        { key: 'product', method: 'GET', path: '/v1/products/', items: true },
      ],
    },
  },
  search('searchPayments', '/v1/payments/', { labels: { ...CHECKOUT_PAGE, ...UPSELL } }),
  search('searchBookings', '/v1/bookings/', { labels: { ...EVENT, ...UPSELL } }),
  search('searchSubscriptions', '/v1/subscriptions/', {
    labels: { ...CHECKOUT_PAGE, ...UPSELL },
  }),
  search('searchSubscriptionPayments', '/v1/subscription-payments/', { labels: CHECKOUT_PAGE }),
  search('searchSubmissions', '/v1/submissions/', { labels: FORM }),
  search('searchCustomers', '/v1/customers/'),
  search('searchCheckoutPages', '/v1/checkout-pages/', { exclude: PAGE_EXCLUDE, labels: REDIRECT }),
  search('searchEvents', '/v1/events/', { exclude: PAGE_EXCLUDE, labels: REDIRECT }),
  search('searchForms', '/v1/forms/', { exclude: PAGE_EXCLUDE, labels: REDIRECT }),
  search('searchProducts', '/v1/products/'),
  search('searchCoupons', '/v1/coupons/', {
    labels: { 'rules.pageId': 'Checkout page or event ID' },
  }),
  search('searchTickets', '/v1/tickets/', { labels: { pageId: EVENT.pageId } }),
  search('searchInvoices', '/v1/invoices/'),
];
