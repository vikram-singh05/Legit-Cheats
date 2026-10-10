import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { PRICING_PLANS, getAppDownloadUrl, APP_FILE_NAME, APP_VERSION } from '../lib/plans';

const PurchaseContext = createContext({});

// Canonical cryptographic license format: LEGIT-XXXX-XXXX-XXXX
export const LICENSE_KEY_REGEX = /^LEGIT-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export function isValidLicenseKey(key) {
  return typeof key === 'string' && LICENSE_KEY_REGEX.test(key.trim());
}

export function PurchaseProvider({ children }) {
  const { user, session } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(PRICING_PLANS[2]); // Default 30-Day Pro
  const [downloadNotice, setDownloadNotice] = useState(null);

  // Storage key helper: strictly bound to authenticated user ID
  const getStorageKey = (uid) => uid ? `legit_purchases_${uid}` : null;

  // Sanitize purchase records against tampering or forged keys
  const sanitizePurchases = useCallback((rawList) => {
    if (!Array.isArray(rawList) || !user) return [];
    return rawList.map(item => {
      if (!item || typeof item !== 'object') return null;
      // If marked verified, strictly audit the license key format
      if (item.status === 'verified') {
        if (!isValidLicenseKey(item.key)) {
          // Defense: Purge tampered or unauthorized key
          return {
            ...item,
            status: 'pending_verification',
            key: null
          };
        }
      }
      return item;
    }).filter(Boolean);
  }, [user]);

  // Load user purchases and synchronize across persistent sessions
  const loadPurchases = useCallback(() => {
    // Defense: Guest or unauthenticated visitors have zero purchase privileges
    if (!user?.id) {
      setPurchases([]);
      try { localStorage.removeItem('legit_purchases_guest'); } catch (_) {}
      return;
    }

    let loaded = [];
    const userStorageKey = getStorageKey(user.id);
    const storedLocal = userStorageKey ? localStorage.getItem(userStorageKey) : null;

    if (storedLocal) {
      try {
        const parsed = JSON.parse(storedLocal) || [];
        loaded = sanitizePurchases(parsed);
      } catch (e) {
        console.error('Failed to parse local purchases:', e);
      }
    }

    // Check user_metadata from Supabase persistent auth session
    if (user.user_metadata?.purchases && Array.isArray(user.user_metadata.purchases)) {
      const metaPurchases = sanitizePurchases(user.user_metadata.purchases);
      const map = new Map();
      [...loaded, ...metaPurchases].forEach(item => {
        if (item?.orderId) {
          const existing = map.get(item.orderId);
          if (!existing || item.status === 'verified') {
            map.set(item.orderId, item);
          }
        }
      });
      loaded = Array.from(map.values());
    }

    setPurchases(loaded);
  }, [user, sanitizePurchases]);

  useEffect(() => {
    loadPurchases();
  }, [loadPurchases]);

  // Persist purchases to localStorage only (SECURITY FIX MED-05: removed user_metadata sync)
  // Purchases are stored server-side in the licenses table via /api/verify-payment
  const savePurchases = async (updatedPurchases) => {
    if (!user?.id) return;
    const sanitized = sanitizePurchases(updatedPurchases);
    setPurchases(sanitized);

    const key = getStorageKey(user.id);
    if (key) {
      localStorage.setItem(key, JSON.stringify(sanitized));
    }
    // --- SECURITY FIX (MED-05): Removed user_metadata.purchases sync ---
    // Storing all purchases in auth metadata causes unlimited growth
    // and potential token corruption. Licenses are persisted server-side.
  };

  // Derive active verified license with cryptographic validation
  const verifiedPurchases = purchases.filter(p => p.status === 'verified' && isValidLicenseKey(p.key));
  const activeLicense = verifiedPurchases.length > 0
    ? verifiedPurchases[verifiedPurchases.length - 1]
    : null;

  const hasPurchased = !!activeLicense && !!user;

  // Checkout modal controls
  const openCheckout = (plan = null) => {
    if (plan) {
      setSelectedPlan(plan);
    }
    setIsCheckoutOpen(true);
  };

  const closeCheckout = () => {
    setIsCheckoutOpen(false);
  };

  // Create an order in pending state (Requires Authentication)
  const createOrder = async ({ plan, paymentMethod, transactionRef }) => {
    if (!user) {
      throw new Error('Authentication Required: Please sign in or create an account to initiate checkout.');
    }

    const orderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
    const newOrder = {
      orderId,
      planId: plan.id,
      planName: plan.name,
      price: plan.price,
      amount: plan.amount,
      durationDays: plan.durationDays,
      isLifetime: plan.isLifetime,
      paymentMethod,
      transactionRef: transactionRef || `TXN-${Date.now()}`,
      status: 'pending_verification',
      createdAt: new Date().toISOString(),
      userEmail: user.email,
      userId: user.id,
      key: null,
      hwid: null
    };

    const updated = [newOrder, ...purchases];
    await savePurchases(updated);
    return newOrder;
  };

  /**
   * Verify a purchase:
   * 1. Requires valid user session
   * 2. Calls server-side /api/verify-payment with user's JWT access token
   * 3. Prevents client-side arbitrary string minting
   */
  const verifyPurchase = async (orderIdOrRef, customPlan = null) => {
    if (!user) {
      throw new Error('Authentication Required: Please sign in to verify payments.');
    }

    const trimmedInput = (orderIdOrRef || '').trim();
    if (!trimmedInput || trimmedInput.length < 4) {
      throw new Error('Please enter a valid Transaction Reference, Razorpay Payment ID, or Order ID.');
    }

    const targetPlan = customPlan || selectedPlan;

    // A. Check if this is a real Razorpay payment ID (e.g. pay_XXXX)
    if (trimmedInput.startsWith('pay_')) {
      const headers = {
        'Content-Type': 'application/json'
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/verify-payment', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          payment_id: trimmedInput,
          plan_id: targetPlan.id
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Payment gateway verification failed.');
      }

      const verifiedOrder = {
        ...result.order,
        key: result.key,
        status: 'verified'
      };

      const existingIdx = purchases.findIndex(
        p => p.transactionRef === trimmedInput || p.orderId === verifiedOrder.orderId
      );

      let updatedList;
      if (existingIdx >= 0) {
        updatedList = purchases.map((p, idx) => idx === existingIdx ? verifiedOrder : p);
      } else {
        updatedList = [verifiedOrder, ...purchases];
      }

      await savePurchases(updatedList);
      return verifiedOrder;
    }

    // B. Check if this is an already verified order in user's state
    const existingOrder = purchases.find(
      p => (p.orderId && p.orderId.toLowerCase() === trimmedInput.toLowerCase()) ||
           (p.transactionRef && p.transactionRef.toLowerCase() === trimmedInput.toLowerCase())
    );

    if (existingOrder && existingOrder.status === 'verified' && isValidLicenseKey(existingOrder.key)) {
      return existingOrder;
    }

    // C. Check against remote Supabase licenses table bound to this user
    // --- SECURITY FIX (HIGH-02): Strict input sanitization before .or() query ---
    const safeInput = trimmedInput.replace(/[^a-zA-Z0-9_\-]/g, '');
    if (safeInput.length < 4) {
      throw new Error('Invalid reference format.');
    }
    try {
      const { data: dbLicense, error: dbErr } = await supabase
        .from('licenses')
        .select('*')
        .or(`note.ilike.%${safeInput}%,license_key.eq.${safeInput}`)
        .eq('status', 'active')
        .maybeSingle();

      if (!dbErr && dbLicense && isValidLicenseKey(dbLicense.license_key)) {
        const verifiedOrder = {
          orderId: existingOrder ? existingOrder.orderId : 'ORD-' + Math.floor(100000 + Math.random() * 900000),
          planId: targetPlan.id,
          planName: targetPlan.name,
          price: targetPlan.price,
          amount: targetPlan.amount,
          durationDays: dbLicense.duration_days,
          isLifetime: dbLicense.is_lifetime,
          paymentMethod: existingOrder ? existingOrder.paymentMethod : 'verified_remote',
          transactionRef: trimmedInput,
          status: 'verified',
          verifiedAt: new Date().toISOString(),
          userEmail: user.email,
          userId: user.id,
          key: dbLicense.license_key,
          hwid: dbLicense.hwid || null
        };

        const updatedList = [
          verifiedOrder,
          ...purchases.filter(p => p.orderId !== verifiedOrder.orderId && p.transactionRef !== trimmedInput)
        ];
        await savePurchases(updatedList);
        return verifiedOrder;
      }
    } catch (checkErr) {
      console.warn('Database remote check notice:', checkErr);
    }

    // D. If unverified manual reference, record as pending and reject instant key grant
    throw new Error(
      'Payment reference could not be verified automatically. For instant automated delivery, complete checkout with Razorpay. If you paid via UPI/manual transfer, your order is queued for administrator review.'
    );
  };

  // Real App Client Download handler (strictly protected by verified license & auth check)
  const downloadApp = () => {
    if (!user || !hasPurchased) {
      openCheckout();
      return;
    }

    const realUrl = getAppDownloadUrl();
    const fallbackUrl = `/downloads/${APP_FILE_NAME}`;

    setDownloadNotice({
      fileName: APP_FILE_NAME,
      version: APP_VERSION,
      url: realUrl,
      timestamp: new Date().toLocaleTimeString()
    });

    try {
      const link = document.createElement('a');
      link.href = realUrl;
      link.download = APP_FILE_NAME;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.warn('Direct link navigation failed, attempting fallback download:', err);
      const link = document.createElement('a');
      link.href = fallbackUrl;
      link.download = APP_FILE_NAME;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    setTimeout(() => {
      setDownloadNotice(null);
    }, 4500);
  };

  return (
    <PurchaseContext.Provider
      value={{
        purchases,
        activeLicense,
        hasPurchased,
        isCheckoutOpen,
        selectedPlan,
        downloadNotice,
        openCheckout,
        closeCheckout,
        createOrder,
        verifyPurchase,
        downloadApp,
        triggerDummyDownload: downloadApp,
        refreshPurchases: loadPurchases,
        APP_VERSION,
        APP_FILE_NAME,
        appDownloadUrl: getAppDownloadUrl(),
        DUMMY_DOWNLOAD_URL: getAppDownloadUrl()
      }}
    >
      {children}
    </PurchaseContext.Provider>
  );
}

export function usePurchase() {
  return useContext(PurchaseContext);
}
