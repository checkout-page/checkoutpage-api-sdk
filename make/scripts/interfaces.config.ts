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
  wrap?: { event: true; key?: string; recoveryUrl?: boolean; data?: DataSource[] };
}

const trigger = (module: string, path: string, key: string, recoveryUrl = false): Target => ({
  module,
  method: 'GET',
  path,
  items: true,
  wrap: { event: true, key, ...(recoveryUrl ? { recoveryUrl: true } : {}) },
});

export const targets: Target[] = [
  trigger('watchPayments', '/v1/payments/', 'payment', true),
  trigger('watchBookings', '/v1/bookings/', 'booking', true),
  trigger('watchTickets', '/v1/tickets/', 'ticket'),
  trigger('watchSubscriptions', '/v1/subscriptions/', 'subscription', true),
  trigger('watchSubmissions', '/v1/submissions/', 'submission'),
  trigger('watchCustomers', '/v1/customers/', 'customer'),
  {
    module: 'watchPagesAndProducts',
    method: 'GET',
    path: '/v1/checkout-pages/',
    items: true,
    exclude: [
      'checkoutPage.themeOverrides',
      'checkoutPage.formLayout',
      'checkoutPage.funnelSteps',
      'checkoutPage.trackingCodes',
      'checkoutPage.images',
    ],
    wrap: {
      event: true,
      data: [
        { key: 'checkoutPage', method: 'GET', path: '/v1/checkout-pages/', items: true },
        { key: 'product', method: 'GET', path: '/v1/products/', items: true },
      ],
    },
  },
];
