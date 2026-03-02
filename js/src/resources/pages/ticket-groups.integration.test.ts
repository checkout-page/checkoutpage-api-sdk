import { describe, it, expect, beforeAll } from 'vitest';
import { CheckoutPageClient, createCheckoutPageClient } from '../../index';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';

describe('PageTicketGroupResource Integration Tests', () => {
  let client: CheckoutPageClient;
  let config: ReturnType<typeof loadIntegrationConfig>;
  let testEventPageId: string;
  let testTicketGroupId: string;

  beforeAll(async () => {
    config = loadIntegrationConfig();

    client = createCheckoutPageClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    });

    // Create a test event page to use for ticket group testing
    const { data: page } = await client.pages.create({
      name: `Ticket Group Test Event ${Date.now()}`,
      type: 'event',
      title: 'Test Event for Ticket Groups',
    });

    testEventPageId = page.id;
  });

  describe('create', () => {
    it('should create a basic ticket group with required fields', async () => {
      const { data: createdGroup } = await client.pageTicketGroups.create(testEventPageId, {
        name: 'Early Bird Tickets',
      });

      expect(createdGroup).toBeDefined();
      expect(createdGroup.name).toBe('Early Bird Tickets');

      // Save ticket group ID for later tests
      if (createdGroup.id) {
        testTicketGroupId = createdGroup.id;
      }
    });

    it('should create a ticket group with description', async () => {
      const { data: createdGroup } = await client.pageTicketGroups.create(testEventPageId, {
        name: 'VIP Passes',
        description: 'Exclusive VIP access with premium seating',
      });

      expect(createdGroup).toBeDefined();
      expect(createdGroup.description).toBe('Exclusive VIP access with premium seating');
    });

    it('should create a ticket group with status', async () => {
      const { data: createdGroup } = await client.pageTicketGroups.create(testEventPageId, {
        name: 'General Admission',
        status: 'enabled',
      });

      expect(createdGroup).toBeDefined();
      expect(createdGroup?.status).toBe('enabled');
    });

    it('should create a disabled ticket group', async () => {
      const { data: createdGroup } = await client.pageTicketGroups.create(testEventPageId, {
        name: 'Coming Soon Tickets',
        status: 'disabled',
      });

      expect(createdGroup).toBeDefined();
      expect(createdGroup.status).toBe('disabled');
    });

    it('should create a ticket group with reference', async () => {
      const { data: createdGroup } = await client.pageTicketGroups.create(testEventPageId, {
        name: 'Student Tickets',
        reference: 'student-discount-2024',
      });

      expect(createdGroup).toBeDefined();
      expect(createdGroup.reference).toBe('student-discount-2024');
    });

    it('should create a ticket group with layout configuration', async () => {
      const { data: createdGroup } = await client.pageTicketGroups.create(testEventPageId, {
        name: 'Premium Seating',
        layout: {
          type: 'grid',
          columns: 3,
        },
      });

      expect(createdGroup).toBeDefined();
      expect(createdGroup.layout).toBeDefined();
      expect(createdGroup.layout?.type).toBe('grid');
      expect(createdGroup.layout?.columns).toBe(3);
    });

    it('should create a ticket group with ticket selection type', async () => {
      const { data: createdGroup } = await client.pageTicketGroups.create(testEventPageId, {
        name: 'Group Packages',
        ticketSelectionType: 'quantity',
      });

      expect(createdGroup).toBeDefined();
      expect(createdGroup.ticketSelectionType).toBe('quantity');
    });

    it('should create a ticket group with single selection type', async () => {
      const { data: createdGroup } = await client.pageTicketGroups.create(testEventPageId, {
        name: 'Single Choice Tickets',
        ticketSelectionType: 'single',
      });

      expect(createdGroup).toBeDefined();
      expect(createdGroup.ticketSelectionType).toBe('single');
    });

    it('should create a ticket group with multiple selection type', async () => {
      const { data: createdGroup } = await client.pageTicketGroups.create(testEventPageId, {
        name: 'Multiple Choice Tickets',
        ticketSelectionType: 'multiple',
      });

      expect(createdGroup).toBeDefined();
      expect(createdGroup.ticketSelectionType).toBe('multiple');
    });

    it('should create a ticket group with preselect configuration', async () => {
      const { data: createdGroup } = await client.pageTicketGroups.create(testEventPageId, {
        name: 'Preselected Tickets',
        preselect: {
          enabled: true,
          quantity: 2,
        },
      });

      expect(createdGroup).toBeDefined();
      expect(createdGroup.preselect).toBeDefined();
      expect(createdGroup.preselect?.enabled).toBe(true);
      expect(createdGroup.preselect?.quantity).toBe(2);
    });

    it('should create a ticket group with capacity limit', async () => {
      const { data: createdGroup } = await client.pageTicketGroups.create(testEventPageId, {
        name: 'Limited Capacity',
        capacity: 100,
      });

      expect(createdGroup).toBeDefined();
      expect(createdGroup.capacity).toBe(100);
    });

    it('should create a ticket group with unlimited capacity', async () => {
      const { data: createdGroup } = await client.pageTicketGroups.create(testEventPageId, {
        name: 'Unlimited Tickets',
        capacity: null,
      });

      expect(createdGroup).toBeDefined();
      expect(createdGroup.capacity).toBeNull();
    });

    it('should create a hidden ticket group', async () => {
      const { data: createdGroup } = await client.pageTicketGroups.create(testEventPageId, {
        name: 'Hidden Group',
        hidden: true,
      });

      expect(createdGroup).toBeDefined();
      expect(createdGroup.hidden).toBe(true);
    });

    it('should create a ticket group with hideWhenSoldOut enabled', async () => {
      const { data: createdGroup } = await client.pageTicketGroups.create(testEventPageId, {
        name: 'Auto Hide Sold Out',
        hideWhenSoldOut: true,
      });

      expect(createdGroup).toBeDefined();
      expect(createdGroup.hideWhenSoldOut).toBe(true);
    });

    it('should create a ticket group with hideWhenNotOnSale enabled', async () => {
      const { data: createdGroup } = await client.pageTicketGroups.create(testEventPageId, {
        name: 'Auto Hide Not On Sale',
        hideWhenNotOnSale: true,
      });

      expect(createdGroup).toBeDefined();
      expect(createdGroup.hideWhenNotOnSale).toBe(true);
    });

    it('should create a ticket group with hideWhenScheduled enabled', async () => {
      const { data: createdGroup } = await client.pageTicketGroups.create(testEventPageId, {
        name: 'Auto Hide Scheduled',
        hideWhenScheduled: true,
      });

      expect(createdGroup).toBeDefined();
      expect(createdGroup.hideWhenScheduled).toBe(true);
    });

    it('should create a ticket group with hideWhenUnavailable enabled', async () => {
      const { data: createdGroup } = await client.pageTicketGroups.create(testEventPageId, {
        name: 'Auto Hide Unavailable',
        hideWhenUnavailable: true,
      });

      expect(createdGroup).toBeDefined();
      expect(createdGroup.hideWhenUnavailable).toBe(true);
    });

    it('should create a ticket group with bulk discounts', async () => {
      const { data: createdGroup } = await client.pageTicketGroups.create(testEventPageId, {
        name: 'Bulk Discount Tickets',
        bulkDiscounts: [
          {
            minQuantity: 5,
            maxQuantity: 9,
            percentOff: 10,
          },
          {
            minQuantity: 10,
            maxQuantity: 999,
            percentOff: 20,
          },
        ],
      });

      expect(createdGroup).toBeDefined();
      expect(createdGroup.bulkDiscounts).toBeDefined();
      expect(createdGroup.bulkDiscounts?.length).toBe(2);
      expect(createdGroup.bulkDiscounts?.[0].minQuantity).toBe(5);
      expect(createdGroup.bulkDiscounts?.[0].percentOff).toBe(10);
    });

    it('should create a ticket group with tiered bulk discounts', async () => {
      const { data: createdGroup } = await client.pageTicketGroups.create(testEventPageId, {
        name: 'Tiered Discount Tickets',
        bulkDiscounts: [
          {
            minQuantity: 3,
            maxQuantity: 5,
            percentOff: 5,
          },
        ],
      });

      expect(createdGroup).toBeDefined();
      expect(createdGroup.bulkDiscounts?.[0].minQuantity).toBe(3);
      expect(createdGroup.bulkDiscounts?.[0].maxQuantity).toBe(5);
      expect(createdGroup.bulkDiscounts?.[0].percentOff).toBe(5);
    });

    it('should create a ticket group with always available behavior', async () => {
      const { data: createdGroup } = await client.pageTicketGroups.create(testEventPageId, {
        name: 'Always Available',
        availabilityBehavior: 'always_available',
      });

      expect(createdGroup).toBeDefined();
      expect(createdGroup.availabilityBehavior).toBe('always_available');
    });

    it('should create a ticket group with scheduled availability', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const { data: createdGroup } = await client.pageTicketGroups.create(testEventPageId, {
        name: 'Scheduled Release',
        availabilityBehavior: 'date_time_based',
        saleStartOn: futureDate,
        saleEndOn: endDate,
      });

      expect(createdGroup).toBeDefined();
      expect(createdGroup.availabilityBehavior).toBe('date_time_based');
      expect(createdGroup.saleStartOn).toBeDefined();
      expect(createdGroup.saleEndOn).toBeDefined();
    });

    it('should create a ticket group with sale start date only', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: createdGroup } = await client.pageTicketGroups.create(testEventPageId, {
        name: 'Start Date Only',
        saleStartOn: futureDate,
      });

      expect(createdGroup).toBeDefined();
      expect(createdGroup.saleStartOn).toBeDefined();
    });

    it('should create a ticket group with sale end date only', async () => {
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const { data: createdGroup } = await client.pageTicketGroups.create(testEventPageId, {
        name: 'End Date Only',
        saleEndOn: endDate,
      });

      expect(createdGroup).toBeDefined();
      expect(createdGroup.saleEndOn).toBeDefined();
    });

    it('should create a ticket group with all visibility options', async () => {
      const { data: createdGroup } = await client.pageTicketGroups.create(testEventPageId, {
        name: 'All Visibility Options',
        hidden: false,
        hideWhenSoldOut: true,
        hideWhenNotOnSale: true,
        hideWhenScheduled: false,
        hideWhenUnavailable: true,
      });

      expect(createdGroup).toBeDefined();
      expect(createdGroup.hidden).toBe(false);
      expect(createdGroup.hideWhenSoldOut).toBe(true);
      expect(createdGroup.hideWhenNotOnSale).toBe(true);
      expect(createdGroup.hideWhenScheduled).toBe(false);
      expect(createdGroup.hideWhenUnavailable).toBe(true);
    });

    it('should create a ticket group with comprehensive configuration', async () => {
      const { data: createdGroup } = await client.pageTicketGroups.create(testEventPageId, {
        name: 'Comprehensive Configuration',
        description: 'A fully configured ticket group',
        status: 'enabled',
        reference: 'comprehensive-001',
        layout: {
          type: 'grid',
          columns: 2,
        },
        ticketSelectionType: 'quantity',
        preselect: {
          enabled: false,
        },
        capacity: 200,
        hidden: false,
        hideWhenSoldOut: true,
        bulkDiscounts: [
          {
            minQuantity: 5,
            maxQuantity: 999,
            percentOff: 15,
          },
        ],
        availabilityBehavior: 'always_available',
      });

      expect(createdGroup).toBeDefined();
      expect(createdGroup.name).toBe('Comprehensive Configuration');
      expect(createdGroup.description).toBe('A fully configured ticket group');
      expect(createdGroup.status).toBe('enabled');
      expect(createdGroup.reference).toBe('comprehensive-001');
      expect(createdGroup.capacity).toBe(200);
      expect(createdGroup.bulkDiscounts).toBeDefined();
      expect(createdGroup.layout).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update ticket group name', async () => {
      const { data: updatedGroup } = await client.pageTicketGroups.update(
        testEventPageId,
        testTicketGroupId,
        {
          name: 'Early Bird Tickets (Updated)',
        }
      );

      expect(updatedGroup).toBeDefined();
      expect(updatedGroup.name).toBe('Early Bird Tickets (Updated)');
    });

    it('should update ticket group description', async () => {
      const { data: updatedGroup } = await client.pageTicketGroups.update(
        testEventPageId,
        testTicketGroupId,
        {
          description: 'Updated description with new details',
        }
      );

      expect(updatedGroup).toBeDefined();
      expect(updatedGroup.description).toBe('Updated description with new details');
    });

    it('should update ticket group status', async () => {
      const { data: updatedGroup } = await client.pageTicketGroups.update(
        testEventPageId,
        testTicketGroupId,
        {
          status: 'disabled',
        }
      );

      expect(updatedGroup).toBeDefined();
      expect(updatedGroup.status).toBe('disabled');
    });

    it('should update ticket group reference', async () => {
      const { data: updatedGroup } = await client.pageTicketGroups.update(
        testEventPageId,
        testTicketGroupId,
        {
          reference: 'updated-reference',
        }
      );

      expect(updatedGroup).toBeDefined();
      expect(updatedGroup.reference).toBe('updated-reference');
    });

    it('should update ticket group layout', async () => {
      const { data: updatedGroup } = await client.pageTicketGroups.update(
        testEventPageId,
        testTicketGroupId,
        {
          layout: {
            type: 'list',
            columns: 1,
          },
        }
      );

      expect(updatedGroup).toBeDefined();
      expect(updatedGroup.layout?.type).toBe('list');
      expect(updatedGroup.layout?.columns).toBe(1);
    });

    it('should update ticket selection type', async () => {
      const { data: updatedGroup } = await client.pageTicketGroups.update(
        testEventPageId,
        testTicketGroupId,
        {
          ticketSelectionType: 'single',
        }
      );

      expect(updatedGroup).toBeDefined();
      expect(updatedGroup.ticketSelectionType).toBe('single');
    });

    it('should update preselect configuration', async () => {
      const { data: updatedGroup } = await client.pageTicketGroups.update(
        testEventPageId,
        testTicketGroupId,
        {
          preselect: {
            enabled: true,
            quantity: 3,
          },
        }
      );

      expect(updatedGroup).toBeDefined();
      expect(updatedGroup.preselect?.enabled).toBe(true);
      expect(updatedGroup.preselect?.quantity).toBe(3);
    });

    it('should update capacity', async () => {
      const { data: updatedGroup } = await client.pageTicketGroups.update(
        testEventPageId,
        testTicketGroupId,
        {
          capacity: 150,
        }
      );

      expect(updatedGroup).toBeDefined();
      expect(updatedGroup.capacity).toBe(150);
    });

    it('should update hidden status', async () => {
      const { data: updatedGroup } = await client.pageTicketGroups.update(
        testEventPageId,
        testTicketGroupId,
        {
          hidden: true,
        }
      );

      expect(updatedGroup).toBeDefined();
      expect(updatedGroup.hidden).toBe(true);
    });

    it('should update visibility options', async () => {
      const { data: updatedGroup } = await client.pageTicketGroups.update(
        testEventPageId,
        testTicketGroupId,
        {
          hideWhenSoldOut: false,
          hideWhenNotOnSale: true,
          hideWhenScheduled: true,
          hideWhenUnavailable: false,
        }
      );

      expect(updatedGroup).toBeDefined();
      expect(updatedGroup.hideWhenSoldOut).toBe(false);
      expect(updatedGroup.hideWhenNotOnSale).toBe(true);
      expect(updatedGroup.hideWhenScheduled).toBe(true);
      expect(updatedGroup.hideWhenUnavailable).toBe(false);
    });

    it('should update bulk discounts', async () => {
      const { data: updatedGroup } = await client.pageTicketGroups.update(
        testEventPageId,
        testTicketGroupId,
        {
          bulkDiscounts: [
            {
              minQuantity: 3,
              maxQuantity: 6,
              percentOff: 5,
            },
            {
              minQuantity: 7,
              maxQuantity: 999,
              percentOff: 12,
            },
          ],
        }
      );

      expect(updatedGroup).toBeDefined();
      expect(updatedGroup.bulkDiscounts?.length).toBe(2);
      expect(updatedGroup.bulkDiscounts?.[0].minQuantity).toBe(3);
      expect(updatedGroup.bulkDiscounts?.[1].percentOff).toBe(12);
    });

    it('should update availability behavior', async () => {
      const { data: updatedGroup } = await client.pageTicketGroups.update(
        testEventPageId,
        testTicketGroupId,
        {
          availabilityBehavior: 'date_time_based',
        }
      );

      expect(updatedGroup).toBeDefined();
      expect(updatedGroup.availabilityBehavior).toBe('date_time_based');
    });

    it('should update sale dates', async () => {
      const startDate = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

      const { data: updatedGroup } = await client.pageTicketGroups.update(
        testEventPageId,
        testTicketGroupId,
        {
          saleStartOn: startDate,
          saleEndOn: endDate,
        }
      );

      expect(updatedGroup).toBeDefined();
      expect(updatedGroup.saleStartOn).toBeDefined();
      expect(updatedGroup.saleEndOn).toBeDefined();
    });

    it('should update multiple properties simultaneously', async () => {
      const { data: updatedGroup } = await client.pageTicketGroups.update(
        testEventPageId,
        testTicketGroupId,
        {
          name: 'Multi-Update Test',
          description: 'Testing multiple updates',
          status: 'enabled',
          capacity: 250,
          hidden: false,
          ticketSelectionType: 'multiple',
        }
      );

      expect(updatedGroup).toBeDefined();
      expect(updatedGroup.name).toBe('Multi-Update Test');
      expect(updatedGroup.description).toBe('Testing multiple updates');
      expect(updatedGroup.status).toBe('enabled');
      expect(updatedGroup.capacity).toBe(250);
      expect(updatedGroup.hidden).toBe(false);
      expect(updatedGroup.ticketSelectionType).toBe('multiple');
    });
  });

  describe('delete', () => {
    it('should delete a ticket group', async () => {
      await client.pageTicketGroups.delete(testEventPageId, testTicketGroupId);

      // Verify the ticket group is deleted by fetching the page
      const { data: page } = await client.pages.get(testEventPageId);
      const deletedGroup = page.ticketGroups?.find((g) => g.id === testTicketGroupId);

      expect(deletedGroup).toBeUndefined();
    });

    it('should delete a newly created ticket group', async () => {
      // Create a ticket group specifically for deletion
      const { data: createdGroup } = await client.pageTicketGroups.create(testEventPageId, {
        name: 'To Be Deleted',
      });

      expect(createdGroup).toBeDefined();
      expect(createdGroup.name).toBe('To Be Deleted');

      const groupIdToDelete = createdGroup.id;
      if (!groupIdToDelete) throw new Error('Group ID not found');

      // Delete the ticket group
      await client.pageTicketGroups.delete(testEventPageId, groupIdToDelete);

      // Verify deletion
      const { data: page } = await client.pages.get(testEventPageId);
      const deletedGroup = page.ticketGroups?.find((g) => g.id === groupIdToDelete);

      expect(deletedGroup).toBeUndefined();
    });
  });
});
