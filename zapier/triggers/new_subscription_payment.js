const perform = async (z, bundle) => {
  const options = {
    url: `${process.env.API_URL}/zapier/v2/subscription-payments`,
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${bundle.authData.api_key}`,
    },
    params: {
      limit: 25,
      skip: 25 * bundle.meta.page,
      ...(bundle.inputData.include_test_subscriptions
        ? {}
        : { livemode: true }),
    },
  };

  return z.request(options).then((response) => {
    response.throwForStatus();
    const results = response.json;

    // You can do any parsing you need for results here before returning them

    return results;
  });
};

module.exports = {
  operation: {
    perform: perform,
    canPaginate: true,
    inputFields: [
      {
        key: 'include_test_subscriptions',
        type: 'boolean',
        label: 'Include test subscriptions',
        helpText:
          'By default, the Zap will trigger on all successful subscriptions.\n\nEach subscription contains a "livemode" field that you can use to determine if it\'s a real or test subscription.\n\nChoose "False" to prevent the Zap from triggering on test subscriptions.',
        default: 'True',
        choices: [
          { sample: 'true', value: 'true', label: 'True' },
          { sample: 'false', value: 'false', label: 'False' },
        ],
        required: true,
        list: false,
        altersDynamicFields: false,
      },
    ],
    sample: {
      customerName: 'eawawe',
      customerEmail: 'weew@weew.com',
      amount: '225.00',
      currency: 'eur',
      createdDate: '2024-08-28T09:29:34.458Z',
      paymentStatus: 'succeeded',
      invoiceStatus: 'paid',
      paid: true,
      billingReason: 'subscription_create',
      checkoutName: 'Subscription',
      productTitle: 'Subscription',
      productNumberOfSubscribers: 4,
      customerCreatedDate: '2024-08-28T09:29:23.242Z',
      customerId: '66ceedf3c35b61efe4832119',
      stripeCustomerId: 'cus_QkCbe8aFcpwrQr',
      livemode: false,
      paymentGateway: 'stripe',
      paymentMethod: 'card',
      subscriptionId: '66ceedf4c35b61efe4832132',
      subscriptionOrderId: '42898959',
      stripeSubscriptionId: 'sub_1PsiBtJ7i86GeQKlUWGzDkNY',
      stripePaymentId: 'ch_3PsiBtJ7i86GeQKl1tnZx45l',
      stripePaymentIntentId: 'pi_3PsiBtJ7i86GeQKl1Ccx5ldM',
      stripeInvoicePdf:
        'https://pay.stripe.com/invoice/acct_1DRMcgJ7i86GeQKl/test_YWNjdF8xRFJNY2dKN2k4NkdlUUtsLF9Ra0NiUWc0aXE3VWEwMmJNQUlkdHRXMXk2QUFlZEhzLDExNTM3ODE3Mg0200uxITPoMQ/pdf?s=ap',
      id: '66ceedfec35b61efe48321c2',
      checkoutId: '66973a0dde853d7fbc07c926',
      checkoutSlug: 'subscription-3',
      isPrefilled: true,
      hasInteraction: true,
    },
    outputFields: [
      { key: 'customerName' },
      { key: 'customerEmail' },
      { key: 'amount' },
      { key: 'currency' },
      { key: 'createdDate', type: 'datetime' },
      { key: 'paymentStatus' },
      { key: 'invoiceStatus' },
      { key: 'paid' },
      { key: 'billingReason' },
      { key: 'checkoutName' },
      { key: 'productTitle' },
      { key: 'productNumberOfSubscribers' },
      { key: 'customerCreatedDate' },
      { key: 'customerId' },
      { key: 'stripeCustomerId' },
      { key: 'livemode', type: 'boolean' },
      { key: 'paymentGateway' },
      { key: 'paymentMethod' },
      { key: 'subscriptionId' },
      { key: 'subscriptionOrderId' },
      { key: 'stripeSubscriptionId' },
      { key: 'stripePaymentId' },
      { key: 'stripePaymentIntentId' },
      { key: 'stripeInvoicePdf' },
      { key: 'id', label: 'Subscription Payment ID' },
      { key: 'checkoutId' },
      { key: 'checkoutSlug' },
      { key: 'isPrefilled', type: 'boolean' },
      { key: 'hasInteraction', type: 'boolean' },
    ],
  },
  display: {
    description: 'Triggers when a subscription renews',
    hidden: false,
    label: 'New Subscription Payment',
  },
  key: 'new_subscription_payment',
  noun: 'Subscription Payment',
};
