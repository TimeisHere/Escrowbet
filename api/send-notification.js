const https = require('https');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { to, subject, message, betId } = req.body;

    // Send via Resend email service
    const emailData = JSON.stringify({
      from: 'SnoVale <notifications@snovale.app>',
      to: [to],
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1c1f23; color: #d4dbe3; padding: 32px; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #e8751a; letter-spacing: 3px; margin: 0;">🏔 SnoVale</h1>
            <p style="color: #6b7a8a; font-size: 12px; letter-spacing: 2px; text-transform: uppercase;">Side Bet Tracker</p>
          </div>
          <div style="background: #252a30; border: 1px solid #3a424d; border-radius: 10px; padding: 24px; margin-bottom: 24px;">
            <p style="font-size: 16px; line-height: 1.6; margin: 0;">${message}</p>
          </div>
          ${betId ? `
          <div style="text-align: center;">
            <a href="https://escrowbet-5jhl.vercel.app" 
               style="background: #e8751a; color: #000; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; display: inline-block;">
              View Bet on SnoVale →
            </a>
          </div>` : ''}
          <p style="color: #404d5c; font-size: 11px; text-align: center; margin-top: 24px;">
            You received this because you were added to a bet on SnoVale.
          </p>
        </div>
      `
    });

    const options = {
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(emailData)
      }
    };

    const result = await new Promise((resolve, reject) => {
      const request = https.request(options, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => resolve({ status: response.statusCode, data: JSON.parse(data) }));
      });
      request.on('error', reject);
      request.write(emailData);
      request.end();
    });

    res.status(200).json({ success: true, result: result.data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
