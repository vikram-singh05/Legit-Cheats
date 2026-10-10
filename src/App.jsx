import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock, LogOut, ArrowRight, Terminal, Sparkles, User, Download, Key } from 'lucide-react';
import PublicSite from './pages/PublicSite';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Profile from './pages/Profile';
import PurchaseModal from './components/PurchaseModal';
import { useAuth } from './context/AuthContext';
import { PurchaseProvider, usePurchase } from './context/PurchaseContext';

function ProtectedDashboard() {
  const { user, isAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div
          animate={{ scale: [1, 1.15, 1], rotate: [0, 180, 360] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ width: '48px', height: '48px', marginBottom: '1.5rem' }}
        >
          <img src="/logo-diamond.png" alt="Loading" style={{ width: '100%', height: 'auto', filter: 'drop-shadow(0 0 15px #0088ff)' }} />
        </motion.div>
        <p className="text-muted" style={{ letterSpacing: '2px', fontSize: '0.85rem', textTransform: 'uppercase' }}>
          Verifying Security Credentials...
        </p>
      </div>
    );
  }

  if (!user && !isAdmin) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card text-center"
          style={{ maxWidth: '440px', padding: '2.5rem 2rem' }}
        >
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
            <Lock size={28} color="#f87171" />
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.75rem', color: '#fff' }}>Authentication Required</h2>
          <p className="text-muted" style={{ fontSize: '0.88rem', marginBottom: '1.75rem', lineHeight: '1.6' }}>
            You must be signed in with an authorized administrator account to access the Command Center.
          </p>
          <div className="flex flex-col gap-3">
            <Link to="/login" className="btn btn-primary" style={{ width: '100%' }}>
              Sign In to Continue
            </Link>
            <Link to="/" className="btn btn-outline" style={{ width: '100%' }}>
              Return to Public Portal
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card text-center"
          style={{ maxWidth: '480px', padding: '2.5rem 2rem' }}
        >
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
            <Shield size={28} color="#fbbf24" />
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.75rem', color: '#fff' }}>Admin Privileges Required</h2>
          <p className="text-muted" style={{ fontSize: '0.88rem', marginBottom: '1.5rem', lineHeight: '1.6' }}>
            Logged in as <span style={{ color: '#fff', fontWeight: 600 }}>{user?.email}</span>. Your account does not have administrative privileges to manage licenses.
          </p>
          <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '10px', padding: '0.9rem', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '1.75rem', textAlign: 'left', fontSize: '0.8rem', color: '#a1a1aa' }}>
            <p style={{ fontWeight: 600, color: '#e4e4e7', marginBottom: '0.25rem' }}>Need admin access?</p>
            <span style={{ color: '#71717a' }}>Contact the site administrator to request elevated privileges for your account.</span>
          </div>
          <div className="flex gap-3 justify-center">
            <Link to="/" className="btn btn-primary">
              Return Home
            </Link>
            <button onClick={() => signOut()} className="btn btn-outline flex items-center gap-2">
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return <Dashboard />;
}

function MainNavbar() {
  const location = useLocation();
  const { user, isAdmin, signOut } = useAuth();
  const { hasPurchased, triggerDummyDownload, openCheckout } = usePurchase();
  const isDashboard = location.pathname.startsWith('/dashboard');

  if (isDashboard) return null;

  return (
    <div style={{ position: 'fixed', top: '16px', left: 0, width: '100%', display: 'flex', justifyContent: 'center', zIndex: 100, pointerEvents: 'none' }}>
      <motion.nav
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="navbar"
        style={{
          pointerEvents: 'auto',
          width: '92%',
          maxWidth: '1200px',
          height: '58px',
          borderRadius: '9999px',
          background: 'rgba(9, 11, 18, 0.85)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 136, 255, 0.08)',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        {/* Brand - ONLY Diamond for logo */}
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
          <motion.div
            whileHover={{ scale: 1.1, rotate: 6 }}
            whileTap={{ scale: 0.95 }}
            title="LEGIT"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(0, 136, 255, 0.22) 0%, rgba(0, 240, 255, 0.06) 100%)',
              border: '1px solid rgba(0, 136, 255, 0.4)',
              boxShadow: '0 0 15px rgba(0, 136, 255, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <img
              src="/logo-diamond.png"
              alt="LEGIT Diamond"
              style={{
                width: '24px',
                height: 'auto',
                filter: 'drop-shadow(0 0 8px rgba(0, 240, 255, 0.8))'
              }}
            />
          </motion.div>
        </Link>

        {/* Center Navigation Links */}
        <div className="hidden md:flex items-center gap-1">
          <a href="/#features" className="nav-link">
            Features
          </a>
          <a href="/#products" className="nav-link">
            Products
          </a>
          <a href="/#security" className="nav-link">
            Security
          </a>
          <a href="/#faq" className="nav-link">
            FAQ
          </a>
          {user && (
            <Link
              to="/profile"
              className="nav-link"
              style={{
                color: location.pathname === '/profile' ? '#00f0ff' : 'inherit',
                fontWeight: location.pathname === '/profile' ? 700 : 500
              }}
            >
              My Profile
            </Link>
          )}
        </div>

        {/* Right Action Items */}
        <div className="flex items-center gap-2">
          {/* Quick Dummy Download App button in navbar if purchased */}
          {hasPurchased && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={triggerDummyDownload}
              title="Download Ring-0 Client"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '6px 13px',
                borderRadius: '9999px',
                background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.2) 0%, rgba(0, 136, 255, 0.2) 100%)',
                border: '1px solid rgba(0, 240, 255, 0.45)',
                boxShadow: '0 0 15px rgba(0, 240, 255, 0.2)',
                color: '#00f0ff',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <Download size={13} />
              <span className="hidden sm:inline">Download App</span>
            </motion.button>
          )}

          {/* Show Admin Panel button ONLY if user is logged in AND is an admin */}
          {isAdmin && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
            >
              <Link
                to="/dashboard"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '6px 13px',
                  borderRadius: '20px',
                  background: 'linear-gradient(135deg, rgba(0, 136, 255, 0.25) 0%, rgba(0, 240, 255, 0.15) 100%)',
                  border: '1px solid rgba(0, 240, 255, 0.4)',
                  boxShadow: '0 0 15px rgba(0, 136, 255, 0.3)',
                  color: '#00f0ff',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  letterSpacing: '0.4px',
                  textDecoration: 'none'
                }}
              >
                <Terminal size={13} />
                <span>ADMIN</span>
              </Link>
            </motion.div>
          )}

          {user ? (
            <div className="flex items-center gap-2">
              <Link
                to="/profile"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '5px 11px',
                  background: location.pathname === '/profile' ? 'rgba(0, 136, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                  borderRadius: '20px',
                  border: location.pathname === '/profile' ? '1px solid rgba(0, 240, 255, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                  textDecoration: 'none'
                }}
              >
                <div
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: hasPurchased
                      ? 'linear-gradient(135deg, #0088ff, #00f0ff)'
                      : 'rgba(255,255,255,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: '#fff'
                  }}
                >
                  {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                </div>
                <span className="hidden sm:inline" style={{ fontSize: '0.8rem', color: '#d4d4d8', maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Profile
                </span>
                {hasPurchased && (
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                )}
              </Link>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => signOut()}
                title="Sign Out"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#a1a1aa',
                  padding: '6px 10px',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  transition: 'all 0.2s ease'
                }}
              >
                <LogOut size={13} />
                <span className="hidden sm:inline">Logout</span>
              </motion.button>
            </div>
          ) : (
            <div
              style={{
                background: 'rgba(15, 18, 26, 0.85)',
                padding: '3px',
                borderRadius: '9999px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                gap: '3px'
              }}
            >
              <Link
                to="/login"
                style={{
                  padding: '6px 13px',
                  background: location.pathname === '/login' ? 'rgba(0, 136, 255, 0.2)' : 'transparent',
                  borderRadius: '9999px',
                  color: location.pathname === '/login' ? '#fff' : '#a1a1aa',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                Sign In
              </Link>
              <button
                onClick={() => openCheckout()}
                style={{
                  padding: '6px 14px',
                  background: 'linear-gradient(135deg, #0088ff 0%, #0055ff 100%)',
                  borderRadius: '9999px',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  boxShadow: '0 2px 10px rgba(0, 136, 255, 0.3)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Buy Now
              </button>
            </div>
          )}
        </div>
      </motion.nav>
    </div>
  );
}

function AppContent() {
  const location = useLocation();
  const isDashboard = location.pathname.startsWith('/dashboard');

  return (
    <>
      <MainNavbar />
      <PurchaseModal />

      {/* Main Content Page Wrapper */}
      <div className={!isDashboard ? "page-wrapper" : ""}>
        <Routes>
          <Route path="/" element={<PublicSite />} />
          <Route path="/login" element={<Login />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/dashboard" element={<ProtectedDashboard />} />
        </Routes>
      </div>
    </>
  );
}

function App() {
  return (
    <PurchaseProvider>
      <AppContent />
    </PurchaseProvider>
  );
}

export default App;
