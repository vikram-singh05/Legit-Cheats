import crypto from 'crypto';

const PLAN_AMOUNTS = {
  plan_1day: { name: '1-Day Access', amount: 99 },
  plan_7day: { name: '7-Day Pass', amount: 249 },
  plan_30day: { name: '30-Day Pro', amount: 799 },
  plan_lifetime: { name: 'Lifetime Elite', amount: 3999 },
};

const ALLOWED_ORIGINS = [
  'https://legitcheats.live',
  'https://www.legitcheats.live',
  'http://localhost:5173',
  'http://localhost:3000',
];

// In-memory rate limiting map: ip -> { count, resetTime }
const rateLimitMap = new Map();

function getTrustedClientIp(req) {
  return (
    req.headers['x-real-ip'] ||
    req.headers['x-vercel-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    '0.0.0.0'
  );
}

function checkRateLimit(clientIp) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 15; // Max 15 order creation requests per minute per IP

  const record = rateLimitMap.get(clientIp) || { count: 0, resetTime: now + windowMs };
  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + windowMs;
  } else {
    record.count++;
  }
  rateLimitMap.set(clientIp, record);

  if (rateLimitMap.size > 1000) {
    for (const [key, val] of rateLimitMap.entries()) {
      if (now > val.resetTime) rateLimitMap.delete(key);
    }
  }

  return record.count <= maxRequests;
}

export default async function handler(req, res) {
  // CORS & Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  const origin = req.headers['origin'] || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // Rate Limiting Guard
  const clientIp = getTrustedClientIp(req);
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: 'Too many requests. Please wait 60 seconds.' });
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
    const razorpayKeyId = process.env.VITE_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!razorpayKeyId || !razorpayKeySecret) {
      return res.status(500).json({ error: 'Payment gateway configuration error.' });
    }
    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ error: 'Server configuration error.' });
    }

    // Strict Bearer Token Extraction & Validation against Supabase Auth (HIGH-01)
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    if (!bearerToken) {
      return res.status(401).json({ error: 'Authentication Required: Please sign in to create an order.' });
    }

    const authCheckRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${bearerToken}`
      }
    });

    if (!authCheckRes.ok) {
      return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    }

    const authUser = await authCheckRes.json();
    if (!authUser || !authUser.id) {
      return res.status(401).json({ error: 'Authentication Failed: User record not found.' });
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
        receipt: `rcpt_${crypto.randomBytes(4).toString('hex')}`,
        notes: {
          user_id: authUser.id,
          user_email: authUser.email || 'unknown',
          plan_id
        }
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
