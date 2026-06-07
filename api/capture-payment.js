const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { loserPaymentIntentId, winnerPaymentIntentId, amount } = req.body;
    const amountInCents = Math.round(parseFloat(amount) * 100);
    const feeInCents = Math.round(amountInCents * 0.04);

    // Capture loser's payment
    const captured = await stripe.paymentIntents.capture(loserPaymentIntentId, {
      amount_to_capture: amountInCents,
      application_fee_amount: feeInCents,
    });

    // Release winner's hold
    const released = await stripe.paymentIntents.cancel(winnerPaymentIntentId);

    res.status(200).json({
      captured: captured.status,
      released: released.status,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
