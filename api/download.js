// In-memory rate limiting map for downloads: ip -> { count, resetTime }
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
  const windowMs = 60 * 1000;
  const maxRequests = 20; // Max 20 download attempts per minute per IP

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
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  const origin = req.headers['origin'] || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const clientIp = getTrustedClientIp(req);
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: 'Download rate limit exceeded. Please wait 60 seconds.' });
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ error: 'Server configuration error.' });
    }

    // Extract Bearer token from header or query param
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    let bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    if (!bearerToken && req.query?.token) {
      bearerToken = String(req.query.token).trim();
    }

    if (!bearerToken) {
      return res.status(401).json({
        error: 'Authentication Required: You must be signed in with an active license to download the client binary.'
      });
    }

    // 1. Verify user session with Supabase Auth
    const authCheckRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${bearerToken}`
      }
    });

    if (!authCheckRes.ok) {
      return res.status(401).json({ error: 'Authentication Expired: Session invalid or expired.' });
    }

    const authUser = await authCheckRes.json();
    if (!authUser || !authUser.id) {
      return res.status(401).json({ error: 'User record not found.' });
    }

    const userEmail = (authUser.email || '').trim().toLowerCase();
    const userId = authUser.id;

    // 2. Check if admin
    const configuredAdminEmails = (process.env.ADMIN_EMAILS || 'jangravikram3105@gmail.com')
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);

    const isAdmin = authUser.app_metadata?.role === 'admin' || (userEmail && configuredAdminEmails.includes(userEmail));

    let hasActiveLicense = isAdmin;

    // 3. Verify user has an active, valid license
    if (!hasActiveLicense && supabaseServiceKey) {
      const dbAuthToken = supabaseServiceKey;
      const fetchRes = await fetch(`${supabaseUrl}/rest/v1/licenses?status=eq.active&select=*`, {
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${dbAuthToken}`
        }
      });

      if (fetchRes.ok) {
        const allLicenses = await fetchRes.json();
        if (Array.isArray(allLicenses)) {
          const now = Date.now();
          hasActiveLicense = allLicenses.some(lic => {
            if (!lic || lic.status !== 'active') return false;
            const note = (lic.note || '').toLowerCase();
            if (note.includes('[unlinked]') || note.includes('unlinked by user')) return false;

            const matchesUser = (userEmail && note.includes(userEmail)) || (userId && note.includes(userId.toLowerCase()));
            if (!matchesUser) return false;

            // Check expiration
            if (lic.is_lifetime) return true;
            if (lic.expires_at) {
              return new Date(lic.expires_at).getTime() > now;
            }
            if (!lic.hwid) {
              // Unactivated standby key
              return true;
            }
            if (lic.activated_at && lic.duration_days) {
              const exp = new Date(lic.activated_at).getTime() + Number(lic.duration_days) * 24 * 60 * 60 * 1000;
              return exp > now;
            }
            return true;
          });
        }
      }
    }

    if (!hasActiveLicense) {
      console.warn(`SECURITY ALERT: Unauthorized download attempt by user ${userEmail} (${userId})`);
      return res.status(403).json({
        error: 'Access Denied: An active, verified license key is required to download legit.exe.'
      });
    }

    // 4. Authorized: Generate short-lived signed URL (valid for 60 seconds) or stream
    const bucket = 'downloads';
    const filePath = 'legit.exe';

    if (supabaseServiceKey) {
      try {
        const signRes = await fetch(`${supabaseUrl}/storage/v1/object/sign/${bucket}/${filePath}`, {
          method: 'POST',
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ expiresIn: 60 })
        });

        if (signRes.ok) {
          const signData = await signRes.json();
          if (signData.signedURL) {
            const fullSignedUrl = `${supabaseUrl}/storage/v1${signData.signedURL}`;
            return res.status(200).json({
              success: true,
              download_url: fullSignedUrl,
              expires_in: 60
            });
          }
        }
      } catch (signErr) {
        console.warn('Signed URL generation error, falling back to direct stream:', signErr);
      }
    }

    // Fallback if signed URL endpoint is unavailable: stream binary with Service Role Key
    const fetchFileRes = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${filePath}`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseServiceKey || supabaseAnonKey}`
      }
    });

    if (!fetchFileRes.ok) {
      console.error('Failed to retrieve binary from storage:', await fetchFileRes.text());
      return res.status(500).json({ error: 'Download server file temporarily unavailable.' });
    }

    const fileBuffer = await fetchFileRes.arrayBuffer();
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="legit.exe"');
    res.setHeader('Content-Length', fileBuffer.byteLength);
    return res.status(200).send(Buffer.from(fileBuffer));

  } catch (error) {
    console.error('Server error in download gateway:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
