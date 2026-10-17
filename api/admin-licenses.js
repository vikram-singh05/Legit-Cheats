import crypto from 'crypto';

// In-memory rate limiting map for admin operations: ip -> { count, resetTime }
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
  const maxRequests = 60; // Max 60 admin requests per minute per IP

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

const ALLOWED_ORIGINS = [
  'https://legitcheats.live',
  'https://www.legitcheats.live',
  'http://localhost:5173',
  'http://localhost:3000',
];

export default async function handler(req, res) {
  // Defense-in-depth HTTP Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  const origin = req.headers['origin'] || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const clientIp = getTrustedClientIp(req);
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please wait 60 seconds.' });
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error('FATAL: Missing Supabase credentials in admin-licenses');
      return res.status(500).json({ error: 'Server configuration error.' });
    }

    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (!bearerToken) {
      return res.status(401).json({ error: 'Authentication Required: No session token provided.' });
    }

    // 1. Authenticate Requesting User
    const authCheckRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${bearerToken}`
      }
    });

    if (!authCheckRes.ok) {
      return res.status(401).json({ error: 'Session expired or invalid.' });
    }

    const authUser = await authCheckRes.json();
    if (!authUser || !authUser.id) {
      return res.status(401).json({ error: 'User record not found.' });
    }

    // 2. Strict Admin Role Verification
    const configuredAdminEmails = (process.env.ADMIN_EMAILS || 'jangravikram3105@gmail.com')
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);

    const userEmail = (authUser.email || '').trim().toLowerCase();
    let isAdmin = authUser.app_metadata?.role === 'admin' || (userEmail && configuredAdminEmails.includes(userEmail));

    if (!isAdmin) {
      const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${authUser.id}&select=role`, {
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseServiceKey}`
        }
      });
      if (profileRes.ok) {
        const profiles = await profileRes.json();
        if (profiles?.[0]?.role === 'admin') {
          isAdmin = true;
        }
      }
    }

    if (!isAdmin) {
      console.warn(`SECURITY ALERT: Unauthorized access attempt to admin-licenses by ${userEmail} (${authUser.id})`);
      return res.status(403).json({ error: 'Access Denied: Administrator privileges required.' });
    }

    // --- SECURE ROUTING: Perform DB operations exclusively with SUPABASE_SERVICE_ROLE_KEY ---

    // 3. GET: List all licenses
    if (req.method === 'GET') {
      const fetchRes = await fetch(`${supabaseUrl}/rest/v1/licenses?select=*&order=created_at.desc`, {
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseServiceKey}`
        }
      });

      if (!fetchRes.ok) {
        console.error('Failed to query licenses:', await fetchRes.text());
        return res.status(500).json({ error: 'Failed to retrieve license records.' });
      }

      const licenses = await fetchRes.json();
      return res.status(200).json({
        success: true,
        licenses: Array.isArray(licenses) ? licenses : []
      });
    }

    // 4. POST: Create a new license key
    if (req.method === 'POST') {
      const {
        license_key,
        duration_days,
        is_lifetime,
        note,
        status = 'active'
      } = req.body || {};

      if (!license_key || typeof license_key !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid license_key parameter.' });
      }

      const cleanKey = license_key.trim().toUpperCase();
      if (!/^[A-Z0-9]{2,12}(-[A-Z0-9]{2,16})+$/i.test(cleanKey)) {
        return res.status(400).json({ error: 'License key format invalid. Expected e.g. LEGIT-XXXX-XXXX-XXXX' });
      }

      const newRecord = {
        license_key: cleanKey,
        duration_days: is_lifetime ? null : (duration_days ? Number(duration_days) : 30),
        is_lifetime: Boolean(is_lifetime),
        note: note ? String(note).trim() : null,
        status: ['active', 'banned', 'expired', 'paused'].includes(status) ? status : 'active',
        created_at: new Date().toISOString()
      };

      const insertRes = await fetch(`${supabaseUrl}/rest/v1/licenses`, {
        method: 'POST',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(newRecord)
      });

      if (!insertRes.ok) {
        const errText = await insertRes.text();
        console.error('Failed to create license record:', errText);
        if (errText.includes('duplicate key') || errText.includes('unique constraint')) {
          return res.status(409).json({ error: 'A license with this key already exists.' });
        }
        return res.status(500).json({ error: 'Failed to create license record.' });
      }

      const inserted = await insertRes.json();
      return res.status(201).json({
        success: true,
        license: inserted?.[0] || newRecord
      });
    }

    // 5. PATCH: Update license status or reset HWID
    if (req.method === 'PATCH') {
      const { id, status, reset_hwid } = req.body || {};

      if (!id) {
        return res.status(400).json({ error: 'Missing license ID parameter.' });
      }

      const updatePayload = {};

      if (reset_hwid) {
        updatePayload.hwid = null;
        updatePayload.activated_at = null;
        updatePayload.expires_at = null;
      }

      if (status && ['active', 'banned', 'expired', 'paused'].includes(status)) {
        updatePayload.status = status;
      }

      if (Object.keys(updatePayload).length === 0) {
        return res.status(400).json({ error: 'No valid update fields specified.' });
      }

      const patchRes = await fetch(`${supabaseUrl}/rest/v1/licenses?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(updatePayload)
      });

      if (!patchRes.ok) {
        console.error('Failed to patch license:', await patchRes.text());
        return res.status(500).json({ error: 'Failed to update license record.' });
      }

      const updated = await patchRes.json();
      return res.status(200).json({
        success: true,
        license: updated?.[0] || null
      });
    }

    // 6. DELETE: Revoke and permanently delete a license
    if (req.method === 'DELETE') {
      const id = req.body?.id || req.query?.id;

      if (!id) {
        return res.status(400).json({ error: 'Missing license ID parameter.' });
      }

      const deleteRes = await fetch(`${supabaseUrl}/rest/v1/licenses?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Prefer': 'return=minimal'
        }
      });

      if (!deleteRes.ok) {
        console.error('Failed to delete license:', await deleteRes.text());
        return res.status(500).json({ error: 'Failed to delete license record.' });
      }

      return res.status(200).json({
        success: true,
        message: 'License deleted successfully.'
      });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error) {
    console.error('Server error in admin-licenses endpoint:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
