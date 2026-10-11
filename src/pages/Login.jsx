import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  Lock,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export default function Login() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);

  // Determine initial mode based on query params or URL hash
  const determineInitialMode = () => {
    const modeParam = searchParams.get('mode');
    const hash = location.hash || '';
    if (modeParam === 'reset-password' || hash.includes('type=recovery')) {
      return 'reset-password';
    }
    if (modeParam === 'forgot') return 'forgot';
    if (modeParam === 'signup') return 'signup';
    return 'signin';
  };

  const [mode, setMode] = useState(determineInitialMode); // 'signin' | 'signup' | 'forgot' | 'reset-password'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Anti-Brute-Force Rate Limiting State
  const [failCount, setFailCount] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState(0);

  // Password Reset Email Rate Limiting (60s cooldown)
  const [resetCooldown, setResetCooldown] = useState(0);

  const { signIn, signUp, resetPassword, updatePassword } = useAuth();
  const navigate = useNavigate();

  // --- SECURITY FIX (MED-04): Whitelist allowed redirect targets to prevent open redirect ---
  const ALLOWED_REDIRECTS = ['/profile', '/', '/dashboard'];
  const rawRedirect = searchParams.get('redirect') || '/profile';
  const redirectTarget = ALLOWED_REDIRECTS.includes(rawRedirect) ? rawRedirect : '/profile';
  const planParam = searchParams.get('plan') || '';

  // Listen for Supabase password recovery events or hash change
  useEffect(() => {
    if (location.hash.includes('type=recovery') || searchParams.get('mode') === 'reset-password') {
      setMode('reset-password');
      setError('');
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('reset-password');
        setError('');
        setSuccessMsg('Security verified. You can now set your new account password.');
      }
    });

    return () => {
      subscription?.unsubscribe?.();
    };
  }, [location.hash, location.search]);

  // Countdown timer for reset email cooldown
  useEffect(() => {
    if (resetCooldown <= 0) return;
    const interval = setInterval(() => {
      setResetCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resetCooldown]);

  const handlePostAuthRedirect = () => {
    if (redirectTarget === 'checkout') {
      const pendingPlan = planParam || sessionStorage.getItem('legit_pending_plan') || '';
      navigate(pendingPlan ? `/?checkout=${pendingPlan}` : '/');
    } else {
      navigate(redirectTarget);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Enforce lockouts from consecutive failures
    if (Date.now() < cooldownUntil) {
      const waitSec = Math.ceil((cooldownUntil - Date.now()) / 1000);
      setError(`Security Alert: Too many failed attempts. Cooldown active for ${waitSec} seconds.`);
      return;
    }

    setError('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const cleanEmail = email.trim().toLowerCase();

      /* ──────────────────────────
         MODE: FORGOT PASSWORD
      ────────────────────────── */
      if (mode === 'forgot') {
        if (!cleanEmail) {
          throw new Error('Please enter your email address.');
        }
        if (resetCooldown > 0) {
          throw new Error(`Please wait ${resetCooldown} seconds before requesting another recovery email.`);
        }

        try {
          await resetPassword(cleanEmail);
        } catch (err) {
          // Log internally for debugging, but preserve neutral messaging against user enumeration
          console.warn('Password recovery request status:', err?.message || err);
        }

        // Minimal and clean confirmation message
        setSuccessMsg('Reset link sent! Check your inbox.');
        setResetCooldown(60); // 60s cooldown
        return;
      }

      /* ──────────────────────────
         MODE: RESET NEW PASSWORD
      ────────────────────────── */
      if (mode === 'reset-password') {
        if (!newPassword || newPassword.length < 6) {
          throw new Error('New password must be at least 6 characters long.');
        }
        if (newPassword !== confirmNewPassword) {
          throw new Error('Passwords do not match.');
        }

        await updatePassword(newPassword);
        setSuccessMsg('Password updated! Redirecting...');
        setNewPassword('');
        setConfirmNewPassword('');
        setTimeout(() => {
          handlePostAuthRedirect();
        }, 1500);
        return;
      }

      /* ──────────────────────────
         MODE: SIGN UP
      ────────────────────────── */
      if (mode === 'signup') {
        if (!cleanEmail || !password) {
          throw new Error('Please fill in both email and password.');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters long.');
        }
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match.');
        }

        const data = await signUp(cleanEmail, password);
        if (data.session) {
          setSuccessMsg('Account created successfully! Redirecting...');
          setTimeout(() => {
            handlePostAuthRedirect();
          }, 1000);
        } else {
          setSuccessMsg('Account registered! If confirmation is required, check your email.');
          setMode('signin');
        }
        return;
      }

      /* ──────────────────────────
         MODE: SIGN IN
      ────────────────────────── */
      if (mode === 'signin') {
        if (!cleanEmail || !password) {
          throw new Error('Please fill in both email and password.');
        }

        await signIn(cleanEmail, password);
        setSuccessMsg('Welcome back!');
        setTimeout(() => {
          handlePostAuthRedirect();
        }, 800);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Authentication failed. Please verify your credentials.');

      if (mode === 'signin' || mode === 'reset-password') {
        const newFails = failCount + 1;
        setFailCount(newFails);
        if (newFails >= 5) {
          setCooldownUntil(Date.now() + 30000); // 30-second security lockdown
          setError('Security Alert: 5 consecutive failed attempts. Authentication locked for 30 seconds.');
          setFailCount(0);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  /* ─── Animation Variants ─── */
  const containerVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 25 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1], staggerChildren: 0.06 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } }
  };

  const tabVariants = {
    inactive: { scale: 1 },
    active: { scale: 1.02 }
  };

  return (
    <div
      className="login-page-container"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '100px 1.5rem 3rem',
        position: 'relative'
      }}
    >
      {/* Background radial atmosphere */}
      <motion.div
        className="bg-glow"
        animate={{ opacity: [0.6, 0.9, 0.6] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ top: '-10%', filter: 'blur(90px)' }}
      />

      {/* Floating Particles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          animate={{
            y: [0, -30, 0],
            x: [0, i % 2 === 0 ? 15 : -15, 0],
            opacity: [0.15, 0.35, 0.15]
          }}
          transition={{ duration: 3 + i * 0.5, repeat: Infinity, delay: i * 0.4, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            width: `${4 + i * 2}px`,
            height: `${4 + i * 2}px`,
            borderRadius: '50%',
            background: `rgba(0, ${136 + i * 20}, 255, 0.3)`,
            top: `${20 + i * 12}%`,
            left: `${15 + i * 12}%`,
            pointerEvents: 'none',
            filter: 'blur(1px)'
          }}
        />
      ))}

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="card auth-card"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '2.5rem 2rem',
          background: 'rgba(12, 14, 20, 0.78)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 35px rgba(0, 136, 255, 0.1)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          borderRadius: '24px',
          position: 'relative',
          zIndex: 10
        }}
      >
        {/* Diamond Logo Header */}
        <motion.div variants={itemVariants} style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
            <motion.div
              whileHover={{ scale: 1.08, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
              animate={{
                boxShadow: [
                  '0 0 15px rgba(0, 136, 255, 0.2)',
                  '0 0 30px rgba(0, 136, 255, 0.4)',
                  '0 0 15px rgba(0, 136, 255, 0.2)'
                ]
              }}
              transition={{
                boxShadow: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' }
              }}
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '18px',
                background: 'linear-gradient(135deg, rgba(0, 136, 255, 0.2) 0%, rgba(0, 240, 255, 0.05) 100%)',
                border: '1px solid rgba(0, 136, 255, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <motion.img
                src="/logo-diamond.png"
                alt="LEGIT Diamond"
                className="animate-rotate-glow"
                style={{ width: '38px', height: 'auto' }}
              />
            </motion.div>
          </Link>

          <AnimatePresence mode="wait">
            <motion.h2
              key={mode + '-title'}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.3 }}
              style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#fff', marginBottom: '0.4rem' }}
            >
              {mode === 'signin' && 'Welcome Back'}
              {mode === 'signup' && 'Create Your Account'}
              {mode === 'forgot' && 'Reset Password'}
              {mode === 'reset-password' && 'Set New Password'}
            </motion.h2>
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.p
              key={mode + '-subtitle'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="text-muted"
              style={{ fontSize: '0.9rem' }}
            >
              {mode === 'signin' && 'Sign in to access your dashboard and active licenses'}
              {mode === 'signup' && 'Join LEGIT and unleash hyper-tuned performance'}
              {mode === 'forgot' && 'Enter your email to receive a password reset link'}
              {mode === 'reset-password' && 'Choose a strong, secure new password for your account'}
            </motion.p>
          </AnimatePresence>
        </motion.div>

        {/* Tab switchers OR Back button */}
        {mode === 'forgot' || mode === 'reset-password' ? (
          <motion.div
            variants={itemVariants}
            style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'flex-start' }}
          >
            <motion.button
              type="button"
              whileHover={{ x: -3 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setMode('signin');
                setError('');
                setSuccessMsg('');
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-muted-foreground)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '4px 0',
                transition: 'color 0.2s ease'
              }}
            >
              <ArrowLeft size={16} />
              <span>Back to Sign In</span>
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            variants={itemVariants}
            style={{
              display: 'flex',
              background: 'rgba(5, 7, 12, 0.8)',
              padding: '4px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              marginBottom: '1.75rem',
              position: 'relative'
            }}
          >
            <motion.div
              layout
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              style={{
                position: 'absolute',
                top: '4px',
                left: mode === 'signin' ? '4px' : 'calc(50% + 0px)',
                width: 'calc(50% - 4px)',
                height: 'calc(100% - 8px)',
                background: 'rgba(0, 136, 255, 0.2)',
                borderRadius: '8px',
                zIndex: 0
              }}
            />
            <motion.button
              type="button"
              onClick={() => {
                setMode('signin');
                setError('');
                setSuccessMsg('');
              }}
              variants={tabVariants}
              animate={mode === 'signin' ? 'active' : 'inactive'}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: '8px',
                border: 'none',
                background: 'transparent',
                color: mode === 'signin' ? '#fff' : 'var(--color-muted-foreground)',
                fontSize: '0.88rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'color 0.25s ease',
                position: 'relative',
                zIndex: 1
              }}
            >
              Sign In
            </motion.button>
            <motion.button
              type="button"
              onClick={() => {
                setMode('signup');
                setError('');
                setSuccessMsg('');
              }}
              variants={tabVariants}
              animate={mode === 'signup' ? 'active' : 'inactive'}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                flex: 1,
                padding: '8px 0',
                borderRadius: '8px',
                border: 'none',
                background: 'transparent',
                color: mode === 'signup' ? '#fff' : 'var(--color-muted-foreground)',
                fontSize: '0.88rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'color 0.25s ease',
                position: 'relative',
                zIndex: 1
              }}
            >
              Register
            </motion.button>
          </motion.div>
        )}

        {/* Feedback alerts */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                borderRadius: '10px',
                padding: '0.75rem 1rem',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                marginBottom: '1.25rem'
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </motion.div>
          )}

          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              style={{
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#34d399',
                borderRadius: '10px',
                padding: '0.75rem 1rem',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                marginBottom: '1.25rem',
                lineHeight: '1.45'
              }}
            >
              <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              <span>{successMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Authentication Form */}
        <form onSubmit={handleSubmit}>
          {/* Email input for signin, signup, forgot */}
          {mode !== 'reset-password' && (
            <motion.div
              variants={itemVariants}
              className="form-group"
              style={{ marginBottom: '1.2rem' }}
            >
              <label className="form-label" style={{ fontSize: '0.85rem', color: '#c4c4cc', marginBottom: '0.4rem', display: 'block' }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <motion.div
                  animate={{ color: email ? '#0088ff' : '#71717a' }}
                  style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: '14px', zIndex: 1 }}
                >
                  <Mail size={18} />
                </motion.div>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@legitcheats.live"
                  className="form-input"
                  style={{
                    paddingLeft: '2.75rem',
                    background: 'rgba(6, 8, 12, 0.7)',
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    fontSize: '0.92rem',
                    height: '46px',
                    width: '100%'
                  }}
                />
              </div>
            </motion.div>
          )}

          {/* Password fields for signin and signup */}
          {(mode === 'signin' || mode === 'signup') && (
            <motion.div
              variants={itemVariants}
              className="form-group"
              style={{ marginBottom: mode === 'signup' ? '1.2rem' : '1.5rem' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label className="form-label" style={{ fontSize: '0.85rem', color: '#c4c4cc', margin: 0 }}>
                  Password
                </label>
                {mode === 'signin' && (
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '0.8rem',
                      color: '#00f0ff',
                      cursor: 'pointer',
                      fontWeight: 500,
                      padding: 0
                    }}
                    onClick={() => {
                      setMode('forgot');
                      setError('');
                      setSuccessMsg('');
                    }}
                  >
                    Forgot password?
                  </motion.button>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <motion.div
                  animate={{ color: password ? '#0088ff' : '#71717a' }}
                  style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: '14px', zIndex: 1 }}
                >
                  <Lock size={18} />
                </motion.div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="form-input"
                  style={{
                    paddingLeft: '2.75rem',
                    paddingRight: '2.75rem',
                    background: 'rgba(6, 8, 12, 0.7)',
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    fontSize: '0.92rem',
                    height: '46px',
                    width: '100%'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    right: '12px',
                    background: 'transparent',
                    border: 'none',
                    color: '#71717a',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex'
                  }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </motion.div>
          )}

          {/* Confirm Password for signup */}
          {mode === 'signup' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              style={{ overflow: 'hidden' }}
            >
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" style={{ fontSize: '0.85rem', color: '#c4c4cc', marginBottom: '0.4rem', display: 'block' }}>
                  Confirm Password
                </label>
                <div style={{ position: 'relative' }}>
                  <motion.div
                    animate={{ color: confirmPassword ? '#0088ff' : '#71717a' }}
                    style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: '14px', zIndex: 1 }}
                  >
                    <ShieldCheck size={18} />
                  </motion.div>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="form-input"
                    style={{
                      paddingLeft: '2.75rem',
                      background: 'rgba(6, 8, 12, 0.7)',
                      borderColor: 'rgba(255, 255, 255, 0.08)',
                      borderRadius: '12px',
                      fontSize: '0.92rem',
                      height: '46px',
                      width: '100%'
                    }}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* New password fields for reset-password mode */}
          {mode === 'reset-password' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="form-group" style={{ marginBottom: '1.2rem' }}>
                <label className="form-label" style={{ fontSize: '0.85rem', color: '#c4c4cc', marginBottom: '0.4rem', display: 'block' }}>
                  New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <motion.div
                    animate={{ color: newPassword ? '#0088ff' : '#71717a' }}
                    style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: '14px', zIndex: 1 }}
                  >
                    <Lock size={18} />
                  </motion.div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="form-input"
                    style={{
                      paddingLeft: '2.75rem',
                      paddingRight: '2.75rem',
                      background: 'rgba(6, 8, 12, 0.7)',
                      borderColor: 'rgba(255, 255, 255, 0.08)',
                      borderRadius: '12px',
                      fontSize: '0.92rem',
                      height: '46px',
                      width: '100%'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      right: '12px',
                      background: 'transparent',
                      border: 'none',
                      color: '#71717a',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex'
                    }}
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" style={{ fontSize: '0.85rem', color: '#c4c4cc', marginBottom: '0.4rem', display: 'block' }}>
                  Confirm New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <motion.div
                    animate={{ color: confirmNewPassword ? '#0088ff' : '#71717a' }}
                    style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: '14px', zIndex: 1 }}
                  >
                    <ShieldCheck size={18} />
                  </motion.div>
                  <input
                    type={showConfirmNewPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="form-input"
                    style={{
                      paddingLeft: '2.75rem',
                      paddingRight: '2.75rem',
                      background: 'rgba(6, 8, 12, 0.7)',
                      borderColor: 'rgba(255, 255, 255, 0.08)',
                      borderRadius: '12px',
                      fontSize: '0.92rem',
                      height: '46px',
                      width: '100%'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      right: '12px',
                      background: 'transparent',
                      border: 'none',
                      color: '#71717a',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex'
                    }}
                    aria-label={showConfirmNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Submit Action Button */}
          <motion.button
            whileHover={{ scale: 1.02, boxShadow: '0 8px 30px rgba(0, 136, 255, 0.5)' }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={submitting || (mode === 'forgot' && resetCooldown > 0)}
            className="btn btn-primary"
            style={{
              width: '100%',
              height: '48px',
              borderRadius: '12px',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              opacity: (mode === 'forgot' && resetCooldown > 0) ? 0.7 : 1,
              cursor: (mode === 'forgot' && resetCooldown > 0) ? 'not-allowed' : 'pointer'
            }}
          >
            {submitting ? (
              <motion.span
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                Processing...
              </motion.span>
            ) : mode === 'signin' ? (
              <>
                <span>Sign In</span>
                <motion.div animate={{ x: [0, 4, 0] }} transition={{ duration: 1.2, repeat: Infinity }}>
                  <ArrowRight size={18} />
                </motion.div>
              </>
            ) : mode === 'signup' ? (
              <>
                <span>Register Account</span>
                <motion.div animate={{ x: [0, 4, 0] }} transition={{ duration: 1.2, repeat: Infinity }}>
                  <ArrowRight size={18} />
                </motion.div>
              </>
            ) : mode === 'forgot' ? (
              <>
                <span>{resetCooldown > 0 ? `Resend Available in ${resetCooldown}s` : 'Send Recovery Link'}</span>
                <motion.div animate={{ x: [0, 4, 0] }} transition={{ duration: 1.2, repeat: Infinity }}>
                  <ArrowRight size={18} />
                </motion.div>
              </>
            ) : (
              <>
                <span>Update Password</span>
                <motion.div animate={{ x: [0, 4, 0] }} transition={{ duration: 1.2, repeat: Infinity }}>
                  <ArrowRight size={18} />
                </motion.div>
              </>
            )}
          </motion.button>
        </form>

        {/* Bottom context links */}
        {mode === 'forgot' && (
          <motion.div
            variants={itemVariants}
            style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.85rem' }}
          >
            <span className="text-muted">Remembered your password? </span>
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError('');
                setSuccessMsg('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#00f0ff',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0
              }}
            >
              Sign In
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
