import type { CheckoutPageApiClient } from '../../client';
import type { InvoiceList, InvoiceListParams } from '../../types';

export class InvoiceResource {
  constructor(private client: CheckoutPageApiClient) {}

  async list(args: InvoiceListParams = {}): Promise<InvoiceList> {
    const query: Record<string, string | undefined> = {
      search: args.search,
      status: args.status,
      customerId: args.customerId,
      chargeId: args.chargeId,
      customerName: args.customerName,
      customerEmail: args.customerEmail,
      productTitle: args.productTitle,
      poNumber: args.poNumber,
      createdAfter: args.createdAfter,
      createdBefore: args.createdBefore,
      limit: args.limit?.toString(),
      starting_after: args.starting_after,
      ending_before: args.ending_before,
    };

    return this.client.request<InvoiceList>({
      method: 'GET',
      query,
      path: '/v1/invoices/',
    });
  }
}
