import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@14.21.0';

Deno.serve(async (req) => {
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const base44 = createClientFromRequest(req);

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const customerEmail = session.customer_details?.email || session.metadata?.user_email;
      const customerId = session.customer;
      const subscriptionId = session.subscription;

      if (customerEmail) {
        const profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: customerEmail });
        if (profiles.length > 0) {
          await base44.asServiceRole.entities.UserProfile.update(profiles[0].id, {
            is_pro: true,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId
          });
          console.log(`User ${customerEmail} upgraded to Pro`);
        }
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const customerId = subscription.customer;

      const profiles = await base44.asServiceRole.entities.UserProfile.filter({ stripe_customer_id: customerId });
      if (profiles.length > 0) {
        await base44.asServiceRole.entities.UserProfile.update(profiles[0].id, {
          is_pro: false,
          stripe_subscription_id: null
        });
        console.log(`User ${profiles[0].user_email} downgraded to Free`);
      }
    }

    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object;
      const customerId = subscription.customer;
      const isActive = subscription.status === 'active';

      const profiles = await base44.asServiceRole.entities.UserProfile.filter({ stripe_customer_id: customerId });
      if (profiles.length > 0) {
        await base44.asServiceRole.entities.UserProfile.update(profiles[0].id, {
          is_pro: isActive
        });
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});