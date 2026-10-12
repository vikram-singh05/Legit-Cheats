# Security Policy & Hardening Documentation

**Target Domain:** [legitcheats.live](https://legitcheats.live)  
**Security Lead:** Senior Application Security Engineer  
**Last Audit & Hardening Date:** 2026-10-12  
**Active Branch:** `security-hardening`  

---

## 1. Vulnerability Disclosure & Reporting

If you identify a security vulnerability in `legitcheats.live`, please report it responsibly:
- **Email:** Contact the security contact configured in your administration panel or email `jangravikram3105@gmail.com`.
- **Response SLA:** Acknowledgement within 24 hours; severity assessment within 72 hours.
- **Scope:** Includes all client-facing web surfaces, Vercel serverless functions (`/api/*`), Supabase database access controls, and Razorpay payment integration.

---

## 2. Hardening Measures Implemented (Phase 2 Remediations)

The following vulnerabilities were identified in the security audit and remediated on the `security-hardening` branch:

### [CRITICAL] Pre-Signature Key Disclosure Remediated (CRIT-01)
- **File:** [`api/verify-payment.js`](file:///c:/Users/vsjan/Music/web/api/verify-payment.js)
- **Fix:** Restructured the payment verification pipeline so that:
  1. Cryptographic HMAC SHA-256 signature verification runs **first** before any database operations.
  2. Server-to-server Razorpay API status and amount checks run **second**.
  3. Replay checks run **third**. If an already-redeemed payment is queried, the server verifies that `verifiedUserId` or `verifiedUserEmail` matches the original purchaser. Unauthorized accounts attempting to replay other users' transaction IDs receive a strict `403 Forbidden` error.

### [CRITICAL] Client-Side PostgREST Wildcard Scraping Eliminated (CRIT-02)
- **File:** [`src/context/PurchaseContext.jsx`](file:///c:/Users/vsjan/Music/web/src/context/PurchaseContext.jsx)
- **Fix:** Removed all client-side `supabase.from('licenses').select('*')` wildcard substring queries (`note.ilike.%...%`). License verification and key claiming flow exclusively through secure serverless API endpoints with service role authentication.

### [HIGH] Order Creation Authentication & Rate Limiting (HIGH-01)
- **File:** [`api/create-order.js`](file:///c:/Users/vsjan/Music/web/api/create-order.js)
- **Fix:** Replaced the superficial Bearer check with mandatory server-side token validation against Supabase Auth (`/auth/v1/user`). Added trusted IP rate limiting (15 requests/minute per IP) using Vercel proxy headers (`x-real-ip`).

### [HIGH] License Key Brute-Force Rate Limiting (HIGH-02)
- **File:** [`api/redeem-key.js`](file:///c:/Users/vsjan/Music/web/api/redeem-key.js)
- **Fix:** Implemented trusted IP rate limiting (max 10 redemption attempts per minute per IP) to prevent automated dictionary or permutation attacks on license keys.

### [MEDIUM] Cryptographic Timing Attack Prevention (MED-02)
- **File:** [`api/verify-payment.js`](file:///c:/Users/vsjan/Music/web/api/verify-payment.js)
- **Fix:** Replaced standard string equality comparison (`===`) with `crypto.timingSafeEqual()` on raw byte buffers, eliminating execution time variances that could leak HMAC digest bytes.

### [MEDIUM] Database Error Masking & Information Disclosure (MED-03)
- **File:** [`api/redeem-key.js`](file:///c:/Users/vsjan/Music/web/api/redeem-key.js)
- **Fix:** Masked internal PostgREST error messages and database schema traces behind generic user-facing messages while maintaining diagnostic logging in server runtime logs.

### [MEDIUM] CORS Typo Fix (MED-01)
- **Files:** [`api/verify-payment.js`](file:///c:/Users/vsjan/Music/web/api/verify-payment.js), [`api/create-order.js`](file:///c:/Users/vsjan/Music/web/api/create-order.js), [`api/redeem-key.js`](file:///c:/Users/vsjan/Music/web/api/redeem-key.js), [`api/admin-users.js`](file:///c:/Users/vsjan/Music/web/api/admin-users.js)
- **Fix:** Corrected CORS whitelist from `https://ligeitcheats.live` (typo) to `https://legitcheats.live` and `https://www.legitcheats.live`.

### [LOW] Password Policy Hardening (LOW-03)
- **File:** [`src/pages/Login.jsx`](file:///c:/Users/vsjan/Music/web/src/pages/Login.jsx)
- **Fix:** Increased minimum password length from 6 to 8 characters for both account registration and password reset workflows.

### [LOW] Environment Configuration & Admin Externalization (LOW-01, LOW-02)
- **Files:** [`api/admin-users.js`](file:///c:/Users/vsjan/Music/web/api/admin-users.js), [`.env.example`](file:///c:/Users/vsjan/Music/web/.env.example)
- **Fix:** Externalized administrator emails into `ADMIN_EMAILS` environment variable. Updated `.env.example` with `SUPABASE_SERVICE_ROLE_KEY` and `ADMIN_EMAILS`.

---

## 3. Remaining Architectural Risks & Recommended Mitigations

1. **Ephemeral Serverless Memory for Rate Limiting:**
   - *Risk:* In-memory rate limiting maps (`rateLimitMap`) are scoped to individual Vercel serverless containers. High-volume distributed attacks spanning cold starts or multiple edge regions can partially bypass in-memory limits.
   - *Mitigation:* Connect Upstash Redis / Vercel KV for global persistent rate limiting, or enforce Cloudflare WAF rate limiting rules at the edge.
2. **Public Binary Hosting on Supabase Storage:**
   - *Risk:* `legit.exe` is stored in a publicly accessible bucket (`/storage/v1/object/public/downloads/legit.exe`).
   - *Mitigation:* Follow Step 2 in the Manual Infrastructure Checklist below to make the bucket private and generate short-lived signed URLs.

---

## 4. Ongoing Security Maintenance Checklist

- [ ] **Monthly Dependency Audits:** Run `npm audit` and update outdated packages via `npm update`.
- [ ] **Quarterly Secret Rotation:**
  - Rotate Razorpay Key Secret in Razorpay Dashboard.
  - Rotate Supabase Service Role Key in Supabase Dashboard.
  - Update environment variables in Vercel project settings immediately after rotation.
- [ ] **Weekly Database Backups:** Verify Supabase automated point-in-time recovery (PITR) or configure scheduled PostgreSQL logical dumps (`pg_dump`).
- [ ] **Log Monitoring:** Periodically review Vercel Function logs for recurring 401, 403, or 429 status spikes indicating credential stuffing or scraping attempts.

---

## 5. Manual Infrastructure Hardening Checklist (Outside Code)

The following critical protections must be configured directly in your provider control panels (Name.com, Cloudflare, Supabase, Vercel, Razorpay):

### Step 1: Supabase Database Row Level Security (RLS)
Execute the following SQL commands in your **Supabase Dashboard -> SQL Editor** to ensure zero unauthorized client access to the `licenses` table:

```sql
-- 1. Enable RLS on the licenses table
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;

-- 2. Revoke direct anon and authenticated access (only service_role key can access)
REVOKE ALL ON licenses FROM anon;
REVOKE ALL ON licenses FROM authenticated;

-- 3. Policy: Service Role full administrative access
CREATE POLICY "Service Role Full Access"
  ON licenses
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 5. Profiles policy: Users can only read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);
```

### Step 2: Supabase Storage Bucket Hardening
1. In **Supabase Dashboard -> Storage**:
2. Select the `downloads` bucket.
3. Toggle bucket access from **Public** to **Private**.
4. Set up an RLS policy on `storage.objects` allowing reads only when authenticated with an active license, or distribute downloads via a serverless function (`/api/download`) that issues signed download URLs valid for 60 seconds.

### Step 3: Supabase Authentication Security
1. Navigate to **Supabase Dashboard -> Authentication -> Rate Limits**:
   - Set **Sign-ins** rate limit: `5 requests per 5 minutes per IP`.
   - Set **Sign-ups** rate limit: `3 requests per 10 minutes per IP`.
   - Set **Password Recovery** rate limit: `2 requests per 15 minutes per IP`.
2. Under **Authentication -> Email Templates**:
   - Ensure redirect URLs whitelist only `https://legitcheats.live/**`.

### Step 4: Cloudflare & DNS Hardening (Recommended)
1. Point your domain nameservers from Name.com to Cloudflare (Free or Pro plan).
2. **Enable DNSSEC** in Name.com and Cloudflare to prevent DNS cache poisoning and spoofing.
3. In **Cloudflare Dashboard -> Security -> WAF**:
   - Enable **Bot Fight Mode** to block automated scrapers.
   - Create a WAF Rate Limiting rule for `/api/*`: Limit to `30 requests per minute` per IP with a 1-hour block on violation.
   - Enforce **Strict SSL/TLS (Full/Strict)** to prevent downgrade attacks.
   - Enable **Under Attack Mode** if receiving an active DDoS attack.

### Step 5: Vercel Deployment Settings
1. In **Vercel Dashboard -> Project Settings -> Environment Variables**:
   - Verify `SUPABASE_SERVICE_ROLE_KEY` is present in Production, Preview, and Development.
   - Verify `ADMIN_EMAILS=jangravikram3105@gmail.com` is configured.
   - Verify `RAZORPAY_KEY_SECRET` matches your live Razorpay secret.
2. In **Project Settings -> Deployment Protection**:
   - Enable Vercel Attack Challenge Mode or Firewall if available on your plan.

### Step 6: Razorpay Live Configuration
1. In **Razorpay Dashboard -> Settings -> API Keys**:
   - Ensure you are using Live API keys (`rzp_live_...`) in production.
2. If using Razorpay Webhooks:
   - Configure a webhook secret and verify the `X-Razorpay-Signature` header on every incoming webhook.
