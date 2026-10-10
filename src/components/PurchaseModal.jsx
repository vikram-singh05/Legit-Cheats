import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Check, Copy, Shield, QrCode, CreditCard,
  Lock, ArrowRight, ExternalLink, RefreshCw,
  Sparkles, CheckCircle2, ChevronRight, Download, Key,
  Smartphone, CheckCheck, AlertCircle, Clock
} from 'lucide-react';
import { usePurchase } from '../context/PurchaseContext';
import { useAuth } from '../context/AuthContext';
import { PRICING_PLANS, DEFAULT_UPI_ID, generateUpiDeepLink } from '../lib/plans';
import { launchRazorpayPayment } from '../lib/razorpay';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';

export default function PurchaseModal() {
  const {
    isCheckoutOpen,
    closeCheckout,
    selectedPlan,
    createOrder,
    verifyPurchase,
    downloadApp,
    APP_VERSION,
    APP_FILE_NAME
  } = usePurchase();

  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('upi'); // 'upi' | 'razorpay'
  const [currentPlan, setCurrentPlan] = useState(selectedPlan || PRICING_PLANS[2]);
  const [currentStep, setCurrentStep] = useState('payment'); // 'payment' | 'verifying' | 'success' | 'pending_review'

  // Payment form states
  const [razorpayLoading, setRazorpayLoading] = useState(false);
  const [utrNumber, setUtrNumber] = useState('');
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Verification states
  const [verificationProgress, setVerificationProgress] = useState(0);
  const [verificationStage, setVerificationStage] = useState(0);
  const [verifiedKey, setVerifiedKey] = useState(null);
  const [verifiedPaymentRef, setVerifiedPaymentRef] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submittedOrderId, setSubmittedOrderId] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

  // Sync currentPlan when selectedPlan changes
  useEffect(() => {
    if (selectedPlan) {
      setCurrentPlan(selectedPlan);
    }
  }, [selectedPlan]);

  // Reset modal state when opening
  useEffect(() => {
    if (isCheckoutOpen) {
      setCurrentStep('payment');
      setUtrNumber('');
      setErrorMsg('');
      setVerificationProgress(0);
      setVerificationStage(0);
      setVerifiedKey(null);
      setVerifiedPaymentRef(null);
      setRazorpayLoading(false);
    }
  }, [isCheckoutOpen]);

  // Memoized UPI deep link (Stable reference prevents infinite re-render freeze)
  const upiDeepLink = useMemo(() => {
    return generateUpiDeepLink({
      upiId: DEFAULT_UPI_ID,
      name: 'LEGIT Cheats',
      amount: currentPlan?.amount || 99,
      orderId: 'ORD'
    });
  }, [currentPlan?.amount]);

  // Generate real, high-resolution scannable QR Code
  useEffect(() => {
    let active = true;
    if (!isCheckoutOpen) return;

    QRCode.toDataURL(upiDeepLink, {
      width: 240,
      margin: 1,
      color: {
        dark: '#050609',
        light: '#ffffff'
      }
    }).then(url => {
      if (active) setQrCodeDataUrl(url);
    }).catch(err => {
      console.error('QR code generation failed:', err);
    });

    return () => { active = false; };
  }, [upiDeepLink, isCheckoutOpen]);

  if (!isCheckoutOpen) return null;

  // Real Razorpay Payment Handler (Verified via Server Backend)
  const handleRazorpayCheckout = async () => {
    if (!user) {
      setErrorMsg('Authentication Required: Please sign in before launching checkout.');
      return;
    }
    setRazorpayLoading(true);
    setErrorMsg('');

    await launchRazorpayPayment({
      plan: currentPlan,
      user,
      onSuccess: async (response) => {
        setRazorpayLoading(false);
        const paymentRef = response.razorpay_payment_id;
        if (!paymentRef) {
          setErrorMsg('Did not receive a valid payment ID from gateway.');
          return;
        }
        setVerifiedPaymentRef(paymentRef);
        await startVerificationPipeline(paymentRef, 'razorpay');
      },
      onDismiss: () => {
        setRazorpayLoading(false);
      },
      onError: (errMsg) => {
        setRazorpayLoading(false);
        setErrorMsg(errMsg || 'Payment was cancelled or rejected by Razorpay.');
      }
    });
  };

  // Start verification process
  const startVerificationPipeline = async (reference, method) => {
    setErrorMsg('');
    setCurrentStep('verifying');
    setVerificationProgress(20);
    setVerificationStage(1);
    setVerifiedPaymentRef(reference);

    try {
      // 1. Record pending order locally
      await createOrder({
        plan: currentPlan,
        paymentMethod: method,
        transactionRef: reference
      });

      // Stage 1: Contacting Razorpay Server
      setVerificationProgress(45);
      setVerificationStage(2);

      // Stage 2 & 3: Server-side API verification with Razorpay Basic Auth secret
      const verifiedResult = await verifyPurchase(reference, currentPlan);
      
      setVerificationProgress(85);
      setVerificationStage(3);

      await new Promise(r => setTimeout(r, 400));
      setVerificationProgress(100);
      setVerificationStage(4);

      setVerifiedKey(verifiedResult.key);
      await new Promise(r => setTimeout(r, 350));
      setCurrentStep('success');
    } catch (err) {
      console.error('Payment verification error:', err);
      setErrorMsg(err.message || 'Payment verification could not be validated by the gateway.');
      setCurrentStep('payment');
    }
  };

  // Manual UPI form submit: queues order for review (Zero backdoor instant key)
  const handleUpiSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      setErrorMsg('Authentication Required: Please sign in before submitting payment reference.');
      return;
    }
    const cleanUtr = utrNumber.trim();
    if (!/^[a-zA-Z0-9]{6,24}$/.test(cleanUtr)) {
      setErrorMsg('Please enter a valid 12-digit numeric UPI Reference / UTR Number.');
      return;
    }

    try {
      const order = await createOrder({
        plan: currentPlan,
        paymentMethod: 'upi_manual',
        transactionRef: cleanUtr
      });
      setSubmittedOrderId(order.orderId);
      setVerifiedPaymentRef(cleanUtr);
      setCurrentStep('pending_review');
    } catch (err) {
      setErrorMsg(err.message || 'Error recording transaction.');
    }
  };



  const handleCopyKey = () => {
    if (verifiedKey) {
      navigator.clipboard.writeText(verifiedKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };



  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        overflowY: 'auto'
      }}
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={closeCheckout}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(3, 4, 8, 0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)'
        }}
      />

      {/* Modal Dialog Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 20 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="card"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '92vh',
          overflowY: 'auto',
          background: 'linear-gradient(180deg, rgba(14, 18, 28, 0.98) 0%, rgba(8, 10, 16, 0.99) 100%)',
          border: '1px solid rgba(0, 136, 255, 0.3)',
          boxShadow: '0 25px 70px -10px rgba(0, 0, 0, 0.85), 0 0 35px rgba(0, 136, 255, 0.25)',
          borderRadius: '24px',
          padding: '2rem 1.8rem',
          zIndex: 10
        }}
      >
        {/* Close Button */}
        <button
          onClick={closeCheckout}
          style={{
            position: 'absolute',
            top: '18px',
            right: '18px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: '#a1a1aa',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#a1a1aa'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
          aria-label="Close checkout modal"
        >
          <X size={18} />
        </button>

        {/* =========================================================================
            STEP 1: PAYMENT & METHOD SELECTION
           ========================================================================= */}
        {currentStep === 'payment' && (
          <div>
            {/* Header: Plan Summary */}
            <div style={{ marginBottom: '1.5rem', paddingRight: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(0, 136, 255, 0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Shield size={16} color="#00f0ff" />
                </div>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.5px', color: '#00f0ff', textTransform: 'uppercase' }}>
                  Live License Payment & Automated Delivery
                </span>
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', marginBottom: '0.4rem' }}>
                Secure Checkout: {currentPlan.name}
              </h2>
              <p className="text-muted" style={{ fontSize: '0.86rem' }}>
                Complete payment to instantly generate your verified key and unlock the Ring-0 client download.
              </p>
            </div>

            {/* Plan Selector Pills */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '8px',
                marginBottom: '1.5rem',
                background: 'rgba(6, 8, 12, 0.65)',
                padding: '6px',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.06)'
              }}
            >
              {PRICING_PLANS.map((plan) => {
                const isSelected = currentPlan.id === plan.id;
                return (
                  <button
                    key={plan.id}
                    onClick={() => setCurrentPlan(plan)}
                    style={{
                      background: isSelected
                        ? 'linear-gradient(135deg, rgba(0, 136, 255, 0.3) 0%, rgba(0, 85, 255, 0.35) 100%)'
                        : 'transparent',
                      border: isSelected
                        ? '1px solid rgba(0, 240, 255, 0.5)'
                        : '1px solid transparent',
                      borderRadius: '10px',
                      padding: '8px 10px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ fontSize: '0.74rem', color: isSelected ? '#00f0ff' : '#8e92a4', fontWeight: 600 }}>
                      {plan.name}
                    </div>
                    <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#ffffff', fontFamily: 'Space Grotesk' }}>
                      {plan.price}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Plan Summary Bar */}
            <div
              style={{
                background: 'rgba(0, 136, 255, 0.08)',
                border: '1px solid rgba(0, 136, 255, 0.2)',
                borderRadius: '12px',
                padding: '0.85rem 1.15rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1.5rem'
              }}
            >
              <div>
                <span style={{ fontSize: '0.78rem', color: '#a1a1aa' }}>Total Payable Amount:</span>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', fontFamily: 'Space Grotesk' }}>
                  {currentPlan.price} <span style={{ fontSize: '0.82rem', fontWeight: 500, color: '#8e92a4' }}>/ {currentPlan.period}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.74rem', color: '#10b981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Check size={12} /> Instant 5-Sec Key Delivery
                </span>
                <div style={{ fontSize: '0.78rem', color: user ? '#38bdf8' : '#f87171', fontWeight: 600 }}>
                  {user ? `Account: ${user.email}` : '🔒 Authentication Required to Pay'}
                </div>
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '10px',
                  padding: '0.7rem 1rem',
                  fontSize: '0.82rem',
                  color: '#f87171',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <AlertCircle size={15} />
                <span>{errorMsg}</span>
              </motion.div>
            )}

            {/* SECURITY GATE: REQUIRE USER LOGIN BEFORE DISPLAYING PAYMENT */}
            {!user ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  background: 'linear-gradient(180deg, rgba(14, 18, 28, 0.8) 0%, rgba(6, 8, 14, 0.9) 100%)',
                  borderRadius: '16px',
                  border: '1px solid rgba(0, 136, 255, 0.35)',
                  boxShadow: '0 0 35px rgba(0, 136, 255, 0.15)',
                  padding: '2.2rem 1.6rem',
                  textAlign: 'center',
                  marginBottom: '1rem'
                }}
              >
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'rgba(0, 136, 255, 0.12)',
                    border: '1px solid rgba(0, 240, 255, 0.4)',
                    boxShadow: '0 0 25px rgba(0, 136, 255, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.25rem'
                  }}
                >
                  <Lock size={30} color="#00f0ff" />
                </div>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(0, 240, 255, 0.1)', border: '1px solid rgba(0, 240, 255, 0.3)', padding: '4px 12px', borderRadius: '20px', marginBottom: '0.75rem', color: '#00f0ff', fontSize: '0.74rem', fontWeight: 700, letterSpacing: '0.5px' }}>
                  <Shield size={13} /> AUTHENTICATION REQUIRED TO PURCHASE
                </div>

                <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem' }}>
                  Sign In to Purchase {currentPlan.name}
                </h3>
                <p className="text-muted" style={{ fontSize: '0.86rem', maxWidth: '440px', margin: '0 auto 1.5rem', lineHeight: 1.6 }}>
                  To cryptographically bind your HWID hardware signature, enable automatic key delivery, and unlock your Ring-0 client download, you must be signed in to your account.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '420px', margin: '0 auto 1.5rem' }}>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      sessionStorage.setItem('legit_pending_plan', currentPlan.id);
                      closeCheckout();
                      navigate(`/login?redirect=checkout&plan=${currentPlan.id}`);
                    }}
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      padding: '0.9rem',
                      borderRadius: '12px',
                      fontSize: '0.92rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.55rem',
                      boxShadow: '0 4px 22px rgba(0, 136, 255, 0.45)',
                      cursor: 'pointer'
                    }}
                  >
                    <Lock size={16} />
                    <span>Sign In to Continue Checkout</span>
                    <ArrowRight size={16} />
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      sessionStorage.setItem('legit_pending_plan', currentPlan.id);
                      closeCheckout();
                      navigate(`/login?mode=signup&redirect=checkout&plan=${currentPlan.id}`);
                    }}
                    className="btn btn-outline"
                    style={{
                      width: '100%',
                      padding: '0.85rem',
                      borderRadius: '12px',
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer'
                    }}
                  >
                    <span>Create New Account</span>
                    <ChevronRight size={16} />
                  </motion.button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '1.25rem', fontSize: '0.74rem', color: '#71717a', flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><CheckCheck size={13} color="#10b981" /> 256-Bit SSL Encrypted</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><CheckCheck size={13} color="#10b981" /> Instant License Binding</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><CheckCheck size={13} color="#10b981" /> Zero Data Leaks</span>
                </div>
              </motion.div>
            ) : (
              <>
                {/* Payment Method Tabs */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '0.75rem', overflowX: 'auto' }}>
                  {[
                    { id: 'upi', label: 'Direct UPI & QR (PhonePe / GPay)', icon: <QrCode size={15} /> },
                    { id: 'razorpay', label: 'Razorpay Gateway', icon: <CreditCard size={15} /> }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => { setActiveTab(tab.id); setErrorMsg(''); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        padding: '8px 14px',
                        borderRadius: '9999px',
                        border: activeTab === tab.id ? '1px solid rgba(0, 136, 255, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
                        background: activeTab === tab.id ? 'rgba(0, 136, 255, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                        color: activeTab === tab.id ? '#00f0ff' : '#a1a1aa',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {tab.icon}
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>

            {/* TAB CONTENT: RAZORPAY GATEWAY (LIVE PAYMENT) */}
            {activeTab === 'razorpay' && (
              <div style={{ background: 'rgba(6, 8, 14, 0.6)', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.06)', padding: '1.75rem 1.25rem', textAlign: 'center', marginBottom: '1.25rem' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0, 136, 255, 0.12)', border: '1px solid rgba(0, 136, 255, 0.3)', padding: '5px 14px', borderRadius: '20px', marginBottom: '1.1rem', color: '#00f0ff', fontSize: '0.78rem', fontWeight: 600 }}>
                  <Shield size={14} /> Official Razorpay 256-Bit Encrypted Gateway
                </div>

                <h3 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '0.5rem' }}>
                  Pay via UPI, Cards, Net Banking & Wallets
                </h3>
                <p className="text-muted" style={{ fontSize: '0.84rem', maxWidth: '440px', margin: '0 auto 1.5rem', lineHeight: 1.5 }}>
                  Supports <strong>Google Pay, PhonePe, Paytm, BHIM, Cards & All Indian Banks</strong>. Your key is verified and generated immediately upon successful transaction.
                </p>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', fontSize: '0.78rem', color: '#8e92a4' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><CheckCheck size={14} color="#10b981" /> Google Pay / PhonePe UPI</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><CheckCheck size={14} color="#10b981" /> Visa / MasterCard / RuPay</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><CheckCheck size={14} color="#10b981" /> 50+ Net Banking Banks</span>
                </div>

                <div style={{ background: 'rgba(0, 136, 255, 0.08)', border: '1px solid rgba(0, 136, 255, 0.25)', borderRadius: '12px', padding: '0.85rem 1rem', marginBottom: '1.25rem', textAlign: 'left', fontSize: '0.8rem', color: '#93c5fd', lineHeight: 1.55 }}>
                  <div style={{ fontWeight: 700, color: '#67e8f9', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Shield size={14} /> Razorpay Test Sandbox Active
                  </div>
                  <div>
                    <strong>Why real bank apps fail here:</strong> Test mode generates sandbox virtual VPAs (<code>random@razorpay</code>) which live banking apps (GPay / PhonePe / Cred) cannot resolve on the live NPCI switch (resulting in <em>"Taking a bit longer"</em> error).
                  </div>
                  <div style={{ marginTop: '0.4rem' }}>
                    • <strong>To make a real payment from your phone:</strong> Switch to the <strong>Direct UPI &amp; QR</strong> tab above to pay directly to <code>legitcheats@axl</code>.
                    <br />
                    • <strong>To simulate a successful test:</strong> Click <em>Pay with Razorpay</em> below, choose <strong>UPI</strong>, and enter <code style={{ color: '#fff', background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: '4px' }}>success@razorpay</code>.
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  disabled={razorpayLoading}
                  onClick={handleRazorpayCheckout}
                  className="btn btn-primary"
                  style={{
                    padding: '0.9rem 2.4rem',
                    borderRadius: '12px',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    boxShadow: '0 4px 22px rgba(0, 136, 255, 0.45)',
                    cursor: razorpayLoading ? 'wait' : 'pointer'
                  }}
                >
                  {razorpayLoading ? (
                    <>
                      <RefreshCw size={16} className="spin" />
                      <span>Launching Payment Gateway...</span>
                    </>
                  ) : (
                    <>
                      <Lock size={16} />
                      <span>Pay {currentPlan.price} with Razorpay</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </motion.button>
              </div>
            )}

            {/* TAB CONTENT: DIRECT UPI & QR */}
            {activeTab === 'upi' && (
              <form onSubmit={handleUpiSubmit}>
                <div
                  style={{
                    background: 'rgba(6, 8, 14, 0.6)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    padding: '1.25rem',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1.25rem',
                    alignItems: 'center',
                    marginBottom: '1.25rem'
                  }}
                >
                  {/* Dynamic High-tech 100% Real Scannable QR Code Box */}
                  <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div
                      style={{
                        width: '150px',
                        height: '150px',
                        background: '#ffffff',
                        borderRadius: '12px',
                        padding: '8px',
                        boxShadow: '0 0 25px rgba(0, 136, 255, 0.25)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative'
                      }}
                    >
                      {qrCodeDataUrl ? (
                        <img
                          src={qrCodeDataUrl}
                          alt="Scan with GPay, PhonePe, Paytm"
                          style={{ width: '100%', height: '100%', borderRadius: '6px', objectFit: 'contain' }}
                        />
                      ) : (
                        <RefreshCw size={24} className="spin" color="#0088ff" />
                      )}
                      <div style={{ position: 'absolute', bottom: '4px', fontSize: '0.62rem', fontWeight: 800, color: '#0088ff', background: '#e0f2fe', padding: '1px 6px', borderRadius: '4px' }}>
                        SCAN VIA ANY UPI APP
                      </div>
                    </div>

                    <a
                      href={upiDeepLink}
                      style={{
                        marginTop: '0.75rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        fontSize: '0.75rem',
                        color: '#00f0ff',
                        textDecoration: 'underline'
                      }}
                    >
                      <Smartphone size={13} />
                      <span>Open in UPI App</span>
                    </a>
                  </div>

                  {/* UPI ID & Details */}
                  <div>
                    <label className="form-label">Official Payment UPI ID</label>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '1rem' }}>
                      <input
                        type="text"
                        readOnly
                        value={DEFAULT_UPI_ID}
                        className="form-input"
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '0.86rem', color: '#00f0ff', background: 'rgba(0,0,0,0.5)' }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(DEFAULT_UPI_ID);
                          setCopiedUpi(true);
                          setTimeout(() => setCopiedUpi(false), 2000);
                        }}
                        className="btn btn-outline"
                        style={{ padding: '0 12px', flexShrink: 0 }}
                        title="Copy UPI ID"
                      >
                        {copiedUpi ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                      </button>
                    </div>

                    <label className="form-label">
                      Transaction UTR / Reference No. <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 429188402914 (12 digits)"
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(e.target.value)}
                      className="form-input"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '0.88rem' }}
                    />
                    <div style={{ marginTop: '0.35rem' }}>
                      <span style={{ fontSize: '0.72rem', color: '#71717a' }}>
                        Found in your payment app receipt (Google Pay, PhonePe, Paytm)
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '0.85rem', borderRadius: '12px', fontSize: '0.92rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  <Shield size={16} />
                  <span>Submit UTR for Verification</span>
                  <ArrowRight size={16} />
                </button>
              </form>
            )}
              </>
            )}


          </div>
        )}

        {/* =========================================================================
            STEP 2: LIVE VERIFICATION SCANNER ENGINE
           ========================================================================= */}
        {currentStep === 'verifying' && (
          <div style={{ padding: '1.5rem 0.5rem', textAlign: 'center' }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                background: 'rgba(0, 136, 255, 0.12)',
                border: '2px dashed #00f0ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem'
              }}
            >
              <Shield size={32} color="#0088ff" />
            </motion.div>

            <h3 style={{ fontSize: '1.4rem', color: '#ffffff', marginBottom: '0.35rem' }}>
              Executing Cryptographic Verification
            </h3>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1.75rem' }}>
              Payment Reference: <code style={{ color: '#00f0ff' }}>{verifiedPaymentRef}</code>
            </p>

            {/* Progress bar */}
            <div style={{ maxWidth: '420px', margin: '0 auto 2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '0.4rem' }}>
                <span>Verification Pipeline</span>
                <span style={{ color: '#00f0ff', fontWeight: 700 }}>{verificationProgress}%</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '9999px', overflow: 'hidden' }}>
                <motion.div
                  style={{ height: '100%', background: 'linear-gradient(90deg, #0088ff, #00f0ff)', borderRadius: '9999px' }}
                  animate={{ width: `${verificationProgress}%` }}
                  transition={{ ease: 'easeOut', duration: 0.4 }}
                />
              </div>
            </div>

            {/* Checklist of stages */}
            <div style={{ maxWidth: '380px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left' }}>
              {[
                { stage: 1, label: 'Contacting Razorpay Gateway Engine' },
                { stage: 2, label: 'Validating Anti-Fraud Status & Amount' },
                { stage: 3, label: 'Minting Ring-0 Hypervisor Key' },
                { stage: 4, label: 'Binding License to Customer Profile' }
              ].map((item) => {
                const isDone = verificationStage >= item.stage;
                return (
                  <div
                    key={item.stage}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      fontSize: '0.82rem',
                      color: isDone ? '#e4e4e7' : '#71717a'
                    }}
                  >
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: isDone ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        border: isDone ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isDone ? '#10b981' : '#71717a',
                        flexShrink: 0
                      }}
                    >
                      {isDone ? <Check size={12} /> : item.stage}
                    </div>
                    <span>{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* =========================================================================
            STEP 3: SUCCESS & LICENSE DISPLAY
           ========================================================================= */}
        {currentStep === 'success' && (
          <div style={{ textAlign: 'center', padding: '1rem 0.5rem' }}>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(0, 240, 255, 0.15) 100%)',
                border: '1px solid #10b981',
                boxShadow: '0 0 30px rgba(16, 185, 129, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem'
              }}
            >
              <CheckCircle2 size={34} color="#10b981" />
            </motion.div>

            <h3 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', marginBottom: '0.35rem' }}>
              Payment Verified & License Issued!
            </h3>
            <p className="text-muted" style={{ fontSize: '0.88rem', maxWidth: '440px', margin: '0 auto 1.5rem' }}>
              Reference: <strong style={{ color: '#00f0ff' }}>{verifiedPaymentRef}</strong>. Your key is stored in your profile and client download is unlocked.
            </p>

            {/* Glowing License Key Display Box */}
            <div
              style={{
                background: 'rgba(6, 8, 14, 0.85)',
                border: '1.5px solid rgba(0, 240, 255, 0.4)',
                boxShadow: '0 10px 30px rgba(0, 136, 255, 0.25)',
                borderRadius: '16px',
                padding: '1.25rem 1.5rem',
                marginBottom: '1.5rem',
                textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#00f0ff', letterSpacing: '0.5px' }}>
                  YOUR DEDICATED LICENSE KEY
                </span>
                <span style={{ fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                  STATUS: ACTIVE
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(0, 0, 0, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '0.75rem 1rem',
                  gap: '0.75rem'
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    color: '#ffffff',
                    letterSpacing: '1px',
                    wordBreak: 'break-all'
                  }}
                >
                  {verifiedKey || 'LEGIT-XXXX-XXXX-XXXX'}
                </span>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCopyKey}
                  style={{
                    background: copiedKey ? '#10b981' : 'rgba(0, 136, 255, 0.2)',
                    border: '1px solid rgba(0, 240, 255, 0.4)',
                    color: '#fff',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {copiedKey ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedKey ? 'Copied' : 'Copy Key'}</span>
                </motion.button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', fontSize: '0.76rem', color: '#a1a1aa' }}>
                <span>Plan: <strong style={{ color: '#fff' }}>{currentPlan.name}</strong></span>
                <span>HWID: <strong style={{ color: '#10b981' }}>Ready (Binds on 1st Launch)</strong></span>
              </div>
            </div>

            {/* Action CTA Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => {
                  downloadApp();
                }}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  borderRadius: '12px',
                  fontSize: '0.92rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.55rem'
                }}
              >
                <Download size={18} />
                <span>Download App Client ({APP_VERSION} Windows)</span>
              </button>

              <button
                onClick={() => {
                  closeCheckout();
                  navigate('/profile');
                }}
                className="btn btn-outline"
                style={{
                  width: '100%',
                  padding: '0.8rem',
                  borderRadius: '12px',
                  fontSize: '0.88rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem'
                }}
              >
                <Key size={16} />
                <span>Manage in Profile Section</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            STEP 4: MANUAL REVIEW QUEUED SCREEN (DIRECT UPI)
           ========================================================================= */}
        {currentStep === 'pending_review' && (
          <div style={{ textAlign: 'center', padding: '1rem 0.5rem' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                boxShadow: '0 0 30px rgba(245, 158, 11, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem'
              }}
            >
              <Clock size={32} color="#f59e0b" />
            </div>

            <h3 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#fff', marginBottom: '0.35rem' }}>
              Transaction Logged & Under Review
            </h3>
            <p className="text-muted" style={{ fontSize: '0.86rem', maxWidth: '460px', margin: '0 auto 1.5rem', lineHeight: 1.5 }}>
              Your order <strong style={{ color: '#00f0ff' }}>{submittedOrderId}</strong> with reference <code style={{ color: '#f59e0b' }}>{verifiedPaymentRef}</code> has been recorded.
            </p>

            <div
              style={{
                background: 'rgba(6, 8, 14, 0.7)',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '1.25rem',
                textAlign: 'left',
                marginBottom: '1.5rem'
              }}
            >
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#00f0ff', marginBottom: '0.5rem' }}>
                Manual Verification Policy
              </div>
              <p style={{ fontSize: '0.8rem', color: '#a1a1aa', margin: 0, lineHeight: 1.6 }}>
                Direct bank transfers are manually audited against bank ledger receipts by our team within <strong>15 to 30 minutes</strong>. Once matched, your key will automatically activate under your profile.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => {
                  closeCheckout();
                  navigate('/profile');
                }}
                className="btn btn-primary"
                style={{ flex: 1, padding: '0.8rem', borderRadius: '12px' }}
              >
                Go to Profile Section
              </button>
              <button
                onClick={() => {
                  setCurrentStep('payment');
                  setActiveTab('razorpay');
                }}
                className="btn btn-outline"
                style={{ flex: 1, padding: '0.8rem', borderRadius: '12px' }}
              >
                Switch to Instant Razorpay
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
