import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Key, Users, Activity, Trash2, Plus, LogOut, RefreshCw, Copy, Check,
  Search, AlertTriangle, ExternalLink, Sparkles, Ban,
  Unlock, CheckCircle2, Mail, Clock
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const [licenses, setLicenses] = useState([]);
  const [userMap, setUserMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'expired' | 'bound' | 'unbound' | 'banned'
  
  // Key Generation State
  const [newKeyDuration, setNewKeyDuration] = useState(30);
  const [isLifetime, setIsLifetime] = useState(false);
  const [keyPrefix, setKeyPrefix] = useState('LEGIT');
  const [adminNote, setAdminNote] = useState('');
  const [generating, setGenerating] = useState(false);
  const [lastGeneratedKey, setLastGeneratedKey] = useState(null);

  // Modal / Toast State
  const [toastMessage, setToastMessage] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchLicenses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('licenses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching licenses:', error);
        showToast('Error querying licenses: ' + error.message);
      } else {
        setLicenses(data || []);
      }

      // Fetch user directory to resolve UUIDs to user Gmails
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (token) {
          const userRes = await fetch('/api/admin-users', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (userRes.ok) {
            const userData = await userRes.json();
            if (userData.users) {
              setUserMap(userData.users);
            }
          }
        }
      } catch (userDirErr) {
        console.warn('User directory mapping unavailable:', userDirErr);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLicenses();
  }, []);

  const generateRandomKey = (prefix = 'LEGIT') => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let segments = [];
    for (let s = 0; s < 3; s++) {
      let seg = '';
      for (let i = 0; i < 4; i++) {
        seg += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      segments.push(seg);
    }
    return `${prefix.toUpperCase()}-${segments.join('-')}`;
  };

  const handleCreateLicense = async (e) => {
    e.preventDefault();
    setGenerating(true);

    const generatedKey = generateRandomKey(keyPrefix || 'LEGIT');
    const tempId = 'temp-' + Date.now();
    
    // Optimistic UI Update
    const newLicense = {
      id: tempId,
      license_key: generatedKey,
      duration_days: isLifetime ? null : Number(newKeyDuration),
      is_lifetime: isLifetime,
      note: adminNote.trim() || null,
      status: 'active',
      hwid: null,
      activated_at: null,
      expires_at: null,
      created_at: new Date().toISOString()
    };
    
    setLicenses(prev => [newLicense, ...prev]);
    setLastGeneratedKey(generatedKey);
    setAdminNote('');
    
    try {
      const { data, error } = await supabase
        .from('licenses')
        .insert([{
          license_key: generatedKey,
          duration_days: isLifetime ? null : Number(newKeyDuration),
          is_lifetime: isLifetime,
          note: newLicense.note,
          status: 'active'
        }])
        .select();

      if (error) throw error;
      
      // Update temp id with real id from DB
      setLicenses(prev => prev.map(l => l.id === tempId ? data[0] : l));
      showToast(`Key minted: ${generatedKey}`);
    } catch (err) {
      // Revert on failure
      setLicenses(prev => prev.filter(l => l.id !== tempId));
      alert('Failed to generate license: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyKey = (keyString) => {
    navigator.clipboard.writeText(keyString);
    setCopiedKey(keyString);
    showToast(`Copied ${keyString}`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleResetHWID = async (id, licenseKey) => {
    const previousLicenses = [...licenses];
    // Optimistic UI Update: Clear HWID, activation, and expiration
    setLicenses(licenses.map(l => l.id === id ? { ...l, hwid: null, activated_at: null, expires_at: null } : l));
    showToast(`HWID unbind cleared for ${licenseKey}`);
    
    try {
      const { error } = await supabase
        .from('licenses')
        .update({ hwid: null, activated_at: null, expires_at: null })
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      // Revert on failure
      setLicenses(previousLicenses);
      alert('Error resetting HWID: ' + err.message);
    }
  };

  const handleToggleBan = async (id, currentStatus) => {
    const newStatus = currentStatus === 'banned' ? 'active' : 'banned';
    const previousLicenses = [...licenses];
    
    // Optimistic UI Update
    setLicenses(licenses.map(l => l.id === id ? { ...l, status: newStatus } : l));
    showToast(`Key status updated to ${newStatus.toUpperCase()}`);
    
    try {
      const { error } = await supabase
        .from('licenses')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      // Revert on failure
      setLicenses(previousLicenses);
      alert('Error updating status: ' + err.message);
    }
  };

  const handleDeleteLicense = async () => {
    if (!confirmDeleteId) return;
    const previousLicenses = [...licenses];
    const idToDelete = confirmDeleteId;
    
    // Optimistic UI Update
    setLicenses(licenses.filter(l => l.id !== idToDelete));
    showToast('License revoked and deleted');
    setConfirmDeleteId(null);
    
    try {
      const { error } = await supabase
        .from('licenses')
        .delete()
        .eq('id', idToDelete);

      if (error) throw error;
    } catch (err) {
      // Revert on failure
      setLicenses(previousLicenses);
      alert('Error deleting license: ' + err.message);
    }
  };

  // Helper to extract Claimed Email and Clean Note
  const parseLicenseClaimInfo = (lic) => {
    const note = lic.note || '';
    let claimedEmail = null;
    let cleanNote = note;

    // Format A: "Verified Razorpay: pay_... | email@domain.com (uuid)"
    const razorMatch = note.match(/\|\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (razorMatch) {
      claimedEmail = razorMatch[1];
      cleanNote = note.split('|')[0]?.trim() || note;
    }

    // Format B: "Claimed by user@domain.com" or "Claimed by <uuid>"
    const claimMatch = note.match(/Claimed by\s+([^|\s]+)/i);
    if (claimMatch) {
      const claimant = claimMatch[1].trim();
      if (claimant.includes('@')) {
        claimedEmail = claimant;
      } else if (userMap[claimant]) {
        claimedEmail = userMap[claimant];
      } else {
        claimedEmail = claimant;
      }
      cleanNote = note.replace(/\|\s*Claimed by.*$/i, '').replace(/Claimed by.*$/i, '').trim();
    }

    // Format C: Direct email anywhere in note if not matched
    if (!claimedEmail) {
      const emailMatch = note.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (emailMatch) {
        claimedEmail = emailMatch[1];
      }
    }

    return {
      claimedEmail,
      displayNote: cleanNote || '—'
    };
  };

  // Helper to determine license expiration, activation status, and reverse countdown
  const getLicenseExpiryInfo = (lic) => {
    if (lic.is_lifetime) {
      return {
        isExpired: false,
        isActivated: true,
        badgeText: 'LIFETIME',
        badgeColor: '#c084fc',
        badgeBg: 'rgba(168, 85, 247, 0.15)',
        badgeBorder: 'rgba(168, 85, 247, 0.3)',
        remainingText: 'Permanent'
      };
    }

    if (lic.status === 'banned') {
      return {
        isExpired: false,
        isActivated: false,
        badgeText: 'BANNED',
        badgeColor: '#f87171',
        badgeBg: 'rgba(239, 68, 68, 0.15)',
        badgeBorder: 'rgba(239, 68, 68, 0.3)',
        remainingText: 'Revoked'
      };
    }

    const durationDays = Number(lic.duration_days) || 0;
    if (durationDays <= 0) {
      return {
        isExpired: false,
        isActivated: true,
        badgeText: 'ACTIVE',
        badgeColor: '#34d399',
        badgeBg: 'rgba(16, 185, 129, 0.15)',
        badgeBorder: 'rgba(16, 185, 129, 0.3)',
        remainingText: 'Active'
      };
    }

    // CRITICAL: Countdown only begins AFTER HWID registration / activation!
    // If not yet bound to a hardware ID, the key does NOT expire and countdown has not started.
    const isBound = !!(lic.hwid && String(lic.hwid).trim());
    const isActivated = !!(lic.activated_at || isBound);

    if (!isActivated) {
      return {
        isExpired: false,
        isActivated: false,
        badgeText: 'READY',
        badgeColor: '#38bdf8', // Vibrant Sky / Cyan
        badgeBg: 'rgba(56, 189, 248, 0.12)',
        badgeBorder: 'rgba(56, 189, 248, 0.3)',
        remainingText: `${durationDays}d (Starts on 1st login)`
      };
    }

    // Key has registered a HWID. Expiration is calculated from activated_at (or expires_at if set)
    let expiresTime = null;
    if (lic.expires_at) {
      expiresTime = new Date(lic.expires_at).getTime();
    } else {
      const baseDateStr = lic.activated_at || lic.created_at;
      const baseTime = new Date(baseDateStr).getTime();
      if (!isNaN(baseTime)) {
        expiresTime = baseTime + durationDays * 24 * 60 * 60 * 1000;
      }
    }

    if (!expiresTime || isNaN(expiresTime)) {
      return {
        isExpired: false,
        isActivated: true,
        badgeText: 'ACTIVE',
        badgeColor: '#34d399',
        badgeBg: 'rgba(16, 185, 129, 0.15)',
        badgeBorder: 'rgba(16, 185, 129, 0.3)',
        remainingText: `${durationDays} Days`
      };
    }

    const now = Date.now();
    const isExpired = now > expiresTime;

    if (isExpired) {
      const daysAgo = Math.floor((now - expiresTime) / (24 * 60 * 60 * 1000));
      const hoursAgo = Math.floor((now - expiresTime) / (60 * 60 * 1000));
      const expiredAgoText = daysAgo > 0 ? `${daysAgo}d ago` : `${hoursAgo}h ago`;

      return {
        isExpired: true,
        isActivated: true,
        badgeText: 'EXPIRED',
        badgeColor: '#fb7185',
        badgeBg: 'rgba(244, 63, 94, 0.15)',
        badgeBorder: 'rgba(244, 63, 94, 0.3)',
        remainingText: `Expired ${expiredAgoText}`
      };
    }

    // Active Reverse Countdown
    const remainingMs = expiresTime - now;
    const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
    const remainingDays = Math.floor(remainingHours / 24);
    const remHoursInDay = remainingHours % 24;

    let remainingText = '';
    if (remainingDays > 0) {
      remainingText = `${remainingDays}d ${remHoursInDay}h left`;
    } else if (remainingHours > 1) {
      remainingText = `${remainingHours}h left`;
    } else {
      const remainingMinutes = Math.max(1, Math.ceil(remainingMs / (60 * 1000)));
      remainingText = `${remainingMinutes}m left`;
    }

    return {
      isExpired: false,
      isActivated: true,
      badgeText: 'ACTIVE',
      badgeColor: '#34d399',
      badgeBg: 'rgba(16, 185, 129, 0.15)',
      badgeBorder: 'rgba(16, 185, 129, 0.3)',
      remainingText
    };
  };

  // Filtered Licenses
  const filteredLicenses = useMemo(() => {
    return licenses.filter(lic => {
      const expiryInfo = getLicenseExpiryInfo(lic);
      const claimInfo = parseLicenseClaimInfo(lic);

      const matchesQuery =
        lic.license_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (claimInfo.claimedEmail && claimInfo.claimedEmail.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (claimInfo.displayNote && claimInfo.displayNote.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (lic.hwid && lic.hwid.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (searchQuery.toLowerCase() === 'expired' && expiryInfo.isExpired) ||
        (searchQuery.toLowerCase() === 'ready' && !expiryInfo.isActivated && !expiryInfo.isExpired);

      if (!matchesQuery) return false;

      if (statusFilter === 'all') return true;
      if (statusFilter === 'active') return !expiryInfo.isExpired && lic.status !== 'banned';
      if (statusFilter === 'ready') return !expiryInfo.isActivated && !expiryInfo.isExpired && !lic.is_lifetime && lic.status !== 'banned';
      if (statusFilter === 'expired') return expiryInfo.isExpired;
      if (statusFilter === 'bound') return !!lic.hwid;
      if (statusFilter === 'unbound') return !lic.hwid;
      if (statusFilter === 'banned') return lic.status === 'banned';
      return true;
    });
  }, [licenses, searchQuery, statusFilter, userMap]);

  const activeBoundCount = licenses.filter(l => l.hwid).length;
  const lifetimeCount = licenses.filter(l => l.is_lifetime).length;
  const expiredCount = licenses.filter(l => getLicenseExpiryInfo(l).isExpired).length;
  const readyCount = licenses.filter(l => {
    const info = getLicenseExpiryInfo(l);
    return !info.isExpired && !info.isActivated && !l.is_lifetime && l.status !== 'banned';
  }).length;

  /* ─── Animation Variants ─── */
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }
  };

  const tableRowVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0 }
  };

  return (
    <motion.div
      initial={{ opacity: 0, filter: 'blur(10px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      style={{ minHeight: '100vh', background: '#050609', padding: '1.25rem 1.5rem 3.5rem', position: 'relative' }}
      className="dashboard-container"
    >
      {/* Background ambient glow */}
      <motion.div
        className="bg-glow"
        animate={{ opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        style={{ top: '-15%' }}
      />

      {/* Floating Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            style={{
              position: 'fixed',
              top: '20px',
              right: '20px',
              zIndex: 250,
              background: 'rgba(12, 16, 26, 0.95)',
              border: '1px solid rgba(0, 136, 255, 0.4)',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 136, 255, 0.25)',
              borderRadius: '12px',
              padding: '0.75rem 1.15rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              color: '#ffffff',
              backdropFilter: 'blur(20px)'
            }}
          >
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.4 }}>
              <CheckCircle2 size={16} color="#00f0ff" />
            </motion.div>
            <span style={{ fontSize: '0.86rem', fontWeight: 500 }}>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{ maxWidth: '1360px', margin: '0 auto' }}
      >
        {/* =========================================================================
            COMMAND CENTER TOP BAR
           ========================================================================= */}
        <motion.header
          variants={itemVariants}
          style={{
            background: 'rgba(11, 14, 22, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '1rem 1.5rem',
            backdropFilter: 'blur(24px)',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <Link to="/" style={{ display: 'flex', alignItems: 'center' }}>
              <motion.div
                whileHover={{ scale: 1.1, rotate: 10 }}
                whileTap={{ scale: 0.9 }}
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, rgba(0, 136, 255, 0.25) 0%, rgba(0, 240, 255, 0.1) 100%)',
                  border: '1px solid rgba(0, 136, 255, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 15px rgba(0, 136, 255, 0.25)'
                }}
              >
                <img src="/logo-diamond.png" alt="LEGIT Diamond" style={{ width: '24px', height: 'auto' }} />
              </motion.div>
            </Link>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, fontFamily: 'Space Grotesk' }}>
                  Command Center
                </h1>
                <motion.span
                  animate={{ boxShadow: ['0 0 5px rgba(0, 240, 255, 0.2)', '0 0 15px rgba(0, 240, 255, 0.5)', '0 0 5px rgba(0, 240, 255, 0.2)'] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{
                    background: 'rgba(0, 136, 255, 0.15)',
                    border: '1px solid rgba(0, 240, 255, 0.3)',
                    color: '#00f0ff',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '5px',
                    letterSpacing: '0.4px'
                  }}
                >
                  ADMIN
                </motion.span>
              </div>
              <p className="text-muted" style={{ fontSize: '0.78rem', margin: 0 }}>
                HWID License Management & Real-Time Driver Matrix
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link to="/" className="btn btn-outline" style={{ padding: '0.5rem 0.95rem', fontSize: '0.82rem' }}>
                <ExternalLink size={14} /> Public Portal
              </Link>
            </motion.div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '5px 12px',
                background: 'rgba(255, 255, 255, 0.04)',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}
            >
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'linear-gradient(135deg, #0088ff, #00f0ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.75rem', color: '#fff' }}>
                {user?.email ? user.email.charAt(0).toUpperCase() : 'A'}
              </div>
              <span style={{ fontSize: '0.82rem', color: '#e4e4e7', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email || 'admin@legit.gg'}
              </span>
            </div>

            <motion.button
              whileHover={{ scale: 1.05, backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { signOut(); navigate('/login'); }}
              className="btn btn-outline"
              style={{ padding: '0.5rem 0.9rem', fontSize: '0.82rem', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#f87171' }}
              title="Sign Out"
            >
              <LogOut size={14} /> Logout
            </motion.button>
          </div>
        </motion.header>

        {/* =========================================================================
            TOP STATS & METRICS (5 CARDS)
           ========================================================================= */}
        <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5" style={{ marginBottom: '1.5rem' }}>
          <motion.div whileHover={{ y: -5 }} className="card" style={{ padding: '1.15rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(0, 136, 255, 0.15)', border: '1px solid rgba(0, 136, 255, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              <Key size={19} color="#0088ff" />
            </motion.div>
            <div>
              <p className="text-muted" style={{ fontSize: '0.74rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', margin: 0 }}>Total Keys</p>
              <motion.h2
                key={licenses.length}
                initial={{ scale: 1.2, color: '#0088ff' }}
                animate={{ scale: 1, color: '#fff' }}
                style={{ fontSize: '1.65rem', fontWeight: 800, margin: 0, lineHeight: 1.2 }}
              >
                {licenses.length}
              </motion.h2>
            </div>
          </motion.div>

          <motion.div whileHover={{ y: -5 }} className="card" style={{ padding: '1.15rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
              style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(0, 240, 255, 0.15)', border: '1px solid rgba(0, 240, 255, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              <Users size={19} color="#00f0ff" />
            </motion.div>
            <div>
              <p className="text-muted" style={{ fontSize: '0.74rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', margin: 0 }}>Active Machines</p>
              <motion.h2
                key={activeBoundCount}
                initial={{ scale: 1.2, color: '#ffffff' }}
                animate={{ scale: 1, color: '#00f0ff' }}
                style={{ fontSize: '1.65rem', fontWeight: 800, margin: 0, lineHeight: 1.2 }}
              >
                {activeBoundCount}
              </motion.h2>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ y: -5 }}
            className="card"
            style={{
              padding: '1.15rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem',
              border: expiredCount > 0 ? '1px solid rgba(244, 63, 94, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)'
            }}
          >
            <motion.div
              animate={{ rotate: [0, 8, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: expiredCount > 0 ? 'rgba(244, 63, 94, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                border: expiredCount > 0 ? '1px solid rgba(244, 63, 94, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Clock size={19} color={expiredCount > 0 ? '#fb7185' : '#71717a'} />
            </motion.div>
            <div>
              <p className="text-muted" style={{ fontSize: '0.74rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', margin: 0 }}>Expired Keys</p>
              <motion.h2
                key={expiredCount}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                style={{
                  fontSize: '1.65rem',
                  fontWeight: 800,
                  margin: 0,
                  lineHeight: 1.2,
                  color: expiredCount > 0 ? '#fb7185' : '#a1a1aa'
                }}
              >
                {expiredCount}
              </motion.h2>
            </div>
          </motion.div>

          <motion.div whileHover={{ y: -5 }} className="card" style={{ padding: '1.15rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
              style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              <Sparkles size={19} color="#c084fc" />
            </motion.div>
            <div>
              <p className="text-muted" style={{ fontSize: '0.74rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', margin: 0 }}>Lifetime Passes</p>
              <motion.h2
                key={lifetimeCount}
                initial={{ scale: 1.2, color: '#ffffff' }}
                animate={{ scale: 1, color: '#c084fc' }}
                style={{ fontSize: '1.65rem', fontWeight: 800, margin: 0, lineHeight: 1.2 }}
              >
                {lifetimeCount}
              </motion.h2>
            </div>
          </motion.div>

          <motion.div whileHover={{ y: -5 }} className="card" style={{ padding: '1.15rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1.6 }}
              style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              <Activity size={19} color="#10b981" />
            </motion.div>
            <div>
              <p className="text-muted" style={{ fontSize: '0.74rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', margin: 0 }}>Driver Service</p>
              <motion.h2
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, lineHeight: 1.2, color: '#10b981' }}
              >
                OPERATIONAL
              </motion.h2>
            </div>
          </motion.div>
        </motion.div>

        {/* =========================================================================
            WORKSPACE: KEY GENERATOR (LEFT) + DATABASE TABLE (RIGHT)
           ========================================================================= */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* LEFT: LICENSE GENERATOR */}
          <motion.div variants={itemVariants} className="card w-full lg:w-[350px] shrink-0" style={{ padding: '1.5rem', height: 'fit-content' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'rgba(0, 136, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={16} color="#0088ff" />
              </div>
              <h3 style={{ fontSize: '1.1rem', color: '#fff', margin: 0 }}>Issue New License</h3>
            </div>

            {/* Duration Presets */}
            <div style={{ marginBottom: '1.15rem' }}>
              <label className="form-label">Duration Preset</label>
              <div className="grid grid-cols-2 gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => { setNewKeyDuration(1); setIsLifetime(false); }}
                  style={{
                    padding: '7px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    background: newKeyDuration === 1 && !isLifetime ? 'rgba(0, 136, 255, 0.25)' : 'rgba(255, 255, 255, 0.02)',
                    color: newKeyDuration === 1 && !isLifetime ? '#00f0ff' : '#a1a1aa',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  1 Day (Trial)
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => { setNewKeyDuration(7); setIsLifetime(false); }}
                  style={{
                    padding: '7px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    background: newKeyDuration === 7 && !isLifetime ? 'rgba(0, 136, 255, 0.25)' : 'rgba(255, 255, 255, 0.02)',
                    color: newKeyDuration === 7 && !isLifetime ? '#00f0ff' : '#a1a1aa',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  7 Days (Weekly)
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => { setNewKeyDuration(30); setIsLifetime(false); }}
                  style={{
                    padding: '7px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    background: newKeyDuration === 30 && !isLifetime ? 'rgba(0, 136, 255, 0.25)' : 'rgba(255, 255, 255, 0.02)',
                    color: newKeyDuration === 30 && !isLifetime ? '#00f0ff' : '#a1a1aa',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  30 Days (Monthly)
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => { setIsLifetime(true); }}
                  style={{
                    padding: '7px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    background: isLifetime ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255, 255, 255, 0.02)',
                    color: isLifetime ? '#c084fc' : '#a1a1aa',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Permanent (Lifetime)
                </motion.button>
              </div>
            </div>

            <form onSubmit={handleCreateLicense}>
              <AnimatePresence mode="wait">
                {!isLifetime && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div className="form-group">
                      <label className="form-label">Duration in Days</label>
                      <input
                        type="number"
                        min="1"
                        max="999"
                        value={newKeyDuration}
                        onChange={(e) => setNewKeyDuration(Number(e.target.value))}
                        className="form-input"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="form-group">
                <label className="form-label">Key Prefix</label>
                <input
                  type="text"
                  maxLength="8"
                  value={keyPrefix}
                  onChange={(e) => setKeyPrefix(e.target.value.toUpperCase())}
                  placeholder="LEGIT"
                  className="form-input"
                  style={{ textTransform: 'uppercase' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Customer / Order Note</label>
                <input
                  type="text"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="e.g. Discord ID, Reseller Order"
                  className="form-input"
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.02, boxShadow: '0 8px 25px rgba(0, 136, 255, 0.4)' }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={generating}
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem' }}
              >
                {generating ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><RefreshCw size={15} className="animate-spin" /> Provisioning...</span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Sparkles size={15} /> Mint & Save License Key</span>
                )}
              </motion.button>
            </form>

            {/* Last Minted Key */}
            <AnimatePresence>
              {lastGeneratedKey && (
                <motion.div
                  initial={{ opacity: 0, y: 15, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  style={{
                    marginTop: '1.25rem',
                    padding: '0.9rem',
                    background: 'rgba(0, 136, 255, 0.1)',
                    borderRadius: '10px',
                    border: '1px solid rgba(0, 136, 255, 0.3)'
                  }}
                >
                  <div style={{ fontSize: '0.72rem', color: '#00f0ff', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                    Newly Minted Key
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>
                      {lastGeneratedKey}
                    </span>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleCopyKey(lastGeneratedKey)}
                      className="btn btn-outline"
                      style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                    >
                      {copiedKey === lastGeneratedKey ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* RIGHT: LICENSE DATABASE TABLE */}
          <motion.div variants={itemVariants} className="card flex-1 min-w-0" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            {/* Header Controls */}
            <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', color: '#fff', margin: 0 }}>License Database Matrix</h3>
                <p className="text-muted" style={{ fontSize: '0.78rem', margin: 0 }}>
                  Showing {filteredLicenses.length} of {licenses.length} recorded licenses
                </p>
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={fetchLicenses}
                className="btn btn-outline"
                style={{ padding: '0.45rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                title="Refresh table"
              >
                <motion.div animate={loading ? { rotate: 360 } : {}} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <RefreshCw size={13} />
                </motion.div>
                Refresh
              </motion.button>
            </div>

            {/* Search and Status Pills */}
            <div style={{ display: 'flex', flexDirection: 'row', gap: '0.625rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                <Search size={15} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: '11px', color: '#71717a' }} />
                <input
                  type="text"
                  placeholder="Filter key, HWID, or notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '2.2rem', height: '38px', fontSize: '0.84rem' }}
                />
              </div>

              {/* Status Pill Filters */}
              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  background: 'rgba(5, 7, 12, 0.7)',
                  padding: '6px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  flexWrap: 'wrap',
                  alignItems: 'center'
                }}
              >
                {['all', 'active', 'ready', 'expired', 'bound', 'unbound', 'banned'].map((status) => (
                  <motion.button
                    key={status}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      background: statusFilter === status
                        ? (status === 'expired'
                            ? 'rgba(244, 63, 94, 0.25)'
                            : status === 'ready'
                            ? 'rgba(56, 189, 248, 0.25)'
                            : 'rgba(0, 136, 255, 0.25)')
                        : 'transparent',
                      color: statusFilter === status
                        ? (status === 'expired'
                            ? '#fb7185'
                            : status === 'ready'
                            ? '#38bdf8'
                            : '#fff')
                        : '#8e92a4',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      transition: 'background 0.2s ease, color 0.2s ease'
                    }}
                  >
                    {status === 'ready' ? `Ready (${readyCount})` : status}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Table Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {loading ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3.5rem 0' }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    style={{ display: 'inline-block', marginBottom: '0.75rem' }}
                  >
                    <RefreshCw size={24} color="#0088ff" />
                  </motion.div>
                  <p className="text-muted" style={{ fontSize: '0.85rem' }}>Loading secure database...</p>
                </div>
              ) : filteredLicenses.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3.5rem 0', color: '#71717a', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '10px' }}
                >
                  <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>No licenses found matching your filters.</p>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
                    className="btn btn-outline"
                    style={{ fontSize: '0.75rem', padding: '3px 10px' }}
                  >
                    Clear Filters
                  </motion.button>
                </motion.div>
              ) : (
                <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.06)', flex: 1, paddingBottom: '0.5rem' }}>
                  <table style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid rgba(255, 255, 255, 0.07)' }}>
                        <th style={{ padding: '0.85rem', color: '#71717a', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600, width: '25%' }}>License Key</th>
                        <th style={{ padding: '0.85rem', color: '#71717a', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600, width: '9%' }}>Tier</th>
                        <th style={{ padding: '0.85rem', color: '#71717a', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600, width: '14%' }}>Status</th>
                        <th style={{ padding: '0.85rem', color: '#71717a', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600, width: '22%' }}>Claimed User</th>
                        <th style={{ padding: '0.85rem', color: '#71717a', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600, width: '12%' }}>HWID</th>
                        <th style={{ padding: '0.85rem', color: '#71717a', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600, width: '9%' }}>Note</th>
                        <th style={{ padding: '0.85rem', color: '#71717a', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600, textAlign: 'right', width: '9%' }}>Actions</th>
                      </tr>
                    </thead>
                    <motion.tbody
                      initial="hidden"
                      animate="visible"
                      variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
                    >
                      <AnimatePresence>
                        {filteredLicenses.map((lic) => {
                          const isBound = !!lic.hwid;
                          const isBanned = lic.status === 'banned';
                          const expiryInfo = getLicenseExpiryInfo(lic);
                          const claimInfo = parseLicenseClaimInfo(lic);

                          return (
                            <motion.tr
                              key={lic.id}
                              variants={tableRowVariants}
                              layout
                              exit={{ opacity: 0, x: 20, transition: { duration: 0.2 } }}
                              style={{
                                borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                                background: expiryInfo.isExpired ? 'rgba(244, 63, 94, 0.02)' : 'transparent'
                              }}
                            >
                              {/* Key with Copy */}
                              <td style={{ padding: '0.85rem', verticalAlign: 'middle' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}>
                                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#ffffff', fontSize: '0.86rem', letterSpacing: '0.3px' }}>
                                    {lic.license_key}
                                  </span>
                                  <motion.button
                                    whileHover={{ scale: 1.15, color: '#fff' }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => handleCopyKey(lic.license_key)}
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#71717a', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    title="Copy Key"
                                  >
                                    {copiedKey === lic.license_key ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                                  </motion.button>
                                </div>
                              </td>

                              {/* Tier */}
                              <td style={{ padding: '0.85rem', fontSize: '0.84rem', color: '#d4d4d8', verticalAlign: 'middle' }}>
                                {lic.is_lifetime ? (
                                  <span style={{ color: '#c084fc', fontWeight: 600 }}>Lifetime</span>
                                ) : (
                                  <span>{lic.duration_days} Days</span>
                                )}
                              </td>

                              {/* Status with Expiry indicators */}
                              <td style={{ padding: '0.85rem', verticalAlign: 'middle' }}>
                                <div>
                                  <motion.span
                                    layout
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.3rem',
                                      padding: '3px 8px',
                                      borderRadius: '6px',
                                      fontSize: '0.72rem',
                                      fontWeight: 800,
                                      background: expiryInfo.badgeBg,
                                      color: expiryInfo.badgeColor,
                                      border: expiryInfo.badgeBorder ? `1px solid ${expiryInfo.badgeBorder}` : 'none',
                                      transition: 'background 0.3s ease, color 0.3s ease'
                                    }}
                                  >
                                    {expiryInfo.isExpired ? (
                                      <Clock size={11} />
                                    ) : !expiryInfo.isActivated && !lic.is_lifetime && !isBanned ? (
                                      <Sparkles size={11} />
                                    ) : isBound && !isBanned ? (
                                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 5px #10b981' }} />
                                    ) : null}
                                    {expiryInfo.badgeText}
                                  </motion.span>
                                  <div style={{ fontSize: '0.71rem', color: expiryInfo.isExpired ? '#fb7185' : (!expiryInfo.isActivated ? '#38bdf8' : '#71717a'), marginTop: '3px', fontWeight: 500 }}>
                                    {expiryInfo.remainingText}
                                  </div>
                                </div>
                              </td>

                              {/* Claimed User (Gmail) */}
                              <td style={{ padding: '0.85rem', verticalAlign: 'middle' }}>
                                {claimInfo.claimedEmail ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', whiteSpace: 'nowrap' }}>
                                    <div
                                      style={{
                                        width: '22px',
                                        height: '22px',
                                        borderRadius: '6px',
                                        background: 'rgba(0, 136, 255, 0.15)',
                                        border: '1px solid rgba(0, 240, 255, 0.3)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                      }}
                                    >
                                      <Mail size={12} color="#00f0ff" />
                                    </div>
                                    <span
                                      style={{
                                        color: '#00f0ff',
                                        fontSize: '0.81rem',
                                        fontWeight: 600,
                                        maxWidth: '170px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                      }}
                                      title={claimInfo.claimedEmail}
                                    >
                                      {claimInfo.claimedEmail}
                                    </span>
                                    <motion.button
                                      whileHover={{ scale: 1.15, color: '#fff' }}
                                      whileTap={{ scale: 0.9 }}
                                      onClick={() => handleCopyKey(claimInfo.claimedEmail)}
                                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#71717a', padding: '2px', display: 'flex', alignItems: 'center' }}
                                      title="Copy Email"
                                    >
                                      {copiedKey === claimInfo.claimedEmail ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                                    </motion.button>
                                  </div>
                                ) : (
                                  <span style={{ color: '#52525b', fontStyle: 'italic', fontSize: '0.8rem' }}>Unclaimed</span>
                                )}
                              </td>

                              {/* HWID */}
                              <td style={{ padding: '0.85rem', fontSize: '0.84rem', verticalAlign: 'middle' }}>
                                {isBound ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} title={lic.hwid}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00f0ff', boxShadow: '0 0 6px #00f0ff' }} />
                                    <span style={{ fontFamily: 'monospace', color: '#00f0ff', fontSize: '0.82rem' }}>
                                      {lic.hwid.substring(0, 8)}...
                                    </span>
                                  </div>
                                ) : (
                                  <span style={{ color: '#71717a', fontStyle: 'italic', fontSize: '0.82rem' }}>Unbound</span>
                                )}
                              </td>

                              {/* Clean Note */}
                              <td style={{ padding: '0.85rem', fontSize: '0.84rem', color: '#a1a1aa', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }} title={claimInfo.displayNote}>
                                {claimInfo.displayNote}
                              </td>

                              {/* Actions */}
                              <td style={{ padding: '0.85rem', textAlign: 'right', verticalAlign: 'middle' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                  <AnimatePresence>
                                    {isBound && (
                                      <motion.button
                                        initial={{ opacity: 0, scale: 0.5 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.5 }}
                                        whileHover={{ scale: 1.15, backgroundColor: 'rgba(255,255,255,0.05)' }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => handleResetHWID(lic.id, lic.license_key)}
                                        className="btn btn-outline"
                                        style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        title="Unbind Hardware ID"
                                      >
                                        <Unlock size={14} />
                                      </motion.button>
                                    )}
                                  </AnimatePresence>

                                  <motion.button
                                    whileHover={{ scale: 1.15, backgroundColor: isBanned ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)' }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => handleToggleBan(lic.id, lic.status)}
                                    className="btn btn-outline"
                                    style={{
                                      width: '32px',
                                      height: '32px',
                                      padding: 0,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: isBanned ? '#10b981' : '#f59e0b',
                                      borderColor: isBanned ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)',
                                      transition: 'all 0.3s ease'
                                    }}
                                    title={isBanned ? 'Unban key' : 'Ban key'}
                                  >
                                    {isBanned ? <Check size={14} /> : <Ban size={14} />}
                                  </motion.button>

                                  <motion.button
                                    whileHover={{ scale: 1.15, backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => setConfirmDeleteId(lic.id)}
                                    className="btn btn-outline"
                                    style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                                    title="Delete key"
                                  >
                                    <Trash2 size={14} />
                                  </motion.button>
                                </div>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    </motion.tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {confirmDeleteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 300,
              padding: '1rem'
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="card"
              style={{ maxWidth: '380px', width: '100%', padding: '1.75rem', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}
            >
              <motion.div
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ duration: 0.5, delay: 0.2 }}
                style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}
              >
                <AlertTriangle size={24} color="#ef4444" />
              </motion.div>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '0.4rem', color: '#fff' }}>Revoke License?</h3>
              <p className="text-muted" style={{ fontSize: '0.84rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                Are you sure you want to permanently delete this key? The machine bound to it will be immediately denied access.
              </p>
              <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'center' }}>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setConfirmDeleteId(null)}
                  className="btn btn-outline"
                  style={{ flex: 1, padding: '0.65rem' }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleDeleteLicense}
                  className="btn"
                  style={{ flex: 1, background: '#ef4444', color: '#fff', padding: '0.65rem' }}
                >
                  Revoke Key
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
