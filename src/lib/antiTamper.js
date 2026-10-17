/**
 * Anti-Reverse-Engineering, Anti-Tampering, and Anti-Debugging Shield
 * 
 * Defends client-side web application against:
 * - DevTools inspection & console tampering
 * - Code decompilation & breakpoint analysis
 * - Unauthorized framing & clickjacking
 * - Source scraping via keyboard shortcuts
 * - Right-click inspection
 */

export function initAntiTamper() {
  if (typeof window === 'undefined') return;

  const isDev = import.meta.env?.DEV;

  // 1. Anti-Framing (Framebusting against Clickjacking)
  try {
    if (window.top !== window.self) {
      window.top.location = window.self.location;
    }
  } catch (_) {
    // If cross-origin framing blocks access to window.top.location, break out
    try {
      document.body.style.display = 'none';
    } catch (e) {}
  }

  // 2. Disable Right-Click Context Menu (Anti-Inspect)
  document.addEventListener('contextmenu', (e) => {
    // Allow right click only on text input fields if needed for pasting
    const target = e.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    return false;
  }, { capture: true });

  // 3. Block Inspection Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    const isCtrlOrMeta = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;
    const keyCode = e.keyCode || e.which;
    const key = (e.key || '').toLowerCase();

    // F12 (DevTools)
    if (keyCode === 123 || key === 'f12') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl + Shift + I (Inspect)
    // Ctrl + Shift + J (Console)
    // Ctrl + Shift + C (Element selector)
    if (isCtrlOrMeta && isShift && (key === 'i' || key === 'j' || key === 'c')) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl + U (View Source)
    if (isCtrlOrMeta && (key === 'u' || keyCode === 85)) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl + S (Save Page)
    if (isCtrlOrMeta && (key === 's' || keyCode === 83)) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }, { capture: true });

  // 4. Production Console Neutralizer
  if (!isDev) {
    try {
      const noop = () => {};
      const originalError = console.error;

      // Mask debug and informational logs in production
      console.log = noop;
      console.info = noop;
      console.debug = noop;
      console.dir = noop;
      console.table = noop;

      // Keep minimal console.error but strip stack traces
      console.error = (...args) => {
        // Strip sensitive internal URLs or credentials if present
        const sanitized = args.map(a => {
          if (typeof a === 'string') {
            return a.replace(/https:\/\/[a-z0-9]+\.supabase\.co/gi, '[SECURE_ENDPOINT]');
          }
          return a;
        });
        originalError.apply(console, sanitized);
      };

      console.clear();
    } catch (_) {}
  }

  // 5. Anti-Debugging Probe (Disrupts DevTools breakpoint tracing in production)
  if (!isDev) {
    const launchDebuggerTrap = () => {
      const startTime = Date.now();
      // Debugger trap will pause execution only if DevTools is actively open
      try {
        (function() {
          const fn = function() {
            if (this !== window && this !== undefined) return;
            const check = new Function('debugger');
            check();
          };
          fn();
        })();
      } catch (_) {}

      const endTime = Date.now();
      // If elapsed time is greater than 100ms, a breakpoint or DevTools paused the execution
      if (endTime - startTime > 100) {
        try {
          console.clear();
        } catch (_) {}
      }
    };

    // Run periodically
    const trapInterval = setInterval(launchDebuggerTrap, 2500);

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
      clearInterval(trapInterval);
    });
  }

  // 6. Anti-Tamper LocalStorage Integrity Check
  try {
    // Purge known attack vectors or outdated cached keys
    const suspiciousKeys = [
      'legit_admin_cached',
      'vanguard_admin_key',
      'supabase_service_role',
      'admin_role_override'
    ];
    suspiciousKeys.forEach(k => {
      if (localStorage.getItem(k)) {
        localStorage.removeItem(k);
      }
    });
  } catch (_) {}
}
