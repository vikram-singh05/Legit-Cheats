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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
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
      return res.status(401).json({ error: 'Authentication Required: You must be signed in to access licenses.' });
    }

    // 1. Authenticate user session with Supabase Auth
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

    if (!supabaseServiceKey) {
      console.error('FATAL: Missing SUPABASE_SERVICE_ROLE_KEY in user-licenses');
      return res.status(500).json({ error: 'Server configuration error.' });
    }

    // 2. GET: Retrieve user's licenses directly filtered by email or user ID
    if (req.method === 'GET') {
      const orFilter = userEmail
        ? `or=(note.ilike.*${encodeURIComponent(userEmail)}*,note.ilike.*${encodeURIComponent(userId)}*)`
        : `note.ilike.*${encodeURIComponent(userId)}*`;

      const fetchRes = await fetch(`${supabaseUrl}/rest/v1/licenses?${orFilter}&select=*&order=created_at.desc`, {
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseServiceKey}`
        }
      });

      if (!fetchRes.ok) {
        console.error('Failed to query user licenses from database:', await fetchRes.text());
        return res.status(500).json({ error: 'License database service unavailable.' });
      }

      const allLicenses = await fetchRes.json();
      if (!Array.isArray(allLicenses)) {
        return res.status(200).json({ success: true, licenses: [] });
      }

      // Filter out any unlinked licenses
      const userLicenses = allLicenses.filter(lic => {
        if (!lic || !lic.license_key) return false;
        const note = (lic.note || '').toLowerCase();
        
        // Exclude unlinked licenses
        if (note.includes('[unlinked]') || note.includes('unlinked by user')) {
          return false;
        }

        const matchesEmail = userEmail && note.includes(userEmail);
        const matchesId = userId && note.includes(userId.toLowerCase());

        return matchesEmail || matchesId;
      });

      return res.status(200).json({
        success: true,
        licenses: userLicenses
      });
    }

    // 3. POST / DELETE: Unlink/Remove old license from user profile
    if (req.method === 'POST' || req.method === 'DELETE') {
      const { license_key, action } = req.body || {};
      const targetKey = (license_key || req.query.license_key || '').trim();

      if (!targetKey) {
        return res.status(400).json({ error: 'Missing license_key parameter.' });
      }

      // Fetch the license to verify ownership
      const checkRes = await fetch(
        `${supabaseUrl}/rest/v1/licenses?license_key=eq.${encodeURIComponent(targetKey)}&select=*`,
        {
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          }
        }
      );

      if (!checkRes.ok) {
        return res.status(500).json({ error: 'Could not lookup license.' });
      }

      const foundList = await checkRes.json();
      if (!Array.isArray(foundList) || foundList.length === 0) {
        return res.status(404).json({ error: 'License key not found.' });
      }

      const lic = foundList[0];
      const note = (lic.note || '').toLowerCase();

      const isOwner =
        (userEmail && note.includes(userEmail)) ||
        (userId && note.includes(userId.toLowerCase()));

      if (!isOwner) {
        return res.status(403).json({ error: 'Access Denied: You do not own this license key.' });
      }

      // Append unlinked marker so it no longer appears in user profile
      const updatedNote = lic.note
        ? `${lic.note} | [Unlinked by user on ${new Date().toISOString()}]`
        : `[Unlinked by user on ${new Date().toISOString()}]`;

      if (supabaseServiceKey) {
        const patchRes = await fetch(
          `${supabaseUrl}/rest/v1/licenses?license_key=eq.${encodeURIComponent(targetKey)}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ note: updatedNote })
          }
        );

        if (!patchRes.ok) {
          console.warn('Failed to patch license note during unlinking:', await patchRes.text());
        }
      }

      return res.status(200).json({
        success: true,
        message: 'License key successfully unlinked and removed from your profile.'
      });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });

  } catch (error) {
    console.error('Server error in user-licenses endpoint:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
