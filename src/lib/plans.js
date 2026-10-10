export const PRICING_PLANS = [
  {
    id: 'plan_1day',
    name: '1-Day Access',
    price: '₹99',
    amount: 99,
    period: '24 Hours',
    durationDays: 1,
    isLifetime: false,
    badge: null,
    popular: false,
    description: 'Instant unthrottled access with HWID protection.',
    features: [
      'Full Kernel Aimbot & ESP Suite',
      'OBS & Discord Streamproof Guard',
      'Instant Automated Key Delivery',
      '1 Concurrent PC Hardware Binding',
      'Community Discord Support'
    ]
  },
  {
    id: 'plan_7day',
    name: '7-Day Pass',
    price: '₹249',
    amount: 249,
    period: '1 Week',
    durationDays: 7,
    isLifetime: false,
    badge: null,
    popular: false,
    description: 'Extended weekly license with priority driver updates.',
    features: [
      'All 1-Day Features Included',
      'Priority Kernel Driver Updates',
      '1 Free HWID Reset Allowance',
      'Cloud Config Profile Sync',
      'Standard Support Ticket Priority'
    ]
  },
  {
    id: 'plan_30day',
    name: '30-Day Pro',
    price: '₹799',
    amount: 799,
    period: '1 Month',
    durationDays: 30,
    isLifetime: false,
    badge: 'MOST POPULAR',
    popular: true,
    description: 'Complete unthrottled arsenal for competitive players.',
    features: [
      'Complete Software Suite Access',
      'Exclusive Polymorphic Builds',
      'Instant Automated HWID Reset',
      'Unlimited Cloud Preset Slots',
      'Private VIP Discord Role & Chat',
      'Early Access to Feature Betas'
    ]
  },
  {
    id: 'plan_lifetime',
    name: 'Lifetime Elite',
    price: '₹3999',
    amount: 3999,
    period: 'Permanent Access',
    durationDays: null,
    isLifetime: true,
    badge: 'BEST VALUE',
    popular: false,
    description: 'Permanent unrestricted access with all future updates.',
    features: [
      'Never Pay Again — Lifetime Access',
      'Direct Developer Contact Access',
      'Zero Queue HWID Reset Portal',
      'Custom Unique Binary Compilations',
      'All Future Expansions Included',
      'VIP Lounge & Priority Alpha Testing'
    ]
  }
];

export const APP_VERSION = 'v3.4.2';
export const APP_FILE_NAME = 'legit.exe';

/**
 * Returns the real Supabase Storage public bucket URL for the application client
 */
export function getAppDownloadUrl() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_DOWNLOAD_URL) {
    return import.meta.env.VITE_APP_DOWNLOAD_URL;
  }
  // --- SECURITY FIX (MED-01): No hardcoded URL fallback ---
  const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || '';
  if (!supabaseUrl) return `/downloads/${APP_FILE_NAME}`;
  return `${supabaseUrl}/storage/v1/object/public/downloads/${APP_FILE_NAME}`;
}

export const APP_DOWNLOAD_URL = getAppDownloadUrl();
export const DUMMY_DOWNLOAD_URL = APP_DOWNLOAD_URL;

export const DEFAULT_UPI_ID = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_UPI_ID) || 'legitcheats@axl';

/**
 * Generates an NPCI compliant UPI Deep Link URI for mobile app intent & QR code
 */
export function generateUpiDeepLink({ upiId = DEFAULT_UPI_ID, name = 'LEGIT Cheats', amount, orderId = 'ORD' }) {
  return `upi://pay?pa=${upiId}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR&tn=${encodeURIComponent(`License Order ${orderId}`)}`;
}
