import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Clé admin pour bypass RLS
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleCheckoutCompleted(session) {
  const customerEmail = session.customer_email;

  if (!customerEmail) {
    console.error('No customer email in checkout session');
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(session.subscription);
  const periodEnd = new Date(subscription.current_period_end * 1000);

  const { error } = await supabase
    .from('user_profiles')
    .update({
      is_pro: true,
      pro_since: new Date().toISOString(),
      pro_until: periodEnd.toISOString()
    })
    .eq('user_email', customerEmail);

  if (error) {
    console.error('Error updating user profile on checkout:', error);
    throw error;
  }

  console.log(`User ${customerEmail} upgraded to Pro until ${periodEnd.toISOString()}`);
}

async function handleSubscriptionUpdate(subscription) {
  const customer = await stripe.customers.retrieve(subscription.customer);
  const periodEnd = new Date(subscription.current_period_end * 1000);

  if (!customer.email) {
    console.error('No email found for customer:', subscription.customer);
    return;
  }

  const { error } = await supabase
    .from('user_profiles')
    .update({
      is_pro: subscription.status === 'active',
      pro_until: periodEnd.toISOString()
    })
    .eq('user_email', customer.email);

  if (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }

  console.log(`Subscription updated for ${customer.email}: ${subscription.status}`);
}

async function handleSubscriptionDeleted(subscription) {
  const customer = await stripe.customers.retrieve(subscription.customer);

  if (!customer.email) {
    console.error('No email found for customer:', subscription.customer);
    return;
  }

  const { error } = await supabase
    .from('user_profiles')
    .update({
      is_pro: false,
      pro_until: new Date().toISOString()
    })
    .eq('user_email', customer.email);

  if (error) {
    console.error('Error canceling subscription:', error);
    throw error;
  }

  console.log(`Subscription canceled for ${customer.email}`);
}
