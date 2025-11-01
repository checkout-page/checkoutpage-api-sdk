import type { CheckoutPageApiClient } from '../../client';
import type { ValidateTicketData, ValidateTicketParams, ValidateTicketResponse } from '../../types';

export class TicketResource {
  constructor(private client: CheckoutPageApiClient) {}

  async validate(qrCode: string, params?: ValidateTicketParams): Promise<ValidateTicketResponse> {
    const body = params || {};

    const response = await this.client.request<ValidateTicketData>({
      method: 'POST',
      path: `/v1/tickets/validate/${qrCode}`,
      body,
    });

    return response.data;
  }
}
