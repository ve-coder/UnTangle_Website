/* ============================================================
   UnTangle – script.js
   Lädt config.json und rendert alle dynamischen Inhalte.
   ============================================================ */

'use strict';

/* ------------------------------------------------------------------
   Globaler Zustand
   ------------------------------------------------------------------ */
let CONFIG = null;          // Geladene config.json
let currentOrder = null;    // Zuletzt abgesendete Bestellung

/* ------------------------------------------------------------------
   Hilfsfunktionen
   ------------------------------------------------------------------ */

/**
 * Formatiert einen Euro-Betrag, z. B. 5 → "5,00 €"
 */
function fmt(value) {
  return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

/**
 * Zeigt einen Toast-Hinweis für eine bestimmte Zeit an.
 */
function showToast(message, duration = 2800) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
}

/**
 * Kopiert einen Text in die Zwischenablage.
 */
async function copyToClipboard(text, btn, originalLabel) {
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = '✓ Kopiert!';
    btn.classList.add('copied');
    showToast('In Zwischenablage kopiert.');
    setTimeout(() => {
      btn.textContent = originalLabel;
      btn.classList.remove('copied');
    }, 2200);
  } catch {
    // Fallback für ältere Browser
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('In Zwischenablage kopiert.');
  }
}

/**
 * Setzt ein Formularfeld auf fehlerhaft oder korrekt.
 */
function setFieldError(groupId, hasError) {
  const group = document.getElementById(groupId);
  if (!group) return;
  if (hasError) {
    group.classList.add('has-error');
  } else {
    group.classList.remove('has-error');
  }
}

/**
 * Berechnet den Rabatt-Prozentsatz anhand der Menge.
 */
function getDiscount(qty) {
  const discounts = CONFIG.discounts.slice().sort((a, b) => b.minQty - a.minQty);
  for (const d of discounts) {
    if (qty >= d.minQty) return d.percent;
  }
  return 0;
}

/**
 * Gibt das Produkt-Objekt für eine ID zurück.
 */
function getProduct(id) {
  return CONFIG.products.find(p => p.id === id) || null;
}

/**
 * Berechnet den vollständigen Bestellpreis und gibt ein Objekt zurück.
 */
function calcPrice(productId, qty, cable) {
  const product = getProduct(productId);
  if (!product || qty < 1) {
    return { valid: false };
  }

  const unitPrice    = product.price;
  const productTotal = unitPrice * qty;
  const cablePrice   = cable ? (CONFIG.addons[0].price * qty) : 0;
  const subtotal     = productTotal + cablePrice;
  const discPct      = getDiscount(qty);
  const discAmt      = discPct > 0 ? -(subtotal * discPct / 100) : 0;
  const afterDiscount = subtotal + discAmt;
  const shipping     = afterDiscount >= CONFIG.shipping.freeAbove ? 0 : CONFIG.shipping.cost;
  const total        = afterDiscount + shipping;

  return {
    valid:       true,
    product,
    qty,
    unitPrice,
    productTotal,
    cablePrice,
    subtotal,
    discPct,
    discAmt,
    afterDiscount,
    shipping,
    total,
    cable,
  };
}

/* ------------------------------------------------------------------
   Navigation
   ------------------------------------------------------------------ */
function renderNav() {
  const linksEl    = document.getElementById('nav-links');
  const mobileEl   = document.getElementById('nav-mobile');
  const hamburger  = document.getElementById('nav-hamburger');

  // Desktop nav
  CONFIG.meta.navLinks.forEach(link => {
    const li = document.createElement('li');
    const a  = document.createElement('a');
    a.href        = link.href;
    a.textContent = link.label;
    a.addEventListener('click', () => {
      // Schließe mobiles Menü beim Klicken
      mobileEl.classList.remove('open');
      hamburger.classList.remove('active');
    });
    li.appendChild(a);
    linksEl.appendChild(li);

    // Mobile nav (dupliziert)
    const am = a.cloneNode(true);
    am.addEventListener('click', () => {
      mobileEl.classList.remove('open');
      hamburger.classList.remove('active');
    });
    mobileEl.appendChild(am);
  });

  // Hamburger Toggle
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    mobileEl.classList.toggle('open');
  });

  // Navbar Scroll-Effekt
  window.addEventListener('scroll', () => {
    document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });

  // Logo-Bild laden wenn in config.json gesetzt
  if (CONFIG.company.logo) {
    const logoImg = document.getElementById('nav-logo-img');
    if (logoImg) {
      logoImg.src = CONFIG.company.logo;
      logoImg.style.display = 'inline-block';
      // Wenn das Bild nicht gefunden wird, einfach verstecken
      logoImg.onerror = () => { logoImg.style.display = 'none'; };
    }
  }
}

/* ------------------------------------------------------------------
   Produkte
   ------------------------------------------------------------------ */
function renderProducts() {
  const grid = document.getElementById('products-grid');
  grid.innerHTML = '';

  const t = CONFIG.texts.products;
  document.getElementById('products-headline').textContent = t.headline;
  document.getElementById('products-sub').textContent      = t.subheadline;

  CONFIG.products.forEach((p, idx) => {
    const isFeatured = idx === 1;
    // Bevorzuge p.image aus config.json, sonst die automatisch generierte SVG
    const fallbackSrc = `assets/images/product-${p.id}.svg`;
    const imgInitSrc  = p.image || fallbackSrc;

    const priceDisplay = p.priceMin
      ? `${p.priceMin.toLocaleString('de-DE', {minimumFractionDigits:2})} – ${p.priceMax.toLocaleString('de-DE', {minimumFractionDigits:2})} <span>€</span>`
      : `${p.price.toLocaleString('de-DE', {minimumFractionDigits:2})} <span>€</span>`;

    const featuresHtml = p.features
      .map(f => `<li>${f}</li>`)
      .join('');

    const badgeHtml = isFeatured
      ? `<div class="product-badge">Beliebt</div>`
      : '';

    const card = document.createElement('div');
    card.className = `product-card${isFeatured ? ' featured' : ''}`;
    card.innerHTML = `
      <div class="product-image">
        <img src="${imgInitSrc}" alt="${p.name}" loading="lazy" />
      </div>
      <div class="product-body">
        ${badgeHtml}
        <h3>${p.name}</h3>
        <p>${p.description}</p>
        <div class="product-price">${priceDisplay}</div>
        <ul class="product-features">${featuresHtml}</ul>
      </div>
      <div class="product-footer">
        <a href="#bestellen" class="btn btn-primary" style="width:100%;justify-content:center;">
          Jetzt bestellen
        </a>
      </div>
    `;
    // Fallback: wenn p.image nicht geladen werden kann, auf SVG wechseln
    if (p.image) {
      const img = card.querySelector('.product-image img');
      img.onerror = () => { img.src = fallbackSrc; img.onerror = null; };
    }
    grid.appendChild(card);
  });
}

/* ------------------------------------------------------------------
   Preise
   ------------------------------------------------------------------ */
function renderPricing() {
  const grid = document.getElementById('pricing-grid');
  grid.innerHTML = '';

  document.getElementById('pricing-headline').textContent = CONFIG.texts.pricing.headline;
  document.getElementById('pricing-sub').textContent      = CONFIG.texts.pricing.subheadline;

  CONFIG.products.forEach((p, idx) => {
    const isDark = idx === 1;

    const priceHtml = p.priceMin
      ? `<div class="price-amount"><span class="currency">€</span> ${p.priceMin.toLocaleString('de-DE',{minimumFractionDigits:2})}–${p.priceMax.toLocaleString('de-DE',{minimumFractionDigits:2})}</div>`
      : `<div class="price-amount"><span class="currency">€</span> ${p.price.toLocaleString('de-DE',{minimumFractionDigits:2})}</div>`;

    const featuresHtml = p.features.map(f => `<li>${f}</li>`).join('');

    const card = document.createElement('div');
    card.className = `price-card${isDark ? ' highlighted' : ''}`;
    card.innerHTML = `
      <p style="font-size:.82rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${isDark ? '#818cf8' : 'var(--clr-accent)'};">${p.name}</p>
      ${priceHtml}
      ${p.priceMin ? `<p class="price-range">je nach Konfiguration</p>` : '<p class="price-range">pro Stück</p>'}
      <p style="font-size:.88rem;margin-top:12px;">${p.description}</p>
      <div class="price-divider"></div>
      <ul class="price-features">${featuresHtml}</ul>
      <div style="margin-top:24px;">
        <a href="#bestellen" class="btn ${isDark ? 'btn-primary' : 'btn-outline'}" style="width:100%;justify-content:center;">
          Bestellen
        </a>
      </div>
    `;
    grid.appendChild(card);
  });

  // Addon-Block
  const addon = CONFIG.addons[0];
  const addonBlock = document.getElementById('addon-block');
  addonBlock.innerHTML = `
    <h3>Zubehör</h3>
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-top:16px;">
      <div>
        <p style="font-weight:700;color:var(--clr-text);font-size:.95rem;">${addon.name}</p>
        <p style="font-size:.88rem;">${addon.description}</p>
      </div>
      <div style="font-size:1.5rem;font-weight:800;color:var(--clr-accent);white-space:nowrap;">+ ${fmt(addon.price)}</div>
    </div>
  `;

  // Discount-Tabelle
  const tbody = document.getElementById('discount-tbody');
  tbody.innerHTML = '';
  CONFIG.discounts
    .slice()
    .sort((a, b) => a.minQty - b.minQty)
    .forEach(d => {
      const baseProduct  = CONFIG.products[0]; // UnTangle One als Beispiel
      const exampleQty   = d.minQty;
      const examplePrice = (baseProduct.price * exampleQty) * (1 - d.percent / 100);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${d.label.split(':')[0]}</td>
        <td><span class="badge badge-success">−${d.percent} %</span></td>
        <td>${fmt(examplePrice)} <span style="font-size:.8rem;color:var(--clr-muted);">(${exampleQty} × ${fmt(baseProduct.price)})</span></td>
      `;
      tbody.appendChild(tr);
    });
}

/* ------------------------------------------------------------------
   Bestellnummer-System (localStorage, Format A0001, A0002, …)
   ------------------------------------------------------------------ */

/** Gibt die nächste Bestellnummer zurück OHNE sie zu vergeben (Vorschau). */
function peekOrderNumber() {
  const counter = parseInt(localStorage.getItem('untangle_order_counter') || '0', 10);
  return 'A' + (counter + 1).toString().padStart(4, '0');
}

/** Vergibt die nächste Bestellnummer und speichert den Zähler dauerhaft. */
function getNextOrderNumber() {
  let counter = parseInt(localStorage.getItem('untangle_order_counter') || '0', 10);
  counter++;
  localStorage.setItem('untangle_order_counter', counter.toString());
  return 'A' + counter.toString().padStart(4, '0');
}

/* ------------------------------------------------------------------
   Bestellpreis-Berechnung (mit Länder-basiertem Versand)
   AT: 0 € ab 20 €, sonst 5 €  |  DE: immer 10 €  |  sonst: blockiert
   ------------------------------------------------------------------ */

/** Produktpreis aus config.json (einziges Produkt: UnTangle One) */
function getVariantPrice() {
  const p = CONFIG.products.find(p => p.id === 'one');
  return p ? p.price : 5.00;
}

function getVariantName() {
  const p = CONFIG.products.find(p => p.id === 'one');
  return p ? p.name : 'UnTangle One';
}

/**
 * Berechnet Bestellpreis inkl. länderbasiertem Versand.
 * country: 'AT' | 'DE' | '' (leer = Versand unbekannt)
 */
function calcOrderPrice(qty, cableQty, country) {
  if (qty < 1) return { valid: false };

  const unitPrice    = getVariantPrice();
  const productTotal = unitPrice * qty;
  const cablePrice   = cableQty > 0 ? (CONFIG.addons[0].price * cableQty) : 0;
  const subtotal     = productTotal + cablePrice;
  const discPct      = getDiscount(qty);
  const discAmt      = discPct > 0 ? -(subtotal * discPct / 100) : 0;
  const afterDiscount = subtotal + discAmt;

  let shipping;
  if (country === 'DE') {
    shipping = 10.00;
  } else if (country === 'AT') {
    shipping = afterDiscount >= 20 ? 0 : 5.00;
  } else {
    shipping = null; // unbekannt / blockiert
  }

  const total = shipping !== null ? afterDiscount + shipping : null;

  return {
    valid: true,
    variantName: getVariantName(),
    qty,
    unitPrice,
    productTotal,
    cableQty,
    cablePrice,
    subtotal,
    discPct,
    discAmt,
    afterDiscount,
    shipping,
    total,
    country,
  };
}

/* ------------------------------------------------------------------
   Bestellformular
   ------------------------------------------------------------------ */
function renderOrderForm() {
  const t = CONFIG.texts.order;
  document.getElementById('order-headline').textContent = t.headline;
  document.getElementById('order-sub').textContent      = t.subheadline;

  // Farb-Dropdowns befüllen (Hauptfarbe + Sekundärfarbe)
  const productColors = (CONFIG.products[0] && CONFIG.products[0].colors) || [];
  ['color-top', 'color-bottom'].forEach(selId => {
    const sel = document.getElementById(selId);
    if (!sel) return;
    productColors.forEach(color => {
      const opt = document.createElement('option');
      opt.value       = color;
      opt.textContent = color;
      sel.appendChild(opt);
    });
  });

  // Kabel-Preis-Label
  const cableAddon = CONFIG.addons[0];
  const cablePriceLbl = document.getElementById('cable-price-label');
  if (cablePriceLbl) cablePriceLbl.textContent = `(+${fmt(cableAddon.price)} / Stk. · USB – USBC, 1m, Grau)`;

  // Sidebar Unternehmensdaten befüllen
  const c = CONFIG.company;
  const nameEl = document.getElementById('info-company-name');
  const addrEl = document.getElementById('info-company-address');
  const mailEl = document.getElementById('info-contact-email');
  const mail2El = document.getElementById('info-contact-email2');
  if (nameEl) nameEl.textContent = `${c.name} – Junior Company`;
  if (addrEl) addrEl.textContent = c.address;
  if (mailEl) mailEl.innerHTML = `E-Mail: <a href="mailto:${c.email}">${c.email}</a>`;
  if (mail2El) mail2El.innerHTML = `Schreib uns: <a href="mailto:${c.email}">${c.email}</a>`;

  // Zahlungsdaten in Sidebar
  const piKonto   = document.getElementById('pi-kontoinhaber');
  const piIban    = document.getElementById('pi-iban');
  const piBic     = document.getElementById('pi-bic');
  const piPurpose = document.getElementById('pi-purpose');
  if (piKonto)   piKonto.textContent   = c.kontoinhaber;
  if (piIban)    piIban.textContent    = c.iban;
  if (piBic)     piBic.textContent     = c.bic;

  // Bestellnummer-Vorschau in Sidebar und Preisvorschau
  const nextNr = peekOrderNumber();
  const sidebarNr = document.getElementById('sidebar-order-number');
  if (sidebarNr) sidebarNr.textContent = nextNr;
  const ppNrVal = document.getElementById('pp-ordernr-val');
  if (ppNrVal) ppNrVal.textContent = nextNr;
  if (piPurpose) piPurpose.textContent = `UnTangle-Order-${nextNr}`;

  // Kundentyp: Firma-Feld ein-/ausblenden
  document.querySelectorAll('input[name="customertype"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const isFirma = document.getElementById('ct-company').checked;
      const fg = document.getElementById('fg-companyname');
      if (fg) fg.style.display = isFirma ? 'block' : 'none';
    });
  });

  // Live-Preis aktualisieren bei jeder Eingabe
  ['qty', 'cable-qty', 'color-top', 'color-bottom', 'land'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', updatePricePreview);
      el.addEventListener('input',  updatePricePreview);
    }
  });

  // Formular absenden
  document.getElementById('order-form').addEventListener('submit', handleFormSubmit);
}

/** Aktualisiert die Preisvorschau live. */
function updatePricePreview() {
  const qty      = parseInt(document.getElementById('qty').value, 10) || 0;
  const cableQty = parseInt(document.getElementById('cable-qty').value, 10) || 0;
  const country  = document.getElementById('land').value;

  const reset = () => {
    document.getElementById('pp-product').innerHTML  = `<span>Produkt</span><span>– €</span>`;
    document.getElementById('pp-cable').style.display    = 'none';
    document.getElementById('pp-discount').style.display = 'none';
    document.getElementById('pp-shipping').innerHTML = `<span>Versand</span><span>– €</span>`;
    document.getElementById('pp-total').innerHTML    = `<span>Gesamtbetrag</span><span>– €</span>`;
  };

  if (qty < 1) { reset(); return; }

  const c = calcOrderPrice(qty, cableQty, country);
  if (!c.valid) { reset(); return; }

  document.getElementById('pp-product').innerHTML =
    `<span>${c.variantName} × ${qty}</span><span>${fmt(c.productTotal)}</span>`;

  if (cableQty > 0) {
    document.getElementById('pp-cable').style.display = 'flex';
    document.getElementById('pp-cable').innerHTML =
      `<span>Kabel × ${cableQty} (USB–USBC, 1m, Grau)</span><span>${fmt(c.cablePrice)}</span>`;
  } else {
    document.getElementById('pp-cable').style.display = 'none';
  }

  if (c.discPct > 0) {
    document.getElementById('pp-discount').style.display = 'flex';
    document.getElementById('pp-discount').innerHTML =
      `<span>Rabatt (−${c.discPct} %)</span><span>−${fmt(Math.abs(c.discAmt))}</span>`;
  } else {
    document.getElementById('pp-discount').style.display = 'none';
  }

  if (c.shipping === null) {
    document.getElementById('pp-shipping').innerHTML =
      `<span>Versand</span><span style="color:var(--clr-muted);">Land wählen</span>`;
    document.getElementById('pp-total').innerHTML =
      `<span>Gesamtbetrag</span><span>– €</span>`;
  } else {
    const shipLabel = c.shipping === 0 ? 'Versand (kostenlos)' : 'Versand';
    document.getElementById('pp-shipping').innerHTML =
      `<span>${shipLabel}</span><span>${c.shipping === 0 ? 'kostenlos' : fmt(c.shipping)}</span>`;
    document.getElementById('pp-total').innerHTML =
      `<span>Gesamtbetrag</span><strong>${fmt(c.total)}</strong>`;
  }
}

/* ------------------------------------------------------------------
   Formular-Validierung
   ------------------------------------------------------------------ */
function validateForm() {
  const isFirma = document.getElementById('ct-company').checked;

  const fields = [
    { id: 'firstname',   groupId: 'fg-firstname',   test: v => v.trim().length > 0 },
    { id: 'lastname',    groupId: 'fg-lastname',    test: v => v.trim().length > 0 },
    { id: 'street',      groupId: 'fg-street',      test: v => v.trim().length > 0 },
    { id: 'houseno',     groupId: 'fg-houseno',     test: v => v.trim().length > 0 },
    { id: 'plz',         groupId: 'fg-plz',         test: v => v.trim().length >= 4 },
    { id: 'ort',         groupId: 'fg-ort',         test: v => v.trim().length > 0 },
    { id: 'land',        groupId: 'fg-land',        test: v => v === 'AT' || v === 'DE' },
    { id: 'email',       groupId: 'fg-email',       test: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) },
    { id: 'phone',       groupId: 'fg-phone',       test: v => v.trim().length >= 6 },
    { id: 'color-top',    groupId: 'fg-color-top',    test: v => v !== '' },
    { id: 'color-bottom', groupId: 'fg-color-bottom', test: v => v !== '' },
    { id: 'qty',          groupId: 'fg-qty',           test: v => parseInt(v, 10) >= 1 },
  ];

  if (isFirma) {
    fields.push({ id: 'companyname', groupId: 'fg-companyname', test: v => v.trim().length > 0 });
  }

  let valid = true;
  fields.forEach(f => {
    const el     = document.getElementById(f.id);
    if (!el) return;
    const passes = f.test(el.value);
    setFieldError(f.groupId, !passes);
    if (!passes) valid = false;
  });
  return valid;
}

/* ------------------------------------------------------------------
   Formular absenden (Formspree AJAX)
   ------------------------------------------------------------------ */
async function handleFormSubmit(e) {
  e.preventDefault();

  if (!validateForm()) {
    showToast('❌ Bitte füll alle Pflichtfelder korrekt aus.');
    const firstErr = document.querySelector('.form-group.has-error');
    if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const isFirma      = document.getElementById('ct-company').checked;
  const customerType = isFirma ? 'Firma' : 'Privatperson';
  const companyname  = isFirma ? document.getElementById('companyname').value.trim() : '';
  const firstname    = document.getElementById('firstname').value.trim();
  const lastname     = document.getElementById('lastname').value.trim();
  const street       = document.getElementById('street').value.trim();
  const houseno      = document.getElementById('houseno').value.trim();
  const plz          = document.getElementById('plz').value.trim();
  const ort          = document.getElementById('ort').value.trim();
  const land         = document.getElementById('land').value;
  const landLabel    = land === 'AT' ? 'Österreich' : 'Deutschland';
  const email        = document.getElementById('email').value.trim();
  const phone        = document.getElementById('phone').value.trim();
  const colorTop     = document.getElementById('color-top').value;
  const colorBottom  = document.getElementById('color-bottom').value;
  const cableQty     = parseInt(document.getElementById('cable-qty').value, 10) || 0;
  const qty          = parseInt(document.getElementById('qty').value, 10);

  const price = calcOrderPrice(qty, cableQty, land);

  // Bestellnummer vergeben
  const orderNumber = getNextOrderNumber();
  const reference   = `UnTangle-Order-${orderNumber}`;
  const orderDate   = new Date().toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  // ─ Versteckte Felder befüllen ─
  document.getElementById('hf-subject').value        = `UnTangle Bestellung ${orderNumber} – ${firstname} ${lastname}`;
  document.getElementById('hf-bestellnummer').value  = orderNumber;
  document.getElementById('hf-verwendungszweck').value = reference;
  document.getElementById('hf-bestelldatum').value   = orderDate;
  document.getElementById('hf-variante').value       = price.variantName;
  document.getElementById('hf-gesamtpreis').value    = fmt(price.total);
  document.getElementById('hf-versandkosten').value  = price.shipping === 0 ? 'kostenlos' : fmt(price.shipping);
  document.getElementById('hf-mengenrabatt').value   = price.discPct > 0 ? `-${price.discPct} % (-${fmt(Math.abs(price.discAmt))})` : 'kein Rabatt';
  document.getElementById('hf-lieferadresse').value  = `${street} ${houseno}, ${plz} ${ort}, ${landLabel}`;

  // ─ Ladeanimation ─
  const submitBtn = document.querySelector('#order-form button[type="submit"]');
  const origLabel = submitBtn.textContent;
  submitBtn.disabled    = true;
  submitBtn.textContent = 'Wird gesendet…';

  // ─ An Formspree schicken ─
  let formspreeOk = false;
  try {
    const form     = document.getElementById('order-form');
    const response = await fetch(form.action, {
      method:  'POST',
      body:    new FormData(form),
      headers: { 'Accept': 'application/json' },
    });
    formspreeOk = response.ok;
    if (!formspreeOk) {
      const json = await response.json().catch(() => ({}));
      console.warn('Formspree Fehler:', json);
    }
  } catch (err) {
    console.warn('Formspree Netzwerkfehler:', err);
  } finally {
    submitBtn.disabled    = false;
    submitBtn.textContent = origLabel;
  }

  if (!formspreeOk) {
    showToast('⚠️ Bestellung konnte nicht gesendet werden. Bitte erneut versuchen oder per E-Mail an ' + CONFIG.company.email);
    return;
  }

  // ─ Bestellung lokal speichern und Erfolg anzeigen ─
  currentOrder = {
    orderNumber, reference, customerType, companyname,
    firstname, lastname, street, houseno, plz, ort, land, landLabel,
    email, phone, colorTop, colorBottom, cableQty, qty,
    price, orderDate,
  };

  showOrderSuccess(currentOrder);
}

/* ------------------------------------------------------------------
   Bestellbestätigung anzeigen
   ------------------------------------------------------------------ */
function showOrderSuccess(order) {
  const t = CONFIG.texts.order;

  // Formular verstecken, Erfolg einblenden
  document.getElementById('order-form-wrap').style.display = 'none';
  const successEl = document.getElementById('order-success');
  successEl.classList.add('visible');

  document.getElementById('success-headline').textContent = t.successHeadline;
  document.getElementById('success-text').textContent     = t.successText;

  const p = order.price;
  const c = CONFIG.company;

  // ── Zusammenfassung aufbauen ──
  const summaryBox = document.getElementById('order-summary-box');
  summaryBox.innerHTML = '';

  const rows = [
    { label: 'Bestellnummer', value: order.orderNumber, cls: 'highlight' },
    { label: 'Bestelldatum',  value: order.orderDate },
    { label: 'Kundentyp',     value: order.customerType },
  ];

  if (order.companyname) {
    rows.push({ label: 'Firma', value: order.companyname });
  }

  rows.push(
    { label: 'Name',         value: `${order.firstname} ${order.lastname}` },
    { label: 'E-Mail',       value: order.email },
    { label: 'Telefon',      value: order.phone },
    { label: 'Lieferadresse',value: `${order.street} ${order.houseno}, ${order.plz} ${order.ort}, ${order.landLabel}` },
    { label: 'Variante',       value: p.variantName },
    { label: 'Hauptfarbe',     value: order.colorTop },
    { label: 'Sekundärfarbe', value: order.colorBottom },
  );

  rows.push({ label: 'Menge', value: `${order.qty} Stück` });

  if (order.cableQty > 0) {
    rows.push({ label: 'Kabel (USB–USBC, 1m, Grau)', value: `${order.cableQty} Stück à ${fmt(CONFIG.addons[0].price)} = ${fmt(p.cablePrice)}` });
  }

  if (p.discPct > 0) {
    rows.push({ label: `Rabatt (−${p.discPct} %)`, value: `−${fmt(Math.abs(p.discAmt))}`, cls: 'discount' });
  }

  rows.push({
    label: 'Versand',
    value: p.shipping === 0 ? 'kostenlos' : fmt(p.shipping),
  });

  rows.forEach(row => {
    const div = document.createElement('div');
    div.className = `summary-row${row.cls ? ' ' + row.cls : ''}`;
    div.innerHTML = `<span>${row.label}</span><span>${row.value}</span>`;
    summaryBox.appendChild(div);
  });

  // Gesamtbetrag-Zeile
  const totalRow = document.createElement('div');
  totalRow.className = 'summary-row total';
  totalRow.innerHTML = `<span>Gesamtbetrag</span><strong>${fmt(p.total)}</strong>`;
  summaryBox.appendChild(totalRow);

  // ── IBAN / Zahlungsdaten ──
  document.getElementById('iban-display').textContent = c.iban;
  document.getElementById('iban-details').innerHTML = `
    Kontoinhaber: <strong>${c.kontoinhaber}</strong> &nbsp;|&nbsp;
    BIC: <strong>${c.bic}</strong><br/>
    Verwendungszweck: <strong style="color:var(--clr-accent);">${order.reference}</strong>
  `;

  // ── Kopier-Buttons ──
  document.getElementById('copy-iban-btn').onclick = () => {
    copyToClipboard(c.iban, document.getElementById('copy-iban-btn'), '📋 IBAN kopieren');
  };

  document.getElementById('copy-purpose-btn').onclick = () => {
    copyToClipboard(order.reference, document.getElementById('copy-purpose-btn'), '📋 Verwendungszweck kopieren');
  };

  document.getElementById('copy-summary-btn').onclick = () => {
    const text = buildSummaryText(order);
    copyToClipboard(text, document.getElementById('copy-summary-btn'), '📄 Zusammenfassung kopieren');
  };

  // ── Sidebar-Bestellnummer aktualisieren ──
  const sidebarNr = document.getElementById('sidebar-order-number');
  if (sidebarNr) sidebarNr.textContent = order.orderNumber;

  // ── Neue Bestellung ──
  document.getElementById('new-order-btn').onclick = () => {
    document.getElementById('order-form').reset();
    // Firmenfeld wieder verstecken
    const fgCo = document.getElementById('fg-companyname');
    if (fgCo) fgCo.style.display = 'none';
    document.getElementById('order-form-wrap').style.display = 'block';
    successEl.classList.remove('visible');
    // Neue Vorschau-Bestellnummer
    const nextNr = peekOrderNumber();
    const sbNr = document.getElementById('sidebar-order-number');
    if (sbNr) sbNr.textContent = nextNr;
    const ppNrVal = document.getElementById('pp-ordernr-val');
    if (ppNrVal) ppNrVal.textContent = nextNr;
    const piPurpose = document.getElementById('pi-purpose');
    if (piPurpose) piPurpose.textContent = `UnTangle-Order-${nextNr}`;
    updatePricePreview();
    document.getElementById('bestellen').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Scroll zur Erfolgsseite
  successEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Baut Klartext-Zusammenfassung für die Zwischenablage. */
function buildSummaryText(order) {
  const p = order.price;
  const c = CONFIG.company;
  const addr = `${order.street} ${order.houseno}, ${order.plz} ${order.ort}, ${order.landLabel}`;

  let text = `=== UnTangle Bestellung ===\n\n`;
  text += `Bestellnummer:   ${order.orderNumber}\n`;
  text += `Datum:           ${order.orderDate}\n`;
  text += `Kundentyp:       ${order.customerType}\n`;
  if (order.companyname) text += `Firma:           ${order.companyname}\n`;
  text += `Name:            ${order.firstname} ${order.lastname}\n`;
  text += `E-Mail:          ${order.email}\n`;
  text += `Telefon:         ${order.phone}\n`;
  text += `Lieferadresse:   ${addr}\n`;
  text += `\n--- Bestellung ---\n`;
  text += `Variante:        ${p.variantName} × ${order.qty}\n`;
  text += `Hauptfarbe:      ${order.colorTop}\n`;
  text += `Sekundärfarbe:   ${order.colorBottom}\n`;
  if (order.cableQty > 0) text += `Kabel:           ${order.cableQty} × USB–USBC 1m Grau = ${fmt(p.cablePrice)}\n`;
  if (p.discPct > 0)    text += `Rabatt:          −${p.discPct} % (−${fmt(Math.abs(p.discAmt))})\n`;
  text += `Versand:         ${p.shipping === 0 ? 'kostenlos' : fmt(p.shipping)}\n`;
  text += `GESAMT:          ${fmt(p.total)}\n`;
  text += `\n--- Zahlung ---\n`;
  text += `IBAN:            ${c.iban}\n`;
  text += `BIC:             ${c.bic}\n`;
  text += `Kontoinhaber:    ${c.kontoinhaber}\n`;
  text += `Verwendungszweck:${order.reference}\n`;
  return text;
}

/* ------------------------------------------------------------------
   Anleitung
   ------------------------------------------------------------------ */
function renderAnleitung() {
  if (!CONFIG.anleitung || !CONFIG.texts.anleitung) return;
  const t = CONFIG.texts.anleitung;
  document.getElementById('anleitung-headline').textContent = t.headline;
  document.getElementById('anleitung-sub').textContent      = t.subheadline;

  const grid = document.getElementById('anleitung-grid');
  grid.innerHTML = '';

  CONFIG.anleitung.forEach(step => {
    const card = document.createElement('div');
    card.className = 'anleitung-card';

    // Bild-Bereich: zeige Platzhatter wenn kein Bild vorhanden
    const imgWrap = document.createElement('div');
    imgWrap.className = 'anleitung-img-wrap';

    const img = document.createElement('img');
    img.src   = step.image;
    img.alt   = step.title;
    img.loading = 'lazy';
    img.onerror = () => {
      // Bild existiert noch nicht → Platzhalter anzeigen
      imgWrap.innerHTML = `
        <div class="anleitung-img-placeholder">
          <span>📷</span>
          <span>Bild hier einfügen:<br/><code>${step.image.split('/').pop()}</code></span>
        </div>`;
    };
    imgWrap.appendChild(img);

    const body = document.createElement('div');
    body.className = 'anleitung-body';
    body.innerHTML = `
      <div class="anleitung-step-num">${step.schritt}</div>
      <h3>${step.title}</h3>
      <p>${step.text}</p>
    `;

    card.appendChild(imgWrap);
    card.appendChild(body);
    grid.appendChild(card);
  });
}

/* ------------------------------------------------------------------
   Über uns
   ------------------------------------------------------------------ */
function renderAbout() {
  const t = CONFIG.texts.about;
  document.getElementById('about-headline').textContent = t.headline;
  document.getElementById('team-label').textContent     = t.teamLabel;

  const paragraphsEl = document.getElementById('about-paragraphs');
  paragraphsEl.innerHTML = '';
  t.paragraphs.forEach(text => {
    const p = document.createElement('p');
    p.textContent = text;
    paragraphsEl.appendChild(p);
  });

  // Team
  const teamGrid = document.getElementById('team-grid');
  teamGrid.innerHTML = '';
  CONFIG.team.forEach(member => {
    const initials = member.name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('');
    const card = document.createElement('div');
    card.className = 'team-card';
    card.innerHTML = `
      <div class="team-avatar">${initials}</div>
      <h4>${member.name}</h4>
      <p>${member.role}</p>
    `;
    teamGrid.appendChild(card);
  });
}

/* ------------------------------------------------------------------
   Kontakt & Impressum
   ------------------------------------------------------------------ */
function renderContact() {
  const t = CONFIG.texts.contact;
  const c = CONFIG.company;

  document.getElementById('contact-headline').textContent = t.headline;
  document.getElementById('impressum-title').textContent  = t.impressumTitle;

  // Kontaktliste
  const contactItems = [
    { icon: '✉️',  label: 'E-Mail',  value: `<a href="mailto:${c.email}">${c.email}</a>` },
    { icon: '📞',  label: 'Telefon', value: c.phone },
    { icon: '📍',  label: 'Adresse', value: c.address },
  ];

  const list = document.getElementById('contact-list');
  list.innerHTML = '';
  contactItems.forEach(item => {
    const div = document.createElement('div');
    div.className = 'contact-item';
    div.innerHTML = `
      <div class="contact-item-icon">${item.icon}</div>
      <div class="contact-item-text">
        <strong>${item.label}</strong>
        ${item.value}
      </div>
    `;
    list.appendChild(div);
  });

  // Impressum
  const impressumBody = document.getElementById('impressum-body');
  impressumBody.innerHTML = '';

  const paragraphs = [
    t.impressumText,
    `Unternehmensname: <strong>${c.name}</strong>`,
    `Adresse: ${c.address}`,
    `E-Mail: <a href="mailto:${c.email}">${c.email}</a>`,
    `Gegründet: ${CONFIG.company.founded} &nbsp;|&nbsp; Schule: ${CONFIG.company.school}`,
    `<em>Dieses Impressum dient ausschließlich zu schulischen Übungszwecken.</em>`,
  ];

  paragraphs.forEach(text => {
    const p = document.createElement('p');
    p.innerHTML = text;
    impressumBody.appendChild(p);
  });
}

/* ------------------------------------------------------------------
   Hero-Texte
   ------------------------------------------------------------------ */
function renderHero() {
  const t = CONFIG.texts.hero;
  const words = t.headline.split(' ');
  const lastWord = words.pop();
  document.getElementById('hero-headline').innerHTML =
    `${words.join(' ')}<br/><span>${lastWord}</span>`;
  document.getElementById('hero-sub').textContent    = t.subheadline;
  document.getElementById('hero-cta').textContent    = t.cta;
  document.getElementById('hero-cta2').textContent   = t.ctaSecondary;
  document.getElementById('hero-badge').textContent  =
    `Junior Company · ${CONFIG.company.school}`;
}

/* ------------------------------------------------------------------
   Footer
   ------------------------------------------------------------------ */
function renderFooter() {
  document.getElementById('footer-year').textContent = new Date().getFullYear();
}

/* ------------------------------------------------------------------
   Seiten-Titel aus config.json
   ------------------------------------------------------------------ */
function applyMeta() {
  document.title                                         = CONFIG.meta.siteTitle;
  document.querySelector('meta[name="description"]').content = CONFIG.meta.description;
}

/* ------------------------------------------------------------------
   Smooth Scroll für interne Anker (Navbar-Höhe beachten)
   ------------------------------------------------------------------ */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      const offset = 76; // Navbar-Höhe
      const top    = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
}

/* ------------------------------------------------------------------
   Startpunkt: config.json laden
   ------------------------------------------------------------------ */
async function init() {
  try {
    const response = await fetch('config.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    CONFIG = await response.json();

    // Alle Render-Funktionen aufrufen
    applyMeta();
    renderNav();
    renderHero();
    renderProducts();
    renderAnleitung();
    renderPricing();
    renderOrderForm();
    renderAbout();
    renderContact();
    renderFooter();
    initSmoothScroll();
    updatePricePreview();

    // Initial einen Scroll-Check auslösen
    document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 20);

  } catch (err) {
    console.error('Fehler beim Laden von config.json:', err);
    // Zeige benutzerfreundliche Fehlermeldung
    const overlay = document.getElementById('loading-overlay');
    overlay.innerHTML = `
      <div style="text-align:center;padding:24px;max-width:400px;">
        <div style="font-size:2rem;margin-bottom:12px;">⚠️</div>
        <h2 style="font-size:1.2rem;margin-bottom:8px;">Seite konnte nicht geladen werden</h2>
        <p style="font-size:.88rem;color:#64748b;margin-bottom:16px;">
          config.json konnte nicht gelesen werden.<br/>
          Öffne die Seite über einen lokalen Webserver (nicht direkt als Datei im Browser).
        </p>
        <p style="font-size:.78rem;color:#94a3b8;">Tipp: <code>python -m http.server 8080</code></p>
      </div>
    `;
    return;
  }

  // Loading overlay ausblenden
  const overlay = document.getElementById('loading-overlay');
  overlay.classList.add('hidden');
  setTimeout(() => overlay.remove(), 500);
}

// DOMContentLoaded abwarten
document.addEventListener('DOMContentLoaded', init);
