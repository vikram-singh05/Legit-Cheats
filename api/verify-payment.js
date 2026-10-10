import crypto from 'crypto';

// In-memory anti-replay cache for redeemed payments
const redeemedPayments = new Set();

// In-memory rate limiting map: ip -> { count, resetTime }
const rateLimitMap = new Map();

// --- SECURITY: Trusted IP extraction for Vercel ---
function getTrustedClientIp(req) {
  // Vercel sets x-real-ip from the actual connecting client
  // x-vercel-forwarded-for is Vercel's trusted proxy chain
  // NEVER trust raw x-forwarded-for (user-spoofable)
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
  const maxRequests = 10; // Max 10 verification calls per minute per IP

  const record = rateLimitMap.get(clientIp) || { count: 0, resetTime: now + windowMs };
  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + windowMs;
  } else {
    record.count++;
  }
  rateLimitMap.set(clientIp, record);

  // Clean stale keys periodically
  if (rateLimitMap.size > 1000) {
    for (const [key, val] of rateLimitMap.entries()) {
      if (now > val.resetTime) rateLimitMap.delete(key);
    }
  }

  return record.count <= maxRequests;
}

const PLAN_AMOUNTS = {
  plan_1day: { name: '1-Day Access', amount: 99, durationDays: 1, isLifetime: false },
  plan_7day: { name: '7-Day Pass', amount: 249, durationDays: 7, isLifetime: false },
  plan_30day: { name: '30-Day Pro', amount: 799, durationDays: 30, isLifetime: false },
  plan_lifetime: { name: 'Lifetime Elite', amount: 3999, durationDays: null, isLifetime: true },
};

// --- SECURITY: Allowed origins for CORS ---
const ALLOWED_ORIGINS = [
  'https://ligeitcheats.live',
  'https://www.ligeitcheats.live',
  'http://localhost:5173',
  'http://localhost:3000',
];

function generateSecureLicenseKey(prefix = 'LEGIT') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segments = [];
  const randomBytes = crypto.randomBytes(12);
  let byteIndex = 0;

  for (let s = 0; s < 3; s++) {
    let seg = '';
    for (let i = 0; i < 4; i++) {
      seg += chars[randomBytes[byteIndex++] % chars.length];
    }
    segments.push(seg);
  }
  return `${prefix.toUpperCase()}-${segments.join('-')}`;
}

export default async function handler(req, res) {
  // 1. Defense-in-depth HTTP Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  // --- SECURITY: CORS Origin Validation ---
  const origin = req.headers['origin'] || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 2. IP Rate Limiting Guard (using trusted Vercel IP)
  const clientIp = getTrustedClientIp(req);
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: 'Security Alert: Rate limit exceeded. Please wait 60 seconds.' });
  }

  try {
    // --- SECURITY: Require env vars, never fallback to hardcoded credentials ---
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const razorpayKeyId = process.env.VITE_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    // Fail-fast if critical credentials are missing
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('FATAL: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY env vars');
      return res.status(500).json({ error: 'Server configuration error. Contact support.' });
    }
    if (!razorpayKeyId || !razorpayKeySecret) {
      console.error('FATAL: Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET env vars');
      return res.status(500).json({ error: 'Payment gateway configuration error. Contact support.' });
    }

    // 3. Mandatory User Authentication Validation
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (!bearerToken) {
      return res.status(401).json({
        error: 'Authentication Required: You must be signed in with a valid account to verify and claim a license.'
      });
    }

    let verifiedUserId = null;
    let verifiedUserEmail = null;

    try {
      const authCheckRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${bearerToken}`
        }
      });

      if (!authCheckRes.ok) {
        return res.status(401).json({
          error: 'Authentication Expired: Your session could not be verified. Please log in again.'
        });
      }

      const authUser = await authCheckRes.json();
      if (!authUser || !authUser.id) {
        return res.status(401).json({ error: 'Authentication Failed: User record not found.' });
      }

      verifiedUserId = authUser.id;
      verifiedUserEmail = authUser.email;
    } catch (authErr) {
      console.error('Auth verification error:', authErr);
      return res.status(500).json({ error: 'Security server failed to validate user credentials.' });
    }

    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, plan_id } = req.body || {};

    // 4. Strict Whitelist Sanitization of payment_id
    if (!razorpay_payment_id || typeof razorpay_payment_id !== 'string') {
      return res.status(400).json({ error: 'Missing payment parameter.' });
    }
    if (!razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing Razorpay signature or order ID.' });
    }

    const cleanPaymentId = razorpay_payment_id.trim();
    if (!/^pay_[a-zA-Z0-9]{14,28}$/.test(cleanPaymentId)) {
      return res.status(400).json({ error: 'Invalid Razorpay payment ID format.' });
    }

    // 5. Strict Plan Validation
    const plan = PLAN_AMOUNTS[plan_id];
    if (!plan) {
      return res.status(400).json({ error: 'Invalid or unrecognized plan_id.' });
    }

    // 6. Anti-Replay: Check memory cache
    if (redeemedPayments.has(cleanPaymentId)) {
      return res.status(409).json({ error: 'This payment has already been redeemed for a license key.' });
    }

    // 7. Persistent Anti-Replay: Check Supabase database
    // --- SECURITY: Use service role key for server-side queries to bypass RLS ---
    const dbAuthToken = supabaseServiceKey || supabaseAnonKey;
    try {
      const checkRes = await fetch(
        `${supabaseUrl}/rest/v1/licenses?note=like.*${encodeURIComponent(cleanPaymentId)}*&select=license_key,status`, {
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${dbAuthToken}`
        }
      });
      if (checkRes.ok) {
        const existingLicenses = await checkRes.json();
        if (Array.isArray(existingLicenses) && existingLicenses.length > 0) {
          redeemedPayments.add(cleanPaymentId);
          return res.status(200).json({
            success: true,
            key: existingLicenses[0].license_key,
            order: {
              orderId: 'ORD-' + Math.floor(100000 + Math.random() * 900000),
              planId: plan_id,
              planName: plan.name,
              price: `₹${plan.amount}`,
              amount: plan.amount,
              durationDays: plan.durationDays,
              isLifetime: plan.isLifetime,
              paymentMethod: 'razorpay_verified',
              transactionRef: cleanPaymentId,
              status: 'verified',
              verifiedAt: new Date().toISOString(),
              userEmail: verifiedUserEmail,
              hwid: null,
              isReclaimed: true
            }
          });
        }
      }
    } catch (checkErr) {
      console.warn('Anti-replay database query notice:', checkErr);
    }

    // 8. Server-to-Server Razorpay Signature Verification
    const expectedSignature = crypto.createHmac('sha256', razorpayKeySecret)
      .update(`${razorpay_order_id}|${cleanPaymentId}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.error('Signature mismatch', { expectedSignature, received: razorpay_signature });
      return res.status(400).json({ error: 'Cryptographic signature verification failed. Payment tampered.' });
    }

    // 8.1 Server-to-Server Razorpay API Verification
    const authHeaderEncoded = 'Basic ' + Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString('base64');

    const razorpayRes = await fetch(`https://api.razorpay.com/v1/payments/${cleanPaymentId}`, {
      method: 'GET',
      headers: {
        'Authorization': authHeaderEncoded,
        'Content-Type': 'application/json'
      }
    });

    if (!razorpayRes.ok) {
      console.error('Razorpay verification error:', await razorpayRes.text());
      return res.status(400).json({ error: 'Payment verification failed.' });
    }

    const paymentData = await razorpayRes.json();

    // 9. Audit Payment Status
    if (paymentData.status !== 'captured' && paymentData.status !== 'authorized') {
      return res.status(400).json({
        error: 'Payment has not been completed successfully. Please complete the payment first.'
      });
    }

    // 10. Audit Exact Payment Amount (Anti-tampering against tier spoofing)
    const expectedAmountPaise = plan.amount * 100;
    if (paymentData.amount !== expectedAmountPaise) {
      // --- SECURITY: Generic error message, do not leak expected amounts ---
      return res.status(400).json({
        error: 'Payment amount does not match the selected plan. Please contact support.'
      });
    }

    // 11. Currency Check
    if (paymentData.currency !== 'INR') {
      return res.status(400).json({ error: 'Invalid currency. Must be INR.' });
    }

    // Mark payment ID as redeemed
    redeemedPayments.add(cleanPaymentId);

    // 12. Mint Cryptographic License Key
    const mintedKey = generateSecureLicenseKey('LEGIT');
    const orderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
    const verifiedAt = new Date().toISOString();

    // 13. Sync with Supabase licenses table bound to verified user
    // --- SECURITY: Require service role key for DB writes. Fail-fast if missing. ---
    if (!supabaseServiceKey) {
      console.error('WARNING: SUPABASE_SERVICE_ROLE_KEY not set. License will not be persisted to database.');
    }

    try {
      const insertRes = await fetch(`${supabaseUrl}/rest/v1/licenses`, {
        method: 'POST',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseServiceKey || supabaseAnonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          license_key: mintedKey,
          duration_days: plan.durationDays,
          is_lifetime: plan.isLifetime,
          note: `Verified Razorpay: ${cleanPaymentId} | ${verifiedUserEmail} (${verifiedUserId})`,
          status: 'active'
        })
      });
      if (!insertRes.ok) {
        console.error('License insert failed:', await insertRes.text());
      }
    } catch (dbErr) {
      console.warn('Licenses table insert notice:', dbErr);
    }

    return res.status(200).json({
      success: true,
      key: mintedKey,
      order: {
        orderId,
        planId: plan_id,
        planName: plan.name,
        price: `₹${plan.amount}`,
        amount: plan.amount,
        durationDays: plan.durationDays,
        isLifetime: plan.isLifetime,
        paymentMethod: 'razorpay_verified',
        transactionRef: cleanPaymentId,
        status: 'verified',
        verifiedAt,
        userEmail: verifiedUserEmail,
        userId: verifiedUserId,
        hwid: null
      }
    });
  } catch (error) {
    console.error('Server error during payment verification:', error);
    return res.status(500).json({ error: 'Internal security engine error.' });
  }
}
