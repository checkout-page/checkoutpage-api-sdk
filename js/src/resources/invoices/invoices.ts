import type { CheckoutPageApiClient } from '../../client';
import type { Invoice, InvoiceList, InvoiceListParams } from '../../types';

export class InvoiceResource {
  constructor(private client: CheckoutPageApiClient) {}

  async list(args: InvoiceListParams = {}): Promise<InvoiceList> {
    const query: Record<string, string | undefined> = {
      limit: args.limit?.toString(),
      starting_after: args.starting_after,
      ending_before: args.ending_before,
      search: args.search,
      status: args.status,
      customerId: args.customerId,
      chargeId: args.chargeId,
      poNumber: args.poNumber,
      createdAfter: args.createdAfter,
      createdBefore: args.createdBefore,
    };

    return this.client.request<InvoiceList>({
      method: 'GET',
      path: '/v1/invoices/',
      query,
    });
  }

  async regenerate(id: string): Promise<Invoice> {
    const response = await this.client.request<{ data: Invoice }>({
      method: 'POST',
      path: `/v1/invoices/${id}/regenerate`,
    });
    return response.data;
  }
}
