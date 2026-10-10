import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Key, ShieldCheck, ArrowRight, AlertCircle, CheckCircle2, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'signin';
  const [mode, setMode] = useState(initialMode); // 'signin' | 'signup' | 'emergency'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [serviceKey, setServiceKey] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  // --- SECURITY FIX (MED-04): Whitelist allowed redirect targets to prevent open redirect ---
  const ALLOWED_REDIRECTS = ['/profile', '/', '/dashboard'];
  const rawRedirect = searchParams.get('redirect') || '/profile';
  const redirectTarget = ALLOWED_REDIRECTS.includes(rawRedirect) ? rawRedirect : '/profile';
  const planParam = searchParams.get('plan') || '';
  // --- SECURITY FIX (CRIT-03): Removed emergency rescue key login ---
  // Admin access is exclusively through Supabase auth + profiles table role check

  // Anti-Brute-Force Rate Limiting State
  const [failCount, setFailCount] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState(0);

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

    if (Date.now() < cooldownUntil) {
      const waitSec = Math.ceil((cooldownUntil - Date.now()) / 1000);
      setError(`Security Alert: Too many failed attempts. Cooldown active for ${waitSec} seconds.`);
      return;
    }

    setError('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      // --- SECURITY FIX (CRIT-03): Removed emergency service key login ---
      if (mode === 'emergency') {
        throw new Error('Emergency key login has been disabled for security. Use standard authentication.');
      }

      if (!email.trim() || !password) {
        throw new Error('Please fill in both email and password');
      }

      if (mode === 'signup') {
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters long');
        }
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        const data = await signUp(email.trim(), password);
        // Supabase might require email confirmation or log user in immediately
        if (data.session) {
          setSuccessMsg('Account created successfully! Redirecting...');
          setTimeout(() => {
            handlePostAuthRedirect();
          }, 1000);
        } else {
          setSuccessMsg('Account registered! If confirmation is required, check your email.');
          setMode('signin');
        }
      } else {
        // Sign in
        const res = await signIn(email.trim(), password);
        setSuccessMsg('Welcome back!');
        setTimeout(() => {
          handlePostAuthRedirect();
        }, 800);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Authentication failed. Please verify your credentials.');
      const newFails = failCount + 1;
      setFailCount(newFails);
      if (newFails >= 5) {
        setCooldownUntil(Date.now() + 30000); // 30 second lockdown
        setError('Security Alert: 5 consecutive failed attempts. Authentication locked for 30 seconds.');
        setFailCount(0);
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
    <div className="login-page-container" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '100px 1.5rem 3rem', position: 'relative' }}>
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
            x: [0, (i % 2 === 0 ? 15 : -15), 0],
            opacity: [0.15, 0.35, 0.15],
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
          background: 'rgba(12, 14, 20, 0.75)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 35px rgba(0, 136, 255, 0.1)',
          backdropFilter: 'blur(30px)',
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
                  '0 0 15px rgba(0, 136, 255, 0.2)',
                ]
              }}
              transition={{
                boxShadow: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' },
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
              {mode === 'emergency' && 'Admin Master Key'}
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
              {mode === 'emergency' && 'Authenticate using direct Supabase Service Role Key'}
            </motion.p>
          </AnimatePresence>
        </motion.div>

        {/* Tab switchers */}
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
          {/* Animated background slider */}
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
              display: mode === 'emergency' ? 'none' : 'block',
              zIndex: 0
            }}
          />
          <motion.button
            type="button"
            onClick={() => { setMode('signin'); setError(''); }}
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
            onClick={() => { setMode('signup'); setError(''); }}
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
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.4 }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
              </motion.div>
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
                marginBottom: '1.25rem'
              }}
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.4 }}
              >
                <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              </motion.div>
              <span>{successMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Authentication Form */}
        <form onSubmit={handleSubmit}>
          <AnimatePresence mode="wait">
            {mode !== 'emergency' ? (
              <motion.div
                key="email-form"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                transition={{ duration: 0.3 }}
              >
                <motion.div
                  variants={itemVariants}
                  className="form-group"
                  style={{ marginBottom: '1.2rem' }}
                >
                  <label className="form-label" style={{ fontSize: '0.85rem', color: '#c4c4cc', marginBottom: '0.4rem' }}>
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
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="operator@legit.gg"
                      className="form-input"
                      style={{
                        paddingLeft: '2.75rem',
                        background: 'rgba(6, 8, 12, 0.7)',
                        borderColor: 'rgba(255, 255, 255, 0.08)',
                        borderRadius: '12px',
                        fontSize: '0.92rem',
                        height: '46px'
                      }}
                    />
                  </div>
                </motion.div>

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
                      <motion.span
                        whileHover={{ scale: 1.05 }}
                        style={{ fontSize: '0.8rem', color: '#0088ff', cursor: 'pointer' }}
                        onClick={() => alert('Password reset link sent to your registered email.')}
                      >
                        Forgot?
                      </motion.span>
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
                        height: '46px'
                      }}
                    />
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
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
                        padding: '2px',
                        display: 'flex'
                      }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </motion.button>
                  </div>
                </motion.div>

                <AnimatePresence>
                  {mode === 'signup' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label className="form-label" style={{ fontSize: '0.85rem', color: '#c4c4cc', marginBottom: '0.4rem' }}>
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
                              height: '46px'
                            }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div
                key="service-key-form"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.3 }}
              >
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label" style={{ fontSize: '0.85rem', color: '#c4c4cc', marginBottom: '0.4rem' }}>
                    Cryptographic Service Role Key (Administrator Authentication)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <motion.div
                      animate={{ color: serviceKey ? '#f59e0b' : '#71717a' }}
                      style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: '14px', zIndex: 1 }}
                    >
                      <Key size={18} />
                    </motion.div>
                    <input
                      type="password"
                      required
                      value={serviceKey}
                      onChange={(e) => setServiceKey(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                      className="form-input"
                      style={{
                        paddingLeft: '2.75rem',
                        background: 'rgba(6, 8, 12, 0.7)',
                        borderColor: 'rgba(255, 255, 255, 0.08)',
                        borderRadius: '12px',
                        fontSize: '0.85rem',
                        height: '46px',
                        fontFamily: 'monospace'
                      }}
                    />
                  </div>
                  <p style={{ fontSize: '0.78rem', color: '#71717a', marginTop: '0.5rem' }}>
                    Used for instant administrator dashboard access without email sign-in.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            whileHover={{ scale: 1.02, boxShadow: '0 8px 30px rgba(0, 136, 255, 0.5)' }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={submitting}
            className="btn btn-primary"
            style={{
              width: '100%',
              height: '48px',
              borderRadius: '12px',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            {submitting ? (
              <motion.span
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                Authenticating...
              </motion.span>
            ) : mode === 'signin' ? (
              <><span>Sign In</span> <motion.div animate={{ x: [0, 4, 0] }} transition={{ duration: 1, repeat: Infinity }}><ArrowRight size={18} /></motion.div></>
            ) : mode === 'signup' ? (
              <><span>Register Account</span> <motion.div animate={{ x: [0, 4, 0] }} transition={{ duration: 1, repeat: Infinity }}><ArrowRight size={18} /></motion.div></>
            ) : (
              <><span>Unlock Command Center</span> <motion.div animate={{ x: [0, 4, 0] }} transition={{ duration: 1, repeat: Infinity }}><ArrowRight size={18} /></motion.div></>
            )}
          </motion.button>
        </form>

      </motion.div>
    </div>
  );
}
