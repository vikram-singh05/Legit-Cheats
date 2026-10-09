import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import {
  Crosshair, Shield, Cpu, Code2, Zap, Lock, Eye, Monitor,
  Gauge, Radio, Sliders, ChevronDown, Check, Sparkles, Terminal,
  Compass, ArrowRight, Layers, Flame, RefreshCw, Server
} from 'lucide-react';

/* ─── Reusable Animated Section Wrapper ─── */
function AnimatedSection({ children, className, style, id, delay = 0 }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <motion.section
      ref={ref}
      id={id}
      className={className}
      style={style}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.section>
  );
}

/* ─── Animated Counter ─── */
function AnimatedCounter({ value, suffix = '', color }) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      whileInView={{ scale: 1, opacity: 1 }}
      viewport={{ once: true }}
      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      style={{ fontSize: '1.6rem', fontWeight: 800, color: color || '#fff', fontFamily: 'Space Grotesk' }}
    >
      {value}{suffix}
    </motion.div>
  );
}

const FEATURE_CATEGORIES = [
  { id: 'all', label: 'All Capabilities' },
  { id: 'aim', label: 'Aimbot & Prediction' },
  { id: 'visuals', label: 'Visuals & 3D ESP' },
  { id: 'security', label: 'Ring-0 Security' },
  { id: 'exploits', label: 'Movement & Utility' },
  { id: 'cloud', label: 'Cloud Sync' },
];

const FEATURES_DATA = [
  {
    category: 'aim',
    icon: <Crosshair size={22} />,
    title: 'Silent Vector Aimbot',
    badge: 'Precision',
    description: 'Sub-tick target calculation utilizing projectile trajectory extrapolation. Targets enemies without locking your camera on screen.'
  },
  {
    category: 'aim',
    icon: <Sliders size={22} />,
    title: 'Humanized Bezier Smoothing',
    badge: 'Undetected',
    description: 'Simulates organic human thumbstick and mouse motor physics with algorithmic micro-jitter, completely defeating server-side telemetry.'
  },
  {
    category: 'aim',
    icon: <Gauge size={22} />,
    title: 'Dynamic FOV & Bone Hierarchy',
    badge: 'Adaptive',
    description: 'Configurable field-of-view that scales with weapon magnification. Dynamic bone priority switches between Head, Neck, and Chest.'
  },
  {
    category: 'visuals',
    icon: <Eye size={22} />,
    title: 'Full 3D Skeleton & Box ESP',
    badge: 'DirectX 11',
    description: 'Hardware-accelerated skeletal bone rigging rendered directly in swapchain. Displays distance meters, weapon held, and health bars.'
  },
  {
    category: 'visuals',
    icon: <Layers size={22} />,
    title: 'Line-of-Sight Visibility Chams',
    badge: 'Culling',
    description: 'Smart visibility occlusion changes player colors dynamically (Emerald when visible, Crimson behind walls), eliminating false pre-firing.'
  },
  {
    category: 'visuals',
    icon: <Radio size={22} />,
    title: '2D Floating Tactical Radar',
    badge: 'Situational',
    description: 'Customizable mini-radar overlay showing 360-degree surrounding player coordinates, vehicle states, and relative elevation.'
  },
  {
    category: 'security',
    icon: <Cpu size={22} />,
    title: 'Ring-0 Hypervisor Driver',
    badge: 'Hypervisor',
    description: 'Operates inside CPU virtualization ring-0 with page-table isolation. Never creates system threads or opens detectable process handles.'
  },
  {
    category: 'security',
    icon: <Monitor size={22} />,
    title: '100% OBS & Discord Streamproof',
    badge: 'Stealth',
    description: 'DirectX hooks bypass window compositors completely. Stream to Discord, Twitch, Medal, or Shadowplay with zero overlay visible.'
  },
  {
    category: 'security',
    icon: <Shield size={22} />,
    title: 'Polymorphic Binary Mutation',
    badge: 'Anti-Sig',
    description: 'Every client build downloaded from the platform is compiled with unique junk instructions and control flow flattening to defeat hash scanners.'
  },
  {
    category: 'exploits',
    icon: <Flame size={22} />,
    title: 'Recoil & Spread Nullifier',
    badge: 'Ballistics',
    description: 'Percentage-based recoil slider from 0% to 100%. Eliminates camera shake and kickback while preserving authentic discharge animations.'
  },
  {
    category: 'exploits',
    icon: <Compass size={22} />,
    title: 'Vehicle & Handling Multipliers',
    badge: 'Physics',
    description: 'Engine torque boosts, instantaneous vehicle repair, drift assists, and suspension tuning engineered for high-speed getaways.'
  },
  {
    category: 'cloud',
    icon: <Zap size={22} />,
    title: 'Cloud Presets & Instant Hotkeys',
    badge: 'Cloud Sync',
    description: 'Store up to 25 weapon loadouts in the cloud. Switch profiles on the fly with custom hotkeys or share configuration codes with teammates.'
  },
];

const PRICING_PLANS = [
  {
    name: '1-Day Access',
    price: '$4.99',
    period: '24 Hours',
    badge: null,
    popular: false,
    features: [
      'Full Kernel Aimbot & ESP Suite',
      'OBS & Discord Streamproof Guard',
      'Instant Automated Key Delivery',
      '1 Concurrent PC Hardware Binding',
      'Community Discord Support'
    ]
  },
  {
    name: '7-Day Pass',
    price: '$14.99',
    period: '1 Week',
    badge: null,
    popular: false,
    features: [
      'All 1-Day Features Included',
      'Priority Kernel Driver Updates',
      '1 Free HWID Reset Allowance',
      'Cloud Config Profile Sync',
      'Standard Support Ticket Priority'
    ]
  },
  {
    name: '30-Day Pro',
    price: '$29.99',
    period: '1 Month',
    badge: 'MOST POPULAR',
    popular: true,
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
    name: 'Lifetime Elite',
    price: '$89.99',
    period: 'Permanent Access',
    badge: 'BEST VALUE',
    popular: false,
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

const FAQS = [
  {
    q: 'How fast is delivery after acquiring a license key?',
    a: 'Key delivery is 100% automated. The instant your transaction completes or an admin generates your key, your license key is displayed and ready to activate.'
  },
  {
    q: 'Is LEGIT truly 100% streamproof on OBS, Discord, and Medal?',
    a: 'Yes. Our DirectX overlay hooks directly into the graphics presentation pipeline before capture compositors read the frame. Your stream viewers will only ever see clean vanilla gameplay.'
  },
  {
    q: 'What Windows versions and hardware are supported?',
    a: 'We support Windows 10 (all builds 1909 to 22H2) and Windows 11 (21H2, 22H2, 23H2, 24H2). Both Intel and AMD CPUs are fully supported without disabling Hyper-V.'
  },
  {
    q: 'What happens if I change or upgrade my computer hardware?',
    a: 'Your license binds to your hardware upon first activation. If you upgrade components, your HWID can be quickly unbound directly from the admin command center.'
  },
  {
    q: 'How do software updates work when FiveM or GTA updates?',
    a: 'Our cloud hypervisor continuously monitors game memory offsets. When a game patch deploys, offsets update automatically in the cloud with zero client re-downloads.'
  }
];

/* ─── Stagger container & item variants ─── */
const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 }
  }
};

const staggerItem = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] }
  }
};

export default function PublicSite() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeFaq, setActiveFaq] = useState(null);

  // Live Interactive HUD Demo States
  const [demoAim, setDemoAim] = useState(true);
  const [demoEsp, setDemoEsp] = useState(true);
  const [demoStreamproof, setDemoStreamproof] = useState(true);
  const [demoFov, setDemoFov] = useState(90);

  const filteredFeatures = activeCategory === 'all'
    ? FEATURES_DATA
    : FEATURES_DATA.filter(f => f.category === activeCategory);

  return (
    <div className="public-site" style={{ overflowX: 'hidden' }}>
      {/* Ambient background glow */}
      <div className="bg-glow" />

      {/* =========================================================================
          HERO SECTION
         ========================================================================= */}
      <section
        style={{
          padding: '4rem 1.5rem 3.5rem',
          textAlign: 'center',
          position: 'relative'
        }}
      >
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          {/* Status Badge */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: -10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            style={{ marginBottom: '1.25rem', display: 'inline-block' }}
          >
            <div className="status-badge" style={{ padding: '0.45rem 1.1rem', gap: '0.55rem' }}>
              <span className="status-dot" />
              <span>UNDETECTED • KERNEL RING-0 • LIVE STATUS: 100% OPERATIONAL</span>
            </div>
          </motion.div>

          {/* Hero Main Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 25, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            style={{
              fontSize: 'clamp(2.5rem, 5.2vw, 4.25rem)',
              lineHeight: 1.12,
              fontWeight: 800,
              letterSpacing: '-0.035em',
              marginBottom: '1.25rem'
            }}
          >
            The Ultimate DLC for <br />
            <span className="text-gradient-primary">LEGIT CHEATS</span>
          </motion.h1>

          {/* Subtext */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="text-muted"
            style={{
              fontSize: 'clamp(1rem, 1.8vw, 1.2rem)',
              maxWidth: '640px',
              margin: '0 auto 2rem',
              lineHeight: 1.6
            }}
          >
            Engineered with hardware virtualization, sub-tick predictive vector aim, and 100% streamproof overlays. Dominate every server with absolute reliability.
          </motion.p>

          {/* Hero Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.875rem', flexWrap: 'wrap', marginBottom: '3rem' }}
          >
            <motion.a
              href="#products"
              className="btn btn-primary"
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97 }}
              style={{
                padding: '0.85rem 2.2rem',
                fontSize: '0.96rem',
                borderRadius: '12px',
                boxShadow: '0 8px 25px rgba(0, 136, 255, 0.4)'
              }}
            >
              <Sparkles size={16} />
              <span>Get Instant Access</span>
            </motion.a>

            <motion.a
              href="#features"
              className="btn btn-outline"
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97 }}
              style={{
                padding: '0.85rem 2rem',
                fontSize: '0.96rem',
                borderRadius: '12px'
              }}
            >
              <span>Explore 12+ Features</span>
              <ArrowRight size={16} />
            </motion.a>
          </motion.div>

          {/* Quick Metrics Bar */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.45 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
            style={{
              maxWidth: '860px',
              margin: '0 auto',
              background: 'rgba(10, 13, 20, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '1.25rem 1.75rem',
              backdropFilter: 'blur(20px)'
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <AnimatedCounter value="0" color="#fff" />
              <div className="text-muted" style={{ fontSize: '0.76rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Detections</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <AnimatedCounter value="< 0.4ms" color="#00f0ff" />
              <div className="text-muted" style={{ fontSize: '0.76rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Execution Latency</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <AnimatedCounter value="100%" color="#fff" />
              <div className="text-muted" style={{ fontSize: '0.76rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Streamproof (OBS)</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <AnimatedCounter value="Ring-0" color="#10b981" />
              <div className="text-muted" style={{ fontSize: '0.76rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Kernel Hypervisor</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* =========================================================================
          INTERACTIVE DEMO / TACTICAL HUD PREVIEW
         ========================================================================= */}
      <AnimatedSection
        className="section-spacing"
        style={{ background: 'rgba(7, 9, 14, 0.5)', borderTop: '1px solid rgba(255, 255, 255, 0.05)', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}
      >
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
            >
              <div className="status-badge status-badge-blue" style={{ marginBottom: '0.75rem' }}>
                <span>LIVE HUD INTERACTIVE SIMULATOR</span>
              </div>
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              style={{ fontSize: '2.1rem', marginBottom: '0.5rem' }}
            >
              Experience the Precision Control
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-muted"
              style={{ maxWidth: '560px', margin: '0 auto', fontSize: '0.92rem' }}
            >
              Test drive our overlay configurations with real-time reactive feedback.
            </motion.p>
          </div>

          <motion.div
            className="card"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            style={{
              padding: '2rem',
              maxWidth: '960px',
              margin: '0 auto',
              background: 'linear-gradient(180deg, rgba(13, 17, 26, 0.85) 0%, rgba(8, 10, 16, 0.95) 100%)',
              border: '1px solid rgba(0, 136, 255, 0.22)'
            }}
          >
            <div className="grid md:grid-cols-2 gap-6 items-stretch">
              {/* Simulator Viewport */}
              <div
                style={{
                  background: 'radial-gradient(circle at center, rgba(10, 24, 44, 0.75) 0%, #030407 100%)',
                  borderRadius: '14px',
                  border: '1px solid rgba(0, 240, 255, 0.25)',
                  minHeight: '360px',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {/* Crosshair Guides */}
                <div style={{ position: 'absolute', width: '100%', height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                <div style={{ position: 'absolute', height: '100%', width: '1px', background: 'rgba(255,255,255,0.06)' }} />

                {/* Animated FOV Circle */}
                {demoAim && (
                  <motion.div
                    animate={{ scale: [1, 1.025, 1], opacity: [0.65, 0.85, 0.65] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    style={{
                      width: `${demoFov * 1.8}px`,
                      height: `${demoFov * 1.8}px`,
                      borderRadius: '50%',
                      border: '1.5px dashed #00f0ff',
                      boxShadow: '0 0 15px rgba(0, 240, 255, 0.25)',
                      position: 'absolute',
                      pointerEvents: 'none'
                    }}
                  />
                )}

                {/* Target ESP Mock */}
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 5,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    pointerEvents: 'none'
                  }}
                >
                  <AnimatePresence>
                    {demoEsp && (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.8, opacity: 0, y: -10 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        style={{
                          border: '1.5px solid #00f0ff',
                          borderRadius: '6px',
                          padding: '10px 16px',
                          background: 'rgba(0, 240, 255, 0.08)',
                          boxShadow: '0 0 20px rgba(0, 240, 255, 0.25)',
                          textAlign: 'center',
                          marginBottom: '8px'
                        }}
                      >
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#00f0ff', fontFamily: 'monospace' }}>TARGET [54m]</div>
                        <div style={{ width: '42px', height: '4px', background: '#10b981', borderRadius: '2px', margin: '3px auto' }} />
                        <div style={{ fontSize: '0.68rem', color: '#10b981', fontFamily: 'monospace' }}>100 HP | 50 AP</div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Crosshair Center Point */}
                  <motion.div
                    animate={{
                      boxShadow: demoAim
                        ? ['0 0 5px #00f0ff', '0 0 15px #00f0ff', '0 0 5px #00f0ff']
                        : '0 0 0px transparent',
                    }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: demoAim ? '#00f0ff' : '#ffffff',
                    }}
                  />
                </div>

                {/* Overlay Badge */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '10px',
                    left: '12px',
                    fontSize: '0.7rem',
                    fontFamily: 'monospace',
                    color: '#71717a',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <span className="status-dot-blue" style={{ width: '5px', height: '5px' }} />
                  <span>DX11 SWAPCHAIN: 144 FPS • STREAMPROOF: {demoStreamproof ? 'ACTIVE' : 'OFF'}</span>
                </div>
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: '#fff' }}>Tactical HUD Controls</h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {/* Toggle: Aimbot */}
                    <motion.div
                      whileHover={{ scale: 1.015, x: 3 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => setDemoAim(!demoAim)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(255, 255, 255, 0.03)',
                        padding: '0.75rem 1rem',
                        borderRadius: '10px',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        cursor: 'pointer',
                        transition: 'border-color 0.3s ease'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem' }}>Silent Vector Aimbot</div>
                        <div className="text-muted" style={{ fontSize: '0.78rem' }}>Sub-tick angle prediction & smoothing</div>
                      </div>
                      <div
                        className="toggle-track"
                        style={{
                          width: '40px',
                          height: '22px',
                          borderRadius: '11px',
                          background: demoAim ? '#0088ff' : 'rgba(255,255,255,0.1)',
                          position: 'relative',
                          transition: 'all 0.25s ease',
                          flexShrink: 0
                        }}
                      >
                        <motion.div
                          animate={{ x: demoAim ? 20 : 2 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px' }}
                        />
                      </div>
                    </motion.div>

                    {/* Toggle: ESP */}
                    <motion.div
                      whileHover={{ scale: 1.015, x: 3 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => setDemoEsp(!demoEsp)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(255, 255, 255, 0.03)',
                        padding: '0.75rem 1rem',
                        borderRadius: '10px',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        cursor: 'pointer'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem' }}>3D Skeleton & Box ESP</div>
                        <div className="text-muted" style={{ fontSize: '0.78rem' }}>DirectX bone rigging and health indicators</div>
                      </div>
                      <div
                        className="toggle-track"
                        style={{
                          width: '40px',
                          height: '22px',
                          borderRadius: '11px',
                          background: demoEsp ? '#0088ff' : 'rgba(255,255,255,0.1)',
                          position: 'relative',
                          transition: 'all 0.25s ease',
                          flexShrink: 0
                        }}
                      >
                        <motion.div
                          animate={{ x: demoEsp ? 20 : 2 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px' }}
                        />
                      </div>
                    </motion.div>

                    {/* Toggle: Streamproof */}
                    <motion.div
                      whileHover={{ scale: 1.015, x: 3 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => setDemoStreamproof(!demoStreamproof)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'rgba(255, 255, 255, 0.03)',
                        padding: '0.75rem 1rem',
                        borderRadius: '10px',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        cursor: 'pointer'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem' }}>OBS Streamproof Guard</div>
                        <div className="text-muted" style={{ fontSize: '0.78rem' }}>Invisible to screen share and capture hooks</div>
                      </div>
                      <div
                        className="toggle-track"
                        style={{
                          width: '40px',
                          height: '22px',
                          borderRadius: '11px',
                          background: demoStreamproof ? '#10b981' : 'rgba(255,255,255,0.1)',
                          position: 'relative',
                          transition: 'all 0.25s ease',
                          flexShrink: 0
                        }}
                      >
                        <motion.div
                          animate={{ x: demoStreamproof ? 20 : 2 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px' }}
                        />
                      </div>
                    </motion.div>
                  </div>
                </div>

                {/* FOV Slider */}
                <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.375rem' }}>
                    <span className="text-muted" style={{ fontSize: '0.8rem' }}>Targeting FOV Radius</span>
                    <motion.span
                      key={demoFov}
                      initial={{ scale: 1.3, color: '#00f0ff' }}
                      animate={{ scale: 1, color: '#00f0ff' }}
                      transition={{ type: 'spring', stiffness: 300 }}
                      style={{ fontWeight: 600, fontSize: '0.85rem' }}
                    >
                      {demoFov}°
                    </motion.span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="150"
                    value={demoFov}
                    onChange={(e) => setDemoFov(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#0088ff', cursor: 'pointer' }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </AnimatedSection>

      {/* =========================================================================
          FEATURE GRID SECTION (ALL 12 CARDS)
         ========================================================================= */}
      <AnimatedSection id="features" className="section-spacing">
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              style={{ marginBottom: '0.75rem' }}
            >
              <div className="status-badge">
                <span>UNMATCHED ARSENAL</span>
              </div>
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              style={{ fontSize: 'clamp(2rem, 3.5vw, 3rem)', marginBottom: '0.75rem' }}
            >
              Engineered For <span className="text-gradient-primary">Dominance</span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-muted"
              style={{ maxWidth: '600px', margin: '0 auto 1.5rem', fontSize: '0.92rem' }}
            >
              Built in native C++ and Ring-0 kernel drivers with zero framerate impact.
            </motion.p>

            {/* Filter Pills */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              style={{
                display: 'inline-flex',
                flexWrap: 'wrap',
                gap: '6px',
                background: 'rgba(12, 15, 24, 0.75)',
                padding: '5px',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}
            >
              {FEATURE_CATEGORIES.map((cat) => (
                <motion.button
                  key={cat.id}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setActiveCategory(cat.id)}
                  style={{
                    padding: '6px 15px',
                    borderRadius: '10px',
                    border: 'none',
                    background: activeCategory === cat.id ? 'linear-gradient(135deg, #0088ff, #0055ff)' : 'transparent',
                    color: activeCategory === cat.id ? '#ffffff' : '#8e92a4',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.25s ease'
                  }}
                >
                  {cat.label}
                </motion.button>
              ))}
            </motion.div>
          </div>

          {/* Cards Grid */}
          <motion.div
            layout
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-50px' }}
          >
            <AnimatePresence mode="popLayout">
              {filteredFeatures.map((feat, index) => (
                <motion.div
                  layout
                  key={feat.title}
                  variants={staggerItem}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.2 } }}
                  whileHover={{ y: -6, scale: 1.015, transition: { duration: 0.25 } }}
                  className="card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '1.6rem'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <motion.div
                        className="feature-icon"
                        whileHover={{ scale: 1.12, rotate: 5 }}
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '12px',
                          background: 'rgba(0, 136, 255, 0.12)',
                          border: '1px solid rgba(0, 136, 255, 0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#00f0ff'
                        }}
                      >
                        {feat.icon}
                      </motion.div>

                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: '#a1a1aa',
                          letterSpacing: '0.4px',
                          textTransform: 'uppercase'
                        }}
                      >
                        {feat.badge}
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem', color: '#fff' }}>
                      {feat.title}
                    </h3>

                    <p className="text-muted" style={{ fontSize: '0.88rem', lineHeight: 1.6 }}>
                      {feat.description}
                    </p>
                  </div>

                  <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <span style={{ fontSize: '0.78rem', color: '#0088ff', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      Active in Kernel Build <Check size={13} />
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>
      </AnimatedSection>

      {/* =========================================================================
          PRICING & SUBSCRIPTION TIERS
         ========================================================================= */}
      <AnimatedSection id="products" className="section-spacing" style={{ background: 'rgba(7, 9, 14, 0.6)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              style={{ marginBottom: '0.75rem' }}
            >
              <div className="status-badge">
                <span>INSTANT LICENSING</span>
              </div>
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              style={{ fontSize: 'clamp(2rem, 3.5vw, 3rem)', marginBottom: '0.75rem' }}
            >
              Choose Your Access Level
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-muted"
              style={{ maxWidth: '560px', margin: '0 auto', fontSize: '0.92rem' }}
            >
              Automated cryptographic license issuance with immediate client download.
            </motion.p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PRICING_PLANS.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -8, scale: 1.02 }}
                className={`card pricing-card ${plan.popular ? 'card-popular' : ''}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '1.6rem',
                  background: plan.popular
                    ? 'linear-gradient(180deg, rgba(16, 26, 45, 0.9) 0%, rgba(10, 14, 22, 0.95) 100%)'
                    : 'rgba(12, 15, 22, 0.65)',
                  border: plan.popular
                    ? '1.5px solid rgba(0, 136, 255, 0.55)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: plan.popular
                    ? '0 20px 45px -10px rgba(0, 136, 255, 0.35)'
                    : 'none',
                  position: 'relative'
                }}
              >
                <div>
                  {/* Badge above title */}
                  {plan.badge && (
                    <motion.div
                      initial={{ scale: 0.9 }}
                      whileInView={{ scale: 1 }}
                      viewport={{ once: true }}
                      style={{
                        display: 'inline-block',
                        background: plan.popular ? 'linear-gradient(135deg, #0088ff, #00f0ff)' : 'rgba(168, 85, 247, 0.25)',
                        color: plan.popular ? '#040508' : '#c084fc',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        letterSpacing: '0.5px',
                        marginBottom: '0.6rem'
                      }}
                    >
                      {plan.badge}
                    </motion.div>
                  )}

                  <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '0.35rem' }}>
                    {plan.name}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.375rem' }}>
                    <span style={{ fontSize: '2.25rem', fontWeight: 800, color: '#fff', fontFamily: 'Space Grotesk' }}>
                      {plan.price}
                    </span>
                    <span className="text-muted" style={{ fontSize: '0.82rem' }}>/ {plan.period}</span>
                  </div>

                  <p className="text-muted" style={{ fontSize: '0.82rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                    Instant unthrottled access with HWID protection.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1.5rem' }}>
                    {plan.features.map((feat, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.05 * idx + 0.2 }}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem' }}
                      >
                        <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'rgba(0, 136, 255, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Check size={11} color="#00f0ff" />
                        </div>
                        <span style={{ color: '#d4d4d8' }}>{feat}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Link
                    to="/login"
                    className={plan.popular ? "btn btn-primary" : "btn btn-outline"}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '10px',
                      fontSize: '0.88rem'
                    }}
                  >
                    <span>Select Plan</span>
                    <ArrowRight size={15} />
                  </Link>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* =========================================================================
          SECURITY ARCHITECTURE
         ========================================================================= */}
      <AnimatedSection id="security" className="section-spacing">
        <div className="container">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="status-badge" style={{ marginBottom: '0.75rem' }}>
                <span>HYPERVISOR VIRTUALIZATION</span>
              </div>
              <h2 style={{ fontSize: 'clamp(2rem, 3.2vw, 2.75rem)', marginBottom: '1rem', lineHeight: 1.18 }}>
                Undetected by Design, <br />
                <span className="text-gradient-primary">Not by Chance.</span>
              </h2>
              <p className="text-muted" style={{ fontSize: '0.96rem', lineHeight: 1.65, marginBottom: '1.75rem' }}>
                Standard cheats get detected because they inject DLLs into processes or create visible threads.
                LEGIT executes completely outside the guest OS via hardware-assisted CPU virtualization (Intel VT-x / AMD-V).
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {[
                  { icon: <Shield size={18} color="#0088ff" />, bg: 'rgba(0, 136, 255, 0.15)', title: 'Zero Hook Memory Read', desc: 'Direct physical page mapping allows our driver to read memory without hooking game functions or triggering page guard traps.' },
                  { icon: <Monitor size={18} color="#00f0ff" />, bg: 'rgba(0, 240, 255, 0.15)', title: 'Hardware-Level Overlay Guard', desc: 'Visuals never touch the Windows Desktop Window Manager buffer, preventing screenshot anticheat audits.' },
                  { icon: <Lock size={18} color="#10b981" />, bg: 'rgba(16, 185, 129, 0.15)', title: 'SHA-256 HWID Cryptographic Bound', desc: 'Each key is cryptographically bound to prevent unauthorized multi-device account sharing.' },
                ].map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.15, duration: 0.5 }}
                    whileHover={{ x: 6, transition: { duration: 0.2 } }}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}
                  >
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                      {item.icon}
                    </div>
                    <div>
                      <h4 style={{ fontSize: '0.98rem', color: '#fff', marginBottom: '0.2rem' }}>{item.title}</h4>
                      <p className="text-muted" style={{ fontSize: '0.84rem' }}>{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Architecture Card */}
            <motion.div
              initial={{ opacity: 0, x: 30, scale: 0.96 }}
              whileInView={{ opacity: 1, x: 0, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="card"
              style={{
                padding: '2rem',
                background: 'linear-gradient(135deg, rgba(14, 18, 28, 0.8) 0%, rgba(6, 8, 14, 0.95) 100%)',
                border: '1px solid rgba(0, 136, 255, 0.22)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }} style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity, delay: 0.2 }} style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} />
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity, delay: 0.4 }} style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
                </div>
                <span style={{ fontSize: '0.74rem', color: '#71717a', fontFamily: 'monospace' }}>LEGIT_HYPERVISOR_CORE.SYS</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: '#d4d4d8' }}>
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 }}
                  style={{ background: 'rgba(0,0,0,0.4)', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <div style={{ color: '#00f0ff', marginBottom: '0.2rem', fontSize: '0.82rem' }}>// RING-0 HYPERVISOR ACTIVE</div>
                  <div style={{ color: '#71717a', fontSize: '0.8rem' }}>CR3 Paging Isolation: <span style={{ color: '#10b981' }}>ENCRYPTED</span></div>
                  <div style={{ color: '#71717a', fontSize: '0.8rem' }}>Driver Handle Enumeration: <span style={{ color: '#10b981' }}>ZERO HANDLES</span></div>
                  <div style={{ color: '#71717a', fontSize: '0.8rem' }}>EAC / BattleEye Scanner: <span style={{ color: '#10b981' }}>BYPASS VERIFIED</span></div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.45 }}
                  style={{ background: 'rgba(0,0,0,0.4)', padding: '0.85rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <div style={{ color: '#00f0ff', marginBottom: '0.2rem', fontSize: '0.82rem' }}>// DIRECTX 11 SWAPCHAIN</div>
                  <div style={{ color: '#71717a', fontSize: '0.8rem' }}>Frame Presentation Delay: <span style={{ color: '#10b981' }}>0.003ms</span></div>
                  <div style={{ color: '#71717a', fontSize: '0.8rem' }}>OBS / Discord Capture: <span style={{ color: '#10b981' }}>HOOK EXCLUDED</span></div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.55 }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.35rem 0.2rem', fontSize: '0.78rem', color: '#a1a1aa' }}
                >
                  <span>STATUS: RUNNING SMOOTH</span>
                  <motion.span
                    animate={{ opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    style={{ color: '#10b981', fontWeight: 700 }}
                  >
                    100% OPERATIONAL
                  </motion.span>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </AnimatedSection>

      {/* =========================================================================
          FAQ ACCORDION SECTION
         ========================================================================= */}
      <AnimatedSection id="faq" className="section-spacing" style={{ background: 'rgba(6, 8, 12, 0.4)' }}>
        <div className="container" style={{ maxWidth: '800px' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              style={{ marginBottom: '0.75rem' }}
            >
              <div className="status-badge">
                <span>FREQUENT QUESTIONS</span>
              </div>
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              style={{ fontSize: 'clamp(2rem, 3.2vw, 2.75rem)', marginBottom: '0.5rem' }}
            >
              Frequently Asked Questions
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-muted"
              style={{ fontSize: '0.92rem' }}
            >
              Everything you need to know about our software architecture and keys.
            </motion.p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {FAQS.map((faq, index) => {
              const isOpen = activeFaq === index;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.08, duration: 0.4 }}
                  whileHover={{ scale: 1.008 }}
                  style={{
                    background: 'rgba(12, 15, 24, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '14px',
                    overflow: 'hidden',
                    transition: 'border-color 0.3s ease',
                    borderColor: isOpen ? 'rgba(0, 136, 255, 0.3)' : 'rgba(255, 255, 255, 0.08)'
                  }}
                >
                  <button
                    onClick={() => setActiveFaq(isOpen ? null : index)}
                    style={{
                      width: '100%',
                      padding: '1.1rem 1.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'transparent',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '0.96rem',
                      fontWeight: 600,
                      textAlign: 'left',
                      cursor: 'pointer',
                      gap: '0.75rem'
                    }}
                  >
                    <span>{faq.q}</span>
                    <motion.div
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      style={{ color: '#0088ff', flexShrink: 0 }}
                    >
                      <ChevronDown size={18} />
                    </motion.div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <div
                          style={{
                            padding: '0 1.5rem 1.25rem',
                            color: '#8e92a4',
                            fontSize: '0.9rem',
                            lineHeight: 1.6,
                            borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                            paddingTop: '0.85rem'
                          }}
                        >
                          {faq.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>
      </AnimatedSection>

      {/* =========================================================================
          FOOTER
         ========================================================================= */}
      <motion.footer
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: '#040508',
          padding: '3rem 1.5rem 2.5rem'
        }}
      >
        <div className="container">
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <motion.div
              whileHover={{ scale: 1.03 }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '9px',
                  background: 'rgba(0, 136, 255, 0.15)',
                  border: '1px solid rgba(0, 136, 255, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <img src="/logo-diamond.png" alt="LEGIT" style={{ width: '20px', height: 'auto' }} />
              </div>
              <span style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'Space Grotesk', color: '#fff' }}>LEGIT</span>
            </motion.div>

            <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.875rem', color: '#8e92a4', flexWrap: 'wrap', justifyContent: 'center' }}>
              <a href="#features" className="nav-link" style={{ padding: '4px 8px' }}>Features</a>
              <a href="#products" className="nav-link" style={{ padding: '4px 8px' }}>Products</a>
              <a href="#security" className="nav-link" style={{ padding: '4px 8px' }}>Security</a>
              <a href="#faq" className="nav-link" style={{ padding: '4px 8px' }}>FAQ</a>
              <Link to="/login" className="nav-link" style={{ padding: '4px 8px' }}>Sign In</Link>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--color-muted-foreground)' }}>
            <p>&copy; {new Date().getFullYear()} LEGIT CHEATS. All rights reserved.</p>
            <p>Designed for reverse-engineering research and performance optimization.</p>
          </div>
        </div>
      </motion.footer>
    </div>
  );
}
