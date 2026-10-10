/**
 * Loads the official Razorpay checkout script dynamically
 */
export function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error('Failed to load Razorpay SDK');
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

/**
 * Initiates real Razorpay Checkout flow
 * @param {Object} options
 * @param {Object} options.plan - Selected plan details { name, price, amount }
 * @param {Object} options.user - Authenticated user details { email, id }
 * @param {Function} options.onSuccess - Callback on payment success (receives response)
 * @param {Function} options.onDismiss - Callback when checkout is closed without completing
 */
export async function launchRazorpayPayment({ plan, user, onSuccess, onDismiss, onError }) {
  const isLoaded = await loadRazorpayScript();

  if (!isLoaded) {
    if (onError) onError('Could not load payment gateway SDK. Please check your internet connection.');
    return;
  }

  // --- SECURITY FIX (CRIT-02): No hardcoded fallback key — must come from env ---
  const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID;
  if (!razorpayKey) {
    if (onError) onError('Payment gateway is not configured. Please contact support.');
    return;
  }

  const options = {
    key: razorpayKey,
    amount: plan.amount * 100, // Amount in paise (1 INR = 100 paise)
    currency: 'INR',
    name: 'LEGIT CHEATS',
    description: `${plan.name} - Kernel Hypervisor License`,
    image: '/logo-diamond.png',
    prefill: {
      email: user?.email || '',
      contact: ''
    },
    notes: {
      plan_id: plan.id,
      plan_name: plan.name,
      plan_duration: plan.period,
      user_id: user?.id || 'guest',
      user_email: user?.email || 'guest'
    },
    theme: {
      color: '#0088ff'
    },
    modal: {
      ondismiss: () => {
        if (onDismiss) onDismiss();
      }
    },
    handler: function (response) {
      // response: { razorpay_payment_id, razorpay_order_id, razorpay_signature }
      if (onSuccess) {
        onSuccess(response);
      }
    }
  };

  try {
    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', function (response) {
      console.error('Razorpay payment failed:', response.error);
      if (onError) {
        onError(response.error.description || 'Transaction was declined by provider.');
      }
    });
    rzp.open();
  } catch (err) {
    console.error('Error opening Razorpay:', err);
    if (onError) onError(err.message || 'Error opening payment gateway modal.');
  }
}
