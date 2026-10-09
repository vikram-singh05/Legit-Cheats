import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Key, Users, Activity, Trash2, Plus, LogOut, RefreshCw, Copy, Check,
  Search, Shield, AlertTriangle, ExternalLink, Sparkles, Ban,
  Unlock, CheckCircle2, ChevronRight, X
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, profile, isAdmin, signOut } = useAuth();

  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'bound' | 'unbound' | 'banned'
  
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
    // Optimistic UI Update
    setLicenses(licenses.map(l => l.id === id ? { ...l, hwid: null, activated_at: null } : l));
    showToast(`HWID unbind cleared for ${licenseKey}`);
    
    try {
      const { error } = await supabase
        .from('licenses')
        .update({ hwid: null, activated_at: null })
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

  // Filtered Licenses
  const filteredLicenses = useMemo(() => {
    return licenses.filter(lic => {
      const matchesQuery =
        lic.license_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (lic.note && lic.note.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (lic.hwid && lic.hwid.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesQuery) return false;

      if (statusFilter === 'all') return true;
      if (statusFilter === 'active') return lic.status === 'active';
      if (statusFilter === 'bound') return !!lic.hwid;
      if (statusFilter === 'unbound') return !lic.hwid;
      if (statusFilter === 'banned') return lic.status === 'banned';
      return true;
    });
  }, [licenses, searchQuery, statusFilter]);

  const activeBoundCount = licenses.filter(l => l.hwid).length;
  const lifetimeCount = licenses.filter(l => l.is_lifetime).length;

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
            TOP STATS & METRICS (4 CARDS)
           ========================================================================= */}
        <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-4" style={{ marginBottom: '1.5rem' }}>
          <motion.div whileHover={{ y: -5 }} className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(0, 136, 255, 0.15)', border: '1px solid rgba(0, 136, 255, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Key size={20} color="#0088ff" />
            </motion.div>
            <div>
              <p className="text-muted" style={{ fontSize: '0.76rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', margin: 0 }}>Total Issued Keys</p>
              <motion.h2
                key={licenses.length}
                initial={{ scale: 1.2, color: '#0088ff' }}
                animate={{ scale: 1, color: '#fff' }}
                style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, lineHeight: 1.2 }}
              >
                {licenses.length}
              </motion.h2>
            </div>
          </motion.div>

          <motion.div whileHover={{ y: -5 }} className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
              style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(0, 240, 255, 0.15)', border: '1px solid rgba(0, 240, 255, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Users size={20} color="#00f0ff" />
            </motion.div>
            <div>
              <p className="text-muted" style={{ fontSize: '0.76rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', margin: 0 }}>Active Machines</p>
              <motion.h2
                key={activeBoundCount}
                initial={{ scale: 1.2, color: '#ffffff' }}
                animate={{ scale: 1, color: '#00f0ff' }}
                style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, lineHeight: 1.2 }}
              >
                {activeBoundCount}
              </motion.h2>
            </div>
          </motion.div>

          <motion.div whileHover={{ y: -5 }} className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Sparkles size={20} color="#c084fc" />
            </motion.div>
            <div>
              <p className="text-muted" style={{ fontSize: '0.76rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', margin: 0 }}>Lifetime Passes</p>
              <motion.h2
                key={lifetimeCount}
                initial={{ scale: 1.2, color: '#ffffff' }}
                animate={{ scale: 1, color: '#c084fc' }}
                style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, lineHeight: 1.2 }}
              >
                {lifetimeCount}
              </motion.h2>
            </div>
          </motion.div>

          <motion.div whileHover={{ y: -5 }} className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
              style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Activity size={20} color="#10b981" />
            </motion.div>
            <div>
              <p className="text-muted" style={{ fontSize: '0.76rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', margin: 0 }}>Driver Service</p>
              <motion.h2
                animate={{ opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, lineHeight: 1.2, color: '#10b981' }}
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
                {['all', 'active', 'bound', 'unbound', 'banned'].map((status) => (
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
                      background: statusFilter === status ? 'rgba(0, 136, 255, 0.25)' : 'transparent',
                      color: statusFilter === status ? '#fff' : '#8e92a4',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      transition: 'background 0.2s ease, color 0.2s ease'
                    }}
                  >
                    {status}
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
                  <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid rgba(255, 255, 255, 0.07)' }}>
                        <th style={{ padding: '0.85rem', color: '#71717a', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600, width: '32%' }}>License Key</th>
                        <th style={{ padding: '0.85rem', color: '#71717a', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600, width: '10%' }}>Tier</th>
                        <th style={{ padding: '0.85rem', color: '#71717a', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600, width: '10%' }}>Status</th>
                        <th style={{ padding: '0.85rem', color: '#71717a', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600, width: '16%' }}>HWID</th>
                        <th style={{ padding: '0.85rem', color: '#71717a', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600, width: '17%' }}>Note</th>
                        <th style={{ padding: '0.85rem', color: '#71717a', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 600, textAlign: 'right', width: '15%' }}>Actions</th>
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

                          return (
                            <motion.tr
                              key={lic.id}
                              variants={tableRowVariants}
                              layout
                              exit={{ opacity: 0, x: 20, transition: { duration: 0.2 } }}
                              style={{
                                borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
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

                              {/* Status */}
                              <td style={{ padding: '0.85rem', verticalAlign: 'middle' }}>
                                <motion.span
                                  layout
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    padding: '3px 9px',
                                    borderRadius: '6px',
                                    fontSize: '0.72rem',
                                    fontWeight: 800,
                                    background: isBanned
                                      ? 'rgba(239, 68, 68, 0.15)'
                                      : lic.status === 'active'
                                      ? 'rgba(16, 185, 129, 0.15)'
                                      : 'rgba(255, 255, 255, 0.08)',
                                    color: isBanned
                                      ? '#f87171'
                                      : lic.status === 'active'
                                      ? '#34d399'
                                      : '#a1a1aa',
                                    transition: 'background 0.3s ease, color 0.3s ease'
                                  }}
                                >
                                  {lic.status.toUpperCase()}
                                </motion.span>
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

                              {/* Note */}
                              <td style={{ padding: '0.85rem', fontSize: '0.84rem', color: '#a1a1aa', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                                {lic.note || '—'}
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
