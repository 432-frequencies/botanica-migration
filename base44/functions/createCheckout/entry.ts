import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@14.21.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { priceId, successUrl, cancelUrl } = await req.json();

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email,
      success_url: successUrl || `${req.headers.get('origin')}/`,
      cancel_url: cancelUrl || `${req.headers.get('origin')}/`,
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID'),
        user_email: user.email
      }
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});