import { describe, it, expect, beforeAll } from 'vitest';
import { CheckoutPageClient, createCheckoutPageClient } from '../../index';
import { loadIntegrationConfig } from '../../test-helpers/integration-config';

describe('PageFieldResource Integration Tests', () => {
  let client: CheckoutPageClient;
  let config: ReturnType<typeof loadIntegrationConfig>;
  let testPageId: string;
  let testFieldId: string;

  beforeAll(async () => {
    config = loadIntegrationConfig();

    client = createCheckoutPageClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    });

    // Create a test page to use for field testing
    const { data: page } = await client.pages.create({
      name: `Field Test Page ${Date.now()}`,
      type: 'form',
    });

    testPageId = page.id;
  });

  describe('list', () => {
    it('should list fields for a page', async () => {
      const { data: fields } = await client.pageFields.list(testPageId);

      expect(Array.isArray(fields)).toBe(true);
      expect(fields).toBeDefined();
    });
  });

  describe('create', () => {
    it('should create a text field with required parameters', async () => {
      const { data: field } = await client.pageFields.create(testPageId, {
        label: 'Company Name',
        element: 'text',
        required: true,
        hidden: false,
      });

      expect(field).toBeDefined();
      expect(field.label).toBe('Company Name');
      expect(field.element).toBe('text');
      expect(field.required).toBe(true);

      // Save field ID for later tests
      testFieldId = field.id;
    });

    it('should create a field with placeholder', async () => {
      const { data: field } = await client.pageFields.create(testPageId, {
        label: 'Phone Number',
        element: 'phone',
        required: false,
        hidden: false,
        placeholder: '+1 (555) 000-0000',
      });

      expect(field).toBeDefined();
      expect(field.label).toBe('Phone Number');
      expect(field.placeholder).toBe('+1 (555) 000-0000');
    });

    it('should create a select field with options', async () => {
      const { data: field } = await client.pageFields.create(testPageId, {
        label: 'T-Shirt Size',
        element: 'select',
        required: true,
        hidden: false,
        options: [
          { label: 'Small', value: 'S' },
          { label: 'Medium', value: 'M' },
          { label: 'Large', value: 'L' },
          { label: 'X-Large', value: 'XL' },
        ],
      });

      expect(field).toBeDefined();
      expect(field.label).toBe('T-Shirt Size');
      expect(field.element).toBe('select');
      expect(field.options).toHaveLength(4);
      expect(field.options?.[0]).toMatchObject({ label: 'Small', value: 'S' });
    });

    it('should create a multiple-choice field', async () => {
      const { data: field } = await client.pageFields.create(testPageId, {
        label: 'Dietary Preferences',
        element: 'multiple-choice',
        required: false,
        hidden: false,
        options: [
          { label: 'Vegetarian', value: 'vegetarian' },
          { label: 'Vegan', value: 'vegan' },
          { label: 'Gluten-Free', value: 'gluten-free' },
        ],
      });

      expect(field).toBeDefined();
      expect(field.label).toBe('Dietary Preferences');
      expect(field.element).toBe('multiple-choice');
      expect(field.options).toHaveLength(3);
    });

    it('should create a field with semantic type', async () => {
      const { data: field } = await client.pageFields.create(testPageId, {
        label: 'Email Address',
        element: 'email',
        type: 'email',
        required: true,
        hidden: false,
      });

      expect(field).toBeDefined();
      expect(field.label).toBe('Email Address');
      expect(field.type).toBe('email');
    });

    it('should create a hidden field', async () => {
      const { data: field } = await client.pageFields.create(testPageId, {
        label: 'UTM Source',
        element: 'text',
        required: false,
        hidden: true,
      });

      expect(field).toBeDefined();
      expect(field.label).toBe('UTM Source');
      expect(field.hidden).toBe(true);
    });

    it('should create a field with custom reference', async () => {
      const { data: field } = await client.pageFields.create(testPageId, {
        label: 'Customer ID',
        element: 'text',
        required: false,
        hidden: false,
        reference: 'custom_customer_id',
      });

      expect(field).toBeDefined();
      expect(field.label).toBe('Customer ID');
      expect(field.reference).toBe('custom_customer_id');
    });

    it('should create a textarea field', async () => {
      const { data: field } = await client.pageFields.create(testPageId, {
        label: 'Additional Notes',
        element: 'textarea',
        required: false,
        hidden: false,
        placeholder: 'Enter any additional information...',
      });

      expect(field).toBeDefined();
      expect(field.label).toBe('Additional Notes');
      expect(field.element).toBe('textarea');
    });

    it('should create a checkbox field', async () => {
      const { data: field } = await client.pageFields.create(testPageId, {
        label: 'I agree to the terms',
        element: 'checkbox',
        required: true,
        hidden: false,
      });

      expect(field).toBeDefined();
      expect(field.label).toBe('I agree to the terms');
      expect(field.element).toBe('checkbox');
    });

    it('should create a date field', async () => {
      const { data: field } = await client.pageFields.create(testPageId, {
        label: 'Preferred Date',
        element: 'date',
        required: false,
        hidden: false,
      });

      expect(field).toBeDefined();
      expect(field.label).toBe('Preferred Date');
      expect(field.element).toBe('date');
    });

    it('should create a number field', async () => {
      const { data: field } = await client.pageFields.create(testPageId, {
        label: 'Age',
        element: 'number',
        required: false,
        hidden: false,
      });

      expect(field).toBeDefined();
      expect(field.label).toBe('Age');
      expect(field.element).toBe('number');
    });

    it('should create a country field', async () => {
      const { data: field } = await client.pageFields.create(testPageId, {
        label: 'Country',
        element: 'country',
        type: 'address-country',
        required: true,
        hidden: false,
      });

      expect(field).toBeDefined();
      expect(field?.element).toBe('country');
    });
  });

  describe('update', () => {
    it('should update field label', async () => {
      const { data: field } = await client.pageFields.update(testPageId, testFieldId, {
        label: 'Company Name (Updated)',
      });

      expect(field).toBeDefined();
      expect(field.id).toBe(testFieldId);
      expect(field.label).toBe('Company Name (Updated)');
    });

    it('should update field placeholder', async () => {
      const { data: field } = await client.pageFields.update(testPageId, testFieldId, {
        placeholder: 'Enter your company name here',
      });

      expect(field).toBeDefined();
      expect(field.id).toBe(testFieldId);
      expect(field.placeholder).toBe('Enter your company name here');
    });

    it('should update field required status', async () => {
      const { data: field } = await client.pageFields.update(testPageId, testFieldId, {
        required: false,
      });

      expect(field).toBeDefined();
      expect(field.id).toBe(testFieldId);
      expect(field.required).toBe(false);
    });

    it('should update field hidden status', async () => {
      const { data: field } = await client.pageFields.update(testPageId, testFieldId, {
        hidden: true,
      });

      expect(field).toBeDefined();
      expect(field?.hidden).toBe(true);
    });

    it('should update field type', async () => {
      const { data: field } = await client.pageFields.update(testPageId, testFieldId, {
        type: 'company-name',
      });

      expect(field).toBeDefined();
      expect(field?.type).toBe('company-name');
    });

    it('should update field order', async () => {
      const { data: field } = await client.pageFields.update(testPageId, testFieldId, {
        order: 0,
      });

      expect(field).toBeDefined();
      expect(field?.order).toBe(0);
    });

    it('should update field reference', async () => {
      const { data: field } = await client.pageFields.update(testPageId, testFieldId, {
        reference: 'updated_company_name',
      });

      expect(field).toBeDefined();
      expect(field?.reference).toBe('updated_company_name');
    });

    it('should update multiple field properties simultaneously', async () => {
      const { data: field } = await client.pageFields.update(testPageId, testFieldId, {
        label: 'Business Name',
        placeholder: 'Your business name',
        required: true,
        hidden: false,
        type: 'company-name',
      });

      expect(field).toBeDefined();
      expect(field?.label).toBe('Business Name');
      expect(field?.placeholder).toBe('Your business name');
      expect(field?.required).toBe(true);
      expect(field?.hidden).toBe(false);
      expect(field?.type).toBe('company-name');
    });
  });

  describe('delete', () => {
    it('should delete a field', async () => {
      await client.pageFields.delete(testPageId, testFieldId);

      // Verify field is deleted by listing all fields
      const { data: fields } = await client.pageFields.list(testPageId);
      const deletedField = fields.find((f) => f.id === testFieldId);
      expect(deletedField).toBeUndefined();
    });
  });
});
