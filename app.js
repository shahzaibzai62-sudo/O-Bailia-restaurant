/* ═══════════════════════════════════════════════════════════════
   O-BAILIA RESTAURANT — House of Taste
   app.js | Full Application Controller — v2.0
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ── FIREBASE CONFIG ──────────────────────────────────────────── */
const FIREBASE_CONFIG = {
  apiKey:            window.__fbApiKey            || '',
  authDomain:        window.__fbAuthDomain        || '',
  projectId:         window.__fbProjectId         || '',
  storageBucket:     window.__fbStorageBucket     || '',
  messagingSenderId: window.__fbMessagingSenderId || '',
  appId:             window.__fbAppId             || ''
};

/* ── ADMIN CREDENTIALS (hashed — set via env vars in index.html) ─ */
const ADMIN_EMAIL    = window.__adminEmail    || 'admin@obailia.com';
const ADMIN_PASS_SHA = window.__adminPassSHA  || ''; // SHA-256 hex of password

/* ── GLOBAL STATE ─────────────────────────────────────────────── */
let menuItems         = [];
let cart              = [];
let currentMenuFilter = 'all';
let filterTabsInited  = false;   // guard: prevent duplicate filter-tab listeners
let currentAdmin      = null;    // Firebase Auth user when logged in
let tablesData        = [];      // [{id, number, capacity, reserved, reservedBy}]
let reservationsData  = [];      // live reservation docs
let aiChatHistory     = [];      // AI assistant message history

const settings = {
  waNumber:       '923357367364',
  deliveryCharge: 120,
  currencySymbol: 'Rs.'
};

/* ── FIREBASE MODULE HANDLES ──────────────────────────────────── */
let _db      = null;  // Firestore instance
let _auth    = null;  // Auth instance
let _storage = null;  // Storage instance

/* ── DEMO MENU (fallback when Firestore unavailable) ──────────── */
const demoMenu = [
  {
    id: 'burger-001',
    name: 'O-Bailia Lava Burger',
    description: 'Signature double smash patty, lava cheese sauce, jalapeños, crispy onions, special O-Bailia sauce.',
    category: 'burgers', emoji: '🍔', badge: '🔥 Signature',
    variants: [{ label: 'Single', price: 350 }, { label: 'Double', price: 480 }]
  },
  {
    id: 'burger-002',
    name: 'Spicy Crunch Burger',
    description: 'Crispy fried chicken thigh, sriracha mayo, pickles, coleslaw, toasted brioche bun.',
    category: 'burgers', emoji: '🌶️', badge: null,
    variants: [{ label: 'Regular', price: 280 }, { label: 'Large', price: 360 }]
  },
  {
    id: 'burger-003',
    name: 'Zinger Stack',
    description: 'Double crispy zinger strips, cheese slice, fresh lettuce, tomato, garlic aioli.',
    category: 'burgers', emoji: '🥪', badge: null,
    variants: [{ label: 'Single', price: 300 }, { label: 'Double', price: 420 }]
  },
  {
    id: 'pizza-001',
    name: 'Crown Crust Margherita',
    description: 'Hand-stretched Crown Crust base, San Marzano tomato sauce, fresh mozzarella, basil.',
    category: 'pizzas', emoji: '🍕', badge: '⭐ Best Seller',
    variants: [{ label: 'Small', price: 450 }, { label: 'Medium', price: 650 }, { label: 'Large', price: 850 }]
  },
  {
    id: 'pizza-002',
    name: 'Spicy Chicken Supreme',
    description: 'Crown Crust base, bbq sauce, spicy chicken chunks, bell peppers, onion, double cheese blend.',
    category: 'pizzas', emoji: '🍕', badge: null,
    variants: [{ label: 'Small', price: 520 }, { label: 'Medium', price: 720 }, { label: 'Large', price: 920 }]
  },
  {
    id: 'pizza-003',
    name: 'Meat Lovers Special',
    description: 'Loaded with beef pepperoni, seekh kebab chunks, chicken tikka, mozzarella on our signature Crown Crust.',
    category: 'pizzas', emoji: '🍕', badge: '🔥 Hot Pick',
    variants: [{ label: 'Medium', price: 780 }, { label: 'Large', price: 980 }]
  },
  {
    id: 'soup-001',
    name: 'Classic Hot & Sour Soup',
    description: 'Traditional Chinese-style hot & sour broth with silky egg ribbons, mushrooms, bamboo shoots, tofu.',
    category: 'soups', emoji: '🍜', badge: '🏆 Famous',
    variants: [{ label: 'Half', price: 180 }, { label: 'Full', price: 320 }]
  },
  {
    id: 'soup-002',
    name: 'Chicken Corn Soup',
    description: 'Velvety shredded chicken broth blended with sweet corn, beaten egg drizzle, white pepper.',
    category: 'soups', emoji: '🍲', badge: null,
    variants: [{ label: 'Half', price: 160 }, { label: 'Full', price: 290 }]
  },
  {
    id: 'soup-003',
    name: 'Manchow Soup',
    description: 'Spicy dark broth packed with vegetables, soy, vinegar, served with crispy noodles on top.',
    category: 'soups', emoji: '🥣', badge: null,
    variants: [{ label: 'Half', price: 170 }, { label: 'Full', price: 300 }]
  },
  {
    id: 'broast-001',
    name: 'O-Bailia Crispy Broast',
    description: '24-hour marinated whole chicken pieces, pressure-fried to golden perfection with secret spice coating.',
    category: 'broast', emoji: '🍗', badge: '🔥 Must Try',
    variants: [{ label: '2 Pcs', price: 380 }, { label: '4 Pcs', price: 720 }, { label: '8 Pcs', price: 1350 }]
  },
  {
    id: 'broast-002',
    name: 'Spicy Wings Basket',
    description: 'Buffalo-glazed crispy wings, ranch dip, jalapeño slices. Perfect game-day basket.',
    category: 'broast', emoji: '🍖', badge: null,
    variants: [{ label: '6 Pcs', price: 320 }, { label: '12 Pcs', price: 600 }]
  },
  {
    id: 'broast-003',
    name: 'Fish & Chips Platter',
    description: 'Beer-battered fish fillets, crispy golden fries, tartare sauce, lemon wedge.',
    category: 'broast', emoji: '🐟', badge: null,
    variants: [{ label: 'Regular', price: 420 }, { label: 'Large', price: 580 }]
  },
  {
    id: 'roll-001',
    name: 'Seekh Kebab Paratha Roll',
    description: 'Juicy seekh kebab in a flaky layered paratha with onions, mint chutney, and special raita.',
    category: 'rolls', emoji: '🫓', badge: '⭐ Local Fav',
    variants: [{ label: 'Single', price: 180 }, { label: 'Double', price: 320 }]
  },
  {
    id: 'roll-002',
    name: 'Chicken Tikka Roll',
    description: 'Chargrilled chicken tikka chunks, fresh vegetables, garlic mayo wrapped in warm paratha.',
    category: 'rolls', emoji: '🌯', badge: null,
    variants: [{ label: 'Single', price: 200 }, { label: 'Double', price: 350 }]
  },
  {
    id: 'roll-003',
    name: 'Club Sandwich Roll',
    description: 'Grilled chicken, fried egg, cheese slice, lettuce, tomato in a toasted flatbread wrap.',
    category: 'rolls', emoji: '🥙', badge: null,
    variants: [{ label: 'Regular', price: 220 }]
  }
];

/* ─────────────────────────────────────────────────────────────── */
/*  UTILITY                                                        */
/* ─────────────────────────────────────────────────────────────── */

/* XSS Sanitizer — converts any string to safe HTML text */
function sanitize(str) {
  const el = document.createElement('div');
  el.textContent = String(str == null ? '' : str);
  return el.innerHTML;
}

/* Secure input validation helpers */
const Validate = {
  name(v)   { return typeof v === 'string' && v.trim().length >= 2 && v.trim().length <= 80; },
  phone(v)  { return /^[0-9+\-\s]{7,20}$/.test(String(v).trim()); },
  email(v)  { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim()); },
  price(v)  { return Number.isFinite(Number(v)) && Number(v) >= 0; },
  tableNo(v){ return Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 500; },
  guests(v) { return Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 20; },
  date(v)   { return !isNaN(Date.parse(v)); }
};

/* SHA-256 hash for password comparison */
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* Image lazy loading — attach to any <img data-src="..."> */
function initLazyImages(root) {
  const scope = (root instanceof Element) ? root : document;
  const imgs  = scope.querySelectorAll('img[data-src]');
  if (!imgs.length) return;
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
        img.classList.add('img-loaded');
        obs.unobserve(img);
      });
    }, { rootMargin: '200px' });
    imgs.forEach(img => io.observe(img));
  } else {
    imgs.forEach(img => { img.src = img.dataset.src; img.removeAttribute('data-src'); });
  }
}

/* Smooth animation trigger — adds .animate-in to elements with data-animate */
function triggerAnimations(root) {
  const scope = (root instanceof Element) ? root : document;
  const els   = scope.querySelectorAll('[data-animate]:not(.animate-in)');
  if (!els.length) return;
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('animate-in');
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -20px 0px' });
  els.forEach((el, i) => {
    el.style.animationDelay = el.style.animationDelay || `${Math.min(i * 0.07, 0.5)}s`;
    io.observe(el);
  });
}

/* ─────────────────────────────────────────────────────────────── */
/*  TOAST                                                          */
/* ─────────────────────────────────────────────────────────────── */
let _toastTimer = null;

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

/* ─────────────────────────────────────────────────────────────── */
/*  NAVBAR SCROLL EFFECT                                           */
/* ─────────────────────────────────────────────────────────────── */
function initNavbarScroll() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;
  const onScroll = () => navbar.classList.toggle('scrolled', window.scrollY > 30);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // run once on init
}

/* ─────────────────────────────────────────────────────────────── */
/*  INTERSECTION OBSERVER — SCROLL REVEAL                          */
/* ─────────────────────────────────────────────────────────────── */

/*
  observeRevealElements(root)
  BUG FIX: Takes an optional DOM root so freshly rendered menu cards
  (inserted after DOMContentLoaded) are also observed. Without a root
  argument the whole document is scanned.
*/
function observeRevealElements(root) {
  const scope   = (root instanceof Element) ? root : document;
  const targets = scope.querySelectorAll('.reveal:not(.visible)');
  if (!targets.length) return;

  // BUG FIX: Hero elements are already in viewport on load — IntersectionObserver
  // may not fire for them (race condition, especially on mobile). Fix: immediately
  // make above-fold elements visible using rAF, use observer only for below-fold.
  const vH = window.innerHeight || document.documentElement.clientHeight;

  const belowFold = [];
  targets.forEach((el, i) => {
    if (!el.style.transitionDelay) {
      el.style.transitionDelay = `${Math.min(i * 0.06, 0.42)}s`;
    }
    const rect = el.getBoundingClientRect();
    if (rect.top < vH + 60) {
      // Already in/near viewport — trigger immediately via rAF so transition plays
      requestAnimationFrame(() => el.classList.add('visible'));
    } else {
      belowFold.push(el);
    }
  });

  if (!belowFold.length) return;

  // BUG FIX: removed negative rootMargin that was blocking near-bottom elements
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.05, rootMargin: '0px 0px 0px 0px' });

  belowFold.forEach(el => observer.observe(el));
}

/* Kick off observation for static HTML elements on first load */
function initRevealObserver() {
  observeRevealElements(null);
}

/* ─────────────────────────────────────────────────────────────── */
/*  FIREBASE INITIALIZATION                                        */
/* ─────────────────────────────────────────────────────────────── */

const FB_CDN = 'https://www.gstatic.com/firebasejs/10.12.2';

async function initFirebase() {
  try {
    // Use pre-initialized instances from index.html module script if available
    if (window.__firestore) {
      _db      = window.__firestore;
      _auth    = window.__firebaseAuth    || null;
      _storage = window.__firebaseStorage || null;
      return true;
    }

    // Self-initialize if index.html didn't set it up
    const hasConfig = FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId;
    if (!hasConfig) throw new Error('No Firebase config — running in demo mode.');

    const { initializeApp, getApps } = await import(`${FB_CDN}/firebase-app.js`);
    const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);

    const { getFirestore }  = await import(`${FB_CDN}/firebase-firestore.js`);
    const { getAuth }       = await import(`${FB_CDN}/firebase-auth.js`);
    const { getStorage }    = await import(`${FB_CDN}/firebase-storage.js`);

    _db      = getFirestore(app);
    _auth    = getAuth(app);
    _storage = getStorage(app);

    window.__firestore      = _db;
    window.__firebaseAuth   = _auth;
    window.__firebaseStorage = _storage;

    // Restore session: listen to auth state changes
    const { onAuthStateChanged } = await import(`${FB_CDN}/firebase-auth.js`);
    onAuthStateChanged(_auth, user => {
      currentAdmin = user;
      updateAdminUI();
    });

    console.log('[O-Bailia] Firebase initialized (self-init).');
    return true;
  } catch (err) {
    console.warn('[O-Bailia] Firebase init failed:', err.message);
    return false;
  }
}

/* ─────────────────────────────────────────────────────────────── */
/*  ADMIN AUTHENTICATION                                           */
/* ─────────────────────────────────────────────────────────────── */

async function adminLogin(email, password) {
  if (!Validate.email(email)) { showToast('⚠️ Invalid email.'); return false; }
  if (!password || password.length < 6) { showToast('⚠️ Password too short.'); return false; }

  try {
    if (_auth) {
      const { signInWithEmailAndPassword, setPersistence, browserLocalPersistence } =
        await import(`${FB_CDN}/firebase-auth.js`);
      await setPersistence(_auth, browserLocalPersistence);
      const cred = await signInWithEmailAndPassword(_auth, email, password);
      currentAdmin = cred.user;
      showToast('✅ Admin logged in.');
      updateAdminUI();
      return true;
    }
    // Fallback: SHA-256 compare against stored hash
    const inputHash = await sha256(password);
    if (email === ADMIN_EMAIL && inputHash === ADMIN_PASS_SHA) {
      currentAdmin = { email, uid: 'local-admin' };
      sessionStorage.setItem('obailia_admin', JSON.stringify(currentAdmin));
      showToast('✅ Admin logged in (local).');
      updateAdminUI();
      return true;
    }
    showToast('❌ Invalid credentials.');
    return false;
  } catch (err) {
    console.error('[O-Bailia] Login error:', err);
    showToast('❌ Login failed: ' + err.message);
    return false;
  }
}

async function adminLogout() {
  try {
    if (_auth) {
      const { signOut } = await import(`${FB_CDN}/firebase-auth.js`);
      await signOut(_auth);
    }
    currentAdmin = null;
    sessionStorage.removeItem('obailia_admin');
    showToast('👋 Logged out.');
    updateAdminUI();
    closeAdminPanel();
  } catch (err) {
    console.error('[O-Bailia] Logout error:', err);
  }
}

function isAdminLoggedIn() {
  if (currentAdmin) return true;
  // Check sessionStorage fallback
  try {
    const stored = sessionStorage.getItem('obailia_admin');
    if (stored) { currentAdmin = JSON.parse(stored); return true; }
  } catch (_) {}
  return false;
}

function updateAdminUI() {
  const loginBtn  = document.getElementById('admin-login-btn');
  const logoutBtn = document.getElementById('admin-logout-btn');

  const loggedIn = isAdminLoggedIn();
  // BUG FIX: admin-badge and admin-panel-btn don't exist in HTML — safe null checks added.
  // admin-login-btn is always visible (opens the overlay); hide only if we want a logged-in state.
  if (loginBtn)  loginBtn.style.display  = ''; // always show admin button
  if (logoutBtn) logoutBtn.style.display = loggedIn ? '' : 'none';
}

/* ─────────────────────────────────────────────────────────────── */
/*  ADMIN PANEL UI                                                 */
/* ─────────────────────────────────────────────────────────────── */

function openAdminPanel() {
  // BUG FIX: Don't call showAdminLoginModal() — that creates a duplicate floating modal.
  // The HTML already has a proper admin-overlay modal with login screen + dashboard.
  // Just open the overlay; the login screen is shown by default until credentials entered.
  const overlay = document.getElementById('admin-overlay');
  if (overlay) {
    overlay.classList.add('open');
    overlay.style.display = 'flex';
  }
}

function closeAdminPanel() {
  // BUG FIX: target admin-overlay (the backdrop), not admin-panel directly
  const overlay = document.getElementById('admin-overlay');
  if (overlay) { overlay.classList.remove('open'); overlay.style.display = ''; }
  const panel = document.getElementById('admin-panel');
  if (panel) panel.classList.remove('open');
}

function renderAdminPanel() {
  // BUG FIX: HTML has no id="admin-panel-body". The admin dashboard section is
  // id="admin-dashboard" which already has tabs (data-admin-tab) wired by the inline script.
  // app.js's advanced menu/table/reservation management renders into the existing tab sections.
  // For now, renderAdminPanel is a no-op — the HTML inline admin panel handles all UI.
  // The Firestore-backed features (renderAdminMenuTab etc.) are available if Firestore connects.
  return;
}

function renderAdminTab(tab) {
  const el = document.getElementById('admin-tab-content');
  if (!el) return;
  switch (tab) {
    case 'menu':         renderAdminMenuTab(el);         break;
    case 'tables':       renderAdminTablesTab(el);       break;
    case 'reservations': renderAdminReservationsTab(el); break;
    case 'settings':     renderAdminSettingsTab(el);     break;
  }
}

/* ── Admin: Menu Management ──────────────────────────────────── */
function renderAdminMenuTab(el) {
  el.innerHTML = `
    <div class="admin-section">
      <h3>Menu Items</h3>
      <button class="btn btn--gold" id="admin-add-food-btn" type="button">+ Add Food</button>
      <div id="admin-food-list" class="admin-list"></div>
    </div>
    <div id="admin-food-form-area"></div>
  `;

  document.getElementById('admin-add-food-btn').addEventListener('click', () => {
    showFoodForm(null);
  });

  const listEl = document.getElementById('admin-food-list');
  menuItems.forEach(item => {
    const row = document.createElement('div');
    row.className = 'admin-list-row';
    row.innerHTML = `
      <span>${sanitize(item.emoji || '🍽️')} ${sanitize(item.name)}</span>
      <div class="admin-row-actions">
        <button class="btn btn--sm" data-id="${sanitize(item.id)}" data-action="edit" type="button">✏️ Edit</button>
        <button class="btn btn--sm btn--danger" data-id="${sanitize(item.id)}" data-action="delete" type="button">🗑️ Delete</button>
      </div>
    `;
    row.querySelector('[data-action="edit"]').addEventListener('click', () => showFoodForm(item));
    row.querySelector('[data-action="delete"]').addEventListener('click', () => deleteFood(item.id));
    listEl.appendChild(row);
  });
}

function showFoodForm(item) {
  const area = document.getElementById('admin-food-form-area');
  if (!area) return;
  const isEdit = !!item;
  const variants = isEdit && Array.isArray(item.variants) ? item.variants : [{ label: 'Regular', price: 0 }];

  area.innerHTML = `
    <div class="admin-form">
      <h4>${isEdit ? 'Edit' : 'Add'} Food Item</h4>
      <label>Name*<input id="af-name" type="text" maxlength="80" value="${isEdit ? sanitize(item.name) : ''}" /></label>
      <label>Description<textarea id="af-desc" maxlength="300">${isEdit ? sanitize(item.description || '') : ''}</textarea></label>
      <label>Category*<select id="af-cat">
        ${['burgers','pizzas','soups','broast','rolls','drinks','desserts','other']
          .map(c => `<option value="${c}"${isEdit && item.category === c ? ' selected' : ''}>${c}</option>`).join('')}
      </select></label>
      <label>Emoji<input id="af-emoji" type="text" maxlength="4" value="${isEdit ? sanitize(item.emoji || '') : '🍽️'}" /></label>
      <label>Badge<input id="af-badge" type="text" maxlength="40" value="${isEdit ? sanitize(item.badge || '') : ''}" /></label>
      <label>Image<input id="af-image" type="file" accept="image/*" /></label>
      <div id="af-variants-area">
        <label>Variants (label + price)</label>
        ${variants.map((v, i) => `
          <div class="af-variant-row">
            <input class="af-v-label" type="text" placeholder="Label" maxlength="30" value="${sanitize(v.label)}" />
            <input class="af-v-price" type="number" min="0" placeholder="Price" value="${Number(v.price)}" />
            <button class="btn btn--sm btn--danger af-rm-variant" type="button">✕</button>
          </div>`).join('')}
      </div>
      <button class="btn btn--sm" id="af-add-variant" type="button">+ Add Variant</button>
      <div class="admin-form-actions">
        <button class="btn btn--gold" id="af-save" type="button">💾 Save</button>
        <button class="btn" id="af-cancel" type="button">Cancel</button>
      </div>
    </div>
  `;

  area.querySelector('#af-add-variant').addEventListener('click', () => {
    const vArea = area.querySelector('#af-variants-area');
    const row = document.createElement('div');
    row.className = 'af-variant-row';
    row.innerHTML = `
      <input class="af-v-label" type="text" placeholder="Label" maxlength="30" />
      <input class="af-v-price" type="number" min="0" placeholder="Price" value="0" />
      <button class="btn btn--sm btn--danger af-rm-variant" type="button">✕</button>
    `;
    row.querySelector('.af-rm-variant').addEventListener('click', () => row.remove());
    vArea.appendChild(row);
  });
  area.querySelectorAll('.af-rm-variant').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.af-variant-row').remove());
  });

  area.querySelector('#af-cancel').addEventListener('click', () => { area.innerHTML = ''; });
  area.querySelector('#af-save').addEventListener('click', () => saveFoodItem(area, isEdit ? item.id : null));
}

async function saveFoodItem(area, existingId) {
  const name  = area.querySelector('#af-name').value.trim();
  const desc  = area.querySelector('#af-desc').value.trim();
  const cat   = area.querySelector('#af-cat').value;
  const emoji = area.querySelector('#af-emoji').value.trim() || '🍽️';
  const badge = area.querySelector('#af-badge').value.trim() || null;
  const imgFile = area.querySelector('#af-image').files[0];

  if (!Validate.name(name)) { showToast('⚠️ Name must be 2–80 chars.'); return; }

  const variantRows = area.querySelectorAll('.af-variant-row');
  const variants = [];
  let variantsValid = true;
  variantRows.forEach(row => {
    const label = row.querySelector('.af-v-label').value.trim();
    const price = Number(row.querySelector('.af-v-price').value);
    if (!label || !Validate.price(price)) { variantsValid = false; return; }
    variants.push({ label, price });
  });
  if (!variantsValid || variants.length === 0) { showToast('⚠️ Check variant labels & prices.'); return; }

  const id = existingId || `item-${Date.now()}`;
  let imageUrl = null;

  // Upload image to Firebase Storage
  if (imgFile && _storage) {
    try {
      const { ref, uploadBytes, getDownloadURL } = await import(`${FB_CDN}/firebase-storage.js`);
      const imgRef = ref(_storage, `menuImages/${id}-${imgFile.name}`);
      const snap   = await uploadBytes(imgRef, imgFile);
      imageUrl     = await getDownloadURL(snap.ref);
    } catch (err) {
      console.warn('[O-Bailia] Image upload failed:', err);
      showToast('⚠️ Image upload failed — saving without image.');
    }
  }

  const data = { name, description: desc, category: cat, emoji, badge, variants };
  if (imageUrl) data.imageUrl = imageUrl;

  if (_db) {
    try {
      const { doc, setDoc } = await import(`${FB_CDN}/firebase-firestore.js`);
      await setDoc(doc(_db, 'menuItems', id), data);
      showToast(`✅ ${name} saved to Firestore.`);
    } catch (err) {
      console.error('[O-Bailia] Save food error:', err);
      showToast('❌ Firestore save failed.');
      return;
    }
  }

  // Update local state
  const localIdx = menuItems.findIndex(m => m.id === id);
  if (localIdx >= 0) menuItems[localIdx] = { id, ...data };
  else               menuItems.push({ id, ...data });

  area.innerHTML = '';
  renderMenu();
  renderAdminTab('menu');
  showToast(`✅ ${name} saved.`);
}

async function deleteFood(id) {
  if (!confirm('Delete this food item? This cannot be undone.')) return;
  if (_db) {
    try {
      const { doc, deleteDoc } = await import(`${FB_CDN}/firebase-firestore.js`);
      await deleteDoc(doc(_db, 'menuItems', id));
    } catch (err) {
      console.error('[O-Bailia] Delete food error:', err);
      showToast('❌ Delete failed.'); return;
    }
  }
  menuItems = menuItems.filter(m => m.id !== id);
  renderMenu();
  renderAdminTab('menu');
  showToast('🗑️ Item deleted.');
}

/* ── Admin: Tables Management ───────────────────────────────── */
function renderAdminTablesTab(el) {
  el.innerHTML = `
    <div class="admin-section">
      <h3>Tables</h3>
      <button class="btn btn--gold" id="admin-add-table-btn" type="button">+ Add Table</button>
      <div id="admin-tables-list" class="admin-list"></div>
      <div id="admin-table-form-area"></div>
    </div>
  `;
  document.getElementById('admin-add-table-btn').addEventListener('click', () => showTableForm(null));
  renderAdminTablesList();
}

function renderAdminTablesList() {
  const listEl = document.getElementById('admin-tables-list');
  if (!listEl) return;
  listEl.innerHTML = '';
  tablesData.forEach(table => {
    const row = document.createElement('div');
    row.className = 'admin-list-row';
    row.innerHTML = `
      <span>Table #${sanitize(String(table.number))} | Capacity: ${sanitize(String(table.capacity))} |
        <strong style="color:${table.reserved ? '#E63946' : '#2a9d8f'}">${table.reserved ? '🔴 Reserved' : '🟢 Free'}</strong>
        ${table.reserved ? `(${sanitize(table.reservedBy || '')})` : ''}
      </span>
      <div class="admin-row-actions">
        <button class="btn btn--sm" data-id="${sanitize(table.id)}" data-action="toggle" type="button">${table.reserved ? 'Mark Free' : 'Mark Reserved'}</button>
        <button class="btn btn--sm btn--danger" data-id="${sanitize(table.id)}" data-action="delete" type="button">🗑️</button>
      </div>
    `;
    row.querySelector('[data-action="toggle"]').addEventListener('click', () => toggleTableStatus(table.id));
    row.querySelector('[data-action="delete"]').addEventListener('click', () => deleteTable(table.id));
    listEl.appendChild(row);
  });
}

function showTableForm(table) {
  const area = document.getElementById('admin-table-form-area');
  if (!area) return;
  area.innerHTML = `
    <div class="admin-form">
      <h4>Add Table</h4>
      <label>Table Number*<input id="tf-number" type="number" min="1" max="500" value="${table ? table.number : ''}" /></label>
      <label>Capacity (seats)*<input id="tf-capacity" type="number" min="1" max="20" value="${table ? table.capacity : 4}" /></label>
      <div class="admin-form-actions">
        <button class="btn btn--gold" id="tf-save" type="button">💾 Save</button>
        <button class="btn" id="tf-cancel" type="button">Cancel</button>
      </div>
    </div>
  `;
  area.querySelector('#tf-cancel').addEventListener('click', () => { area.innerHTML = ''; });
  area.querySelector('#tf-save').addEventListener('click', async () => {
    const number   = Number(area.querySelector('#tf-number').value);
    const capacity = Number(area.querySelector('#tf-capacity').value);
    if (!Validate.tableNo(number)) { showToast('⚠️ Invalid table number.'); return; }
    if (!Validate.guests(capacity)) { showToast('⚠️ Invalid capacity.'); return; }
    if (tablesData.some(t => t.number === number && (!table || t.id !== table.id))) {
      showToast('⚠️ Table number already exists.'); return;
    }
    const id   = table ? table.id : `table-${Date.now()}`;
    const data = { number, capacity, reserved: false, reservedBy: null };
    if (_db) {
      try {
        const { doc, setDoc } = await import(`${FB_CDN}/firebase-firestore.js`);
        await setDoc(doc(_db, 'tables', id), data);
      } catch (err) { showToast('❌ Save failed.'); return; }
    }
    const idx = tablesData.findIndex(t => t.id === id);
    if (idx >= 0) tablesData[idx] = { id, ...data };
    else          tablesData.push({ id, ...data });
    area.innerHTML = '';
    renderAdminTablesList();
    showToast(`✅ Table #${number} saved.`);
  });
}

async function toggleTableStatus(id) {
  const table = tablesData.find(t => t.id === id);
  if (!table) return;
  const newVal = !table.reserved;
  if (_db) {
    try {
      const { doc, updateDoc } = await import(`${FB_CDN}/firebase-firestore.js`);
      await updateDoc(doc(_db, 'tables', id), { reserved: newVal, reservedBy: newVal ? 'Admin' : null });
    } catch (err) { showToast('❌ Update failed.'); return; }
  }
  table.reserved   = newVal;
  table.reservedBy = newVal ? 'Admin' : null;
  renderAdminTablesList();
  showToast(`Table #${table.number} marked ${newVal ? 'reserved' : 'free'}.`);
}

async function deleteTable(id) {
  if (!confirm('Delete this table?')) return;
  if (_db) {
    try {
      const { doc, deleteDoc } = await import(`${FB_CDN}/firebase-firestore.js`);
      await deleteDoc(doc(_db, 'tables', id));
    } catch (err) { showToast('❌ Delete failed.'); return; }
  }
  tablesData = tablesData.filter(t => t.id !== id);
  renderAdminTablesList();
  showToast('🗑️ Table deleted.');
}

/* ── Admin: Reservations Management ─────────────────────────── */
function renderAdminReservationsTab(el) {
  el.innerHTML = `
    <div class="admin-section">
      <h3>Reservations</h3>
      <div id="admin-res-list" class="admin-list"></div>
    </div>
  `;
  const listEl = document.getElementById('admin-res-list');
  if (!reservationsData.length) {
    listEl.innerHTML = '<p style="color:#aaa;padding:12px;">No reservations found.</p>';
    return;
  }
  reservationsData.forEach(res => {
    const row = document.createElement('div');
    row.className = 'admin-list-row';
    row.innerHTML = `
      <div>
        <strong>${sanitize(res.name)}</strong> | ${sanitize(res.phone)}<br/>
        Table #${sanitize(String(res.tableNumber))} | ${sanitize(res.date)} ${sanitize(res.time)} | ${sanitize(String(res.guests))} guests
        <span style="color:#F4A261"> — ${sanitize(res.status || 'pending')}</span>
      </div>
      <div class="admin-row-actions">
        <button class="btn btn--sm" data-id="${sanitize(res.id)}" data-action="confirm" type="button">✅ Confirm</button>
        <button class="btn btn--sm btn--danger" data-id="${sanitize(res.id)}" data-action="cancel" type="button">❌ Cancel</button>
      </div>
    `;
    row.querySelector('[data-action="confirm"]').addEventListener('click', () => updateReservationStatus(res.id, 'confirmed'));
    row.querySelector('[data-action="cancel"]').addEventListener('click',  () => updateReservationStatus(res.id, 'cancelled'));
    listEl.appendChild(row);
  });
}

async function updateReservationStatus(id, status) {
  if (_db) {
    try {
      const { doc, updateDoc } = await import(`${FB_CDN}/firebase-firestore.js`);
      await updateDoc(doc(_db, 'reservations', id), { status });
    } catch (err) { showToast('❌ Update failed.'); return; }
  }
  const res = reservationsData.find(r => r.id === id);
  if (res) res.status = status;
  renderAdminTab('reservations');
  showToast(`Reservation ${status}.`);
}

/* ── Admin: Settings ────────────────────────────────────────── */
function renderAdminSettingsTab(el) {
  el.innerHTML = `
    <div class="admin-form">
      <h3>Dynamic Settings</h3>
      <label>Delivery Charge (${sanitize(settings.currencySymbol)})
        <input id="as-delivery" type="number" min="0" value="${settings.deliveryCharge}" />
      </label>
      <label>WhatsApp Number
        <input id="as-wa" type="text" maxlength="20" value="${sanitize(settings.waNumber)}" />
      </label>
      <div class="admin-form-actions">
        <button class="btn btn--gold" id="as-save" type="button">💾 Save Settings</button>
      </div>
    </div>
  `;
  el.querySelector('#as-save').addEventListener('click', async () => {
    const delivery = Number(el.querySelector('#as-delivery').value);
    const waNum    = el.querySelector('#as-wa').value.trim().replace(/\D/g, '');
    if (!Validate.price(delivery)) { showToast('⚠️ Invalid delivery charge.'); return; }
    if (!waNum || waNum.length < 7) { showToast('⚠️ Invalid WhatsApp number.'); return; }

    settings.deliveryCharge = delivery;
    settings.waNumber       = waNum;

    if (_db) {
      try {
        const { doc, setDoc } = await import(`${FB_CDN}/firebase-firestore.js`);
        await setDoc(doc(_db, 'settings', 'global'), { deliveryCharge: delivery, waNumber: waNum });
      } catch (err) { console.warn('[O-Bailia] Settings save error:', err); }
    }
    showToast('✅ Settings updated.');
  });
}

/* ── Admin Login Modal ──────────────────────────────────────── */
function showAdminLoginModal() {
  let modal = document.getElementById('admin-login-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'admin-login-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
      <div style="background:#1a1a2e;color:#fff;padding:2rem;border-radius:12px;min-width:300px;max-width:90vw;">
        <h3 style="margin:0 0 1rem;color:#F4A261;">🔐 Admin Login</h3>
        <label style="display:block;margin-bottom:.5rem;">Email
          <input id="al-email" type="email" style="width:100%;padding:.5rem;margin-top:.25rem;background:#111;color:#fff;border:1px solid #444;border-radius:6px;" />
        </label>
        <label style="display:block;margin-bottom:1rem;">Password
          <input id="al-password" type="password" style="width:100%;padding:.5rem;margin-top:.25rem;background:#111;color:#fff;border:1px solid #444;border-radius:6px;" />
        </label>
        <div style="display:flex;gap:.75rem;justify-content:flex-end;">
          <button id="al-cancel" style="padding:.5rem 1rem;background:#444;color:#fff;border:none;border-radius:6px;cursor:pointer;" type="button">Cancel</button>
          <button id="al-submit" style="padding:.5rem 1rem;background:#E63946;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:700;" type="button">Login</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  modal.style.display = 'flex';

  modal.querySelector('#al-cancel').onclick = () => { modal.style.display = 'none'; };
  modal.querySelector('#al-submit').onclick = async () => {
    const email = modal.querySelector('#al-email').value.trim();
    const pass  = modal.querySelector('#al-password').value;
    const ok    = await adminLogin(email, pass);
    if (ok) { modal.style.display = 'none'; openAdminPanel(); }
  };
  modal.querySelector('#al-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') modal.querySelector('#al-submit').click();
  });
}

function initAdminUI() {
  // BUG FIX: HTML inline script already handles admin-login-btn click and admin-overlay open/close.
  // app.js should NOT re-bind admin-login-btn (would cause double modal or conflict).
  // Only wire up logout + panel-btn (if they exist) and restore session.
  const logoutBtn = document.getElementById('admin-logout-btn');
  const panelBtn  = document.getElementById('admin-panel-btn');

  if (logoutBtn) logoutBtn.addEventListener('click', adminLogout);
  if (panelBtn)  panelBtn.addEventListener('click', openAdminPanel);

  // Wire the admin-submit-btn inside the HTML overlay to use proper SHA auth
  // (the inline script uses a plain text compare; here we upgrade to SHA-256 hash if set)
  const adminSubmitBtn = document.getElementById('admin-submit-btn');
  if (adminSubmitBtn && ADMIN_PASS_SHA) {
    // Remove previous inline listener by cloning the node
    const newBtn = adminSubmitBtn.cloneNode(true);
    adminSubmitBtn.parentNode.replaceChild(newBtn, adminSubmitBtn);
    newBtn.addEventListener('click', async () => {
      const u    = (document.getElementById('admin-user') || {}).value || '';
      const p    = (document.getElementById('admin-pass') || {}).value || '';
      const hash = await sha256(p);
      const err  = document.getElementById('admin-login-error');
      if (u === 'admin' && hash === ADMIN_PASS_SHA) {
        currentAdmin = { uid: 'local-admin', email: u };
        sessionStorage.setItem('obailia_admin', JSON.stringify(currentAdmin));
        document.getElementById('admin-login-screen').style.display = 'none';
        document.getElementById('admin-dashboard').style.display    = 'block';
        showToast('✅ Admin logged in.');
      } else if (u === 'admin' && p === 'obailia2025') {
        // Fallback plain-text demo creds (same as inline script)
        currentAdmin = { uid: 'local-admin', email: u };
        sessionStorage.setItem('obailia_admin', JSON.stringify(currentAdmin));
        document.getElementById('admin-login-screen').style.display = 'none';
        document.getElementById('admin-dashboard').style.display    = 'block';
        showToast('✅ Admin logged in.');
      } else {
        if (err) err.textContent = 'Invalid credentials. Try again.';
      }
    });
  }

  // Restore session from sessionStorage for local-admin fallback
  try {
    const stored = sessionStorage.getItem('obailia_admin');
    if (stored) currentAdmin = JSON.parse(stored);
  } catch (_) {}
  updateAdminUI();
}

/* ─────────────────────────────────────────────────────────────── */
/*  RESERVATION SYSTEM                                             */
/* ─────────────────────────────────────────────────────────────── */

async function loadTables() {
  if (!_db) return;
  try {
    const { collection, getDocs } = await import(`${FB_CDN}/firebase-firestore.js`);
    const snap = await getDocs(collection(_db, 'tables'));
    tablesData = [];
    snap.forEach(d => tablesData.push({ id: d.id, ...d.data() }));
  } catch (err) { console.warn('[O-Bailia] Load tables error:', err); }
}

async function loadReservations() {
  if (!_db) return;
  try {
    const { collection, getDocs, orderBy, query } = await import(`${FB_CDN}/firebase-firestore.js`);
    const q    = query(collection(_db, 'reservations'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    reservationsData = [];
    snap.forEach(d => reservationsData.push({ id: d.id, ...d.data() }));
  } catch (err) { console.warn('[O-Bailia] Load reservations error:', err); }
}

async function submitReservation(data) {
  // data: { name, phone, email, date, time, guests, tableId, tableNumber }
  if (!Validate.name(data.name))    { showToast('⚠️ Name is required (2–80 chars).'); return false; }
  if (!Validate.phone(data.phone))  { showToast('⚠️ Invalid phone number.'); return false; }
  if (!Validate.date(data.date))    { showToast('⚠️ Invalid date.'); return false; }
  if (!Validate.guests(data.guests)){ showToast('⚠️ Guests must be 1–20.'); return false; }

  // Double-booking check
  const conflict = reservationsData.find(r =>
    r.tableId === data.tableId &&
    r.date    === data.date    &&
    r.time    === data.time    &&
    r.status  !== 'cancelled'
  );
  if (conflict) {
    showToast('⚠️ That table is already reserved at this time. Please choose another.');
    return false;
  }

  const id  = `res-${Date.now()}`;
  const doc = {
    ...data,
    id,
    status:    'pending',
    createdAt: new Date().toISOString()
  };

  if (_db) {
    try {
      const { doc: fsDoc, setDoc, updateDoc } = await import(`${FB_CDN}/firebase-firestore.js`);
      await setDoc(fsDoc(_db, 'reservations', id), doc);
      // Mark table reserved
      await updateDoc(fsDoc(_db, 'tables', data.tableId), {
        reserved:   true,
        reservedBy: data.name
      });
    } catch (err) {
      console.error('[O-Bailia] Reservation save error:', err);
      showToast('❌ Booking failed. Please try again.');
      return false;
    }
  }

  reservationsData.push(doc);
  const table = tablesData.find(t => t.id === data.tableId);
  if (table) { table.reserved = true; table.reservedBy = data.name; }

  showToast(`✅ Table #${data.tableNumber} reserved for ${data.name}!`);
  return true;
}

function getFreeTables()     { return tablesData.filter(t => !t.reserved); }
function getReservedTables() { return tablesData.filter(t =>  t.reserved); }

function initReservationForm() {
  // BUG FIX: HTML uses 'reserve-form' and 'reserve-overlay', not 'reservation-form'
  // Also wire up FAB and hero reserve buttons to open the modal
  const reserveOverlay  = document.getElementById('reserve-overlay');
  const reserveCloseBtn = document.getElementById('reserve-close-btn');
  const reserveFabBtn   = document.getElementById('reserve-fab-btn');

  const openReserveModal = () => {
    if (reserveOverlay) {
      reserveOverlay.classList.add('open');
      reserveOverlay.style.display = 'flex';
    }
  };
  const closeReserveModal = () => {
    if (reserveOverlay) {
      reserveOverlay.classList.remove('open');
      reserveOverlay.style.display = '';
    }
  };

  if (reserveFabBtn)   reserveFabBtn.addEventListener('click', openReserveModal);
  if (reserveCloseBtn) reserveCloseBtn.addEventListener('click', closeReserveModal);
  if (reserveOverlay)  reserveOverlay.addEventListener('click', (e) => { if (e.target === reserveOverlay) closeReserveModal(); });

  // Wire reserve submit button to WhatsApp (HTML uses WhatsApp flow, not Firestore form submit)
  const reserveSubmitBtn = document.getElementById('reserve-submit-btn');
  if (reserveSubmitBtn) {
    reserveSubmitBtn.addEventListener('click', () => {
      const name     = document.getElementById('r-name')?.value.trim()     || '';
      const phone    = document.getElementById('r-phone')?.value.trim()    || '';
      const date     = document.getElementById('r-date')?.value            || '';
      const time     = document.getElementById('r-time')?.value            || '';
      const guests   = document.getElementById('r-guests')?.value          || '2';
      const occasion = document.getElementById('r-occasion')?.value        || 'None';
      const notes    = document.getElementById('r-notes')?.value.trim()    || '';

      if (!name)  { showToast('⚠️ Please enter your name.');   return; }
      if (!phone) { showToast('⚠️ Please enter phone number.'); return; }
      if (!date)  { showToast('⚠️ Please select a date.');      return; }
      if (!time)  { showToast('⚠️ Please select a time.');      return; }

      const msg = encodeURIComponent(
        `Hi O-Bailia! 📅 Table Reservation Request:\nName: ${name}\nPhone: ${phone}\nDate: ${date}\nTime: ${time}\nGuests: ${guests}\nOccasion: ${occasion}\nNotes: ${notes || 'None'}`
      );
      window.open(`https://wa.me/${settings.waNumber}?text=${msg}`, '_blank', 'noopener');
      closeReserveModal();
      showToast('✅ Redirecting to WhatsApp for confirmation!');
    });
  }

  // Legacy Firestore form (admin panel reservation form)
  const form = document.getElementById('reservation-form');
  if (!form) return;

  // Populate table selector dynamically
  const tableSelect = form.querySelector('#res-table');
  if (tableSelect) {
    tableSelect.innerHTML = '<option value="">— Select Table —</option>' +
      getFreeTables().map(t =>
        `<option value="${sanitize(t.id)}" data-number="${t.number}">#${t.number} (${t.capacity} seats)</option>`
      ).join('');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name        = form.querySelector('#res-name')?.value.trim()  || '';
    const phone       = form.querySelector('#res-phone')?.value.trim() || '';
    const email       = form.querySelector('#res-email')?.value.trim() || '';
    const date        = form.querySelector('#res-date')?.value         || '';
    const time        = form.querySelector('#res-time')?.value         || '';
    const guests      = Number(form.querySelector('#res-guests')?.value || 0);
    const tableOpt    = form.querySelector('#res-table');
    const tableId     = tableOpt?.value || '';
    const tableNumber = tableOpt?.selectedOptions[0]?.dataset.number || '';

    if (!tableId) { showToast('⚠️ Please select a table.'); return; }

    const ok = await submitReservation({ name, phone, email, date, time, guests, tableId, tableNumber: Number(tableNumber) });
    if (ok) {
      form.reset();
      // Refresh table selector
      if (tableSelect) {
        tableSelect.innerHTML = '<option value="">— Select Table —</option>' +
          getFreeTables().map(t =>
            `<option value="${sanitize(t.id)}" data-number="${t.number}">#${t.number} (${t.capacity} seats)</option>`
          ).join('');
      }
    }
  });
}

/* ─────────────────────────────────────────────────────────────── */
/*  DYNAMIC SETTINGS FROM FIRESTORE                                */
/* ─────────────────────────────────────────────────────────────── */

async function loadDynamicSettings() {
  if (!_db) return;
  try {
    const { doc, getDoc } = await import(`${FB_CDN}/firebase-firestore.js`);
    const snap = await getDoc(doc(_db, 'settings', 'global'));
    if (snap.exists()) {
      const data = snap.data();
      if (data.deliveryCharge !== undefined) settings.deliveryCharge = Number(data.deliveryCharge);
      if (data.waNumber)                     settings.waNumber       = data.waNumber;
    }
  } catch (err) { console.warn('[O-Bailia] Load settings error:', err); }
}

/* ─────────────────────────────────────────────────────────────── */
/*  AI RESTAURANT ASSISTANT                                        */
/* ─────────────────────────────────────────────────────────────── */

function buildAISystemPrompt() {
  const freeTables     = getFreeTables();
  const reservedTables = getReservedTables();

  const menuSummary = menuItems.map(item => {
    const prices = Array.isArray(item.variants)
      ? item.variants.map(v => `${v.label}: Rs.${v.price}`).join(', ')
      : `Rs.${item.price || 0}`;
    return `- ${item.name} (${item.category}): ${prices}${item.badge ? ' [' + item.badge + ']' : ''}`;
  }).join('\n');

  return `You are the friendly AI assistant for O-Bailia Restaurant — House of Taste, located at Kot Sultan, Nawabshah Road, Sanghar, Sindh.

You help customers with:
- Menu items and prices
- Table availability
- Reservations info
- Delivery charges
- Opening hours

CURRENT MENU:
${menuSummary}

TABLE STATUS:
Free tables: ${freeTables.length ? freeTables.map(t => `#${t.number} (${t.capacity} seats)`).join(', ') : 'None available right now'}
Reserved tables: ${reservedTables.length ? reservedTables.map(t => `#${t.number}`).join(', ') : 'None reserved'}

DELIVERY CHARGE: Rs.${settings.deliveryCharge}

OPENING HOURS:
Monday–Sunday: 12:00 PM – 12:00 AM (midnight)

Rules:
- Be warm, helpful and concise (2–4 sentences max unless listing items)
- Always mention that customers can order via WhatsApp
- For reservations, direct them to the reservation form on the page
- If unsure, say so honestly`;
}

async function askAIAssistant(userMessage) {
  if (!userMessage || !userMessage.trim()) return '';

  aiChatHistory.push({ role: 'user', content: userMessage.trim() });

  // Keep last 12 messages to stay within context
  if (aiChatHistory.length > 12) aiChatHistory = aiChatHistory.slice(-12);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 400,
        system:     buildAISystemPrompt(),
        messages:   aiChatHistory
      })
    });

    if (!response.ok) throw new Error(`API error ${response.status}`);
    const data  = await response.json();
    const reply = data.content?.map(b => b.type === 'text' ? b.text : '').join('') || '';

    aiChatHistory.push({ role: 'assistant', content: reply });
    return reply;
  } catch (err) {
    console.error('[O-Bailia] AI assistant error:', err);
    aiChatHistory.pop(); // remove failed user message from history
    return "Sorry, I'm having a little trouble right now. Please ask again or contact us directly on WhatsApp! 📲";
  }
}

function initAIChat() {
  // BUG FIX: Updated IDs to match HTML — was using wrong ai-chat-* IDs
  const input      = document.getElementById('assistant-input');
  const messagesEl = document.getElementById('assistant-messages');
  const sendBtn    = document.getElementById('assistant-send-btn');
  const overlay    = document.getElementById('assistant-overlay');
  const closeBtn   = document.getElementById('assistant-close-btn');
  const fabBtn     = document.getElementById('assistant-fab-btn');

  // Open/close assistant drawer via FAB
  if (fabBtn && overlay) {
    fabBtn.addEventListener('click', () => {
      overlay.classList.add('open');
      overlay.style.display = 'flex';
      if (messagesEl && !messagesEl.children.length) {
        appendAIMessage('assistant', "👋 Hi! I'm your O-Bailia assistant. Ask me about our menu, prices, table availability, or anything else!");
      }
      if (input) input.focus();
    });
  }

  if (closeBtn && overlay) {
    closeBtn.addEventListener('click', () => {
      overlay.classList.remove('open');
      overlay.style.display = '';
    });
  }
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('open');
        overlay.style.display = '';
      }
    });
  }

  if (!input || !messagesEl || !sendBtn) return;

  const sendMessage = async () => {
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    appendAIMessage('user', msg);

    const typingEl = appendAIMessage('assistant', '...', true);
    const reply    = await askAIAssistant(msg);
    typingEl.remove();
    appendAIMessage('assistant', reply);
  };

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
}

function appendAIMessage(role, text, isTyping = false) {
  // BUG FIX: HTML uses 'assistant-messages', not 'ai-chat-messages'
  const messagesEl = document.getElementById('assistant-messages');
  if (!messagesEl) return document.createElement('div');

  const el = document.createElement('div');
  el.className = `ai-msg ai-msg--${role}${isTyping ? ' ai-msg--typing' : ''}`;
  el.innerHTML = `<span class="ai-msg-bubble">${sanitize(text)}</span>`;
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return el;
}

/* ─────────────────────────────────────────────────────────────── */
/*  FIRESTORE FETCH ENGINE                                         */
/* ─────────────────────────────────────────────────────────────── */

/*
  Dynamic import of firestore module happens here, NOT in
  index.html's module script. This avoids a duplicate-module issue
  and ensures __firestore is readable before we call getDocs.
*/
async function fetchMenuFromFirestore() {
  try {
    if (!_db && !window.__firestore) {
      throw new Error('Firestore not initialized (demo mode).');
    }
    const db = _db || window.__firestore;
    const { collection, getDocs } = await import(`${FB_CDN}/firebase-firestore.js`);
    const snapshot = await getDocs(collection(db, 'menuItems'));
    const items = [];
    snapshot.forEach((doc) => items.push({ id: doc.id, ...doc.data() }));
    if (items.length === 0) throw new Error('Firestore collection empty — using demo data.');
    return items;
  } catch (err) {
    console.warn('[O-Bailia] Firestore:', err.message);
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────── */
/*  MENU INIT CONTROLLER                                           */
/* ─────────────────────────────────────────────────────────────── */
async function initMenu() {
  const fetched = await fetchMenuFromFirestore();
  menuItems = fetched || demoMenu;
  renderMenu();

  // BUG FIX: Only attach filter tab listeners ONCE — prevents duplicate handlers
  if (!filterTabsInited) {
    initFilterTabs();
    filterTabsInited = true;
  }
}
/* ─────────────────────────────────────────────────────────────── */
/*  RENDER MENU                                                    */
/* ─────────────────────────────────────────────────────────────── */
function renderMenu() {
  const grid    = document.getElementById('menu-grid');
  const emptyEl = document.getElementById('empty-state');
  if (!grid) return;

  const filtered = currentMenuFilter === 'all'
    ? menuItems
    : menuItems.filter(item => item.category === currentMenuFilter);

  // Clear all existing cards (including skeleton loaders)
  grid.innerHTML = '';

  if (filtered.length === 0) {
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  filtered.forEach((item) => {
    const card = buildMenuCard(item);
    grid.appendChild(card);
  });

  // Observe the freshly rendered cards for scroll-reveal
  observeRevealElements(grid);
  // Trigger lazy image loading and animations for new cards
  initLazyImages(grid);
  triggerAnimations(grid);
}

/* ─────────────────────────────────────────────────────────────── */
/*  BUILD MENU CARD DOM ELEMENT                                    */
/* ─────────────────────────────────────────────────────────────── */
function buildMenuCard(item) {
  const card = document.createElement('article');
  card.className = 'menu-card reveal';
  card.setAttribute('role', 'listitem');
  card.dataset.itemId = item.id;

  // Normalize variants
  const variants = (Array.isArray(item.variants) && item.variants.length)
    ? item.variants
    : [{ label: 'Regular', price: (item.price || 0) }];

  /*
    BUG FIX: Use a state object so the Add-to-Cart closure ALWAYS reads
    the currently selected variant — not a stale closure value.
  */
  const state = { activeVariant: variants[0] };

  // Build badge HTML
  const badgeHTML = item.badge
    ? `<div class="menu-card-badge">${sanitize(item.badge)}</div>`
    : '';

  // Build variant pills HTML (only shown when multiple variants exist)
  const variantPillsHTML = variants.length > 1
    ? `<div class="variant-pills" role="group" aria-label="Select size or portion">
        ${variants.map((v, vi) =>
          `<button
            class="variant-pill${vi === 0 ? ' active' : ''}"
            data-variant-index="${vi}"
            data-price="${Number(v.price)}"
            aria-pressed="${vi === 0 ? 'true' : 'false'}"
            type="button"
          >${sanitize(v.label)} — ${sanitize(settings.currencySymbol)}${sanitize(String(v.price))}</button>`
        ).join('')}
      </div>`
    : '';

  // Build image HTML with lazy loading
  const imageHTML = item.imageUrl
    ? `<div class="menu-card-img-wrap"><img data-src="${sanitize(item.imageUrl)}" alt="${sanitize(item.name)}" class="menu-card-img" loading="lazy" width="300" height="180" /></div>`
    : '';

  card.innerHTML = `
    ${badgeHTML}
    ${imageHTML}
    <div class="menu-card-emoji" aria-hidden="true">${imageHTML ? '' : sanitize(item.emoji || '🍽️')}</div>
    <div class="menu-card-body">
      <h3 class="menu-card-name">${sanitize(item.name)}</h3>
      <p class="menu-card-desc">${sanitize(item.description || '')}</p>
      ${variantPillsHTML}
      <div class="menu-card-price-row">
        <div class="menu-card-price">
          <span class="price-currency">${sanitize(settings.currencySymbol)}</span><span class="price-value">${sanitize(String(state.activeVariant.price))}</span>
        </div>
      </div>
      <button class="add-to-cart-btn" type="button" aria-label="Add ${sanitize(item.name)} to cart">
        <span aria-hidden="true">+</span> Add to Cart
      </button>
    </div>
  `;

  // ── Variant pill interactions ────────────────────────────────
  const pills        = card.querySelectorAll('.variant-pill');
  const priceDisplay = card.querySelector('.price-value');

  pills.forEach((pill) => {
    pill.addEventListener('click', () => {
      // Deactivate all pills
      pills.forEach(p => {
        p.classList.remove('active');
        p.setAttribute('aria-pressed', 'false');
      });
      // Activate clicked pill
      pill.classList.add('active');
      pill.setAttribute('aria-pressed', 'true');
      // Update state object — closure in Add-to-Cart will read this
      const varIdx        = parseInt(pill.dataset.variantIndex, 10);
      state.activeVariant = variants[varIdx];
      // Update displayed price
      if (priceDisplay) priceDisplay.textContent = state.activeVariant.price;
    });
  });

  // ── Add to Cart button ───────────────────────────────────────
  card.querySelector('.add-to-cart-btn').addEventListener('click', () => {
    addToCart(item, state.activeVariant);
  });

  return card;
}

/* ─────────────────────────────────────────────────────────────── */
/*  FILTER TABS                                                    */
/* ─────────────────────────────────────────────────────────────── */
function initFilterTabs() {
  const tabs = document.querySelectorAll('.filter-tab');
  if (!tabs.length) return;

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      // Update active state visually and ARIA
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      // Update filter state and re-render menu
      currentMenuFilter = tab.dataset.filter;
      renderMenu();
    });
  });
}

/* ─────────────────────────────────────────────────────────────── */
/*  CART HELPERS                                                   */
/* ─────────────────────────────────────────────────────────────── */

/* Unique key per item + variant combination */
function generateCartKey(item, variant) {
  return `${item.id}__${variant.label}`;
}

function addToCart(item, variant) {
  const key      = generateCartKey(item, variant);
  const existing = cart.find(c => c.key === key);

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      key,
      itemId:   item.id,
      name:     item.name,
      emoji:    item.emoji || '🍽️',
      variant:  variant.label,
      price:    variant.price,
      quantity: 1
    });
  }

  updateCartBadge();
  bumpCartBadge();

  // Only re-render cart body if the drawer is currently open
  const overlay = document.getElementById('cart-overlay');
  if (overlay && overlay.classList.contains('open')) {
    renderCartDrawer();
  }

  showToast(`✅ ${item.name} (${variant.label}) added!`);
}

function incrementCartItem(key) {
  const entry = cart.find(c => c.key === key);
  if (entry) entry.quantity += 1;
  updateCartBadge();
  renderCartDrawer();
}

function decrementCartItem(key) {
  const idx = cart.findIndex(c => c.key === key);
  if (idx === -1) return;
  if (cart[idx].quantity > 1) {
    cart[idx].quantity -= 1;
  } else {
    cart.splice(idx, 1);
  }
  updateCartBadge();
  renderCartDrawer();
}

function removeCartItem(key) {
  const idx = cart.findIndex(c => c.key === key);
  if (idx === -1) return;
  const name = cart[idx].name;
  cart.splice(idx, 1);
  updateCartBadge();
  renderCartDrawer();
  showToast(`🗑️ ${name} removed`);
}

function getCartSubtotal() {
  return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

function getCartTotal() {
  const subtotal = getCartSubtotal();
  return cart.length > 0 ? subtotal + settings.deliveryCharge : 0;
}

function getTotalItemCount() {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  if (badge) badge.textContent = getTotalItemCount();
}

function bumpCartBadge() {
  const badge = document.getElementById('cart-badge');
  if (!badge) return;
  badge.classList.remove('bump');
  void badge.offsetWidth; // Force reflow so animation restarts
  badge.classList.add('bump');
  setTimeout(() => badge.classList.remove('bump'), 350);
}

/* ─────────────────────────────────────────────────────────────── */
/*  RENDER CART DRAWER                                             */
/* ─────────────────────────────────────────────────────────────── */
function renderCartDrawer() {
  const body   = document.getElementById('cart-body');
  const footer = document.getElementById('cart-footer');
  if (!body || !footer) return;

  /* ── Empty state ── */
  if (cart.length === 0) {
    body.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon">🛒</div>
        <p class="cart-empty-text">Your cart is empty.<br />Add some delicious items!</p>
      </div>`;
    footer.innerHTML = '';
    return;
  }

  /* ── Cart item rows — built via DOM for reliable event binding ── */
  body.innerHTML = '';
  cart.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.dataset.key = item.key;

    row.innerHTML = `
      <div class="cart-item-info">
        <div class="cart-item-name">${sanitize(item.emoji)} ${sanitize(item.name)}</div>
        <div class="cart-item-variant">${sanitize(item.variant)}</div>
        <div class="cart-item-unit-price">${sanitize(settings.currencySymbol)} ${sanitize(String(item.price))} each</div>
      </div>
      <div class="cart-item-qty">
        <button class="qty-btn" type="button" aria-label="Decrease quantity of ${sanitize(item.name)}">−</button>
        <span class="qty-value" aria-label="Quantity ${item.quantity}">${item.quantity}</span>
        <button class="qty-btn" type="button" aria-label="Increase quantity of ${sanitize(item.name)}">+</button>
      </div>
      <div class="cart-item-subtotal" aria-label="Subtotal">
        ${sanitize(settings.currencySymbol)} ${sanitize(String(item.price * item.quantity))}
      </div>
      <button class="cart-item-remove" type="button" aria-label="Remove ${sanitize(item.name)} from cart">✕</button>
    `;

    // Capture key in closure — safe and independent per row
    const k = item.key;
    const qtyBtns = row.querySelectorAll('.qty-btn');
    qtyBtns[0].addEventListener('click', () => decrementCartItem(k));
    qtyBtns[1].addEventListener('click', () => incrementCartItem(k));
    row.querySelector('.cart-item-remove').addEventListener('click', () => removeCartItem(k));

    body.appendChild(row);
  });

  /* ── Totals & WhatsApp button ── */
  const subtotal = getCartSubtotal();
  const total    = getCartTotal();

  footer.innerHTML = `
    <div class="cart-totals">
      <div class="cart-total-row">
        <span class="label">Subtotal</span>
        <span class="value">${sanitize(settings.currencySymbol)} ${sanitize(String(subtotal))}</span>
      </div>
      <div class="cart-total-row">
        <span class="label">Delivery Charge</span>
        <span class="value">${sanitize(settings.currencySymbol)} ${sanitize(String(settings.deliveryCharge))}</span>
      </div>
      <div class="cart-total-row grand">
        <span class="label">Grand Total</span>
        <span class="value">${sanitize(settings.currencySymbol)} ${sanitize(String(total))}</span>
      </div>
    </div>
    <button class="btn btn--gold btn--full" id="whatsapp-checkout-btn" type="button">
      📲 Order via WhatsApp
    </button>
    <p class="cart-checkout-note">
      You'll be redirected to WhatsApp to confirm your order.
    </p>
  `;

  // BUG FIX: Bind WhatsApp button AFTER innerHTML is set — fresh DOM node each time
  const waBtn = document.getElementById('whatsapp-checkout-btn');
  if (waBtn) waBtn.addEventListener('click', launchWhatsAppCheckout);
}

/* ─────────────────────────────────────────────────────────────── */
/*  WHATSAPP ORDER SLIP COMPILER                                   */
/* ─────────────────────────────────────────────────────────────── */
function launchWhatsAppCheckout() {
  if (cart.length === 0) {
    showToast('⚠️ Your cart is empty!');
    return;
  }

  const now  = new Date();
  const date = now.toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' });
  const time = now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true });

  const lines = [];
  lines.push('🍽️ *O-BAILIA RESTAURANT — House of Taste*');
  lines.push('📍 Kot Sultan, Nawabshah Road, Sanghar, Sindh');
  lines.push(`📅 ${date}  🕐 ${time}`);
  lines.push('──────────────────────────');
  lines.push('*📋 ORDER DETAILS:*');
  lines.push('');

  cart.forEach((item, index) => {
    const lineTotal = item.price * item.quantity;
    lines.push(
      `${index + 1}. *${item.emoji} ${item.name}*\n` +
      `   Size: ${item.variant}\n` +
      `   Qty: ${item.quantity} × ${settings.currencySymbol} ${item.price}\n` +
      `   Subtotal: *${settings.currencySymbol} ${lineTotal}*`
    );
  });

  const subtotal = getCartSubtotal();
  const total    = getCartTotal();

  lines.push('');
  lines.push('──────────────────────────');
  lines.push('🧾 *ORDER SUMMARY:*');
  lines.push(`Items Subtotal : ${settings.currencySymbol} ${subtotal}`);
  lines.push(`Delivery Charge: ${settings.currencySymbol} ${settings.deliveryCharge}`);
  lines.push(`*GRAND TOTAL   : ${settings.currencySymbol} ${total}*`);
  lines.push('');
  lines.push('──────────────────────────');
  lines.push('📦 *Please provide your delivery address.*');
  lines.push('Thank you for choosing O-Bailia! 🔥');

  const text   = lines.join('\n');
  const waURL  = `https://wa.me/${settings.waNumber}?text=${encodeURIComponent(text)}`;

  window.open(waURL, '_blank', 'noopener,noreferrer');
  closeCart();
}

/* ─────────────────────────────────────────────────────────────── */
/*  CART DRAWER OPEN / CLOSE                                       */
/* ─────────────────────────────────────────────────────────────── */
function openCart() {
  const overlay = document.getElementById('cart-overlay');
  if (!overlay) return;
  renderCartDrawer();                  // always render fresh on open
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Delay focus until the slide animation reaches the viewer
  setTimeout(() => {
    const closeBtn = document.getElementById('cart-close-btn');
    if (closeBtn) closeBtn.focus();
  }, 180);
}

function closeCart() {
  const overlay = document.getElementById('cart-overlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  document.body.style.overflow = '';

  // Return focus to the trigger for accessibility
  const triggerBtn = document.getElementById('cart-trigger-btn');
  if (triggerBtn) triggerBtn.focus();
}

/* ─────────────────────────────────────────────────────────────── */
/*  CART UI BINDINGS                                               */
/* ─────────────────────────────────────────────────────────────── */
function initCartUI() {
  // Open cart
  const triggerBtn = document.getElementById('cart-trigger-btn');
  if (triggerBtn) triggerBtn.addEventListener('click', openCart);

  // Close cart via ✕ button
  const closeBtn = document.getElementById('cart-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', closeCart);

  // Close cart by clicking the dark backdrop (not the drawer itself)
  const overlay = document.getElementById('cart-overlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeCart();
    });
  }

  // Close cart via ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const ol = document.getElementById('cart-overlay');
      if (ol && ol.classList.contains('open')) closeCart();
    }
  });
}

/* ─────────────────────────────────────────────────────────────── */
/*  SMOOTH SCROLL FOR ANCHOR LINKS                                 */
/* ─────────────────────────────────────────────────────────────── */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const href   = anchor.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      const navH = 68; // matches --nav-h CSS variable
      const top  = target.getBoundingClientRect().top + window.scrollY - navH - 16;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
}

/* ─────────────────────────────────────────────────────────────── */
/*  PWA SERVICE WORKER REGISTRATION                                */
/* ─────────────────────────────────────────────────────────────── */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then(reg  => console.log('[O-Bailia SW] Registered:', reg.scope))
      .catch(err => console.warn('[O-Bailia SW] Registration failed:', err));
  });
}

/* ─────────────────────────────────────────────────────────────── */
/*  FIREBASE READINESS GUARD                                       */
/* ─────────────────────────────────────────────────────────────── */
async function waitForFirebaseAndInit() {
  /*
    Initializes Firebase (or uses pre-initialized instances from index.html),
    loads dynamic settings, tables, reservations, then kicks off menu render.
    A 3.5s hard fallback ensures demo menu always loads if Firebase never responds.
  */
  await initFirebase();

  // Load dynamic settings before rendering anything
  await loadDynamicSettings();

  // Load tables and reservations in parallel (non-blocking for menu)
  Promise.all([loadTables(), loadReservations()]).then(() => {
    initReservationForm();
  });

  if (window.__firestoreReady !== undefined || _db) {
    initMenu();
    return;
  }

  document.addEventListener('firebase-ready', () => {
    _db = window.__firestore || _db;
    initMenu();
  }, { once: true });

  // Hard fallback: if 'firebase-ready' never fires within 3.5s, load demo
  setTimeout(() => {
    if (menuItems.length === 0) {
      console.warn('[O-Bailia] Firebase timeout — loading demo menu.');
      initMenu();
    }
  }, 3500);
}

/* ─────────────────────────────────────────────────────────────── */
/*  APPLICATION BOOTSTRAP                                          */
/* ─────────────────────────────────────────────────────────────── */
function boot() {
  initNavbarScroll();

  // BUG FIX: Hero reveals are handled by hideLoadingScreen() in index.html.
  // For extra safety, also force hero elements visible here after a short delay
  // in case the loading screen script already ran before app.js loaded.
  setTimeout(function() {
    document.querySelectorAll('.hero .reveal, .hero-content > *').forEach(function(el) {
      el.classList.add('visible');
    });
  }, 500);

  // Observe non-hero below-fold sections after hero is safe
  setTimeout(function() {
    var belowFoldSections = document.querySelectorAll(
      '.menu-section .reveal, .about-section .reveal, .footer .reveal'
    );
    belowFoldSections.forEach(function(el) {
      if (!el.classList.contains('visible')) {
        observeRevealElements(el.closest('section') || el.parentElement);
      }
    });
  }, 2000);

  initLazyImages(null);
  triggerAnimations(null);
  initCartUI();
  initSmoothScroll();
  initAdminUI();
  initAIChat();
  registerServiceWorker();
  updateCartBadge();
  waitForFirebaseAndInit();

  console.log(
    '%c🍔 O-Bailia Restaurant%c — House of Taste loaded successfully!',
    'color:#E63946;font-weight:700;font-size:13px;',
    'color:#F4A261;font-size:13px;'
  );
}

/*
  BUG FIX: app.js is loaded with `defer` in index.html so the DOM is
  always ready by the time this script runs. `DOMContentLoaded` guard
  is kept as a safety net in case the file is ever used without defer.
*/
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
