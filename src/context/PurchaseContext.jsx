import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { PRICING_PLANS, getAppDownloadUrl, APP_FILE_NAME, APP_VERSION } from '../lib/plans';

const PurchaseContext = createContext({});

// Flexible cryptographic license format: accepts any valid hyphen-delimited alphanumeric format
// e.g. LEGIT-XXXX-XXXX-XXXX, LEGIT-LIFETIME-2026, VIP-ABCD-1234
export const LICENSE_KEY_REGEX = /^[A-Z0-9]{2,12}(-[A-Z0-9]{2,16})+$/i;

export function isValidLicenseKey(key) {
  return typeof key === 'string' && LICENSE_KEY_REGEX.test(key.trim());
}

export function PurchaseProvider({ children }) {
  const { user, session } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(PRICING_PLANS[2]); // Default 30-Day Pro
  const [downloadNotice, setDownloadNotice] = useState(null);

  // Active key selection tracking (allows user to switch between multiple keys)
  const [activeKeyId, setActiveKeyIdState] = useState(() => {
    try {
      return localStorage.getItem('legit_selected_active_key') || null;
    } catch (_) {
      return null;
    }
  });

  const setActiveKeyId = useCallback((keyString) => {
    setActiveKeyIdState(keyString);
    try {
      if (keyString) localStorage.setItem('legit_selected_active_key', keyString);
      else localStorage.removeItem('legit_selected_active_key');
    } catch (_) {}
  }, []);

  // Storage key helper: strictly bound to authenticated user ID
  const getStorageKey = (uid) => uid ? `legit_purchases_${uid}` : null;

  // Sanitize purchase records against tampering or forged keys
  const sanitizePurchases = useCallback((rawList) => {
    if (!Array.isArray(rawList)) return [];
    return rawList.map(item => {
      if (!item || typeof item !== 'object') return null;
      if (item.status === 'verified') {
        if (!isValidLicenseKey(item.key)) {
          return {
            ...item,
            status: 'pending_verification',
            key: null
          };
        }
      }
      return item;
    }).filter(Boolean);
  }, []);

  // Persist purchases to localStorage
  const savePurchases = useCallback((updatedPurchases) => {
    if (!user?.id) return;
    const sanitized = sanitizePurchases(updatedPurchases);
    setPurchases(sanitized);

    const key = getStorageKey(user.id);
    if (key) {
      try {
        localStorage.setItem(key, JSON.stringify(sanitized));
      } catch (err) {
        console.warn('Failed to save purchases to localStorage:', err);
      }
    }
  }, [user, sanitizePurchases]);

  // Synchronize purchases directly with Supabase server licenses
  const syncWithServer = useCallback(async () => {
    if (!user?.id) return;

    try {
      let token = session?.access_token;
      if (!token) {
        const { data: sessionData } = await supabase.auth.getSession();
        token = sessionData?.session?.access_token;
      }
      if (!token) return;

      const res = await fetch('/api/user-licenses', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) return;

      const result = await res.json();
      if (!result.success || !Array.isArray(result.licenses)) return;

      // Map Supabase licenses to purchases
      const serverPurchases = result.licenses.map(lic => {
        let matchedPlan = PRICING_PLANS.find(p => p.isLifetime === lic.is_lifetime && p.durationDays === lic.duration_days);
        if (!matchedPlan) {
          if (lic.is_lifetime) matchedPlan = PRICING_PLANS[3];
          else if (lic.duration_days === 1) matchedPlan = PRICING_PLANS[0];
          else if (lic.duration_days === 7) matchedPlan = PRICING_PLANS[1];
          else matchedPlan = PRICING_PLANS[2];
        }

        return {
          orderId: 'LIC-' + lic.license_key.replace(/[^A-Z0-9]/gi, '').substring(0, 10),
          planId: matchedPlan.id,
          planName: matchedPlan.name,
          price: matchedPlan.price,
          amount: matchedPlan.amount,
          durationDays: lic.duration_days,
          isLifetime: lic.is_lifetime,
          paymentMethod: 'verified_license',
          transactionRef: lic.license_key,
          status: 'verified',
          createdAt: lic.created_at || new Date().toISOString(),
          userEmail: user.email,
          userId: user.id,
          key: lic.license_key,
          hwid: lic.hwid || null,
          activatedAt: lic.activated_at || null,
          expiresAt: lic.expires_at || null,
          dbStatus: lic.status
        };
      });

      // Merge with local storage
      const userStorageKey = getStorageKey(user.id);
      let localList = [];
      if (userStorageKey) {
        try {
          const stored = localStorage.getItem(userStorageKey);
          if (stored) localList = JSON.parse(stored) || [];
        } catch (_) {}
      }

      const mergedMap = new Map();
      serverPurchases.forEach(sp => {
        if (sp.key) mergedMap.set(sp.key, sp);
      });

      localList.forEach(lp => {
        if (lp.key && mergedMap.has(lp.key)) {
          const srv = mergedMap.get(lp.key);
          mergedMap.set(lp.key, { ...lp, ...srv });
        } else if (lp.orderId && !lp.key) {
          mergedMap.set(lp.orderId, lp);
        } else if (lp.key) {
          mergedMap.set(lp.key, lp);
        }
      });

      const mergedList = Array.from(mergedMap.values()).sort((a, b) => {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });

      setPurchases(mergedList);
      if (userStorageKey) {
        try {
          localStorage.setItem(userStorageKey, JSON.stringify(mergedList));
        } catch (_) {}
      }
    } catch (syncErr) {
      console.warn('License server sync notice:', syncErr);
    }
  }, [user, session]);

  // Load user purchases and synchronize across persistent sessions
  const loadPurchases = useCallback(() => {
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
    // Background sync with Supabase server
    syncWithServer();
  }, [user, sanitizePurchases, syncWithServer]);

  useEffect(() => {
    loadPurchases();
  }, [loadPurchases]);

  // Derive verified purchases
  const verifiedPurchases = useMemo(() => {
    return purchases.filter(p => p.status === 'verified' && isValidLicenseKey(p.key));
  }, [purchases]);

  // Derive active verified license with smart priority selection
  const activeLicense = useMemo(() => {
    if (verifiedPurchases.length === 0) return null;

    // 1. If user explicitly selected an active key and it's valid
    if (activeKeyId) {
      const selected = verifiedPurchases.find(p => p.key === activeKeyId || p.orderId === activeKeyId);
      if (selected) return selected;
    }

    // 2. Prioritize Lifetime keys
    const lifetime = verifiedPurchases.find(p => p.isLifetime);
    if (lifetime) return lifetime;

    // 3. Prioritize non-expired keys (either countdown running with time left or standby not yet bound)
    const validKey = verifiedPurchases.find(p => {
      if (p.isLifetime) return true;
      if (!p.hwid) return true; // Standby
      if (p.expiresAt && new Date(p.expiresAt).getTime() > Date.now()) return true;
      if (p.activatedAt && p.durationDays) {
        const exp = new Date(p.activatedAt).getTime() + Number(p.durationDays) * 24 * 60 * 60 * 1000;
        return exp > Date.now();
      }
      return false;
    });

    if (validKey) return validKey;

    // 4. Default to newest verified purchase
    return verifiedPurchases[0];
  }, [verifiedPurchases, activeKeyId]);

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

  // Remove / Unlink key from user profile (USER FEATURE: remove old key after buying new one)
  const removeKey = async (keyOrOrderId) => {
    if (!user?.id || !keyOrOrderId) return { success: false };

    const target = (typeof keyOrOrderId === 'string' ? keyOrOrderId : '').trim();
    const purchaseToRemove = purchases.find(p => p.key === target || p.orderId === target);
    const keyString = purchaseToRemove?.key || target;

    // Remove from local state immediately
    const updated = purchases.filter(p => p.key !== target && p.orderId !== target);
    setPurchases(updated);

    const userStorageKey = getStorageKey(user.id);
    if (userStorageKey) {
      try {
        localStorage.setItem(userStorageKey, JSON.stringify(updated));
      } catch (_) {}
    }

    // If removed key was selected active key, clear selection
    if (activeKeyId === target || activeKeyId === keyString) {
      setActiveKeyId(null);
    }

    // Call server API to unlink license in Supabase
    try {
      let token = session?.access_token;
      if (!token) {
        const { data: sessionData } = await supabase.auth.getSession();
        token = sessionData?.session?.access_token;
      }

      if (token && isValidLicenseKey(keyString)) {
        await fetch('/api/user-licenses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            action: 'remove',
            license_key: keyString
          })
        });
      }
    } catch (unlinkErr) {
      console.warn('Server unlink notice:', unlinkErr);
    }

    return { success: true };
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
    savePurchases(updated);
    return newOrder;
  };

  /**
   * Verify a purchase:
   * 1. Requires valid user session
   * 2. Calls server-side /api/verify-payment with user's JWT access token
   */
  const verifyPurchase = async (orderIdOrRef, customPlan = null) => {
    if (!user) {
      throw new Error('Authentication Required: Please sign in to verify payments.');
    }

    const isObj = typeof orderIdOrRef === 'object' && orderIdOrRef !== null;
    const paymentId = isObj
      ? (orderIdOrRef.razorpay_payment_id || orderIdOrRef.payment_id || '')
      : (typeof orderIdOrRef === 'string' ? orderIdOrRef.trim() : '');
    const orderId = isObj ? (orderIdOrRef.razorpay_order_id || '') : '';
    const signature = isObj ? (orderIdOrRef.razorpay_signature || '') : '';

    if (!paymentId && !orderId) {
      throw new Error('Please enter a valid Transaction Reference, Razorpay Payment ID, or Order ID.');
    }

    const targetPlan = customPlan || selectedPlan;

    // A. Check if this is a real Razorpay payment ID (e.g. pay_XXXX)
    if (paymentId.startsWith('pay_')) {
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
          razorpay_payment_id: paymentId,
          razorpay_order_id: orderId,
          razorpay_signature: signature,
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
        p => p.transactionRef === paymentId || p.orderId === verifiedOrder.orderId
      );

      let updatedList;
      if (existingIdx >= 0) {
        updatedList = purchases.map((p, idx) => idx === existingIdx ? verifiedOrder : p);
      } else {
        updatedList = [verifiedOrder, ...purchases];
      }

      savePurchases(updatedList);
      setActiveKeyId(verifiedOrder.key);
      return verifiedOrder;
    }

    // B. Check if this is an already verified order in user's state
    const cleanRef = paymentId.toLowerCase();
    const existingOrder = purchases.find(
      p => (p.orderId && p.orderId.toLowerCase() === cleanRef) ||
           (p.transactionRef && p.transactionRef.toLowerCase() === cleanRef)
    );

    if (existingOrder && existingOrder.status === 'verified' && isValidLicenseKey(existingOrder.key)) {
      setActiveKeyId(existingOrder.key);
      return existingOrder;
    }

    // C. Check if this is an external license key to redeem
    if (isValidLicenseKey(paymentId)) {
      return await redeemExternalKey(paymentId);
    }

    throw new Error('Transaction could not be verified automatically. If you paid via UPI manual transfer, please allow admin review or contact support.');
  };

  const redeemExternalKey = async (licenseKey) => {
    if (!user) {
      throw new Error('Authentication Required: Please sign in to redeem a license key.');
    }

    const cleanKey = (licenseKey || '').trim();
    if (!isValidLicenseKey(cleanKey)) {
      throw new Error('Invalid license key format. Expected e.g. LEGIT-XXXX-XXXX-XXXX');
    }

    const existingOrder = purchases.find(p => p.key === cleanKey);
    if (existingOrder && existingOrder.status === 'verified') {
      setActiveKeyId(cleanKey);
      return existingOrder;
    }

    try {
      const headers = {
        'Content-Type': 'application/json'
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/redeem-key', {
        method: 'POST',
        headers,
        body: JSON.stringify({ license_key: cleanKey })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to redeem license key.');
      }

      const dbLicense = result.license;

      // Infer plan from dbLicense
      let matchedPlan = PRICING_PLANS.find(p => p.isLifetime === dbLicense.is_lifetime && p.durationDays === dbLicense.duration_days);
      if (!matchedPlan) {
        if (dbLicense.is_lifetime) matchedPlan = PRICING_PLANS[3];
        else if (dbLicense.duration_days === 1) matchedPlan = PRICING_PLANS[0];
        else if (dbLicense.duration_days === 7) matchedPlan = PRICING_PLANS[1];
        else matchedPlan = PRICING_PLANS[2];
      }

      const verifiedOrder = {
        orderId: 'EXT-' + Math.floor(100000 + Math.random() * 900000),
        planId: matchedPlan.id,
        planName: matchedPlan.name,
        price: matchedPlan.price,
        amount: matchedPlan.amount,
        durationDays: dbLicense.duration_days,
        isLifetime: dbLicense.is_lifetime,
        paymentMethod: 'external_key',
        transactionRef: cleanKey,
        status: 'verified',
        verifiedAt: new Date().toISOString(),
        userEmail: user.email,
        userId: user.id,
        key: dbLicense.license_key,
        hwid: dbLicense.hwid || null,
        activatedAt: dbLicense.activated_at || null,
        expiresAt: dbLicense.expires_at || null
      };

      const updatedList = [verifiedOrder, ...purchases];
      savePurchases(updatedList);
      setActiveKeyId(cleanKey);
      return verifiedOrder;

    } catch (checkErr) {
      throw new Error(checkErr.message || 'Could not verify license key.');
    }
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
        verifiedPurchases,
        activeLicense,
        activeKeyId,
        setActiveKeyId,
        removeKey,
        hasPurchased,
        isCheckoutOpen,
        selectedPlan,
        downloadNotice,
        openCheckout,
        closeCheckout,
        createOrder,
        verifyPurchase,
        redeemExternalKey,
        downloadApp,
        triggerDummyDownload: downloadApp,
        refreshPurchases: loadPurchases,
        syncWithServer,
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
