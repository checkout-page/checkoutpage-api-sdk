const perform = async (z, bundle) => {
  const options = {
    url: `${process.env.API_URL}/zapier/v2/submissions`,
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${bundle.authData.api_key}`,
    },
    params: {
      limit: 25,
      skip: bundle.meta.page * 25,
      ...(bundle.inputData.include_test_submissions ? {} : { livemode: true }),
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
    inputFields: [
      {
        key: 'include_test_submissions',
        type: 'boolean',
        label: 'Include test submissions',
        helpText:
          'Set this to True if you want the Zap to trigger on test submissions',
        choices: [
          { sample: 'false', value: 'false', label: 'False' },
          { sample: 'true', value: 'true', label: 'True' },
        ],
        required: true,
        list: false,
        altersDynamicFields: false,
      },
    ],
    canPaginate: true,
    sample: {
      customerEmail: 'weae@wa.om',
      fields: { customer_email: 'weae@WA.OM' },
      createdDate: '2023-10-25T08:00:58.306Z',
      status: 'succeeded',
      checkoutName: 'Untitled',
      customerCreatedDate: '2023-10-25T08:00:58.272Z',
      customerId: '6538cb3ad769d28d3e4fdf6a',
      livemode: true,
      id: '6538cb3ad769d28d3e4fdf70',
      checkoutId: '65376fa183e380fa7bfa9338',
      checkoutSlug: 'untitled-2',
      createdAt: '2023-10-25T08:00:58.306Z',
    },
    outputFields: [
      { key: 'customerEmail' },
      { key: 'fields__customer_email' },
      { key: 'createdDate' },
      { key: 'status' },
      { key: 'checkoutName' },
      { key: 'customerCreatedDate' },
      { key: 'customerId' },
      { key: 'livemode' },
      { key: 'id' },
      { key: 'checkoutId' },
      { key: 'checkoutSlug' },
      { key: 'createdAt' },
    ],
  },
  display: {
    description: 'Triggers when a someone submits a Form',
    hidden: false,
    label: 'New Submission',
  },
  key: 'new_submission',
  noun: 'Submission',
};
