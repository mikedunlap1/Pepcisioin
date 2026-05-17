/**
 * pepcision-catalog.js  v1.0
 * ─────────────────────────────────────────────────────────────
 * Self-contained Airtable-powered product catalog for Pepcision.
 * Drop this file into your repo and add two lines to shop.html:
 *
 *   <div id="pepcision-catalog"></div>
 *   <script src="pepcision-catalog.js"></script>
 *
 * SETUP STEPS:
 *  1. Go to https://airtable.com/create/tokens
 *  2. Create a token with scope:  data.records:read
 *     and access to base "everything-peptides" (appxW9T4UTU83xb1n)
 *  3. Paste your token into CFG.token below
 *  4. When you're ready to wire up checkout, replace CFG.checkoutUrl
 * ─────────────────────────────────────────────────────────────
 */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════
     CONFIG  — edit these values
  ══════════════════════════════════════════════════════════ */
  var CFG = {
    token:       'patZWddrXoFoYX5VO.1386e4cddbdc8a1a97602676865b5468dce8f2629a6be46b951cb31b56b8df24',   // ← paste your token
    baseId:      'appxW9T4UTU83xb1n',
    primaryColor:'#1b56ff',
    checkoutUrl: 'https://paywithsoap.com',   // ← update when ready

    /* Airtable table names */
    tables: {
      products:   'Products',
      variants:   'Product_Variants',
      categories: 'Shop_Filter_Categories',
    },

    /* Field name map — update if your Airtable columns differ */
    f: {
      // Products
      p_id:          'product_id',
      p_name:        'product_name',
      p_slug:        'slug',
      p_shortDesc:   'short_description',
      p_imageUrl:    'image_url',
      p_priceFrom:   'price_from',
      p_catId:       'raw_category_id',
      p_mechanism:   'mechanism_type',
      // Product_Variants
      v_id:          'variant_id',
      v_productSlug: 'product_slug',   // plain-text slug used to join to Products
      v_name:        'variant_name',   // e.g. "5mg", "10mg Kit"
      v_price:       'price',
      v_purity:      'purity',         // e.g. "99.1%" — may be blank if not in your base
      v_stock:       'stock_status',   // "In stock" | "Low stock" | "Out of stock"
      v_lot:         'lot_number',
      // Shop_Filter_Categories
      c_id:          'category_id',
      c_name:        'category_name',
    },
  };

  /* ══════════════════════════════════════════════════════════
     STATE
  ══════════════════════════════════════════════════════════ */
  var S = {
    products:   [],
    variantMap: {},   // slug → [variants]
    categories: [],
    cart:       JSON.parse(localStorage.getItem('pep_cart') || '[]'),
    filters: {
      categories: [],
      maxPrice:   999,
      minPurity:  0,
      sort:       'featured',
    },
    selectedVariant: {}, // productSlug → variantIndex
    loading: true,
    error:   null,
  };

  /* ══════════════════════════════════════════════════════════
     AIRTABLE FETCH  (handles 100-record pagination)
  ══════════════════════════════════════════════════════════ */
  async function fetchAll(table) {
    var base = 'https://api.airtable.com/v0/' + CFG.baseId + '/' + encodeURIComponent(table);
    var records = [];
    var offset;
    do {
      var url = base + (offset ? '?offset=' + offset : '');
      var res = await fetch(url, {
        headers: { Authorization: 'Bearer ' + CFG.token }
      });
      if (!res.ok) throw new Error('Airtable ' + res.status + ': ' + (await res.text()).slice(0, 200));
      var data = await res.json();
      data.records.forEach(function (r) {
        records.push(Object.assign({ _recId: r.id }, r.fields));
      });
      offset = data.offset;
    } while (offset);
    return records;
  }

  /* ══════════════════════════════════════════════════════════
     HELPERS
  ══════════════════════════════════════════════════════════ */
  function parsePrice(raw) {
    if (!raw) return 0;
    return parseFloat(String(raw).replace(/[^0-9.]/g, '')) || 0;
  }

  function fmt(n) {
    return '$' + n.toFixed(2);
  }

  function parsePurity(raw) {
    if (!raw) return 0;
    return parseFloat(String(raw).replace('%', '')) || 0;
  }

  function stockClass(status) {
    if (!status) return 'pep-dot-gray';
    var s = String(status).toLowerCase();
    if (s.includes('low'))  return 'pep-dot-amber';
    if (s.includes('out'))  return 'pep-dot-gray';
    return 'pep-dot-green';
  }

  function cartTotal() {
    return S.cart.reduce(function (t, i) { return t + i.price * i.qty; }, 0);
  }

  function cartCount() {
    return S.cart.reduce(function (t, i) { return t + i.qty; }, 0);
  }

  /* ══════════════════════════════════════════════════════════
     CSS INJECTION
  ══════════════════════════════════════════════════════════ */
  function injectStyles() {
    if (document.getElementById('pep-styles')) return;
    var s = document.createElement('style');
    s.id = 'pep-styles';
    s.textContent = [
      '#pepcision-catalog *{box-sizing:border-box;margin:0;padding:0}',
      '#pepcision-catalog{font-family:-apple-system,"Inter",BlinkMacSystemFont,sans-serif;font-size:14px;color:#111827;position:relative}',

      /* layout */
      '.pep-layout{display:flex;gap:28px;align-items:flex-start}',

      /* sidebar */
      '.pep-sidebar{width:210px;flex-shrink:0;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;position:sticky;top:20px}',
      '.pep-sb-heading{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#9ca3af;margin-bottom:10px;display:block}',
      '.pep-sb-section{margin-bottom:22px}',
      '.pep-sb-select{width:100%;padding:7px 10px;border:1px solid #d1d5db;border-radius:7px;font-size:13px;color:#111827;background:#fff;cursor:pointer}',
      '.pep-check-label{display:flex;align-items:center;gap:8px;font-size:13px;color:#374151;cursor:pointer;padding:4px 0;user-select:none}',
      '.pep-check-label input[type=checkbox]{accent-color:'+CFG.primaryColor+';width:14px;height:14px;cursor:pointer}',
      '.pep-slider{width:100%;accent-color:'+CFG.primaryColor+';cursor:pointer}',
      '.pep-slider-labels{display:flex;justify-content:space-between;font-size:11px;color:#9ca3af;margin-top:4px}',

      /* main */
      '.pep-main{flex:1;min-width:0}',
      '.pep-meta{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;font-size:13px;color:#6b7280}',
      '.pep-meta strong{color:'+CFG.primaryColor+'}',

      /* table */
      '.pep-table{width:100%;border-collapse:collapse}',
      '.pep-table thead th{text-align:left;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#9ca3af;padding:8px 12px;border-bottom:2px solid #e5e7eb}',
      '.pep-table tbody tr{border-bottom:1px solid #f3f4f6;transition:background .1s}',
      '.pep-table tbody tr:hover{background:#f9fafb}',
      '.pep-table td{padding:14px 12px;vertical-align:middle}',
      '.pep-td-name .pep-name{font-weight:600;font-size:14px;color:#111827}',
      '.pep-td-name .pep-mech{font-size:11px;color:#9ca3af;margin-top:2px}',
      '.pep-purity{font-size:13px;color:#374151;font-variant-numeric:tabular-nums}',
      '.pep-size-select{padding:5px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;color:#374151;background:#fff;cursor:pointer;max-width:110px}',
      '.pep-price{font-weight:700;font-size:14px;color:#111827;font-variant-numeric:tabular-nums;white-space:nowrap}',

      /* stock dot */
      '.pep-stock{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#374151;white-space:nowrap}',
      '.pep-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}',
      '.pep-dot-green{background:#22c55e}',
      '.pep-dot-amber{background:#f59e0b}',
      '.pep-dot-gray{background:#d1d5db}',

      /* buttons */
      '.pep-btn-add{padding:7px 16px;background:'+CFG.primaryColor+';color:#fff;border:none;border-radius:7px;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap;transition:opacity .15s}',
      '.pep-btn-add:hover{opacity:.85}',
      '.pep-btn-add:disabled{background:#d1d5db;cursor:not-allowed;opacity:1}',
      '.pep-btn-notify{padding:7px 14px;background:#fff;color:#6b7280;border:1px solid #d1d5db;border-radius:7px;font-size:13px;cursor:default;white-space:nowrap}',

      /* loading / error */
      '.pep-loading{text-align:center;padding:60px 24px;color:#9ca3af}',
      '.pep-spinner{width:28px;height:28px;border:2px solid #e5e7eb;border-top-color:'+CFG.primaryColor+';border-radius:50%;animation:pep-spin .7s linear infinite;margin:0 auto 12px}',
      '@keyframes pep-spin{to{transform:rotate(360deg)}}',
      '.pep-error{background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px 20px;color:#dc2626;font-size:13px;line-height:1.5}',
      '.pep-error code{display:block;margin-top:8px;font-size:11px;opacity:.7;word-break:break-all}',
      '.pep-no-results{text-align:center;padding:48px;color:#9ca3af;font-size:14px}',

      /* ── CART floating button ── */
      '.pep-cart-fab{position:fixed;bottom:28px;right:28px;width:52px;height:52px;background:'+CFG.primaryColor+';color:#fff;border:none;border-radius:50%;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 18px rgba(27,86,255,.35);z-index:9998;transition:transform .15s}',
      '.pep-cart-fab:hover{transform:scale(1.07)}',
      '.pep-cart-badge{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;font-size:10px;font-weight:700;min-width:18px;height:18px;border-radius:9px;padding:0 3px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;line-height:1}',

      /* ── CART drawer ── */
      '.pep-overlay{position:fixed;inset:0;background:rgba(0,0,0,.3);z-index:9997;opacity:0;pointer-events:none;transition:opacity .25s}',
      '.pep-overlay.open{opacity:1;pointer-events:all}',
      '.pep-drawer{position:fixed;top:0;right:0;width:360px;height:100vh;background:#fff;box-shadow:-4px 0 28px rgba(0,0,0,.12);z-index:9999;display:flex;flex-direction:column;transform:translateX(110%);transition:transform .25s ease}',
      '.pep-drawer.open{transform:translateX(0)}',
      '.pep-drawer-hdr{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #e5e7eb;flex-shrink:0}',
      '.pep-drawer-hdr h2{font-size:16px;font-weight:600}',
      '.pep-drawer-close{background:none;border:none;font-size:22px;cursor:pointer;color:#9ca3af;line-height:1;padding:2px 6px}',
      '.pep-drawer-close:hover{color:#374151}',
      '.pep-drawer-items{flex:1;overflow-y:auto;padding:12px 20px}',
      '.pep-cart-empty{text-align:center;padding:48px 0;color:#9ca3af;font-size:13px}',
      '.pep-cart-item{display:flex;gap:12px;align-items:flex-start;padding:14px 0;border-bottom:1px solid #f3f4f6}',
      '.pep-cart-img{width:52px;height:52px;object-fit:cover;border-radius:8px;background:#f3f4f6;flex-shrink:0}',
      '.pep-cart-info{flex:1;min-width:0}',
      '.pep-cart-iname{font-weight:600;font-size:13px;line-height:1.3}',
      '.pep-cart-isize{font-size:12px;color:#6b7280;margin-top:1px}',
      '.pep-cart-iprice{font-size:13px;font-weight:700;color:'+CFG.primaryColor+';margin-top:4px}',
      '.pep-qty-row{display:flex;align-items:center;gap:8px;margin-top:8px}',
      '.pep-qty-btn{width:26px;height:26px;border:1px solid #d1d5db;border-radius:5px;background:#fff;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;color:#374151;line-height:1}',
      '.pep-qty-btn:hover{background:#f9fafb}',
      '.pep-qty-val{font-size:13px;font-weight:500;min-width:22px;text-align:center}',
      '.pep-remove{background:none;border:none;color:#d1d5db;cursor:pointer;font-size:13px;margin-left:auto;padding:0}',
      '.pep-remove:hover{color:#ef4444}',
      '.pep-drawer-ftr{padding:14px 20px;border-top:1px solid #e5e7eb;flex-shrink:0}',
      '.pep-subtotal-row{display:flex;justify-content:space-between;font-size:14px;font-weight:600;margin-bottom:14px}',
      '.pep-checkout-btn{width:100%;padding:13px;background:'+CFG.primaryColor+';color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:opacity .15s}',
      '.pep-checkout-btn:hover{opacity:.88}',
      '.pep-checkout-btn:disabled{background:#d1d5db;cursor:not-allowed;opacity:1}',
      '.pep-checkout-note{font-size:11px;color:#9ca3af;text-align:center;margin-top:8px}',
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ══════════════════════════════════════════════════════════
     ROOT ELEMENT
  ══════════════════════════════════════════════════════════ */
  var root;
  function getRoot() {
    root = document.getElementById('pepcision-catalog');
    if (!root) {
      console.warn('[Pepcision] No <div id="pepcision-catalog"> found on page.');
    }
    return root;
  }

  /* ══════════════════════════════════════════════════════════
     RENDER — LOADING
  ══════════════════════════════════════════════════════════ */
  function renderLoading() {
    if (!root) return;
    root.innerHTML =
      '<div class="pep-loading">' +
        '<div class="pep-spinner"></div>' +
        'Loading catalog from Airtable…' +
      '</div>';
  }

  /* ══════════════════════════════════════════════════════════
     RENDER — ERROR
  ══════════════════════════════════════════════════════════ */
  function renderError(msg) {
    if (!root) return;
    root.innerHTML =
      '<div class="pep-error">' +
        '<strong>Could not load catalog.</strong> ' + msg +
        '<code>Check your Airtable token and make sure it has read access to this base.</code>' +
      '</div>';
  }

  /* ══════════════════════════════════════════════════════════
     RENDER — FULL CATALOG
  ══════════════════════════════════════════════════════════ */
  function renderCatalog() {
    if (!root) return;
    root.innerHTML = buildLayout();
    attachCatalogListeners();
  }

  /* ── filtered product list ───────────────────────────────── */
  function filteredProducts() {
    return S.products.filter(function (p) {
      var variants = S.variantMap[p[CFG.f.p_slug]] || [];
      var catId    = Array.isArray(p[CFG.f.p_catId]) ? p[CFG.f.p_catId][0] : p[CFG.f.p_catId];

      // category filter
      if (S.filters.categories.length && !S.filters.categories.includes(catId)) return false;

      // price filter (check at least one variant is within range)
      var hasPrice = !variants.length;
      variants.forEach(function (v) {
        var pr = parsePrice(v[CFG.f.v_price]);
        if (pr <= S.filters.maxPrice) hasPrice = true;
      });
      if (!hasPrice) {
        var fromPrice = parsePrice(p[CFG.f.p_priceFrom]);
        if (fromPrice > S.filters.maxPrice) return false;
      }

      // purity filter
      if (S.filters.minPurity > 0 && variants.length) {
        var hasMinPurity = variants.some(function (v) {
          return parsePurity(v[CFG.f.v_purity]) >= S.filters.minPurity;
        });
        if (!hasMinPurity) return false;
      }

      return true;
    }).sort(function (a, b) {
      if (S.filters.sort === 'price_asc') {
        return parsePrice(a[CFG.f.p_priceFrom]) - parsePrice(b[CFG.f.p_priceFrom]);
      }
      if (S.filters.sort === 'price_desc') {
        return parsePrice(b[CFG.f.p_priceFrom]) - parsePrice(a[CFG.f.p_priceFrom]);
      }
      return 0;
    });
  }

  /* ── selected variant for a product ─────────────────────── */
  function selectedVariant(slug) {
    var variants = S.variantMap[slug] || [];
    var idx = S.selectedVariant[slug] || 0;
    return variants[idx] || null;
  }

  /* ── build HTML ──────────────────────────────────────────── */
  function buildLayout() {
    var products = filteredProducts();
    var maxPriceAll = 200;
    S.products.forEach(function (p) {
      (S.variantMap[p[CFG.f.p_slug]] || []).forEach(function (v) {
        var pr = parsePrice(v[CFG.f.v_price]);
        if (pr > maxPriceAll) maxPriceAll = pr;
      });
    });

    return (
      '<div class="pep-layout">' +
        buildSidebar(maxPriceAll) +
        '<div class="pep-main">' +
          buildMeta(products.length) +
          buildTable(products) +
        '</div>' +
      '</div>' +
      buildCartFab() +
      buildDrawer() +
      '<div class="pep-overlay" id="pep-overlay"></div>'
    );
  }

  function buildSidebar(maxPriceAll) {
    var catCheckboxes = S.categories.map(function (c) {
      var checked = S.filters.categories.includes(c[CFG.f.c_id]) ? ' checked' : '';
      return (
        '<label class="pep-check-label">' +
          '<input type="checkbox" class="pep-cat-cb" data-id="' + esc(c[CFG.f.c_id]) + '"' + checked + '>' +
          esc(c[CFG.f.c_name]) +
        '</label>'
      );
    }).join('');

    var maxVal = Math.min(S.filters.maxPrice, maxPriceAll);

    return (
      '<div class="pep-sidebar">' +
        '<div class="pep-sb-section">' +
          '<span class="pep-sb-heading">Sort</span>' +
          '<select class="pep-sb-select" id="pep-sort">' +
            '<option value="featured"' + (S.filters.sort==='featured'?' selected':'') + '>Featured</option>' +
            '<option value="price_asc"' + (S.filters.sort==='price_asc'?' selected':'') + '>Price: low to high</option>' +
            '<option value="price_desc"' + (S.filters.sort==='price_desc'?' selected':'') + '>Price: high to low</option>' +
          '</select>' +
        '</div>' +
        (catCheckboxes ? (
          '<div class="pep-sb-section">' +
            '<span class="pep-sb-heading">Category</span>' +
            catCheckboxes +
          '</div>'
        ) : '') +
        '<div class="pep-sb-section">' +
          '<span class="pep-sb-heading">Max price</span>' +
          '<input type="range" class="pep-slider" id="pep-price-slider" ' +
            'min="0" max="' + maxPriceAll + '" step="5" value="' + maxVal + '">' +
          '<div class="pep-slider-labels"><span>$0</span><span id="pep-price-label">$' + maxVal + '</span></div>' +
        '</div>' +
        '<div class="pep-sb-section">' +
          '<span class="pep-sb-heading">Purity</span>' +
          '<label class="pep-check-label">' +
            '<input type="radio" name="pep-purity" value="0"' + (S.filters.minPurity===0?' checked':'') + '> Any' +
          '</label>' +
          '<label class="pep-check-label">' +
            '<input type="radio" name="pep-purity" value="98"' + (S.filters.minPurity===98?' checked':'') + '> ≥ 98%' +
          '</label>' +
          '<label class="pep-check-label">' +
            '<input type="radio" name="pep-purity" value="99"' + (S.filters.minPurity===99?' checked':'') + '> ≥ 99%' +
          '</label>' +
        '</div>' +
      '</div>'
    );
  }

  function buildMeta(count) {
    return (
      '<div class="pep-meta">' +
        '<span><strong>' + count + '</strong> product' + (count!==1?'s':'') + ' in stock</span>' +
        '<span>Sorted · ' + S.filters.sort.replace('_', ' ') + '</span>' +
      '</div>'
    );
  }

  function buildTable(products) {
    if (!products.length) {
      return '<div class="pep-no-results">No products match your filters.</div>';
    }

    var rows = products.map(function (p) {
      var slug     = p[CFG.f.p_slug];
      var variants = S.variantMap[slug] || [];
      var idx      = S.selectedVariant[slug] || 0;
      var v        = variants[idx] || null;

      var purity   = v ? (v[CFG.f.v_purity] || '—') : '—';
      var status   = v ? (v[CFG.f.v_stock]  || 'In stock') : 'In stock';
      var price    = v ? parsePrice(v[CFG.f.v_price]) : parsePrice(p[CFG.f.p_priceFrom]);
      var isOut    = status.toLowerCase().includes('out');
      var imgSrc   = p[CFG.f.p_imageUrl] || '';

      // variant selector
      var variantCell = '';
      if (variants.length > 1) {
        variantCell =
          '<select class="pep-size-select" data-slug="' + esc(slug) + '">' +
          variants.map(function (vv, i) {
            return '<option value="' + i + '"' + (i===idx?' selected':'') + '>' + esc(vv[CFG.f.v_name] || '') + '</option>';
          }).join('') +
          '</select>';
      } else {
        variantCell = '<span>' + esc(v ? (v[CFG.f.v_name] || '—') : '—') + '</span>';
      }

      // stock indicator
      var dotClass = stockClass(status);
      var stockHtml =
        '<span class="pep-stock">' +
          '<span class="pep-dot ' + dotClass + '"></span>' +
          esc(status) +
        '</span>';

      // action button
      var actionBtn = isOut
        ? '<button class="pep-btn-notify" disabled>Notify me</button>'
        : '<button class="pep-btn-add" data-slug="' + esc(slug) + '" data-idx="' + idx + '">' +
            'Add to cart' +
          '</button>';

      return (
        '<tr data-slug="' + esc(slug) + '">' +
          '<td class="pep-td-name">' +
            '<div class="pep-name">' + esc(p[CFG.f.p_name]) + '</div>' +
            '<div class="pep-mech">' + esc(p[CFG.f.p_mechanism] || '') + '</div>' +
          '</td>' +
          '<td><span class="pep-purity">' + esc(purity) + '</span></td>' +
          '<td>' + variantCell + '</td>' +
          '<td>' + stockHtml + '</td>' +
          '<td><span class="pep-price">' + (price ? fmt(price) : '—') + '</span></td>' +
          '<td>' + actionBtn + '</td>' +
        '</tr>'
      );
    }).join('');

    return (
      '<table class="pep-table">' +
        '<thead><tr>' +
          '<th>Peptide</th>' +
          '<th>Purity</th>' +
          '<th>Size</th>' +
          '<th>Stock</th>' +
          '<th>Price</th>' +
          '<th></th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>'
    );
  }

  /* ══════════════════════════════════════════════════════════
     CART HTML
  ══════════════════════════════════════════════════════════ */
  function buildCartFab() {
    var count = cartCount();
    return (
      '<button class="pep-cart-fab" id="pep-cart-fab" aria-label="Open cart">' +
        '🛒' +
        '<span class="pep-cart-badge" id="pep-cart-badge">' + (count || '') + '</span>' +
      '</button>'
    );
  }

  function buildDrawer() {
    return (
      '<div class="pep-drawer" id="pep-drawer">' +
        '<div class="pep-drawer-hdr">' +
          '<h2>Your cart</h2>' +
          '<button class="pep-drawer-close" id="pep-drawer-close">&#x2715;</button>' +
        '</div>' +
        '<div class="pep-drawer-items" id="pep-drawer-items">' +
          buildCartItems() +
        '</div>' +
        '<div class="pep-drawer-ftr">' +
          '<div class="pep-subtotal-row">' +
            '<span>Subtotal</span>' +
            '<span id="pep-subtotal">' + fmt(cartTotal()) + '</span>' +
          '</div>' +
          '<button class="pep-checkout-btn" id="pep-checkout-btn"' + (S.cart.length ? '' : ' disabled') + '>' +
            'Proceed to checkout →' +
          '</button>' +
          '<p class="pep-checkout-note">Secure checkout via paywithsoap.com</p>' +
        '</div>' +
      '</div>'
    );
  }

  function buildCartItems() {
    if (!S.cart.length) {
      return '<div class="pep-cart-empty">Your cart is empty.</div>';
    }
    return S.cart.map(function (item) {
      return (
        '<div class="pep-cart-item">' +
          (item.image
            ? '<img class="pep-cart-img" src="' + esc(item.image) + '" alt="' + esc(item.name) + '">'
            : '<div class="pep-cart-img"></div>') +
          '<div class="pep-cart-info">' +
            '<div class="pep-cart-iname">' + esc(item.name) + '</div>' +
            '<div class="pep-cart-isize">' + esc(item.size) + '</div>' +
            '<div class="pep-cart-iprice">' + fmt(item.price * item.qty) + '</div>' +
            '<div class="pep-qty-row">' +
              '<button class="pep-qty-btn" data-action="dec" data-vid="' + esc(item.variantId) + '">−</button>' +
              '<span class="pep-qty-val">' + item.qty + '</span>' +
              '<button class="pep-qty-btn" data-action="inc" data-vid="' + esc(item.variantId) + '">+</button>' +
              '<button class="pep-remove" data-vid="' + esc(item.variantId) + '" title="Remove">✕</button>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  /* ══════════════════════════════════════════════════════════
     CART LOGIC
  ══════════════════════════════════════════════════════════ */
  function saveCart() {
    localStorage.setItem('pep_cart', JSON.stringify(S.cart));
  }

  function addToCart(slug, variantIdx) {
    var p = S.products.find(function (x) { return x[CFG.f.p_slug] === slug; });
    if (!p) return;
    var variants = S.variantMap[slug] || [];
    var v = variants[variantIdx];
    if (!v) return;

    var vid   = v[CFG.f.v_id] || (slug + '_v' + variantIdx);
    var price = parsePrice(v[CFG.f.v_price]);
    var size  = v[CFG.f.v_name] || '';

    var existing = S.cart.find(function (i) { return i.variantId === vid; });
    if (existing) {
      existing.qty++;
    } else {
      S.cart.push({
        variantId: vid,
        productSlug: slug,
        name:  p[CFG.f.p_name] || slug,
        size:  size,
        price: price,
        image: p[CFG.f.p_imageUrl] || '',
        qty:   1,
      });
    }
    saveCart();
    updateCartUI();
    openDrawer();
  }

  function changeQty(vid, delta) {
    var item = S.cart.find(function (i) { return i.variantId === vid; });
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
      S.cart = S.cart.filter(function (i) { return i.variantId !== vid; });
    }
    saveCart();
    updateCartUI();
  }

  function removeItem(vid) {
    S.cart = S.cart.filter(function (i) { return i.variantId !== vid; });
    saveCart();
    updateCartUI();
  }

  /* ── update cart UI without full re-render ─────────────── */
  function updateCartUI() {
    var badge      = document.getElementById('pep-cart-badge');
    var items      = document.getElementById('pep-drawer-items');
    var subtotal   = document.getElementById('pep-subtotal');
    var checkoutBtn= document.getElementById('pep-checkout-btn');

    var count = cartCount();
    if (badge) {
      badge.textContent = count || '';
      badge.style.display = count ? 'flex' : 'none';
    }
    if (items)      items.innerHTML    = buildCartItems();
    if (subtotal)   subtotal.textContent = fmt(cartTotal());
    if (checkoutBtn) checkoutBtn.disabled = S.cart.length === 0;

    // re-attach qty listeners inside drawer
    attachCartItemListeners();
  }

  /* ══════════════════════════════════════════════════════════
     DRAWER OPEN / CLOSE
  ══════════════════════════════════════════════════════════ */
  function openDrawer() {
    var drawer  = document.getElementById('pep-drawer');
    var overlay = document.getElementById('pep-overlay');
    if (drawer)  drawer.classList.add('open');
    if (overlay) overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    var drawer  = document.getElementById('pep-drawer');
    var overlay = document.getElementById('pep-overlay');
    if (drawer)  drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  /* ══════════════════════════════════════════════════════════
     EVENT LISTENERS
  ══════════════════════════════════════════════════════════ */
  function attachCatalogListeners() {
    // sort
    var sortEl = document.getElementById('pep-sort');
    if (sortEl) sortEl.addEventListener('change', function () {
      S.filters.sort = this.value;
      rerenderMain();
    });

    // category checkboxes
    root.querySelectorAll('.pep-cat-cb').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var id = this.dataset.id;
        if (this.checked) {
          S.filters.categories.push(id);
        } else {
          S.filters.categories = S.filters.categories.filter(function (x) { return x !== id; });
        }
        rerenderMain();
      });
    });

    // price slider
    var slider = document.getElementById('pep-price-slider');
    var priceLabel = document.getElementById('pep-price-label');
    if (slider) {
      slider.addEventListener('input', function () {
        S.filters.maxPrice = parseInt(this.value, 10);
        if (priceLabel) priceLabel.textContent = '$' + this.value;
      });
      slider.addEventListener('change', function () {
        S.filters.maxPrice = parseInt(this.value, 10);
        rerenderMain();
      });
    }

    // purity radios
    root.querySelectorAll('[name="pep-purity"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        S.filters.minPurity = parseInt(this.value, 10);
        rerenderMain();
      });
    });

    // table: variant selectors + add to cart
    attachTableListeners();

    // cart fab
    var fab = document.getElementById('pep-cart-fab');
    if (fab) fab.addEventListener('click', openDrawer);

    // drawer close
    var closeBtn = document.getElementById('pep-drawer-close');
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);

    // overlay
    var overlay = document.getElementById('pep-overlay');
    if (overlay) overlay.addEventListener('click', closeDrawer);

    // checkout button
    var checkoutBtn = document.getElementById('pep-checkout-btn');
    if (checkoutBtn) checkoutBtn.addEventListener('click', function () {
      // Build a simple cart query string and redirect to checkout URL
      // Replace this block with your paywithsoap.com integration
      var params = S.cart.map(function (i) {
        return encodeURIComponent(i.name + ' ' + i.size) + 'x' + i.qty;
      }).join(',');
      window.location.href = CFG.checkoutUrl + '?items=' + params;
    });

    // cart item listeners (initial)
    attachCartItemListeners();
  }

  function attachTableListeners() {
    // variant selectors
    root.querySelectorAll('.pep-size-select').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var slug = this.dataset.slug;
        S.selectedVariant[slug] = parseInt(this.value, 10);
        rerenderMain();
      });
    });

    // add to cart buttons
    root.querySelectorAll('.pep-btn-add').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var slug = this.dataset.slug;
        var idx  = parseInt(this.dataset.idx || '0', 10);
        addToCart(slug, idx);
        // brief feedback
        var orig = this.textContent;
        this.textContent = '✓ Added';
        this.disabled = true;
        var self = this;
        setTimeout(function () {
          self.textContent = orig;
          self.disabled = false;
        }, 1200);
      });
    });
  }

  function attachCartItemListeners() {
    var items = document.getElementById('pep-drawer-items');
    if (!items) return;

    items.querySelectorAll('.pep-qty-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var vid   = this.dataset.vid;
        var delta = this.dataset.action === 'inc' ? 1 : -1;
        changeQty(vid, delta);
      });
    });

    items.querySelectorAll('.pep-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        removeItem(this.dataset.vid);
      });
    });
  }

  /* ══════════════════════════════════════════════════════════
     PARTIAL RE-RENDER (sidebar stays, main refreshes)
  ══════════════════════════════════════════════════════════ */
  function rerenderMain() {
    var main = root.querySelector('.pep-main');
    if (!main) { renderCatalog(); return; }
    var products = filteredProducts();
    main.innerHTML = buildMeta(products.length) + buildTable(products);
    attachTableListeners();
  }

  /* ══════════════════════════════════════════════════════════
     HTML ESCAPE
  ══════════════════════════════════════════════════════════ */
  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ══════════════════════════════════════════════════════════
     BOOT
  ══════════════════════════════════════════════════════════ */
  async function boot() {
    injectStyles();
    if (!getRoot()) return;
    renderLoading();

    if (!CFG.token || CFG.token === 'YOUR_AIRTABLE_PAT_HERE') {
      renderError('No Airtable token configured. Open pepcision-catalog.js and set CFG.token.');
      return;
    }

    try {
      // Fetch in parallel for speed
      var results = await Promise.all([
        fetchAll(CFG.tables.products),
        fetchAll(CFG.tables.variants),
        fetchAll(CFG.tables.categories).catch(function () { return []; }),
      ]);

      S.products   = results[0];
      var variants = results[1];
      S.categories = results[2];

      // Build variant map keyed by product_slug
      S.variantMap = {};
      variants.forEach(function (v) {
        var slug = v[CFG.f.v_productSlug];
        if (!slug) return;
        if (!S.variantMap[slug]) S.variantMap[slug] = [];
        S.variantMap[slug].push(v);
      });

      // If no categories from API, derive them from products
      if (!S.categories.length) {
        var catIds = {};
        S.products.forEach(function (p) {
          var id = Array.isArray(p[CFG.f.p_catId]) ? p[CFG.f.p_catId][0] : p[CFG.f.p_catId];
          if (id && !catIds[id]) {
            catIds[id] = true;
            S.categories.push({ [CFG.f.c_id]: id, [CFG.f.c_name]: id });
          }
        });
      }

      S.loading = false;
      renderCatalog();

    } catch (err) {
      renderError(err.message || String(err));
    }
  }

  // Run on DOMContentLoaded or immediately if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
