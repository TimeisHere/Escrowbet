const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { amount, betId, email, role, description } = req.body;
    const amountInCents = Math.round(parseFloat(amount) * 100);

    // Create a SetupIntent to save card for future capture
    const setupIntent = await stripe.setupIntents.create({
      usage: 'off_session',
      metadata: { betId, email, role, description },
    });

    // Also create a PaymentIntent with manual capture for the hold
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      capture_method: 'manual',
      metadata: { betId, email, role, description },
      receipt_email: email,
      description: `SnoVale Bet Hold: ${description}`,
    });

    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      setupClientSecret: setupIntent.client_secret,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
