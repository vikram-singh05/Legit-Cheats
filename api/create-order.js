import crypto from 'crypto';

const PLAN_AMOUNTS = {
  plan_1day: { name: '1-Day Access', amount: 99 },
  plan_7day: { name: '7-Day Pass', amount: 249 },
  plan_30day: { name: '30-Day Pro', amount: 799 },
  plan_lifetime: { name: 'Lifetime Elite', amount: 3999 },
};

const ALLOWED_ORIGINS = [
  'https://ligeitcheats.live',
  'https://www.ligeitcheats.live',
  'http://localhost:5173',
  'http://localhost:3000',
];

export default async function handler(req, res) {
  // CORS & Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  const origin = req.headers['origin'] || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const razorpayKeyId = process.env.VITE_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!razorpayKeyId || !razorpayKeySecret) {
      return res.status(500).json({ error: 'Payment gateway configuration error.' });
    }

    const authHeader = req.headers['authorization'];
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!bearerToken) {
      return res.status(401).json({ error: 'Authentication Required.' });
    }

    const { plan_id } = req.body || {};
    const plan = PLAN_AMOUNTS[plan_id];
    if (!plan) {
      return res.status(400).json({ error: 'Invalid plan_id.' });
    }

    // Create Order via Razorpay API
    const authEncoded = 'Basic ' + Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString('base64');
    const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': authEncoded,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: plan.amount * 100, // paise
        currency: 'INR',
        receipt: `rcpt_${crypto.randomBytes(4).toString('hex')}`
      })
    });

    if (!orderRes.ok) {
      console.error('Razorpay order creation failed:', await orderRes.text());
      return res.status(500).json({ error: 'Failed to create payment order.' });
    }

    const orderData = await orderRes.json();
    return res.status(200).json({ order_id: orderData.id, amount: orderData.amount });
  } catch (error) {
    console.error('Error creating order:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
