import { describe, it, expect, beforeAll } from 'vitest';
import { CheckoutPageClient, createCheckoutPageClient, NotFoundError } from '../../index';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';

describe('PageResource Integration Tests', () => {
  let client: CheckoutPageClient;
  let config: ReturnType<typeof loadIntegrationConfig>;

  beforeAll(() => {
    config = loadIntegrationConfig();

    client = createCheckoutPageClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    });
  });

  describe('list', () => {
    it('should fetch a list of pages', async () => {
      const result = await client.pages.list();

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('has_more');
      expect(Array.isArray(result.data)).toBe(true);
      expect(typeof result.has_more).toBe('boolean');
    });

    it('should fetch pages with filters', async () => {
      const result = await client.pages.list({
        status: 'published',
        type: 'checkout',
        limit: 5,
      });

      expect(result.data).toBeDefined();
      expect(result.data.length).toBeLessThanOrEqual(5);
    });

    it('should filter by page type', async () => {
      const result = await client.pages.list({
        type: 'event',
      });

      expect(result.data).toBeDefined();
      result.data.forEach((page) => {
        expect(page.type).toBe('event');
      });
    });

    it('should filter by status', async () => {
      const result = await client.pages.list({
        status: 'draft',
      });

      expect(result.data).toBeDefined();
      result.data.forEach((page) => {
        expect(page.status).toBe('draft');
      });
    });
  });

  describe('create - checkout pages', () => {
    it('should create a minimal one-time payment checkout page', async () => {
      const { data: page } = await client.pages.create({
        name: `Minimal One-Time Checkout ${Date.now()}`,
        type: 'checkout',
        title: 'Buy Our Product',
      });

      expect(page).toHaveProperty('id');
      expect(page.type).toBe('checkout');
      expect(page.name).toContain('One-Time Checkout');
      expect(page.title).toBe('Buy Our Product');
      expect(page.product).toBeDefined();
      expect(page.product?.price).toBe(0);
      expect(page.product?.type).toBe('charge');
      expect(page.product?.currency).toBe('usd');
    });

    it('should create a basic one-time payment checkout page', async () => {
      const { data: page } = await client.pages.create({
        name: `One-Time Checkout ${Date.now()}`,
        type: 'checkout',
        title: 'Buy Our Product',
        description: 'Get access to our premium product',
        productDetails: {
          price: 4900,
          currency: 'usd',
          title: 'Premium Product',
          type: 'charge',
        },
      });

      expect(page).toHaveProperty('id');
      expect(page.type).toBe('checkout');
      expect(page.name).toContain('One-Time Checkout');
      expect(page.product).toBeDefined();
      expect(page.product?.price).toBe(4900);
      expect(page.product?.type).toBe('charge');
      expect(page.product?.currency).toBe('usd');
    });

    it('should create a minimal subscription checkout page', async () => {
      const { data: page } = await client.pages.create({
        name: `Monthly Subscription ${Date.now()}`,
        type: 'checkout',
        title: 'Subscribe Monthly',
        productDetails: {
          title: 'Monthly Plan',
          type: 'subscription',
        },
      });

      if (page.type !== 'checkout') throw Error();

      expect(page.type).toBe('checkout');
      expect(page.product).toBeDefined();
      expect(page.product?.type).toBe('subscription');
      expect(page.product?.interval).toBe('month');
      expect(page.product?.intervalCount).toBe(1);
      expect(page.product?.price).toBe(0);
    });

    it('should create a subscription checkout page', async () => {
      const { data: page } = await client.pages.create({
        name: `Monthly Subscription ${Date.now()}`,
        type: 'checkout',
        title: 'Subscribe Monthly',
        productDetails: {
          price: 2900,
          currency: 'usd',
          title: 'Monthly Plan',
          type: 'subscription',
          interval: 'month',
          intervalCount: 1,
        },
      });

      if (page.type !== 'checkout') throw Error();

      expect(page.type).toBe('checkout');
      expect(page.product).toBeDefined();
      expect(page.product?.type).toBe('subscription');
      expect(page.product?.interval).toBe('month');
      expect(page.product?.intervalCount).toBe(1);
      expect(page.product?.price).toBe(2900);
    });

    it('should create a subscription with trial period', async () => {
      const { data: page } = await client.pages.create({
        name: `Trial Subscription ${Date.now()}`,
        type: 'checkout',
        title: 'Start Your Free Trial',
        productDetails: {
          price: 4900,
          currency: 'eur',
          type: 'subscription',
          trialPeriodDays: 14,
        },
      });

      expect(page.product?.type).toBe('subscription');
      expect(page.product?.trialPeriodDays).toBe(14);
    });

    it('should create a subscription with setup fee', async () => {
      const { data: page } = await client.pages.create({
        name: `Subscription with Setup ${Date.now()}`,
        type: 'checkout',
        title: 'Join Our Platform',
        productDetails: {
          price: 9900,
          currency: 'usd',
          title: 'Platform Access',
          type: 'subscription',
          interval: 'year',
          intervalCount: 1,
          setupFee: 5000,
        },
      });

      expect(page.product?.type).toBe('subscription');
      expect(page.product?.setupFee).toBe(5000);
      expect(page.product?.interval).toBe('year');
    });

    it.each(['day', 'week', 'month', 'year'])(
      'should create a %s subscription',
      async (interval) => {
        const { data: page } = await client.pages.create({
          name: `Weekly Subscription ${Date.now()}`,
          type: 'checkout',
          productDetails: {
            type: 'subscription',
            interval: interval as any,
            intervalCount: 1,
          },
        });

        expect(page.product?.interval).toBe(interval);
        expect(page.product?.intervalCount).toBe(1);
      }
    );

    it('should create a checkout page with product variants', async () => {
      const { data: page } = await client.pages.create({
        name: `Variant Product ${Date.now()}`,
        type: 'checkout',
        title: 'Choose Your Option',
        productDetails: {
          // price is ignored!
          price: 2900,
          currency: 'usd',
          title: 'T-Shirt',
          type: 'charge',
          pricingType: 'multiple',
          variants: [
            {
              name: 'Size',
              required: true,
              options: [
                { name: 'Small', sku: 'tshirt-s' },
                { name: 'Medium', sku: 'tshirt-m', additionalChargeAmount: 500 },
                { name: 'Large', sku: 'tshirt-l', additionalChargeAmount: 1000 },
              ],
            },
            {
              name: 'Color',
              required: true,
              options: [
                { name: 'Black', sku: 'color-black' },
                { name: 'White', sku: 'color-white' },
                { name: 'Blue', sku: 'color-blue' },
              ],
            },
          ],
        },
      });

      expect(page.product?.price).toBe(0);
      expect(page.product?.variants).toBeDefined();
      expect(page.product?.variants?.length).toBe(2);
      expect(page.product?.variants?.[0].name).toBe('Size');
      expect(page.product?.variants?.[0].options?.length).toBe(3);
      expect(page.product?.variants?.[1].name).toBe('Color');
    });

    it('should create a checkout page with stock tracking', async () => {
      const { data: page } = await client.pages.create({
        name: `Limited Stock Product ${Date.now()}`,
        type: 'checkout',
        productDetails: {
          price: 9900,
          currency: 'usd',
          title: 'Limited Edition Product',
          type: 'charge',
          stock: 50,
          sku: 'LIMITED-EDITION-001',
        },
      });

      expect(page.product?.stock).toBe(50);
      expect(page.product?.sku).toBe('LIMITED-EDITION-001');
    });

    it('should create a checkout page with discounted price', async () => {
      const { data: page } = await client.pages.create({
        name: `Discounted Product ${Date.now()}`,
        type: 'checkout',
        productDetails: {
          price: 4900,
          currency: 'usd',
          title: 'Sale Item',
          type: 'charge',
          discountedFromPrice: 9900,
        },
      });

      expect(page.product?.price).toBe(4900);
      expect(page.product?.discountedFromPrice).toBe(9900);
    });

    it('should create a checkout page with custom fields', async () => {
      const { data: page } = await client.pages.create({
        name: `Checkout with Custom Fields ${Date.now()}`,
        type: 'checkout',
        productDetails: {
          price: 2900,
          currency: 'usd',
        },
        fields: [
          {
            label: 'Company Name',
            element: 'text',
            required: true,
            placeholder: 'Enter your company name',
            reference: 'company_name',
          },
          {
            label: 'Company Size',
            element: 'select',
            required: true,
            options: [
              { label: '1-10 employees', value: '1-10' },
              { label: '11-50 employees', value: '11-50' },
              { label: '51-200 employees', value: '51-200' },
              { label: '200+ employees', value: '200+' },
            ],
          },
          {
            label: 'Additional Notes',
            element: 'textarea',
            required: false,
            placeholder: 'Any special requirements?',
            hidden: true,
          },
        ],
      });

      expect(page.fields).toBeDefined();
      expect(page.fields?.length).toBeGreaterThanOrEqual(3);

      const companyNameField = page.fields?.find((f) => f.reference === 'company_name');
      expect(companyNameField).toBeDefined();
      expect(companyNameField?.label).toBe('Company Name');
      expect(companyNameField?.required).toBe(true);
    });

    it('should create a checkout page with advanced page settings', async () => {
      const { data: page } = await client.pages.create({
        name: `Advanced Checkout ${Date.now()}`,
        type: 'checkout',
        title: 'Premium Course Checkout',
        description: '<p>Get access to our <strong>premium</strong> course today!</p>',
        slug: `advanced-checkout-${Date.now()}`,
        hostedLayoutType: 'double',
        savePaymentMethod: true,
        showCouponCodeField: true,
        tax: {
          enabled: true,
        },
        checkoutAbandonment: {
          disableEmails: true,
        },
        googleIndex: false,
        productDetails: {
          price: 9900,
          currency: 'usd',
          title: 'Premium Course',
        },
      });

      expect(page.hostedLayoutType).toBe('double');
      expect(page.savePaymentMethod).toBe(true);
      expect(page.showCouponCodeField).toBe(true);
      expect(page.checkoutAbandonment).toBeDefined();
    });

    it('should create a checkout page with dynamic price overrides enabled', async () => {
      const { data: page } = await client.pages.create({
        name: `Dynamic Pricing ${Date.now()}`,
        type: 'checkout',
        productDetails: {
          price: 4900,
          currency: 'usd',
        },
        allowDynamicPrice: true,
        allowDynamicDiscountedFromPrice: true,
        allowDynamicTitle: true,
        allowDynamicDescription: true,
      });

      expect(page.allowDynamicPrice).toBe(true);
      expect(page.allowDynamicDiscountedFromPrice).toBe(true);
      expect(page.allowDynamicTitle).toBe(true);
    });

    it('should create a free checkout page (price: 0)', async () => {
      const { data: page } = await client.pages.create({
        name: `Free Download ${Date.now()}`,
        type: 'checkout',
        title: 'Free eBook Download',
        productDetails: {
          price: 0,
          currency: 'usd',
          title: 'Free eBook',
          type: 'charge',
        },
      });

      expect(page.product?.price).toBe(0);
      expect(page.product?.type).toBe('charge');
    });

    it('should create a checkout page with EUR currency', async () => {
      const { data: page } = await client.pages.create({
        name: `EUR Product ${Date.now()}`,
        type: 'checkout',
        productDetails: {
          price: 4900,
          currency: 'eur',
          title: 'European Product',
        },
      });

      expect(page.product?.currency).toBe('eur');
    });
  });

  describe('create - event pages', () => {
    it('should create a basic event page with default ticket', async () => {
      const { data: page } = await client.pages.create({
        name: `Basic Event ${Date.now()}`,
        type: 'event',
        title: 'Annual Conference',
        description: 'Join us for our annual conference',
      });

      expect(page.type).toBe('event');
      expect(page.name).toContain('Basic Event');
      expect(page.ticketGroups).toBeDefined();
      expect(page.ticketGroups?.length).toBe(1);
    });

    it('should create an event with custom ticket groups and types', async () => {
      const { data: page } = await client.pages.create({
        name: `Multi-Tier Event ${Date.now()}`,
        type: 'event',
        title: 'Tech Conference 2024',
        eventDetails: {
          type: 'in_person',
          currency: 'usd',
          startDate: '2024-09-15T09:00:00Z',
          endDate: '2024-09-15T17:00:00Z',
          timezone: 'America/New_York',
          location: '123 Conference Center, New York, NY',
          capacity: 500,
        },
        ticketGroups: [
          {
            name: 'Early Bird Tickets',
            ticketTypes: [
              {
                name: 'Early Bird General',
                pricing: 'paid',
                price: 9900,
                capacity: 100,
                maxQuantity: 5,
              },
              {
                name: 'Early Bird VIP',
                pricing: 'paid',
                price: 29900,
                capacity: 20,
                maxQuantity: 2,
              },
            ],
          },
          {
            name: 'Regular Tickets',
            ticketTypes: [
              {
                name: 'General Admission',
                pricing: 'paid',
                price: 14900,
                capacity: 300,
                maxQuantity: 10,
              },
              {
                name: 'VIP Access',
                pricing: 'paid',
                price: 39900,
                capacity: 50,
                maxQuantity: 5,
              },
            ],
          },
        ],
      });

      expect(page.type).toBe('event');
      expect(page.eventDetails).toBeDefined();
      expect(page.eventDetails?.type).toBe('in_person');
      expect(page.eventDetails?.capacity).toBe(500);
      expect(page.eventDetails?.location).toBe('123 Conference Center, New York, NY');
      expect(page.ticketGroups?.length).toBe(2);
      expect(page.ticketGroups?.[0].name).toBe('Early Bird Tickets');
      expect(page.ticketGroups?.[0].ticketTypes?.length).toBe(2);
      expect(page.ticketGroups?.[1].ticketTypes?.length).toBe(2);
    });

    it('should create a free event', async () => {
      const { data: page } = await client.pages.create({
        name: `Free Webinar ${Date.now()}`,
        type: 'event',
        title: 'Free Marketing Webinar',
        eventDetails: {
          type: 'virtual',
          startDate: '2024-10-01T14:00:00Z',
          endDate: '2024-10-01T15:30:00Z',
          timezone: 'UTC',
        },
        ticketGroups: [
          {
            name: 'Attendees',
            ticketTypes: [
              {
                name: 'Free Registration',
                pricing: 'free',
                price: 0,
                maxQuantity: 1,
              },
            ],
          },
        ],
      });

      expect(page.eventDetails?.type).toBe('virtual');
      expect(page.ticketGroups?.[0].ticketTypes?.[0].pricing).toBe('free');
      expect(page.ticketGroups?.[0].ticketTypes?.[0].price).toBe(0);
    });

    it('should create a hybrid event', async () => {
      const { data: page } = await client.pages.create({
        name: `Hybrid Event ${Date.now()}`,
        type: 'event',
        title: 'Hybrid Workshop',
        eventDetails: {
          type: 'hybrid',
          currency: 'usd',
          startDate: '2024-11-20T10:00:00Z',
          endDate: '2024-11-20T16:00:00Z',
          timezone: 'America/Los_Angeles',
          location: 'San Francisco, CA + Online',
        },
        ticketGroups: [
          {
            name: 'In-Person',
            ticketTypes: [
              {
                name: 'In-Person Ticket',
                pricing: 'paid',
                price: 19900,
                capacity: 50,
              },
            ],
          },
          {
            name: 'Virtual',
            ticketTypes: [
              {
                name: 'Virtual Ticket',
                pricing: 'paid',
                price: 4900,
              },
            ],
          },
        ],
      });

      expect(page.eventDetails?.type).toBe('hybrid');
      expect(page.ticketGroups?.length).toBe(2);
    });

    it('should create an event with custom fields', async () => {
      const { data: page } = await client.pages.create({
        name: `Event with Custom Fields ${Date.now()}`,
        type: 'event',
        title: 'Professional Conference',
        ticketGroups: [
          {
            name: 'Attendees',
            ticketTypes: [
              {
                name: 'Conference Pass',
                pricing: 'paid',
                price: 29900,
              },
            ],
          },
        ],
        fields: [
          {
            label: 'Dietary Restrictions',
            element: 'textarea',
            required: false,
            placeholder: 'Please list any dietary restrictions',
          },
          {
            label: 'T-Shirt Size',
            element: 'select',
            required: true,
            options: [
              { label: 'Small', value: 'S' },
              { label: 'Medium', value: 'M' },
              { label: 'Large', value: 'L' },
              { label: 'X-Large', value: 'XL' },
            ],
          },
          {
            label: 'Special Accommodations',
            element: 'text',
            required: false,
          },
        ],
      });

      expect(page.fields).toBeDefined();
      expect(page.fields?.length).toBeGreaterThanOrEqual(3);

      const dietaryField = page.fields?.find((f) => f.label === 'Dietary Restrictions');
      expect(dietaryField).toBeDefined();
      expect(dietaryField?.type).toBe('textarea');
    });

    it('should create an event with unlimited capacity tickets', async () => {
      const { data: page } = await client.pages.create({
        name: `Unlimited Event ${Date.now()}`,
        type: 'event',
        title: 'Virtual Summit',
        eventDetails: {
          type: 'virtual',
        },
        ticketGroups: [
          {
            name: 'Attendees',
            ticketTypes: [
              {
                name: 'Virtual Pass',
                pricing: 'paid',
                price: 2900,
              },
            ],
          },
        ],
      });

      expect(page.ticketGroups?.[0].ticketTypes?.[0].capacity).toBeFalsy();
    });

    it('should create an event with EUR currency', async () => {
      const { data: page } = await client.pages.create({
        name: `EUR Event ${Date.now()}`,
        type: 'event',
        title: 'European Conference',
        eventDetails: {
          type: 'in_person',
          currency: 'eur',
          location: 'Berlin, Germany',
        },
        ticketGroups: [
          {
            name: 'Tickets',
            ticketTypes: [
              {
                name: 'Standard',
                pricing: 'paid',
                price: 9900,
              },
            ],
          },
        ],
      });

      expect(page.eventDetails?.currency).toBe('eur');
    });
  });

  describe('create - form pages', () => {
    it('should create a basic form page', async () => {
      const { data: page } = await client.pages.create({
        name: `Contact Form ${Date.now()}`,
        type: 'form',
        title: 'Contact Us',
        description: 'We would love to hear from you',
      });

      expect(page.type).toBe('form');
      expect(page.name).toContain('Contact Form');
      expect(page.title).toBe('Contact Us');
    });

    it('should create a form page with custom fields', async () => {
      const { data: page } = await client.pages.create({
        name: `Survey Form ${Date.now()}`,
        type: 'form',
        title: 'Customer Feedback Survey',
        description: 'Help us improve our service',
        fields: [
          {
            label: 'How satisfied are you with our service?',
            element: 'select',
            required: true,
            options: [
              { label: 'Very Satisfied', value: '5' },
              { label: 'Satisfied', value: '4' },
              { label: 'Neutral', value: '3' },
              { label: 'Dissatisfied', value: '2' },
              { label: 'Very Dissatisfied', value: '1' },
            ],
          },
          {
            label: 'What can we improve?',
            element: 'textarea',
            required: true,
            placeholder: 'Please share your thoughts...',
            helpText: 'Your feedback helps us serve you better',
          },
          {
            label: 'Would you recommend us to a friend?',
            element: 'select',
            required: true,
            options: [
              { label: 'Yes', value: 'yes' },
              { label: 'No', value: 'no' },
              { label: 'Maybe', value: 'maybe' },
            ],
          },
          {
            label: 'Phone Number',
            element: 'text',
            type: 'phone',
            required: false,
            placeholder: '+1 (555) 123-4567',
          },
        ],
      });

      expect(page.type).toBe('form');
      expect(page.fields).toBeDefined();
      expect(page.fields?.length).toBeGreaterThanOrEqual(4);

      const satisfactionField = page.fields?.find((f) => f.label?.includes('satisfied'));
      expect(satisfactionField).toBeDefined();
      expect(satisfactionField?.required).toBe(true);
      expect(satisfactionField?.options?.length).toBe(5);
    });
  });

  describe('get', () => {
    it('should fetch a checkout page with product details', async () => {
      const { data: created } = await client.pages.create({
        name: `Get Test Checkout ${Date.now()}`,
        type: 'checkout',
        productDetails: {
          price: 5900,
          currency: 'usd',
        },
      });

      const { data: page } = await client.pages.get(created.id);

      expect(page.id).toBe(created.id);
      expect(page.type).toBe('checkout');
      expect(page.product).toBeDefined();
      expect(page.product?.price).toBe(5900);
    });

    it('should fetch an event page with ticket groups', async () => {
      const { data: created } = await client.pages.create({
        name: `Get Test Event ${Date.now()}`,
        type: 'event',
        ticketGroups: [
          {
            name: 'General',
            ticketTypes: [{ name: 'GA', pricing: 'paid', price: 2900 }],
          },
        ],
      });

      const { data: page } = await client.pages.get(created.id);

      expect(page.id).toBe(created.id);
      expect(page.type).toBe('event');
      expect(page.ticketGroups).toBeDefined();
    });

    it('should throw NotFoundError for non-existent page', async () => {
      await expect(client.pages.get('6812fe6e9f39b6760576f01c')).rejects.toThrow(NotFoundError);
    });
  });

  describe('update', () => {
    it('should update checkout page basic fields', async () => {
      const { data: page } = await client.pages.create({
        name: `Update Test ${Date.now()}`,
        type: 'checkout',
      });

      const { data: updated } = await client.pages.update(page.id, {
        title: 'Updated Title',
        description: 'Updated description with <strong>HTML</strong>',
      });

      expect(updated.id).toBe(page.id);
      expect(updated.title).toBe('Updated Title');
      expect(updated.description).toContain('HTML');
    });

    it('should update event page title', async () => {
      const { data: page } = await client.pages.create({
        name: `Update Event ${Date.now()}`,
        type: 'event',
      });

      const { data: updated } = await client.pages.update(page.id, {
        title: 'New Event Title',
      });

      expect(updated.title).toBe('New Event Title');
    });

    it('should update form page settings', async () => {
      const { data: page } = await client.pages.create({
        name: `Update Form ${Date.now()}`,
        type: 'form',
      });

      const { data: updated } = await client.pages.update(page.id, {
        title: 'Updated Form Title',
        description: 'New description',
      });

      expect(updated.title).toBe('Updated Form Title');
    });
  });

  describe('publish', () => {
    it('should publish a draft checkout page', async () => {
      const { data: page } = await client.pages.create({
        name: `Publish Test ${Date.now()}`,
        type: 'checkout',
        status: 'draft',
      });

      const { data: published } = await client.pages.publish(page.id);

      expect(published.id).toBe(page.id);
      expect(published.status).toBe('published');
    });

    it('should publish a draft event page', async () => {
      const { data: page } = await client.pages.create({
        name: `Publish Event ${Date.now()}`,
        type: 'event',
        status: 'draft',
      });

      const { data: published } = await client.pages.publish(page.id);

      expect(published.status).toBe('published');
    });

    it('should publish a draft form page', async () => {
      const { data: page } = await client.pages.create({
        name: `Publish Form ${Date.now()}`,
        type: 'form',
        status: 'draft',
      });

      const { data: published } = await client.pages.publish(page.id);

      expect(published.status).toBe('published');
    });
  });

  describe('delete', () => {
    it('should archive a checkout page', async () => {
      const { data: page } = await client.pages.create({
        name: `Delete Checkout ${Date.now()}`,
        type: 'checkout',
      });

      await client.pages.delete(page.id);

      const { data: deletedPage } = await client.pages.get(page.id);
      expect(deletedPage.status).toBe('archived');
    });

    it('should archive an event page', async () => {
      const { data: page } = await client.pages.create({
        name: `Delete Event ${Date.now()}`,
        type: 'event',
      });

      await client.pages.delete(page.id);

      const { data: deletedPage } = await client.pages.get(page.id);
      expect(deletedPage.status).toBe('archived');
    });

    it('should archive a form page', async () => {
      const { data: page } = await client.pages.create({
        name: `Delete Form ${Date.now()}`,
        type: 'form',
      });

      await client.pages.delete(page.id);

      const { data: deletedPage } = await client.pages.get(page.id);
      expect(deletedPage.status).toBe('archived');
    });
  });
});
