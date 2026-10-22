const test = async (z, bundle) => {
  const options = {
    url: `${process.env.API_URL}/zapier/v2/health`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${bundle.authData.api_key}`,
    },
  };

  return z.request(options).then((response) => {
    const results = response.json;

    // You can do any parsing you need for results here before returning them

    return results;
  });
};

module.exports = {
  type: 'custom',
  test: test,
  customConfig: {},
  fields: [
    {
      helpText:
        'You can create an API key within your store API key settings https://checkoutpage.com/dashboard/settings/api',
      computed: false,
      key: 'api_key',
      required: true,
      label: 'API Key',
      type: 'string',
    },
  ],
};
