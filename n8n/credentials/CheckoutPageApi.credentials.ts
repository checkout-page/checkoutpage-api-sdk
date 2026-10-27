import type {
  IAuthenticateGeneric,
  Icon,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class CheckoutPageApi implements ICredentialType {
  name = 'checkoutPageApi';

  displayName = 'Checkout Page API';

  icon: Icon = {
    light: 'file:../icons/checkoutpage.svg',
    dark: 'file:../icons/checkoutpage.dark.svg',
  };

  documentationUrl =
    'https://github.com/checkout-page/checkoutpage-api-sdk/tree/main/n8n#credentials';

  properties: INodeProperties[] = [
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description:
        'Your Checkout Page API key. Create one in the dashboard under Settings > API keys.',
    },
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'https://api.checkoutpage.com',
      description: 'Leave this as it is unless Checkout Page support gives you a different address',
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        Authorization: '=Bearer {{$credentials.apiKey}}',
      },
    },
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.baseUrl.replace(/\\/+$/, "")}}',
      url: '/v1/account/',
      method: 'GET',
    },
  };
}
