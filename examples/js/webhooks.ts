import { CheckoutPageClient } from '@checkoutpage/sdk';

const client = new CheckoutPageClient({
  apiKey: process.env.CHECKOUTPAGE_API_KEY!,
});

async function main() {
  // Create a webhook endpoint. The url must use https.
  const created = await client.webhooks.create({
    name: 'CRM sync',
    url: 'https://example.com/hooks/checkoutpage',
    events: ['payment.paid', 'subscription.created'],
    customHeaders: { Authorization: 'Bearer receiver-token' },
  });

  // The secret is returned here and nowhere else — store it now, it cannot be
  // retrieved later.
  console.log('Created webhook:', created.data.id);
  console.log('Signing secret (store this now):', created.data.secret);

  // List webhook endpoints. Secrets are never included.
  const { data: webhooks } = await client.webhooks.list({ limit: 25 });

  console.log(`Found ${webhooks.length} webhook(s)`);

  // Filter by event and status
  const active = await client.webhooks.list({
    event: 'payment.paid',
    status: 'active',
  });

  console.log(`${active.data.length} active endpoint(s) receive payment.paid`);

  // Delete a webhook endpoint. Deliveries stop immediately.
  const deleted = await client.webhooks.delete(created.data.id);

  console.log('Deleted webhook:', deleted.data.id);
}

main().catch(console.error);
