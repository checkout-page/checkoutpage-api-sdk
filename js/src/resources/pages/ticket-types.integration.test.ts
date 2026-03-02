import { describe, it, expect, beforeAll } from 'vitest';
import { CheckoutPageClient, createCheckoutPageClient } from '../../index';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';

describe('PageTicketTypeResource Integration Tests', () => {
  let client: CheckoutPageClient;
  let config: ReturnType<typeof loadIntegrationConfig>;
  let testPageId: string;
  let testGroupId: string;
  let testTicketTypeId: string;

  beforeAll(async () => {
    config = loadIntegrationConfig();

    client = createCheckoutPageClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    });

    // Create a test event page with a ticket group
    const { data: page } = await client.pages.create({
      name: `Ticket Type Test Event ${Date.now()}`,
      type: 'event',
      title: 'Test Event for Ticket Types',
      ticketGroups: [
        {
          name: 'Test Group',
          ticketTypes: [
            {
              name: 'Initial Ticket',
              pricing: 'paid',
              price: 1000,
            },
          ],
        },
      ],
    });

    testPageId = page.id;

    // Extract the ticket group ID from the created page
    if (page.ticketGroups && page.ticketGroups.length > 0) {
      testGroupId = page.ticketGroups[0].id;
    } else {
      throw new Error('No ticket groups found on created event page');
    }
  });

  describe('create', () => {
    it('should create a basic paid ticket type', async () => {
      const { data: ticket } = await client.pageTicketTypes.create(testPageId, testGroupId, {
        name: 'General Admission',
        pricing: 'paid',
        price: 4900,
      });

      expect(ticket).toBeDefined();
      expect(ticket?.name).toBe('General Admission');
      expect(ticket?.pricing).toBe('paid');
      expect(ticket?.price).toBe(4900);

      // Save for update/delete tests
      if (ticket?.id) {
        testTicketTypeId = ticket.id;
      }
    });

    it('should create a free ticket type', async () => {
      const { data: ticket } = await client.pageTicketTypes.create(testPageId, testGroupId, {
        name: 'Free Registration',
        pricing: 'free',
        price: 0,
      });

      expect(ticket).toBeDefined();
      expect(ticket.pricing).toBe('free');
      expect(ticket.price).toBe(0);
    });

    it('should create a pay-what-you-want ticket type', async () => {
      const { data: ticket } = await client.pageTicketTypes.create(testPageId, testGroupId, {
        name: 'Donation Ticket',
        pricing: 'pwyw',
        price: 1000,
      });

      expect(ticket).toBeDefined();
      expect(ticket.pricing).toBe('pwyw');
      expect(ticket.price).toBe(1000);
    });

    it('should create a ticket with description', async () => {
      const { data: ticket } = await client.pageTicketTypes.create(testPageId, testGroupId, {
        name: 'VIP Access',
        description: 'Includes backstage pass and meet & greet',
        pricing: 'paid',
        price: 29900,
      });

      expect(ticket).toBeDefined();
      expect(ticket.description).toBe('Includes backstage pass and meet & greet');
    });

    it('should create a ticket with limited capacity', async () => {
      const { data: ticket } = await client.pageTicketTypes.create(testPageId, testGroupId, {
        name: 'Early Bird (Limited)',
        pricing: 'paid',
        price: 3900,
        capacity: 50,
      });

      expect(ticket).toBeDefined();
      expect(ticket.capacity).toBe(50);
    });

    it('should create a ticket with min/max quantity restrictions', async () => {
      const { data: ticket } = await client.pageTicketTypes.create(testPageId, testGroupId, {
        name: 'Group Ticket',
        pricing: 'paid',
        price: 9900,
        minQuantity: 2,
        maxQuantity: 10,
      });

      expect(ticket).toBeDefined();
      expect(ticket.minQuantity).toBe(2);
      expect(ticket.maxQuantity).toBe(10);
    });

    it('should create a disabled ticket type', async () => {
      const { data: ticket } = await client.pageTicketTypes.create(testPageId, testGroupId, {
        name: 'Disabled Ticket',
        pricing: 'paid',
        price: 1000,
        status: 'disabled',
      });

      expect(ticket).toBeDefined();
      expect(ticket.status).toBe('disabled');
    });

    it('should create a hidden ticket type', async () => {
      const { data: ticket } = await client.pageTicketTypes.create(testPageId, testGroupId, {
        name: 'Hidden Ticket',
        pricing: 'paid',
        price: 5000,
        hidden: true,
      });

      expect(ticket).toBeDefined();
      expect(ticket.hidden).toBe(true);
    });

    it('should create a ticket with custom reference', async () => {
      const { data: ticket } = await client.pageTicketTypes.create(testPageId, testGroupId, {
        name: 'Reference Ticket',
        pricing: 'paid',
        price: 2500,
        reference: 'custom-ticket-ref',
      });

      expect(ticket).toBeDefined();
      expect(ticket.reference).toBe('custom-ticket-ref');
    });

    it('should create a ticket with discounted price', async () => {
      const { data: ticket } = await client.pageTicketTypes.create(testPageId, testGroupId, {
        name: 'Sale Ticket',
        pricing: 'paid',
        price: 4900,
        discountedFromPrice: 6900,
      });

      expect(ticket).toBeDefined();
      expect(ticket.price).toBe(4900);
      expect(ticket.discountedFromPrice).toBe(6900);
    });

    it('should create a ticket with sale date restrictions', async () => {
      const { data: ticket } = await client.pageTicketTypes.create(testPageId, testGroupId, {
        name: 'Timed Sale Ticket',
        pricing: 'paid',
        price: 3500,
        availabilityBehavior: 'date_time_based',
        saleStartOn: '2024-06-01T00:00:00Z',
        saleEndOn: '2024-12-31T23:59:59Z',
      });

      expect(ticket).toBeDefined();
      expect(ticket.availabilityBehavior).toBe('availabilityBehavior');
      expect(ticket.saleStartOn).toBeDefined();
      expect(ticket.saleEndOn).toBeDefined();
    });

    it('should create a ticket with visibility options', async () => {
      const { data: ticket } = await client.pageTicketTypes.create(testPageId, testGroupId, {
        name: 'Conditional Visibility Ticket',
        pricing: 'paid',
        price: 4000,
        hideWhenSoldOut: true,
        hideWhenNotOnSale: true,
        hideWhenScheduled: true,
        hideWhenUnavailable: true,
      });

      expect(ticket).toBeDefined();
      expect(ticket.hideWhenSoldOut).toBe(true);
      expect(ticket.hideWhenNotOnSale).toBe(true);
      expect(ticket.hideWhenScheduled).toBe(true);
      expect(ticket.hideWhenUnavailable).toBe(true);
    });

    it('should create a ticket with quantity display settings', async () => {
      const { data: ticket } = await client.pageTicketTypes.create(testPageId, testGroupId, {
        name: 'Display Settings Ticket',
        pricing: 'paid',
        price: 2000,
        capacity: 100,
        showAvailableQuantity: false,
        showTicketSaleDates: false,
      });

      expect(ticket).toBeDefined();
      expect(ticket.showAvailableQuantity).toBe(false);
      expect(ticket.showTicketSaleDates).toBe(false);
    });

    it('should create a ticket with booking fee', async () => {
      const { data: ticket } = await client.pageTicketTypes.create(testPageId, testGroupId, {
        name: 'Ticket with Booking Fee',
        pricing: 'paid',
        price: 5000,
        bookingFee: {
          enabled: true,
          type: 'percentage',
          percentageFee: 10,
        },
      });

      expect(ticket).toBeDefined();
      expect(ticket.bookingFee).toBeDefined();
      expect(ticket.bookingFee?.type).toBe('percentage');
      expect(ticket.bookingFee?.percentageFee).toBe(10);
    });

    it('should create a ticket with image', async () => {
      const { data: ticket } = await client.pageTicketTypes.create(testPageId, testGroupId, {
        name: 'Ticket with Image',
        pricing: 'paid',
        price: 3500,
        image: {
          url: 'https://example.com/ticket-image.jpg',
        },
      });

      expect(ticket).toBeDefined();
      expect(ticket.image).toBeDefined();
      expect(ticket.image?.url).toBe('https://example.com/ticket-image.jpg');
    });
  });

  describe('update', () => {
    it('should update ticket type name', async () => {
      const { data: ticket } = await client.pageTicketTypes.update(
        testPageId,
        testGroupId,
        testTicketTypeId,
        {
          name: 'General Admission (Updated)',
        }
      );

      expect(ticket).toBeDefined();
      expect(ticket.name).toBe('General Admission (Updated)');
    });

    it('should update ticket type price', async () => {
      const { data: ticket } = await client.pageTicketTypes.update(
        testPageId,
        testGroupId,
        testTicketTypeId,
        {
          price: 5900,
        }
      );

      expect(ticket).toBeDefined();
      expect(ticket.price).toBe(5900);
    });

    it('should update ticket type description', async () => {
      const { data: ticket } = await client.pageTicketTypes.update(
        testPageId,
        testGroupId,
        testTicketTypeId,
        {
          description: 'Updated description with more details',
        }
      );

      expect(ticket).toBeDefined();
      expect(ticket.description).toBe('Updated description with more details');
    });

    it('should update ticket type status', async () => {
      const { data: ticket } = await client.pageTicketTypes.update(
        testPageId,
        testGroupId,
        testTicketTypeId,
        {
          status: 'disabled',
        }
      );

      expect(ticket).toBeDefined();
      expect(ticket.status).toBe('disabled');
    });

    it('should update ticket type capacity', async () => {
      const { data: ticket } = await client.pageTicketTypes.update(
        testPageId,
        testGroupId,
        testTicketTypeId,
        {
          capacity: 200,
        }
      );

      expect(ticket).toBeDefined();
      expect(ticket.capacity).toBe(200);
    });

    it('should update ticket type quantity restrictions', async () => {
      const { data: ticket } = await client.pageTicketTypes.update(
        testPageId,
        testGroupId,
        testTicketTypeId,
        {
          minQuantity: 1,
          maxQuantity: 20,
        }
      );

      expect(ticket).toBeDefined();
      expect(ticket.minQuantity).toBe(1);
      expect(ticket.maxQuantity).toBe(20);
    });

    it('should update ticket type hidden status', async () => {
      const { data: ticket } = await client.pageTicketTypes.update(
        testPageId,
        testGroupId,
        testTicketTypeId,
        {
          hidden: true,
        }
      );

      expect(ticket).toBeDefined();
      expect(ticket.hidden).toBe(true);
    });

    it('should update ticket type reference', async () => {
      const { data: ticket } = await client.pageTicketTypes.update(
        testPageId,
        testGroupId,
        testTicketTypeId,
        {
          reference: 'updated-ticket-ref',
        }
      );

      expect(ticket).toBeDefined();
      expect(ticket.reference).toBe('updated-ticket-ref');
    });

    it('should update multiple ticket type properties simultaneously', async () => {
      const { data: ticket } = await client.pageTicketTypes.update(
        testPageId,
        testGroupId,
        testTicketTypeId,
        {
          name: 'Updated Ticket',
          description: 'Fully updated ticket type',
          price: 6900,
          capacity: 150,
          status: 'enabled',
          hidden: false,
        }
      );

      expect(ticket).toBeDefined();
      expect(ticket.name).toBe('Updated Ticket');
      expect(ticket.description).toBe('Fully updated ticket type');
      expect(ticket.price).toBe(6900);
      expect(ticket.capacity).toBe(150);
      expect(ticket.status).toBe('enabled');
      expect(ticket.hidden).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete a ticket type', async () => {
      await client.pageTicketTypes.delete(testPageId, testGroupId, testTicketTypeId);

      // Verify ticket is deleted by fetching the page
      const { data: page } = await client.pages.get(testPageId);
      const group = page.ticketGroups?.find((g) => g.id === testGroupId);
      const deletedTicket = group?.ticketTypes?.find((t) => t.id === testTicketTypeId);

      expect(deletedTicket).toBeUndefined();
    });
  });
});
