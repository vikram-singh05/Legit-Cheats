import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  Key, Download, Shield, CheckCircle2, Lock,
  Copy, Check, Sparkles, RefreshCw, ArrowRight,
  Clock, AlertTriangle, AlertCircle, ExternalLink,
  ChevronRight, Terminal, User, FileText, Zap, Laptop
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePurchase } from '../context/PurchaseContext';
import { PRICING_PLANS, DUMMY_DOWNLOAD_URL, APP_FILE_NAME, APP_VERSION } from '../lib/plans';

export default function Profile() {
  const { user, signOut } = useAuth();
  const {
    purchases,
    activeLicense,
    hasPurchased,
    openCheckout,
    verifyPurchase,
    redeemExternalKey,
    downloadApp,
    appDownloadUrl,
    downloadNotice
  } = usePurchase();

  const navigate = useNavigate();

  // Verification tool state
  const [verifyInput, setVerifyInput] = useState('');
  const [selectedPlanForVerify, setSelectedPlanForVerify] = useState(PRICING_PLANS[2]);
  const [verifying, setVerifying] = useState(false);
  const [verifySuccess, setVerifySuccess] = useState('');
  const [verifyError, setVerifyError] = useState('');

  // Key copy state
  const [copiedKey, setCopiedKey] = useState(false);

  // External Key tool state
  const [externalKeyInput, setExternalKeyInput] = useState('');
  const [redeemingKey, setRedeemingKey] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState('');
  const [redeemError, setRedeemError] = useState('');

  const [fileSize, setFileSize] = useState('1.92 MB');

  useEffect(() => {
    if (appDownloadUrl) {
      fetch(appDownloadUrl, { method: 'HEAD' })
        .then(res => {
          const size = res.headers.get('content-length');
          if (size) {
            const mb = (parseInt(size, 10) / (1024 * 1024)).toFixed(2);
            setFileSize(`${mb} MB`);
          }
        })
        .catch(() => {});
    }
  }, [appDownloadUrl]);

  const handleRedeemKey = async (e) => {
    e.preventDefault();
    const cleanInput = externalKeyInput.trim();
    if (!cleanInput) {
      setRedeemError('Please enter a valid license key.');
      return;
    }

    setRedeemingKey(true);
    setRedeemError('');
    setRedeemSuccess('');

    try {
      await new Promise(r => setTimeout(r, 600));
      const res = await redeemExternalKey(cleanInput);
      setRedeemSuccess(`License Key redeemed successfully! Plan: ${res.planName}. You can now download the app.`);
      setExternalKeyInput('');
    } catch (err) {
      setRedeemError(err.message || 'Could not redeem the provided license key.');
    } finally {
      setRedeemingKey(false);
    }
  };

  const handleCopyKey = (keyText) => {
    if (!keyText) return;
    navigator.clipboard.writeText(keyText);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleManualVerify = async (e) => {
    e.preventDefault();
    const cleanInput = verifyInput.trim();
    if (!cleanInput) {
      setVerifyError('Please enter a Transaction Reference or Order ID.');
      return;
    }
    // Strict input sanitization against injection payloads
    if (!/^[a-zA-Z0-9_\-]{4,64}$/.test(cleanInput)) {
      setVerifyError('Invalid reference format. Please enter a valid payment ID or reference code.');
      return;
    }

    setVerifying(true);
    setVerifyError('');
    setVerifySuccess('');

    try {
      await new Promise(r => setTimeout(r, 600));
      const res = await verifyPurchase(cleanInput, selectedPlanForVerify);
      setVerifySuccess(`Verified successfully! License Key ${res.key} has been issued and linked to your profile.`);
      setVerifyInput('');
    } catch (err) {
      setVerifyError(err.message || 'Could not verify purchase with the provided reference.');
    } finally {
      setVerifying(false);
    }
  };

  if (!user) {
    return (
      <div className="profile-page-container" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '100px 1.5rem 4rem' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card text-center"
          style={{
            maxWidth: '460px',
            padding: '2.5rem 2rem',
            background: 'linear-gradient(135deg, rgba(14, 18, 28, 0.92) 0%, rgba(8, 10, 16, 0.96) 100%)',
            border: '1px solid rgba(0, 136, 255, 0.35)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 30px rgba(0, 136, 255, 0.2)'
          }}
        >
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(0, 136, 255, 0.12)', border: '1px solid rgba(0, 240, 255, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
            <Lock size={30} color="#00f0ff" />
          </div>
          <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#00f0ff', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
            AUTHENTICATION REQUIRED
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', marginBottom: '0.6rem' }}>
            Sign In to Access Profile
          </h2>
          <p className="text-muted" style={{ fontSize: '0.88rem', marginBottom: '1.75rem', lineHeight: '1.6' }}>
            You must be logged in with a registered account to view your active license keys, HWID hardware bindings, and client downloads.
          </p>
          <div className="flex flex-col gap-3">
            <Link to="/login?redirect=/profile" className="btn btn-primary" style={{ width: '100%', padding: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <Lock size={16} /> Sign In to Your Account
            </Link>
            <Link to="/" className="btn btn-outline" style={{ width: '100%', padding: '0.8rem' }}>
              Return to Public Portal
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="profile-page-container" style={{ minHeight: '100vh', padding: '100px 1.5rem 4rem', position: 'relative' }}>
      {/* Background ambient glow */}
      <div className="bg-glow" />

      {/* Floating Download Toast */}
      <AnimatePresence>
        {downloadNotice && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            style={{
              position: 'fixed',
              top: '24px',
              right: '24px',
              zIndex: 9999,
              background: 'rgba(10, 14, 22, 0.95)',
              border: '1px solid rgba(0, 240, 255, 0.4)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.8), 0 0 20px rgba(0, 136, 255, 0.3)',
              borderRadius: '14px',
              padding: '0.9rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              color: '#ffffff',
              backdropFilter: 'blur(20px)'
            }}
          >
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(0, 136, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Download size={16} color="#00f0ff" />
            </div>
            <div>
              <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#00f0ff' }}>
                Client Download Triggered
              </div>
              <div style={{ fontSize: '0.78rem', color: '#a1a1aa' }}>
                {downloadNotice.fileName} ({downloadNotice.version})
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
        {/* =========================================================================
            PROFILE USER HEADER
           ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="card"
          style={{
            padding: '2rem',
            marginBottom: '1.75rem',
            background: 'linear-gradient(135deg, rgba(14, 18, 28, 0.85) 0%, rgba(8, 10, 16, 0.92) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1.5rem'
          }}
        >
          {/* Avatar & User Details */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '18px',
                background: hasPurchased
                  ? 'linear-gradient(135deg, #0088ff 0%, #00f0ff 100%)'
                  : 'rgba(255, 255, 255, 0.08)',
                border: hasPurchased
                  ? '1px solid rgba(0, 240, 255, 0.5)'
                  : '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: hasPurchased
                  ? '0 0 25px rgba(0, 136, 255, 0.4)'
                  : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                fontWeight: 800,
                color: '#ffffff'
              }}
            >
              {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
                <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                  {user?.email ? user.email.split('@')[0] : 'Guest Customer'}
                </h1>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: hasPurchased ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: hasPurchased ? '#10b981' : '#f59e0b',
                    border: hasPurchased ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)'
                  }}
                >
                  {hasPurchased ? 'VIP ACTIVE LICENSE' : 'UNLICENSED ACCOUNT'}
                </span>
              </div>
              <p className="text-muted" style={{ fontSize: '0.84rem' }}>
                {user?.email || 'Not logged in (Purchases cached in browser session)'}
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
            <div style={{ background: 'rgba(0,0,0,0.4)', padding: '0.75rem 1.15rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '0.74rem', color: '#8e92a4', marginBottom: '0.2rem' }}>License Status</div>
              <div style={{ fontSize: '0.94rem', fontWeight: 700, color: hasPurchased ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                {hasPurchased ? <CheckCircle2 size={15} /> : <Lock size={14} />}
                <span>{hasPurchased ? 'Active & Valid' : 'Not Purchased'}</span>
              </div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.4)', padding: '0.75rem 1.15rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '0.74rem', color: '#8e92a4', marginBottom: '0.2rem' }}>App Download</div>
              <div style={{ fontSize: '0.94rem', fontWeight: 700, color: hasPurchased ? '#00f0ff' : '#71717a', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Laptop size={15} />
                <span>{hasPurchased ? 'Unlocked (v3.4.2)' : 'Locked'}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* =========================================================================
            SECTION 1: LICENSE KEY DISPLAY (PURCHASED VS NOT PURCHASED)
           ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="card"
          style={{
            padding: '2rem',
            marginBottom: '1.75rem',
            background: 'rgba(12, 15, 24, 0.75)',
            border: hasPurchased ? '1px solid rgba(0, 136, 255, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: hasPurchased ? '0 15px 40px -10px rgba(0, 136, 255, 0.15)' : 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(0, 136, 255, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Key size={18} color="#00f0ff" />
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                  Active License Key
                </h2>
                <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                  Your cryptographic token for hypervisor client authorization.
                </span>
              </div>
            </div>

            {hasPurchased && (
              <span
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  color: '#10b981',
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  padding: '4px 10px',
                  borderRadius: '6px'
                }}
              >
                PLAN: {activeLicense.planName.toUpperCase()}
              </span>
            )}
          </div>

          {/* KEY BOX ROW: Handles both Purchased and Not Purchased states */}
          <div
            style={{
              background: 'rgba(6, 8, 12, 0.85)',
              border: hasPurchased ? '1px solid rgba(0, 240, 255, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '1.25rem 1.5rem',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem'
            }}
          >
            {/* Left: Key string representation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: hasPurchased ? 'rgba(0, 240, 255, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  border: hasPurchased ? '1px solid rgba(0, 240, 255, 0.3)' : '1px solid rgba(239, 68, 68, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                {hasPurchased ? <Shield size={20} color="#00f0ff" /> : <Lock size={20} color="#f87171" />}
              </div>

              <div>
                <div style={{ fontSize: '0.74rem', color: '#8e92a4', marginBottom: '0.2rem' }}>
                  {hasPurchased ? 'LICENSED TO THIS ACCOUNT' : 'LICENSE KEY STATUS'}
                </div>

                {hasPurchased ? (
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '1.3rem',
                      fontWeight: 800,
                      color: '#ffffff',
                      letterSpacing: '1px'
                    }}
                  >
                    {activeLicense.key}
                  </div>
                ) : (
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '1.2rem',
                      fontWeight: 700,
                      color: '#71717a',
                      letterSpacing: '2px'
                    }}
                  >
                    ••••-••••-••••-••••
                  </div>
                )}
              </div>
            </div>

            {/* Right Action: BUY NOW button if NOT purchased, or COPY KEY button if purchased */}
            <div>
              {hasPurchased ? (
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleCopyKey(activeLicense.key)}
                    className="btn btn-outline"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '8px 16px',
                      borderRadius: '10px',
                      fontSize: '0.86rem',
                      borderColor: copiedKey ? '#10b981' : 'rgba(0, 136, 255, 0.4)',
                      color: copiedKey ? '#10b981' : '#00f0ff'
                    }}
                  >
                    {copiedKey ? <Check size={16} /> : <Copy size={16} />}
                    <span>{copiedKey ? 'Key Copied!' : 'Copy Key'}</span>
                  </motion.button>

                  <button
                    onClick={() => openCheckout(PRICING_PLANS[2])}
                    className="btn btn-outline"
                    style={{ padding: '8px 14px', borderRadius: '10px', fontSize: '0.82rem', color: '#a1a1aa' }}
                    title="Renew or Upgrade plan"
                  >
                    Renew / Upgrade
                  </button>
                </div>
              ) : (
                /* USER REQUIREMENT: "And if the user dont have purchased then there shows buy now button in front of key." */
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => openCheckout(PRICING_PLANS[2])}
                  className="btn btn-primary"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '10px 22px',
                    borderRadius: '12px',
                    fontSize: '0.94rem',
                    fontWeight: 700,
                    boxShadow: '0 4px 20px rgba(0, 136, 255, 0.5)'
                  }}
                >
                  <Sparkles size={16} />
                  <span>Buy Now</span>
                  <ArrowRight size={16} />
                </motion.button>
              )}
            </div>
          </div>

          {/* Helper notice below key box */}
          {!hasPurchased && (
            <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: '0.85rem' }}>
              No active subscription found. Click <strong>"Buy Now"</strong> above to purchase 1-Day, 7-Day, 30-Day, or Lifetime access and obtain your key immediately.
            </p>
          )}

          {hasPurchased && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '0.8rem', color: '#a1a1aa' }}>
              <div>Hardware Binding: <strong style={{ color: '#10b981' }}>Unbound (Auto-binds on 1st Launch)</strong></div>
              <div>Duration: <strong style={{ color: '#fff' }}>{activeLicense.durationDays ? `${activeLicense.durationDays} Days` : 'Permanent Lifetime'}</strong></div>
              <div>Verification: <strong style={{ color: '#00f0ff' }}>Cryptographic Hash Verified</strong></div>
            </div>
          )}
        </motion.div>

        {/* =========================================================================
            SECTION 2: APPLICATION DOWNLOAD OPTION (UNLOCKED VS LOCKED)
           ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="card"
          style={{
            padding: '2rem',
            marginBottom: '1.75rem',
            background: hasPurchased
              ? 'linear-gradient(135deg, rgba(10, 24, 45, 0.8) 0%, rgba(6, 12, 22, 0.9) 100%)'
              : 'rgba(12, 15, 24, 0.65)',
            border: hasPurchased ? '1.5px solid rgba(0, 136, 255, 0.45)' : '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(0, 240, 255, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Download size={18} color="#00f0ff" />
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                  Client Application Download
                </h2>
                <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                  {hasPurchased
                    ? 'Ring-0 hypervisor launcher unlocked. Ready for installation.'
                    : 'Download is locked. A valid license purchase is required to download.'}
                </span>
              </div>
            </div>

            <span
              style={{
                fontSize: '0.74rem',
                fontWeight: 700,
                color: hasPurchased ? '#00f0ff' : '#71717a',
                background: hasPurchased ? 'rgba(0, 136, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                padding: '4px 10px',
                borderRadius: '6px'
              }}
            >
              VERSION {APP_VERSION}
            </span>
          </div>

          {/* USER REQUIREMENT: "If the user havee purchased, then he will get the download option for the app. Keep that button link to dummy for now we ill update later." */}
          {hasPurchased ? (
            <div>
              <div
                style={{
                  background: 'rgba(4, 8, 16, 0.65)',
                  borderRadius: '14px',
                  padding: '1.25rem',
                  border: '1px solid rgba(0, 136, 255, 0.2)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1.25rem',
                  marginBottom: '1.25rem'
                }}
              >
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '0.25rem' }}>
                    {APP_FILE_NAME}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#8e92a4', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span>Size: <strong>{fileSize}</strong></span>
                    <span>OS: <strong>Windows 10 / 11 (64-bit)</strong></span>
                    <span>Host: <strong style={{ color: '#00f0ff' }}>Supabase Cloud Storage</strong></span>
                    <span>Status: <strong style={{ color: '#10b981' }}>Undetected & Active</strong></span>
                  </div>
                </div>

                {/* Real App Download Button */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <motion.a
                    href={appDownloadUrl}
                    download={APP_FILE_NAME}
                    onClick={(e) => {
                      // Trigger download handler
                      downloadApp();
                    }}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    className="btn btn-primary"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      padding: '11px 24px',
                      borderRadius: '12px',
                      fontSize: '0.94rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 4px 22px rgba(0, 136, 255, 0.45)'
                    }}
                  >
                    <Download size={18} />
                    <span>Download App</span>
                  </motion.a>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(appDownloadUrl);
                      alert('Direct Supabase Storage download link copied to clipboard!');
                    }}
                    className="btn btn-outline"
                    style={{ padding: '11px 13px', borderRadius: '12px' }}
                    title="Copy direct Supabase Storage download link"
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </div>

              {/* Instructions */}
              <div style={{ background: 'rgba(0, 0, 0, 0.35)', borderRadius: '12px', padding: '1rem', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#00f0ff', marginBottom: '0.5rem' }}>
                  // Quick Launch Instructions
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.78rem', color: '#a1a1aa' }}>
                  <div>1. Run <code>{APP_FILE_NAME}</code> as Administrator.</div>
                  <div>2. Paste your active license key: <code>{activeLicense.key}</code>.</div>
                  <div>3. Launch your game. Overlay activates automatically via F2.</div>
                </div>
              </div>
            </div>
          ) : (
            /* Locked State for unpurchased users */
            <div
              style={{
                background: 'rgba(6, 8, 12, 0.6)',
                borderRadius: '14px',
                padding: '1.5rem',
                border: '1px dashed rgba(255, 255, 255, 0.1)',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Lock size={18} color="#f87171" />
                </div>
                <div>
                  <div style={{ fontSize: '0.96rem', fontWeight: 600, color: '#e4e4e7' }}>
                    Software Download Restricted
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#71717a' }}>
                    Purchase a license key above to unlock client binaries and hypervisor drivers.
                  </div>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => openCheckout(PRICING_PLANS[2])}
                className="btn btn-outline"
                style={{ padding: '8px 18px', borderRadius: '10px', fontSize: '0.86rem', color: '#0088ff', borderColor: 'rgba(0, 136, 255, 0.3)' }}
              >
                <span>Unlock with License</span>
                <ChevronRight size={15} />
              </motion.button>
            </div>
          )}
        </motion.div>

        {/* =========================================================================
            SECTION 2.5: REDEEM EXTERNAL LICENSE KEY
           ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="card"
          style={{
            padding: '2rem',
            marginBottom: '1.75rem',
            background: 'rgba(12, 15, 24, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(0, 136, 255, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={18} color="#00f0ff" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                Redeem External Key
              </h2>
              <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                Bought a key from a reseller? Enter it here to activate and download.
              </span>
            </div>
          </div>

          <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
            If you purchased a license key from an external marketplace or reseller, paste your 
            <code style={{ color: '#00f0ff', marginLeft: '4px', marginRight: '4px' }}>LEGIT-XXXX-XXXX-XXXX</code> 
            key below to instantly claim your access and unlock the application download.
          </p>

          <form onSubmit={handleRedeemKey}>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <input
                  type="text"
                  placeholder="LEGIT-XXXX-XXXX-XXXX"
                  value={externalKeyInput}
                  onChange={(e) => setExternalKeyInput(e.target.value)}
                  className="form-input"
                  style={{ fontFamily: 'var(--font-mono)', width: '100%' }}
                />
              </div>
              <button
                type="submit"
                disabled={redeemingKey}
                className="btn btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '9px 24px',
                  borderRadius: '10px',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  cursor: redeemingKey ? 'wait' : 'pointer'
                }}
              >
                {redeemingKey ? (
                  <>
                    <RefreshCw size={15} className="spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <Zap size={16} />
                    <span>Redeem Key</span>
                  </>
                )}
              </button>
            </div>

            {redeemSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  borderRadius: '10px',
                  padding: '0.8rem 1rem',
                  fontSize: '0.84rem',
                  color: '#34d399',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <CheckCircle2 size={16} />
                <span>{redeemSuccess}</span>
              </motion.div>
            )}

            {redeemError && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: '10px',
                  padding: '0.8rem 1rem',
                  fontSize: '0.84rem',
                  color: '#f87171',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <AlertCircle size={16} />
                <span>{redeemError}</span>
              </motion.div>
            )}
          </form>
        </motion.div>

        {/* =========================================================================
            SECTION 3: PURCHASE VERIFICATION MECHANISM
           ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="card"
          style={{
            padding: '2rem',
            marginBottom: '1.75rem',
            background: 'rgba(12, 15, 24, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={18} color="#10b981" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                Verify Existing Purchase
              </h2>
              <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                Validate a transaction reference, UTR number, or Order ID to claim your license.
              </span>
            </div>
          </div>

          <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
            If you paid via Razorpay, enter your Payment ID (starting with <code style={{ color: '#00f0ff' }}>pay_...</code>) below for instant cryptographic key minting.
            If you paid via direct transfer or have an existing order, enter your Order ID or reference to verify.
          </p>

          <form onSubmit={handleManualVerify}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginBottom: '1rem' }}>
              <div>
                <label className="form-label">Razorpay Payment ID (pay_...) or Order ID</label>
                <input
                  type="text"
                  placeholder="e.g. pay_Q8k2LmN789412 or ORD-829142"
                  value={verifyInput}
                  onChange={(e) => setVerifyInput(e.target.value)}
                  className="form-input"
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <div>
                <label className="form-label">Plan to Verify</label>
                <select
                  value={selectedPlanForVerify.id}
                  onChange={(e) => {
                    const found = PRICING_PLANS.find(p => p.id === e.target.value);
                    if (found) setSelectedPlanForVerify(found);
                  }}
                  className="form-input"
                  style={{ background: 'rgba(6, 8, 12, 0.9)', color: '#fff' }}
                >
                  {PRICING_PLANS.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.price})</option>
                  ))}
                </select>
              </div>
            </div>

            {verifySuccess && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  borderRadius: '10px',
                  padding: '0.8rem 1rem',
                  fontSize: '0.84rem',
                  color: '#34d399',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <CheckCircle2 size={16} />
                <span>{verifySuccess}</span>
              </motion.div>
            )}

            {verifyError && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: '10px',
                  padding: '0.8rem 1rem',
                  fontSize: '0.84rem',
                  color: '#f87171',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <AlertCircle size={16} />
                <span>{verifyError}</span>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={verifying}
              className="btn btn-outline"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '9px 20px',
                borderRadius: '10px',
                fontSize: '0.88rem',
                color: '#10b981',
                borderColor: 'rgba(16, 185, 129, 0.35)',
                cursor: verifying ? 'wait' : 'pointer'
              }}
            >
              {verifying ? (
                <>
                  <RefreshCw size={15} className="spin" />
                  <span>Scanning & Verifying Telemetry...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Verify & Claim License</span>
                </>
              )}
            </button>
          </form>
        </motion.div>

        {/* =========================================================================
            SECTION 4: ORDER & TRANSACTION HISTORY
           ========================================================================= */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="card"
          style={{
            padding: '2rem',
            background: 'rgba(12, 15, 24, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={18} color="#e4e4e7" />
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                Order & License History
              </h2>
            </div>
            <span style={{ fontSize: '0.8rem', color: '#8e92a4' }}>
              {purchases.length} Recorded Transactions
            </span>
          </div>

          {purchases.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#71717a' }}>
              <p style={{ fontSize: '0.88rem', marginBottom: '0.75rem' }}>No purchases recorded on this account yet.</p>
              <button
                onClick={() => openCheckout(PRICING_PLANS[2])}
                className="btn btn-primary"
                style={{ padding: '8px 18px', borderRadius: '10px', fontSize: '0.84rem' }}
              >
                Browse Plans & Buy
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#8e92a4' }}>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Order ID</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Plan Tier</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Amount</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Reference</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Key</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((ord) => (
                    <tr
                      key={ord.orderId}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        color: '#d4d4d8'
                      }}
                    >
                      <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'var(--font-mono)', color: '#00f0ff' }}>
                        {ord.orderId}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>
                        {ord.planName}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'Space Grotesk', fontWeight: 700 }}>
                        {ord.price}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.76rem', color: '#a1a1aa' }}>
                        {ord.transactionRef || 'N/A'}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: 700,
                            background: ord.status === 'verified' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: ord.status === 'verified' ? '#10b981' : '#f59e0b'
                          }}
                        >
                          {ord.status === 'verified' ? 'VERIFIED' : 'PENDING'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'var(--font-mono)' }}>
                        {ord.key ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{ fontSize: '0.8rem', color: '#fff' }}>{ord.key}</span>
                            <button
                              onClick={() => handleCopyKey(ord.key)}
                              style={{ background: 'none', border: 'none', color: '#0088ff', cursor: 'pointer', padding: '2px' }}
                              title="Copy"
                            >
                              <Copy size={13} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setVerifyInput(ord.orderId);
                              window.scrollTo({ top: 400, behavior: 'smooth' });
                            }}
                            style={{ background: 'none', border: 'none', color: '#0088ff', fontSize: '0.76rem', cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            Verify Now
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
