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
    'https://ligeitcheats.live',
    'https://www.ligeitcheats.live',
    'http://localhost:5173',
    'http://localhost:3000',
  ];
  
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
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
      return res.status(401).json({ error: 'Authentication Required.' });
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
    // Admin check via app_metadata, verified email, or profiles table
    let isAdmin = authUser.app_metadata?.role === 'admin' || authUser.email === 'jangravikram3105@gmail.com';

    if (!isAdmin && supabaseServiceKey) {
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
      return res.status(403).json({ error: 'Access Denied: Admin authorization required.' });
    }

    const userMap = {};

    // 3. Fetch user directory with Service Role Key
    if (supabaseServiceKey) {
      try {
        const adminUsersRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, {
          headers: {
            'apikey': supabaseAnonKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          }
        });

        if (adminUsersRes.ok) {
          const data = await adminUsersRes.json();
          const list = data?.users || (Array.isArray(data) ? data : []);
          list.forEach(u => {
            if (u.id && u.email) {
              userMap[u.id] = u.email;
            }
          });
        }
      } catch (err) {
        console.warn('Error fetching admin user list:', err);
      }
    }

    return res.status(200).json({
      success: true,
      users: userMap
    });

  } catch (error) {
    console.error('Server error in admin-users handler:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
