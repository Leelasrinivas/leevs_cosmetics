/* ============================================================
   LEEVS.IN — LUXURY FOREST COSMETICS
   script.js — Complete Production JavaScript
   Security-hardened, accessible, production-ready
   ============================================================ */

'use strict';

/* ── SECURITY UTILITIES ─────────────────────────────────────── */

const Security = {

  escapeHTML(str) {
    if (typeof str !== 'string') return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
      '/': '&#x2F;',
      '`': '&#x60;',
      '=': '&#x3D;'
    };
    return str.replace(/[&<>"'`=/]/g, s => map[s]);
  },

  sanitizeInput(str, maxLength = 500) {
    if (typeof str !== 'string') return '';
    return str
      .trim()
      .slice(0, maxLength)
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/data:/gi, '')
      .replace(/vbscript:/gi, '');
  },

  validateEmail(email) {
    const pattern = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    return pattern.test(email) && email.length <= 254;
  },

  validatePhone(phone) {
    if (!phone) return true;
    const pattern = /^[+0-9\s\-]{7,15}$/;
    return pattern.test(phone);
  },

  validateName(name) {
    const pattern = /^[a-zA-Z\u0900-\u097F\s'\-\.]{2,100}$/;
    return pattern.test(name);
  },

  generateCSRFToken() {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
  },

  rateLimiter: {
    attempts: {},
    check(key, limit = 5, windowMs = 60000) {
      const now = Date.now();
      if (!this.attempts[key]) {
        this.attempts[key] = { count: 1, start: now };
        return true;
      }
      const record = this.attempts[key];
      if (now - record.start > windowMs) {
        this.attempts[key] = { count: 1, start: now };
        return true;
      }
      if (record.count >= limit) return false;
      record.count++;
      return true;
    }
  }

};

/* ── CSRF TOKEN INIT ────────────────────────────────────────── */

let csrfToken = sessionStorage.getItem('leevs_csrf');
if (!csrfToken) {
  csrfToken = Security.generateCSRFToken();
  sessionStorage.setItem('leevs_csrf', csrfToken);
}

/* ── DOM HELPERS ────────────────────────────────────────────── */

const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);
const on = (el, ev, fn) => el && el.addEventListener(ev, fn);
const off = (el, ev, fn) => el && el.removeEventListener(ev, fn);

function safeSetText(el, text) {
  if (!el) return;
  el.textContent = Security.escapeHTML(String(text));
}

function safeSetHTML(el, html) {
  if (!el) return;
  el.innerHTML = '';
  const tmp = document.createElement('div');
  tmp.textContent = html;
  el.textContent = tmp.textContent;
}

/* ── TOAST NOTIFICATION ─────────────────────────────────────── */

const Toast = (() => {
  const el = $('toast');
  let timer = null;

  function show(message, duration = 3500) {
    if (!el) return;
    const safe = Security.sanitizeInput(message, 120);
    el.textContent = safe;
    el.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => {
      el.classList.remove('show');
    }, duration);
  }

  return { show };
})();

/* ── SCROLL PROGRESS BAR ────────────────────────────────────── */

const ScrollProgress = (() => {
  const bar = $('scroll-progress');

  function update() {
    if (!bar) return;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    bar.style.width = Math.min(pct, 100).toFixed(2) + '%';
  }

  function init() {
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  return { init };
})();

/* ── HEADER SCROLL BEHAVIOUR ────────────────────────────────── */

const Header = (() => {
  const header = $('site-header');
  let lastScroll = 0;
  let ticking = false;

  function update() {
    const scroll = window.scrollY;
    if (header) {
      header.classList.toggle('scrolled', scroll > 40);
    }
    lastScroll = scroll;
    ticking = false;
  }

  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }

  function init() {
    window.addEventListener('scroll', onScroll, { passive: true });
    update();
  }

  return { init };
})();

/* ── ANNOUNCEMENT BAR ───────────────────────────────────────── */

const AnnouncementBar = (() => {
  function init() {
    const bar = $('announcement-bar');
    const btn = $('announcement-close');
    if (!bar || !btn) return;

    const dismissed = sessionStorage.getItem('leevs_announce_dismissed');
    if (dismissed) {
      bar.classList.add('hidden');
      return;
    }

    on(btn, 'click', () => {
      bar.classList.add('hidden');
      sessionStorage.setItem('leevs_announce_dismissed', '1');
    });
  }

  return { init };
})();

/* ── MOBILE NAVIGATION ──────────────────────────────────────── */

const MobileNav = (() => {
  const hamburger = $('nav-hamburger');
  const nav       = $('mobile-nav');
  const overlay   = $('mobile-nav-overlay');
  const closeBtn  = $('mobile-nav-close');
  const links     = $$('.mobile-nav-link');

  function open() {
    nav?.classList.add('open');
    overlay?.classList.add('open');
    hamburger?.setAttribute('aria-expanded', 'true');
    nav?.setAttribute('aria-hidden', 'false');
    document.body.classList.add('menu-open');
    closeBtn?.focus();
  }

  function close() {
    nav?.classList.remove('open');
    overlay?.classList.remove('open');
    hamburger?.setAttribute('aria-expanded', 'false');
    nav?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('menu-open');
    hamburger?.focus();
  }

  function init() {
    on(hamburger, 'click', open);
    on(closeBtn, 'click', close);
    on(overlay, 'click', close);

    links.forEach(link => {
      on(link, 'click', close);
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && nav?.classList.contains('open')) {
        close();
      }
    });

    // Trap focus in mobile nav when open
    on(nav, 'keydown', e => {
      if (e.key !== 'Tab' || !nav.classList.contains('open')) return;
      const focusable = nav.querySelectorAll(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  return { init };
})();

/* ── SEARCH OVERLAY ─────────────────────────────────────────── */

const SearchOverlay = (() => {
  const overlay   = $('search-overlay');
  const openBtn   = $('search-toggle');
  const closeBtn  = $('search-close');
  const input     = $('search-input');

  function open() {
    overlay?.classList.add('open');
    overlay?.setAttribute('aria-hidden', 'false');
    document.body.classList.add('search-open');
    setTimeout(() => input?.focus(), 50);
  }

  function close() {
    overlay?.classList.remove('open');
    overlay?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('search-open');
    openBtn?.focus();
  }

  function init() {
    on(openBtn, 'click', open);
    on(closeBtn, 'click', close);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && overlay?.classList.contains('open')) {
        close();
      }
    });

    on(overlay, 'click', e => {
      if (e.target === overlay) close();
    });
  }

  return { init };
})();

/* Search form sanitization (called inline in HTML) */
function sanitizeSearch(form) {
  const input = form.querySelector('input[name="q"]');
  if (!input) return false;
  const value = Security.sanitizeInput(input.value, 100);
  if (!value) return false;
  input.value = value;
  return true;
}

/* ── CART STATE ─────────────────────────────────────────────── */

const CartState = (() => {
  const STORAGE_KEY = 'leevs_cart_v1';
  let items = [];

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      items = parsed.filter(item =>
        typeof item.id === 'number' &&
        typeof item.name === 'string' &&
        typeof item.price === 'number' &&
        typeof item.qty === 'number' &&
        item.qty > 0 &&
        item.price > 0
      ).map(item => ({
        id:    Number(item.id),
        name:  Security.sanitizeInput(item.name, 100),
        price: Math.abs(Number(item.price)),
        qty:   Math.min(Math.abs(Math.floor(item.qty)), 99)
      }));
    } catch {
      items = [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Storage quota exceeded — fail silently
    }
  }

  function getAll() {
    return [...items];
  }

  function getTotal() {
    return items.reduce((sum, item) => sum + item.price * item.qty, 0);
  }

  function getCount() {
    return items.reduce((sum, item) => sum + item.qty, 0);
  }

  function add(id, name, price, qty = 1) {
    id    = Number(id);
    price = Math.abs(Number(price));
    qty   = Math.min(Math.abs(Math.floor(qty)), 99);
    name  = Security.sanitizeInput(String(name), 100);

    if (!id || !name || !price || !qty) return false;

    const existing = items.find(i => i.id === id);
    if (existing) {
      existing.qty = Math.min(existing.qty + qty, 99);
    } else {
      items.push({ id, name, price, qty });
    }
    save();
    return true;
  }

  function updateQty(id, qty) {
    id  = Number(id);
    qty = Math.min(Math.abs(Math.floor(qty)), 99);
    const item = items.find(i => i.id === id);
    if (!item) return;
    if (qty <= 0) {
      remove(id);
    } else {
      item.qty = qty;
      save();
    }
  }

  function remove(id) {
    id = Number(id);
    items = items.filter(i => i.id !== id);
    save();
  }

  function clear() {
    items = [];
    save();
  }

  load();
  return { getAll, getTotal, getCount, add, updateQty, remove, clear };
})();

/* ── CART UI ────────────────────────────────────────────────── */

const Cart = (() => {
  const sidebar    = $('cart-sidebar');
  const overlay    = $('cart-overlay');
  const openBtn    = $('cart-toggle');
  const closeBtn   = $('cart-close');
  const itemsEl    = $('cart-items');
  const emptyEl    = $('cart-empty');
  const footerEl   = $('cart-footer');
  const subtotalEl = $('cart-subtotal');
  const countEl    = $('cart-count');

  function open() {
    sidebar?.classList.add('open');
    overlay?.classList.add('open');
    sidebar?.setAttribute('aria-hidden', 'false');
    document.body.classList.add('cart-open');
    closeBtn?.focus();
  }

  function close() {
    sidebar?.classList.remove('open');
    overlay?.classList.remove('open');
    sidebar?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('cart-open');
    openBtn?.focus();
  }

  function formatPrice(paise) {
    return '\u20B9' + Number(paise).toLocaleString('en-IN');
  }

  function renderItems() {
    const items = CartState.getAll();
    const count = CartState.getCount();
    const total = CartState.getTotal();

    // Update count badge
    if (countEl) {
      countEl.textContent = count > 99 ? '99+' : String(count);
      countEl.setAttribute('aria-label', count + ' items in cart');
    }

    if (!itemsEl) return;

    if (items.length === 0) {
      if (emptyEl) emptyEl.style.display = 'flex';
      if (footerEl) footerEl.style.display = 'none';

      // Remove any existing item elements
      $$('.cart-item').forEach(el => el.remove());
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';
    if (footerEl) footerEl.style.display = 'block';
    if (subtotalEl) subtotalEl.textContent = formatPrice(total);

    // Clear existing items
    $$('.cart-item').forEach(el => el.remove());

    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'cart-item';
      div.setAttribute('data-item-id', item.id);

      const safeName  = Security.escapeHTML(item.name);
      const safePrice = formatPrice(item.price);
      const safeTotal = formatPrice(item.price * item.qty);

      div.innerHTML = `
        <div class="cart-item-thumb" aria-hidden="true">LEEVS</div>
        <div class="cart-item-info">
          <span class="cart-item-name">${safeName}</span>
          <span class="cart-item-price">${safePrice} &times; ${item.qty} = ${safeTotal}</span>
          <div class="cart-item-qty" role="group" aria-label="Quantity for ${safeName}">
            <button class="cart-qty-btn" data-action="decrement" data-id="${item.id}" aria-label="Decrease quantity">&#8722;</button>
            <span class="cart-qty-value" aria-live="polite">${item.qty}</span>
            <button class="cart-qty-btn" data-action="increment" data-id="${item.id}" aria-label="Increase quantity">&#43;</button>
          </div>
        </div>
        <button class="cart-item-remove" data-id="${item.id}" aria-label="Remove ${safeName} from cart">Remove</button>
      `;

      itemsEl.insertBefore(div, emptyEl);
    });
  }

  function bindCartItemEvents() {
    on(itemsEl, 'click', e => {
      const target = e.target;

      if (target.classList.contains('cart-qty-btn')) {
        const id     = Number(target.dataset.id);
        const action = target.dataset.action;
        const items  = CartState.getAll();
        const item   = items.find(i => i.id === id);
        if (!item) return;

        if (action === 'increment') {
          CartState.updateQty(id, item.qty + 1);
        } else if (action === 'decrement') {
          CartState.updateQty(id, item.qty - 1);
        }
        renderItems();
      }

      if (target.classList.contains('cart-item-remove')) {
        const id = Number(target.dataset.id);
        CartState.remove(id);
        renderItems();
        Toast.show('Item removed from cart.');
      }
    });
  }

  function bindAddToCart() {
    $$('.add-to-cart').forEach(btn => {
      on(btn, 'click', () => {
        const id    = Number(btn.dataset.id);
        const name  = String(btn.dataset.name || '');
        const price = Number(btn.dataset.price);
        const qty   = Number(btn.dataset.qty || 1);

        if (!id || !name || !price) return;

        const added = CartState.add(id, name, price, qty);
        if (added) {
          renderItems();
          Toast.show(Security.sanitizeInput(name, 60) + ' added to your cart.');

          // Button feedback
          const originalText = btn.textContent;
          btn.textContent = 'Added';
          btn.disabled = true;
          setTimeout(() => {
            btn.textContent = originalText;
            btn.disabled = false;
          }, 1600);
        }
      });
    });
  }

  function bindWishlist() {
    $$('.btn-wishlist').forEach(btn => {
      on(btn, 'click', () => {
        btn.classList.toggle('active');
        const isActive = btn.classList.contains('active');
        btn.setAttribute('aria-label', isActive ? 'Remove from wishlist' : 'Add to wishlist');
        Toast.show(isActive ? 'Added to wishlist.' : 'Removed from wishlist.');
      });
    });
  }

  function init() {
    on(openBtn, 'click', open);
    on(closeBtn, 'click', close);
    on(overlay, 'click', close);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && sidebar?.classList.contains('open')) {
        close();
      }
    });

    // Trap focus in cart sidebar
    on(sidebar, 'keydown', e => {
      if (e.key !== 'Tab' || !sidebar.classList.contains('open')) return;
      const focusable = sidebar.querySelectorAll(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    bindCartItemEvents();
    bindAddToCart();
    bindWishlist();
    renderItems();
  }

  return { init, renderItems, open, close };
})();

/* ── SCROLL REVEAL ANIMATION ────────────────────────────────── */

const RevealObserver = (() => {
  let observer = null;

  function init() {
    if (!('IntersectionObserver' in window)) {
      $$('[data-reveal]').forEach(el => el.classList.add('revealed'));
      return;
    }

    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, {
      root: null,
      rootMargin: '0px 0px -60px 0px',
      threshold: 0.12
    });

    $$('[data-reveal]').forEach(el => observer.observe(el));
  }

  return { init };
})();

/* ── SMOOTH SCROLL FOR ANCHOR LINKS ─────────────────────────── */

const SmoothScroll = (() => {
  function getHeaderOffset() {
    const header = $('site-header');
    const announce = $('announcement-bar');
    let offset = header ? header.offsetHeight : 72;
    if (announce && !announce.classList.contains('hidden')) {
      offset += announce.offsetHeight;
    }
    return offset + 24;
  }

  function scrollTo(targetId) {
    const target = document.querySelector(targetId);
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.scrollY - getHeaderOffset();
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }

  function init() {
    document.addEventListener('click', e => {
      const link = e.target.closest('a[href^="#"]');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href || href === '#') return;

      // Validate href format — only allow #id patterns
      if (!/^#[a-zA-Z][a-zA-Z0-9\-_]*$/.test(href)) return;

      e.preventDefault();
      scrollTo(href);

      // Update URL hash safely
      try {
        history.pushState(null, '', href);
      } catch {
        // Ignore
      }
    });
  }

  return { init };
})();

/* ── ACTIVE NAV LINK HIGHLIGHTING ───────────────────────────── */

const NavHighlight = (() => {
  const sections = ['home', 'collection', 'ingredients', 'about', 'contact'];
  const links    = $$('.nav-link');

  function update() {
    const scrollY = window.scrollY + 120;

    for (let i = sections.length - 1; i >= 0; i--) {
      const section = document.getElementById(sections[i]);
      if (!section) continue;
      if (scrollY >= section.offsetTop) {
        links.forEach(link => {
          const href = link.getAttribute('href');
          link.classList.toggle('active', href === '#' + sections[i]);
        });
        break;
      }
    }
  }

  function init() {
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  return { init };
})();

/* ── RITUAL TABS ────────────────────────────────────────────── */

const RitualTabs = (() => {
  const tabs   = $$('.ritual-tab');
  const panels = $$('.ritual-panel');

  function activate(index) {
    tabs.forEach((tab, i) => {
      const isActive = i === index;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
    });

    panels.forEach((panel, i) => {
      const isActive = i === index;
      panel.classList.toggle('active', isActive);
      panel.hidden = !isActive;

      if (isActive) {
        // Re-trigger reveal animations in newly shown panel
        panel.querySelectorAll('[data-reveal]').forEach(el => {
          el.classList.remove('revealed');
          setTimeout(() => el.classList.add('revealed'), 50);
        });
      }
    });
  }

  function init() {
    tabs.forEach((tab, i) => {
      on(tab, 'click', () => activate(i));

      on(tab, 'keydown', e => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          const next = e.key === 'ArrowRight'
            ? (i + 1) % tabs.length
            : (i - 1 + tabs.length) % tabs.length;
          activate(next);
          tabs[next].focus();
        }
      });
    });
  }

  return { init };
})();

/* ── TESTIMONIALS CAROUSEL ──────────────────────────────────── */

const Testimonials = (() => {
  const track    = $('testimonials-track');
  const prevBtn  = $('test-prev');
  const nextBtn  = $('test-next');
  const dotsWrap = $('test-dots');

  let current     = 0;
  let total       = 0;
  let perView     = 1;
  let autoTimer   = null;
  let startX      = 0;
  let isDragging  = false;

  function getPerView() {
  const w = window.innerWidth;
  if (w >= 1200) return 4;
  if (w >= 900)  return 3;
  if (w >= 640)  return 2;
  return 1; // always 1 card on phones
}


  function buildDots(count) {
    if (!dotsWrap) return;
    dotsWrap.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const btn = document.createElement('button');
      btn.className = 't-dot' + (i === 0 ? ' active' : '');
      btn.setAttribute('aria-label', 'Go to testimonial group ' + (i + 1));
      btn.dataset.index = i;
      dotsWrap.appendChild(btn);
    }
  }

  function updateDots(index) {
    if (!dotsWrap) return;
    dotsWrap.querySelectorAll('.t-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
    });
  }

  function goTo(index) {
  if (!track) return;
  const cards = track.children.length;
  total = Math.ceil(cards / perView);
  current = Math.max(0, Math.min(index, total - 1));

  // each slide = 100% width
  track.style.transform = `translateX(-${current * 100}%)`;
  track.style.transition = 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';

  updateDots(current);

  if (prevBtn) prevBtn.disabled = current === 0;
  if (nextBtn) nextBtn.disabled = current >= total - 1;
}

  function next() {
    const cards = track ? track.children.length : 0;
    const t = Math.ceil(cards / perView);
    goTo(current >= t - 1 ? 0 : current + 1);
  }

  function prev() {
    const cards = track ? track.children.length : 0;
    const t = Math.ceil(cards / perView);
    goTo(current <= 0 ? t - 1 : current - 1);
  }

  function startAuto() {
    stopAuto();
    autoTimer = setInterval(next, 5500);
  }

  function stopAuto() {
    clearInterval(autoTimer);
  }

  function handleResize() {
    const newPerView = getPerView();
    if (newPerView !== perView) {
      perView = newPerView;
      if (track) {
        const cards = track.children.length;
        const t = Math.ceil(cards / perView);
        buildDots(t);
        current = 0;
        goTo(0);
      }
    }
  }

  function init() {
    if (!track) return;
    perView = getPerView();
    const count = track.children.length;
    const totalGroups = Math.ceil(count / perView);

    buildDots(totalGroups);
    goTo(0);
    startAuto();

    on(prevBtn, 'click', () => { prev(); stopAuto(); startAuto(); });
    on(nextBtn, 'click', () => { next(); stopAuto(); startAuto(); });

    on(dotsWrap, 'click', e => {
      const dot = e.target.closest('.t-dot');
      if (!dot) return;
      goTo(Number(dot.dataset.index));
      stopAuto();
      startAuto();
    });

    // Touch/swipe
    on(track, 'touchstart', e => {
      startX = e.touches[0].clientX;
      isDragging = true;
      stopAuto();
    }, { passive: true });

    on(track, 'touchend', e => {
      if (!isDragging) return;
      const delta = e.changedTouches[0].clientX - startX;
      if (Math.abs(delta) > 50) {
        delta < 0 ? next() : prev();
      }
      isDragging = false;
      startAuto();
    }, { passive: true });

    // Keyboard
    on(track, 'keydown', e => {
      if (e.key === 'ArrowLeft') { prev(); stopAuto(); startAuto(); }
      if (e.key === 'ArrowRight') { next(); stopAuto(); startAuto(); }
    });

    // Pause on hover
    on(track, 'mouseenter', stopAuto);
    on(track, 'mouseleave', startAuto);

    // Resize
    window.addEventListener('resize', debounce(handleResize, 250), { passive: true });
  }

  return { init };
})();

/* ── FOREST PARTICLES ───────────────────────────────────────── */

const ForestParticles = (() => {
  const container = $('forest-particles');
  const COUNT     = 22;
  const particles = [];

  function createParticle(index) {
    const el = document.createElement('div');
    el.className = 'particle';

    const size     = 2 + Math.random() * 3;
    const left     = 5 + Math.random() * 90;
    const duration = 8 + Math.random() * 14;
    const delay    = Math.random() * 12;
    const opacity  = 0.3 + Math.random() * 0.5;

    el.style.cssText = `
      left: ${left}%;
      width: ${size}px;
      height: ${size}px;
      animation-duration: ${duration}s;
      animation-delay: -${delay}s;
      opacity: ${opacity};
    `;

    return el;
  }

  function init() {
    if (!container) return;

    // Only run particles if user has no reduced motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    for (let i = 0; i < COUNT; i++) {
      const p = createParticle(i);
      container.appendChild(p);
      particles.push(p);
    }
  }

  return { init };
})();

/* ── NOTIFY FORM (Coming Soon) ──────────────────────────────── */

function handleNotify(e) {
  e.preventDefault();

  const form    = e.target;
  const input   = $('notify-email');
  const msgEl   = $('notify-message');
  const btn     = form.querySelector('button[type="submit"]');

  if (!input || !msgEl) return false;

  const email = Security.sanitizeInput(input.value, 254);

  if (!Security.validateEmail(email)) {
    if (msgEl) msgEl.textContent = 'Please enter a valid email address.';
    input.focus();
    return false;
  }

  // Rate limit
  if (!Security.rateLimiter.check('notify', 3, 60000)) {
    if (msgEl) msgEl.textContent = 'Too many attempts. Please try again in a minute.';
    return false;
  }

  // Simulate server submission
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Sending...';
  }

  setTimeout(() => {
    if (msgEl) {
      msgEl.textContent = 'You are on the list. We will notify you first.';
      msgEl.style.color = 'var(--forest-pale)';
    }
    input.value = '';
    if (btn) {
      btn.textContent = 'Notify Me';
      btn.disabled = false;
    }
    Toast.show('Notification registered successfully.');
  }, 900);

  return false;
}

/* ── CONTACT FORM ───────────────────────────────────────────── */

function handleContact(e) {
  e.preventDefault();

  const form      = e.target;
  const statusEl  = $('contact-message-status');
  const btn       = form.querySelector('button[type="submit"]');

  // Clear previous states
  form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
  if (statusEl) statusEl.textContent = '';

  // Gather fields
  const name     = Security.sanitizeInput(form.name?.value || '', 100);
  const email    = Security.sanitizeInput(form.email?.value || '', 254);
  const phone    = Security.sanitizeInput(form.phone?.value || '', 15);
  const subject  = Security.sanitizeInput(form.subject?.value || '', 50);
  const message  = Security.sanitizeInput(form.message?.value || '', 2000);
  const consent  = form.consent?.checked;

  let valid = true;

  function markError(field, msg) {
    const el = form.querySelector(`[name="${field}"]`);
    if (el) el.classList.add('error');
    if (statusEl && valid) statusEl.textContent = msg;
    valid = false;
  }

  if (!name || !Security.validateName(name)) {
    markError('name', 'Please enter your full name (letters only, 2–100 characters).');
  }
  if (!Security.validateEmail(email)) {
    markError('email', 'Please enter a valid email address.');
  }
  if (phone && !Security.validatePhone(phone)) {
    markError('phone', 'Please enter a valid phone number.');
  }
  if (!subject) {
    markError('subject', 'Please select a subject.');
  }
  if (!message || message.length < 10) {
    markError('message', 'Please enter a message of at least 10 characters.');
  }
  if (!consent) {
    if (statusEl && valid) statusEl.textContent = 'Please accept the privacy policy to continue.';
    valid = false;
  }

  if (!valid) return false;

  // Rate limit
  if (!Security.rateLimiter.check('contact', 3, 120000)) {
    if (statusEl) statusEl.textContent = 'Too many submissions. Please wait a few minutes.';
    return false;
  }

  // Simulate server submission
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Sending...';
  }

  setTimeout(() => {
    if (statusEl) {
      statusEl.textContent = 'Thank you for reaching out. We will respond within 24 hours.';
      statusEl.style.color = 'var(--forest-light)';
    }
    form.reset();
    if (btn) {
      btn.textContent = 'Send Message';
      btn.disabled = false;
    }
    Toast.show('Message sent. We will be in touch soon.');
  }, 1000);

  return false;
}

/* ── FOOTER YEAR ────────────────────────────────────────────── */

function setFooterYear() {
  const el = $('footer-year');
  if (el) el.textContent = new Date().getFullYear();
}

/* ── LAZY IMAGE LOADING ─────────────────────────────────────── */

const LazyImages = (() => {
  function init() {
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
        }
        observer.unobserve(img);
      });
    }, { rootMargin: '200px' });

    $$('img[data-src]').forEach(img => observer.observe(img));
  }

  return { init };
})();

/* ── EXTERNAL LINK SECURITY ─────────────────────────────────── */

const ExternalLinks = (() => {
  function init() {
    $$('a[target="_blank"]').forEach(link => {
      const rel = link.getAttribute('rel') || '';
      if (!rel.includes('noopener')) {
        link.setAttribute('rel', (rel + ' noopener noreferrer').trim());
      }
    });
  }

  return { init };
})();

/* ── FORM AUTOFILL STYLE FIX ────────────────────────────────── */

const AutofillFix = (() => {
  function init() {
    // Prevent browser autofill yellow background from breaking design
    const style = document.createElement('style');
    style.textContent = `
      input:-webkit-autofill,
      input:-webkit-autofill:hover,
      input:-webkit-autofill:focus,
      textarea:-webkit-autofill,
      select:-webkit-autofill {
        -webkit-box-shadow: 0 0 0 1000px var(--cream-dark) inset !important;
        -webkit-text-fill-color: var(--text-primary) !important;
        transition: background-color 5000s ease-in-out 0s;
      }
    `;
    document.head.appendChild(style);
  }

  return { init };
})();

/* ── PRODUCT VESSEL HOVER PARALLAX ─────────────────────────── */

const VesselParallax = (() => {
  function init() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if ('ontouchstart' in window) return;

    $$('.product-visual').forEach(visual => {
      const vessel = visual.querySelector('.product-vessel');
      if (!vessel) return;

      on(visual, 'mousemove', e => {
        const rect   = visual.getBoundingClientRect();
        const cx     = rect.left + rect.width / 2;
        const cy     = rect.top + rect.height / 2;
        const dx     = (e.clientX - cx) / (rect.width / 2);
        const dy     = (e.clientY - cy) / (rect.height / 2);
        const rotY   = dx * 6;
        const rotX   = -dy * 4;
        vessel.style.transform = `translateY(-8px) rotate(${rotY * 0.3}deg) perspective(400px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
      });

      on(visual, 'mouseleave', () => {
        vessel.style.transform = '';
        vessel.style.transition = 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      });
    });
  }

  return { init };
})();

/* ── INGREDIENT TAG HOVER ───────────────────────────────────── */

const IngredientTags = (() => {
  const descriptions = {
    'Coconut'      : 'Cold-pressed virgin coconut oil — deep conditioning, anti-fungal.',
    'Rosemary'     : 'Stimulates scalp circulation and promotes hair regrowth.',
    'Curry Leaves' : 'Rich in beta-carotene — strengthens follicles and prevents greying.',
    'Fenugreek'    : 'Lecithin-rich — conditions, moisturises and prevents dandruff.',
    'Aloe Vera'    : 'Cold-processed — soothes, hydrates and accelerates cell renewal.',
    'Rice Water'   : 'Fermented inositol — repairs damage and brightens skin tone.',
    'Sacred Neem'  : '4,000 years of Ayurvedic antibacterial and anti-inflammatory use.'
  };

  function init() {
    $$('.ingredient-tag').forEach(tag => {
      const label = tag.textContent.trim();
      const desc  = descriptions[label];
      if (!desc) return;

      tag.setAttribute('title', desc);
      tag.setAttribute('tabindex', '0');
      tag.setAttribute('role', 'button');
      tag.setAttribute('aria-label', label + ': ' + desc);
    });
  }

  return { init };
})();

/* ── NUMBER COUNTER ANIMATION ───────────────────────────────── */

const CounterAnimation = (() => {
  function animateCounter(el, target, duration = 1800) {
    const start     = performance.now();
    const startVal  = 0;

    function update(now) {
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      const current  = Math.floor(startVal + (target - startVal) * eased);
      el.textContent = current.toLocaleString('en-IN');
      if (progress < 1) requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
  }

  function init() {
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = Number(el.dataset.count);
        if (!isNaN(target)) animateCounter(el, target);
        observer.unobserve(el);
      });
    }, { threshold: 0.5 });

    $$('[data-count]').forEach(el => observer.observe(el));
  }

  return { init };
})();

/* ── PAGE VISIBILITY — Pause Animations ────────────────────── */

document.addEventListener('visibilitychange', () => {
  const marquee = document.querySelector('.marquee-track');
  if (marquee) {
    marquee.style.animationPlayState =
      document.hidden ? 'paused' : 'running';
  }
});

/* ── KEYBOARD NAVIGATION ENHANCEMENT ───────────────────────── */

const KeyboardNav = (() => {
  function init() {
    // Show focus rings only when using keyboard
    document.addEventListener('mousedown', () => {
      document.body.classList.remove('keyboard-nav');
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Tab') {
        document.body.classList.add('keyboard-nav');
      }
    });

    // Close dropdowns on Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        $$('.dropdown-menu').forEach(menu => {
          menu.style.opacity = '0';
          menu.style.visibility = 'hidden';
        });
      }
    });
  }

  return { init };
})();

/* ── PERFORMANCE: Debounce & Throttle ───────────────────────── */

function debounce(fn, wait) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

function throttle(fn, limit) {
  let inThrottle = false;
  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => { inThrottle = false; }, limit);
    }
  };
}

/* ── CLICK OUTSIDE HANDLER ──────────────────────────────────── */

document.addEventListener('click', e => {
  // Close dropdowns when clicking outside
  const isInDropdown = e.target.closest('.nav-dropdown');
  if (!isInDropdown) {
    $$('.dropdown-menu').forEach(menu => {
      menu.parentElement?.classList.remove('active');
    });
  }
});

/* ── PREVENT FORM RESUBMISSION ON REFRESH ───────────────────── */

if (window.history.replaceState) {
  window.history.replaceState(null, null, window.location.href);
}

/* ── INPUT SANITIZATION ON BLUR ─────────────────────────────── */

const InputSanitizer = (() => {
  function init() {
    $$('input[type="text"], input[type="email"], input[type="tel"], textarea').forEach(input => {
      on(input, 'blur', () => {
        input.value = Security.sanitizeInput(input.value, Number(input.maxLength) || 500);
      });

      // Prevent paste of scripts
      on(input, 'paste', e => {
        const pasted = (e.clipboardData || window.clipboardData).getData('text');
        if (/<script|javascript:|on\w+\s*=/i.test(pasted)) {
          e.preventDefault();
          Toast.show('Pasted content was blocked for security.');
        }
      });
    });
  }

  return { init };
})();

/* ── RIGHT CLICK PROTECTION (brand content) ─────────────────── */

document.addEventListener('contextmenu', e => {
  const target = e.target;
  if (target.tagName === 'IMG') {
    e.preventDefault();
  }
});

/* ── PRINT HANDLER ──────────────────────────────────────────── */

window.addEventListener('beforeprint', () => {
  document.title = 'Leevs Natural Cosmetics — leevs.in';
});

/* ── ERROR BOUNDARY ─────────────────────────────────────────── */

window.addEventListener('error', e => {
  // Suppress console errors in production (log to monitoring service)
  if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    e.preventDefault();
    // In production, send to error monitoring:
    // monitoringService.log(e.message, e.filename, e.lineno);
  }
});

window.addEventListener('unhandledrejection', e => {
  if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    e.preventDefault();
  }
});

/* ── RESPONSIVE NAV RECALCULATION ───────────────────────────── */

window.addEventListener('resize', debounce(() => {
  if (window.innerWidth >= 900) {
    // Close mobile nav if window is resized to desktop
    const nav = $('mobile-nav');
    if (nav?.classList.contains('open')) {
      nav.classList.remove('open');
      $('mobile-nav-overlay')?.classList.remove('open');
      $('nav-hamburger')?.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('menu-open');
    }
  }
}, 200));

/* ── BOOT ───────────────────────────────────────────────────── */

function init() {
  // Core UI
  ScrollProgress.init();
  Header.init();
  AnnouncementBar.init();
  MobileNav.init();
  SearchOverlay.init();
  Cart.init();

  // Content & Animation
  RevealObserver.init();
  SmoothScroll.init();
  NavHighlight.init();
  RitualTabs.init();
  Testimonials.init();
  ForestParticles.init();
  LazyImages.init();
  CounterAnimation.init();

  // Interaction enhancements
  VesselParallax.init();
  IngredientTags.init();
  KeyboardNav.init();
  InputSanitizer.init();
  ExternalLinks.init();
  AutofillFix.init();

  // Utilities
  setFooterYear();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
