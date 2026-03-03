/* ============================================================
   LEEVS.IN — checkout.js
   Complete checkout logic — security-hardened
   ============================================================ */

'use strict';

/* ── REUSE SECURITY UTILITIES ───────────────────────────────── */
const CheckoutSecurity = {
  escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"'`=/]/g, s => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',
      "'":'&#039;','/':'&#x2F;','`':'&#x60;','=':'&#x3D;'
    }[s]));
  },
  sanitize(str, max = 300) {
    if (typeof str !== 'string') return '';
    return str.trim().slice(0, max)
      .replace(/[<>]/g,'')
      .replace(/javascript:/gi,'')
      .replace(/on\w+\s*=/gi,'');
  },
  validateEmail(e) {
    return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(e) && e.length <= 254;
  },
  validateIndianPhone(p) {
    return /^[6-9][0-9]{9}$/.test(p.replace(/\s/g,''));
  },
  validatePincode(p) {
    return /^[1-9][0-9]{5}$/.test(p);
  },
  validateUPI(u) {
    return /^[a-zA-Z0-9._\-]+@[a-zA-Z0-9]+$/.test(u);
  },
  validateCardNumber(n) {
    const digits = n.replace(/\s/g,'');
    if (!/^\d{13,19}$/.test(digits)) return false;
    // Luhn algorithm
    let sum = 0, alt = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let d = parseInt(digits[i]);
      if (alt) { d *= 2; if (d > 9) d -= 9; }
      sum += d;
      alt = !alt;
    }
    return sum % 10 === 0;
  },
  validateExpiry(e) {
    const m = e.match(/^(\d{2})\/(\d{2})$/);
    if (!m) return false;
    const month = parseInt(m[1]), year = 2000 + parseInt(m[2]);
    const now = new Date();
    return month >= 1 && month <= 12 &&
           (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1));
  }
};

/* ── CSRF TOKEN ─────────────────────────────────────────────── */
let csrfToken = sessionStorage.getItem('leevs_csrf');
if (!csrfToken) {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  csrfToken = Array.from(arr, b => b.toString(16).padStart(2,'0')).join('');
  sessionStorage.setItem('leevs_csrf', csrfToken);
}
['csrf_info','csrf_shipping','csrf_payment'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.value = csrfToken;
});

/* ── HELPERS ────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);

function formatINR(amount) {
  return '\u20B9' + Number(amount).toLocaleString('en-IN');
}

function generateOrderId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = 'LVS-';
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/* ── TOAST ──────────────────────────────────────────────────── */
const Toast = (() => {
  const el = $('toast');
  let timer;
  function show(msg, dur = 3500) {
    if (!el) return;
    el.textContent = CheckoutSecurity.sanitize(msg, 120);
    el.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove('show'), dur);
  }
  return { show };
})();

/* ── CART STATE (read from localStorage) ───────────────────── */
const CheckoutCart = (() => {
  const STORAGE_KEY = 'leevs_cart_v1';
  let items = [];

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      items = parsed.filter(i =>
        typeof i.id === 'number' &&
        typeof i.name === 'string' &&
        typeof i.price === 'number' &&
        i.qty > 0 && i.price > 0
      ).map(i => ({
        id:    Number(i.id),
        name:  CheckoutSecurity.sanitize(i.name, 100),
        price: Math.abs(Number(i.price)),
        qty:   Math.min(Math.abs(Math.floor(i.qty)), 99)
      }));
    } catch { items = []; }
  }

  function getAll() { return [...items]; }
  function getSubtotal() { return items.reduce((s,i) => s + i.price * i.qty, 0); }

  load();
  return { getAll, getSubtotal };
})();

/* ── ORDER SUMMARY SIDEBAR ──────────────────────────────────── */
const OrderSummary = (() => {
  let shippingCost  = 0;
  let discountAmt   = 0;
  let appliedCoupon = null;

  const COUPONS = {
    'LEEVS10'  : { type: 'percent', value: 10, label: '10% off' },
    'LEEVS50'  : { type: 'flat',    value: 50, label: '&#8377;50 off' },
    'FOREST20' : { type: 'percent', value: 20, label: '20% off' },
    'TIRUPATI' : { type: 'flat',    value: 30, label: '&#8377;30 off' }
  };

  const GST_RATE = 0.18;

  function render() {
    const items     = CheckoutCart.getAll();
    const subtotal  = CheckoutCart.getSubtotal();
    const container = $('summary-items');
    if (!container) return;

    container.innerHTML = '';

    if (items.length === 0) {
      container.innerHTML = '<p class="summary-empty">Your cart is empty.</p>';
      updateTotals(0);
      return;
    }

    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'summary-item';
      const safeName = CheckoutSecurity.escapeHTML(item.name);
      div.innerHTML = `
        <div class="summary-item-thumb" aria-hidden="true">
          LEEVS
          <span class="summary-item-qty">${item.qty}</span>
        </div>
        <span class="summary-item-name">${safeName}</span>
        <span class="summary-item-price">${formatINR(item.price * item.qty)}</span>
      `;
      container.appendChild(div);
    });

    updateTotals(subtotal);
  }

  function updateTotals(subtotal) {
    // Recalculate discount
    if (appliedCoupon) {
      const coupon = COUPONS[appliedCoupon];
      if (coupon.type === 'percent') {
        discountAmt = Math.round(subtotal * coupon.value / 100);
      } else {
        discountAmt = coupon.value;
      }
    } else {
      discountAmt = 0;
    }

    // Free shipping if subtotal > 499 and standard selected
    const shippingEl = document.querySelector('input[name="shipping_method"]:checked');
    const method = shippingEl ? shippingEl.value : 'standard';
    if (method === 'express') {
      shippingCost = 99;
    } else {
      shippingCost = subtotal >= 499 ? 0 : 49;
    }

    const afterDiscount = Math.max(0, subtotal - discountAmt);
    const gst   = Math.round(afterDiscount * GST_RATE);
    const total = afterDiscount + shippingCost + gst;

    const subtotalEl  = $('summary-subtotal');
    const discountRow = $('discount-row');
    const discountEl  = $('summary-discount');
    const shippingEl2 = $('summary-shipping');
    const taxEl       = $('summary-tax');
    const totalEl     = $('summary-total');

    if (subtotalEl)  subtotalEl.textContent  = formatINR(subtotal);
    if (shippingEl2) shippingEl2.textContent = shippingCost === 0 ? 'Free' : formatINR(shippingCost);
    if (taxEl)       taxEl.textContent       = formatINR(gst);
    if (totalEl)     totalEl.textContent     = formatINR(total);

    if (discountRow && discountEl) {
      if (discountAmt > 0) {
        discountRow.style.display = 'flex';
        discountEl.textContent = '− ' + formatINR(discountAmt);
      } else {
        discountRow.style.display = 'none';
      }
    }

    return { subtotal, discountAmt, shippingCost, gst, total };
  }

  function applyCoupon(code) {
    const clean = CheckoutSecurity.sanitize(code, 20).toUpperCase();
    const coupon = COUPONS[clean];
    const statusEl = $('coupon-status');
    const appliedEl = $('summary-coupon-applied');
    const appliedLabel = $('coupon-applied-label');

    if (!coupon) {
      if (statusEl) {
        statusEl.textContent = 'Invalid coupon code.';
        statusEl.style.color = '#b94040';
      }
      return false;
    }

    appliedCoupon = clean;
    if (statusEl) {
      statusEl.textContent = '';
    }
    if (appliedEl) appliedEl.hidden = false;
    if (appliedLabel) appliedLabel.innerHTML =
      'Coupon <strong>' + CheckoutSecurity.escapeHTML(clean) + '</strong> applied — ' + coupon.label;

    updateTotals(CheckoutCart.getSubtotal());
    Toast.show('Coupon applied: ' + coupon.label.replace(/&#8377;/g, '\u20B9'));
    return true;
  }

  function removeCoupon() {
    appliedCoupon = null;
    discountAmt = 0;
    const appliedEl = $('summary-coupon-applied');
    const statusEl  = $('coupon-status');
    const codeInput = $('coupon-code');
    if (appliedEl) appliedEl.hidden = true;
    if (statusEl)  statusEl.textContent = '';
    if (codeInput) codeInput.value = '';
    updateTotals(CheckoutCart.getSubtotal());
  }

  function getSnapshot() {
    return updateTotals(CheckoutCart.getSubtotal());
  }

  return { render, updateTotals, applyCoupon, removeCoupon, getSnapshot };
})();

/* ── STEP MANAGEMENT ────────────────────────────────────────── */
const Steps = (() => {
  let current = 1;
  const panels = {
    1: $('step-1'),
    2: $('step-2'),
    3: $('step-3'),
    4: $('step-confirm')
  };

  // Collected data across steps
  const data = {
    info:     {},
    shipping: {},
    payment:  {}
  };

  function showStep(num) {
    Object.values(panels).forEach(p => {
      if (p) { p.classList.remove('active'); p.hidden = true; }
    });

    const target = panels[num];
    if (target) {
      target.classList.add('active');
      target.hidden = false;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Update step indicators
    document.querySelectorAll('.step').forEach(step => {
      const n = Number(step.dataset.step);
      step.classList.remove('active','completed');
      step.removeAttribute('aria-current');
      if (n < num)       step.classList.add('completed');
      else if (n === num){ step.classList.add('active'); step.setAttribute('aria-current','step'); }
    });

    current = num;
  }

  function getData()       { return data; }
  function setInfo(d)      { data.info = d; }
  function setShipping(d)  { data.shipping = d; }
  function setPayment(d)   { data.payment = d; }
  function getCurrent()    { return current; }

  return { showStep, getData, setInfo, setShipping, setPayment, getCurrent };
})();

/* ── FIELD ERROR HELPERS ────────────────────────────────────── */
function showError(fieldId, msg) {
  const errEl = document.getElementById('err-' + fieldId);
  const input = document.getElementById(fieldId) ||
                document.querySelector(`[name="${fieldId}"]`);
  if (errEl) errEl.textContent = msg;
  if (input) input.classList.add('error');
}

function clearErrors(form) {
  form.querySelectorAll('.field-error').forEach(el => el.textContent = '');
  form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
}

/* ── STEP 1: INFORMATION FORM ───────────────────────────────── */
on($('form-information'), 'submit', e => {
  e.preventDefault();
  const form = e.target;
  clearErrors(form);

  const firstName = CheckoutSecurity.sanitize(form.first_name.value, 50);
  const lastName  = CheckoutSecurity.sanitize(form.last_name.value, 50);
  const email     = CheckoutSecurity.sanitize(form.email.value, 254);
  const phone     = CheckoutSecurity.sanitize(form.phone.value, 10).replace(/\s/g,'');
  const addr1     = CheckoutSecurity.sanitize(form.address_line1.value, 200);
  const city      = CheckoutSecurity.sanitize(form.city.value, 100);
  const pincode   = CheckoutSecurity.sanitize(form.pincode.value, 6);
  const state     = CheckoutSecurity.sanitize(form.state.value, 5);

  let valid = true;

  if (!firstName || firstName.length < 2) {
    showError('first-name', 'Please enter your first name.');
    valid = false;
  }
  if (!lastName || lastName.length < 2) {
    showError('last-name', 'Please enter your last name.');
    valid = false;
  }
  if (!CheckoutSecurity.validateEmail(email)) {
    showError('checkout-email', 'Please enter a valid email address.');
    valid = false;
  }
  if (!CheckoutSecurity.validateIndianPhone(phone)) {
    showError('checkout-phone', 'Enter a valid 10-digit Indian mobile number.');
    valid = false;
  }
  if (!addr1 || addr1.length < 5) {
    showError('address-line1', 'Please enter your full address.');
    valid = false;
  }
  if (!city || city.length < 2) {
    showError('city', 'Please enter your city.');
    valid = false;
  }
  if (!CheckoutSecurity.validatePincode(pincode)) {
    showError('pincode', 'Please enter a valid 6-digit PIN code.');
    valid = false;
  }
  if (!state) {
    showError('state', 'Please select your state.');
    valid = false;
  }

  if (!valid) return;

  const infoData = { firstName, lastName, email, phone, addr1,
    addr2: CheckoutSecurity.sanitize(form.address_line2?.value || '', 200),
    city, pincode, state };

  Steps.setInfo(infoData);

  // Populate summary bar on step 2
  const summaryAddr = $('summary-address');
  if (summaryAddr) {
    summaryAddr.textContent =
      `${firstName} ${lastName} — ${addr1}, ${city}, ${state} ${pincode}`;
  }

  Steps.showStep(2);
});

/* ── STEP 2: SHIPPING FORM ──────────────────────────────────── */
on($('btn-back-to-info'), 'click', () => Steps.showStep(1));

on($('form-shipping'), 'submit', e => {
  e.preventDefault();
  const form = e.target;
  const method = form.shipping_method?.value || 'standard';
  const shippingEl = document.querySelector(`input[name="shipping_method"][value="${method}"]`);
  const days = shippingEl ? shippingEl.dataset.days : '5-7';

  Steps.setShipping({ method, days });
  OrderSummary.updateTotals(CheckoutCart.getSubtotal());

  // Populate payment step summary
  const info = Steps.getData().info;
  const payAddr = $('payment-summary-address');
  if (payAddr && info.firstName) {
    const methodLabel = method === 'express' ? 'Express (2–3 days)' : 'Standard (5–7 days)';
    payAddr.textContent =
      `${info.firstName} ${info.lastName} · ${info.city}, ${info.state} · ${methodLabel}`;
  }

  Steps.showStep(3);
});

on($('btn-apply-coupon'), 'click', () => {
  const input = $('coupon-code');
  if (!input) return;
  OrderSummary.applyCoupon(input.value);
});

on($('coupon-code'), 'keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    OrderSummary.applyCoupon(e.target.value);
  }
});

on($('btn-remove-coupon'), 'click', () => OrderSummary.removeCoupon());

// Update totals when shipping option changes
document.querySelectorAll('input[name="shipping_method"]').forEach(radio => {
  on(radio, 'change', () => OrderSummary.updateTotals(CheckoutCart.getSubtotal()));
});

on($('btn-edit-info'), 'click', () => Steps.showStep(1));

/* ── STEP 3: PAYMENT FORM ───────────────────────────────────── */
on($('btn-back-to-shipping'), 'click', () => Steps.showStep(2));
on($('btn-edit-shipping'), 'click', () => Steps.showStep(2));

// Toggle payment detail panels
document.querySelectorAll('input[name="payment_method"]').forEach(radio => {
  on(radio, 'change', () => {
    document.querySelectorAll('.payment-detail').forEach(panel => {
      panel.hidden = true;
    });
    const detail = document.getElementById(radio.value + '-detail');
    if (detail) {
      detail.hidden = false;
      detail.classList.add('active');
    }
  });
});

// Card number formatting
on($('card-number'), 'input', e => {
  let val = e.target.value.replace(/\D/g,'').slice(0,16);
  e.target.value = val.replace(/(.{4})/g,'$1 ').trim();
});

// Expiry formatting
on($('card-expiry'), 'input', e => {
  let val = e.target.value.replace(/\D/g,'').slice(0,4);
  if (val.length > 2) val = val.slice(0,2) + '/' + val.slice(2);
  e.target.value = val;
});

// CVV: digits only
on($('card-cvv'), 'input', e => {
  e.target.value = e.target.value.replace(/\D/g,'').slice(0,4);
});

on($('form-payment'), 'submit', e => {
  e.preventDefault();
  const form = e.target;
  clearErrors(form);

  const method = form.payment_method?.value;
  const terms  = form.terms?.checked;
  let valid = true;

  if (!terms) {
    Toast.show('Please agree to the Terms of Service to continue.');
    form.terms.focus();
    return;
  }

  if (method === 'upi') {
    const upi = CheckoutSecurity.sanitize(form.upi_id?.value || '', 60);
    if (!CheckoutSecurity.validateUPI(upi)) {
      showError('upi', 'Please enter a valid UPI ID (e.g. name@upi).');
      valid = false;
    }
  }

  if (method === 'card') {
    const cardNum  = CheckoutSecurity.sanitize(form.card_number?.value || '', 25);
    const expiry   = CheckoutSecurity.sanitize(form.card_expiry?.value || '', 6);
    const cvv      = form.card_cvv?.value || '';
    const cardName = CheckoutSecurity.sanitize(form.card_name?.value || '', 100);

    if (!CheckoutSecurity.validateCardNumber(cardNum)) {
      showError('card-number', 'Please enter a valid card number.');
      valid = false;
    }
    if (!CheckoutSecurity.validateExpiry(expiry)) {
      showError('card-expiry', 'Please enter a valid expiry date.');
      valid = false;
    }
    if (!/^\d{3,4}$/.test(cvv)) {
      showError('card-cvv', 'Please enter a valid CVV.');
      valid = false;
    }
    if (!cardName || cardName.length < 2) {
      showError('card-name', 'Please enter the name on your card.');
      valid = false;
    }
  }

  if (!valid) return;

  Steps.setPayment({ method });

  // Simulate order placement
  const btn = $('btn-place-order');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Processing...';
  }

  setTimeout(() => {
    placeOrder();
  }, 1400);
});

/* ── ORDER PLACEMENT ────────────────────────────────────────── */
function placeOrder() {
  const orderId   = generateOrderId();
  const snapshot  = OrderSummary.getSnapshot();
  const allData   = Steps.getData();
  const items     = CheckoutCart.getAll();

  // Clear cart
  try { localStorage.removeItem('leevs_cart_v1'); } catch {}

  // Store order receipt in session
  try {
    sessionStorage.setItem('leevs_last_order', JSON.stringify({
      orderId,
      timestamp: new Date().toISOString(),
      items: items.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
      total: snapshot.total,
      email: allData.info.email || ''
    }));
  } catch {}

  // Populate confirmation
  const confirmId      = $('confirm-order-id');
  const confirmDetails = $('confirm-details');

  if (confirmId) confirmId.textContent = orderId;

  if (confirmDetails && allData.info.firstName) {
    confirmDetails.innerHTML = `
      <p>Delivering to <strong>${
        CheckoutSecurity.escapeHTML(allData.info.firstName + ' ' + allData.info.lastName)
      }</strong></p>
      <p>${CheckoutSecurity.escapeHTML(allData.info.city)},
         ${CheckoutSecurity.escapeHTML(allData.info.state)}</p>
      <p>Order Total: <strong>${
        formatINR(snapshot.total)
      }</strong></p>
      <p>Estimated delivery: ${
        allData.shipping.method === 'express' ? '2–3 business days' : '5–7 business days'
      }</p>
    `;
  }

  Steps.showStep(4);
  Toast.show('Order placed successfully! Order ID: ' + orderId, 6000);
}

/* ── INPUT SANITIZATION ON BLUR ─────────────────────────────── */
document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], textarea')
  .forEach(input => {
    on(input, 'blur', () => {
      input.value = CheckoutSecurity.sanitize(input.value, Number(input.maxLength) || 300);
    });
    on(input, 'paste', e => {
      const pasted = (e.clipboardData || window.clipboardData).getData('text');
      if (/<script|javascript:|on\w+\s*=/i.test(pasted)) {
        e.preventDefault();
        Toast.show('Pasted content was blocked for security.');
      }
    });
  });

/* ── AUTOFILL STYLE FIX ─────────────────────────────────────── */
const style = document.createElement('style');
style.textContent = `
  input:-webkit-autofill,input:-webkit-autofill:hover,
  input:-webkit-autofill:focus,select:-webkit-autofill {
    -webkit-box-shadow: 0 0 0 1000px var(--cream-dark) inset !important;
    -webkit-text-fill-color: var(--text-primary) !important;
    transition: background-color 5000s ease-in-out 0s;
  }
`;
document.head.appendChild(style);

/* ── EXTERNAL LINK SECURITY ─────────────────────────────────── */
document.querySelectorAll('a[target="_blank"]').forEach(a => {
  const rel = a.getAttribute('rel') || '';
  if (!rel.includes('noopener')) a.setAttribute('rel', (rel + ' noopener noreferrer').trim());
});

/* ── INIT ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // Set CSRF tokens
  ['csrf_info','csrf_shipping','csrf_payment'].forEach(id => {
    const el = $(id);
    if (el) el.value = csrfToken;
  });

  // Footer year
  const yr = $('checkout-year');
  if (yr) yr.textContent = new Date().getFullYear();

  // Render summary
  OrderSummary.render();
  Steps.showStep(1);

  // Redirect if cart is empty
  const items = CheckoutCart.getAll();
  if (items.length === 0) {
    Toast.show('Your cart is empty. Redirecting to shop...');
    setTimeout(() => { window.location.href = '/'; }, 2500);
  }
});
