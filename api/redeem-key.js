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
  const maxRequests = 10; // Max 10 attempts per minute per IP

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
  // Defense-in-depth HTTP Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  const origin = req.headers['origin'] || '';
  const ALLOWED_ORIGINS = [
    'https://legitcheats.live',
    'https://www.legitcheats.live',
    'http://localhost:5173',
    'http://localhost:3000',
  ];
  
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Rate Limiting Guard against brute-force key guessing (HIGH-02)
  const clientIp = getTrustedClientIp(req);
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: 'Security Alert: Rate limit exceeded. Please wait 60 seconds.' });
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ error: 'Server configuration error.' });
    }

    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (!bearerToken) {
      return res.status(401).json({ error: 'Authentication Required: You must be signed in to redeem a license.' });
    }

    // Authenticate User against Supabase Auth
    const authCheckRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${bearerToken}`
      }
    });

    if (!authCheckRes.ok) {
      return res.status(401).json({ error: 'Authentication Expired: Your session could not be verified.' });
    }

    const authUser = await authCheckRes.json();
    if (!authUser || !authUser.id) {
      return res.status(401).json({ error: 'Authentication Failed: User record not found.' });
    }

    const { license_key } = req.body || {};
    const cleanKey = (license_key || '').trim();

    if (!/^LEGIT-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(cleanKey)) {
      return res.status(400).json({ error: 'Invalid license key format.' });
    }

    // Use Service Role Key to bypass RLS and read the licenses table
    const dbAuthToken = supabaseServiceKey || supabaseAnonKey;
    
    const checkRes = await fetch(
      `${supabaseUrl}/rest/v1/licenses?license_key=eq.${encodeURIComponent(cleanKey)}&status=eq.active&select=*`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${dbAuthToken}`
      }
    });

    if (!checkRes.ok) {
      // SECURITY FIX (MED-03): Log raw error on server; never leak database schema/errors to client
      console.error('Database license verification error:', await checkRes.text());
      return res.status(500).json({ error: 'Database verification service temporarily unavailable.' });
    }

    const existingLicenses = await checkRes.json();
    
    if (!Array.isArray(existingLicenses) || existingLicenses.length === 0) {
      return res.status(404).json({ error: 'License key is invalid, already in use, or expired.' });
    }

    const licenseData = existingLicenses[0];
    
    // Bind the key to the user if not already bound
    const userIdentifier = authUser.email ? authUser.email : authUser.id;
    const isAlreadyClaimed = licenseData.note && licenseData.note.includes('Claimed by');

    if (isAlreadyClaimed) {
      const isClaimedByCurrentUser =
        licenseData.note.includes(`Claimed by ${authUser.id}`) ||
        (authUser.email && licenseData.note.includes(`Claimed by ${authUser.email}`));
      if (!isClaimedByCurrentUser) {
        return res.status(403).json({ error: 'License key has already been claimed by another account.' });
      }
    } else if (supabaseServiceKey) {
      // Bind it to the user with their email address so admin sees their Gmail
      const updatedNote = licenseData.note
        ? `${licenseData.note} | Claimed by ${userIdentifier}`
        : `Claimed by ${userIdentifier}`;

      const updateRes = await fetch(`${supabaseUrl}/rest/v1/licenses?license_key=eq.${encodeURIComponent(cleanKey)}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          note: updatedNote
        })
      });
      if (!updateRes.ok) {
        console.warn('Failed to update license note during claiming:', await updateRes.text());
      }
    }

    return res.status(200).json({
      success: true,
      license: licenseData
    });

  } catch (error) {
    console.error('Server error during key redemption:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
