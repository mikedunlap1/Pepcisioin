/* ============================================================
   Pepcision — site interactivity
   ============================================================ */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    setupMobileNav();
    setupCartDrawer();
    setupAccordions();
    setupTabs();
    setupQuantity();
    setupRangeOutputs();
    setupGallery();
    setupAddToCart();
    setupAgeGate();
  }

  /* ---------- Mobile nav ---------- */
  function setupMobileNav() {
    const toggle = document.querySelector("[data-mobile-toggle]");
    const nav = document.querySelector("[data-mobile-nav]");
    const overlay = document.querySelector("[data-site-overlay]");
    if (!toggle || !nav) return;

    function open() {
      nav.classList.add("is-open");
      overlay && overlay.classList.add("is-open");
      overlay && overlay.removeAttribute("hidden");
      toggle.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
    }
    function close() {
      nav.classList.remove("is-open");
      overlay && overlay.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    }
    toggle.addEventListener("click", () => {
      nav.classList.contains("is-open") ? close() : open();
    });
    overlay && overlay.addEventListener("click", close);
    nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", close));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  }

  /* ---------- Cart drawer ---------- */
  function setupCartDrawer() {
    const drawer = document.querySelector("[data-cart-drawer]");
    const toggles = document.querySelectorAll("[data-cart-toggle]");
    const close = document.querySelector("[data-cart-close]");
    const overlay = document.querySelector("[data-site-overlay]");
    if (!drawer) return;

    function openCart() {
      drawer.classList.add("is-open");
      drawer.setAttribute("aria-hidden", "false");
      overlay && overlay.classList.add("is-open");
      overlay && overlay.removeAttribute("hidden");
      document.body.style.overflow = "hidden";
    }
    function closeCart() {
      drawer.classList.remove("is-open");
      drawer.setAttribute("aria-hidden", "true");
      overlay && overlay.classList.remove("is-open");
      document.body.style.overflow = "";
    }

    toggles.forEach((t) => t.addEventListener("click", openCart));
    close && close.addEventListener("click", closeCart);
    overlay && overlay.addEventListener("click", closeCart);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeCart(); });
  }

  /* ---------- Accordions ---------- */
  function setupAccordions() {
    document.querySelectorAll("[data-accordion-button]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const expanded = btn.getAttribute("aria-expanded") === "true";
        const panelId = btn.getAttribute("aria-controls");
        const panel = panelId ? document.getElementById(panelId) : null;
        btn.setAttribute("aria-expanded", String(!expanded));
        if (panel) {
          if (expanded) panel.setAttribute("hidden", "");
          else panel.removeAttribute("hidden");
        }
      });
    });
  }

  /* ---------- Tabs ---------- */
  function setupTabs() {
    document.querySelectorAll("[data-tabs]").forEach((container) => {
      const buttons = container.querySelectorAll("[role='tab']");
      buttons.forEach((btn) => {
        btn.addEventListener("click", () => {
          buttons.forEach((b) => {
            b.setAttribute("aria-selected", "false");
            b.setAttribute("tabindex", "-1");
            const id = b.getAttribute("aria-controls");
            const panel = id ? document.getElementById(id) : null;
            panel && panel.setAttribute("hidden", "");
          });
          btn.setAttribute("aria-selected", "true");
          btn.setAttribute("tabindex", "0");
          const id = btn.getAttribute("aria-controls");
          const panel = id ? document.getElementById(id) : null;
          panel && panel.removeAttribute("hidden");
        });
      });
    });
  }

  /* ---------- Quantity selector ---------- */
  function setupQuantity() {
    document.querySelectorAll("[data-quantity]").forEach((wrap) => {
      const dec = wrap.querySelector("[data-quantity-dec]");
      const inc = wrap.querySelector("[data-quantity-inc]");
      const input = wrap.querySelector("input");
      if (!input) return;
      const clamp = (n) => Math.max(1, Math.min(99, n));
      dec && dec.addEventListener("click", () => { input.value = clamp((+input.value || 1) - 1); });
      inc && inc.addEventListener("click", () => { input.value = clamp((+input.value || 1) + 1); });
      input.addEventListener("blur", () => { input.value = clamp(+input.value || 1); });
    });
  }

  /* ---------- Range outputs ---------- */
  function setupRangeOutputs() {
    document.querySelectorAll("[data-range-input]").forEach((input) => {
      const output = document.querySelector(`[data-range-output='${input.id}']`);
      if (!output) return;
      const update = () => { output.textContent = "$" + input.value; };
      input.addEventListener("input", update);
      update();
    });
  }

  /* ---------- Product gallery ---------- */
  function setupGallery() {
    const main = document.querySelector("[data-product-main-image]");
    const buttons = document.querySelectorAll("[data-gallery-button]");
    if (!main || !buttons.length) return;
    buttons.forEach((b) => {
      b.addEventListener("click", () => {
        buttons.forEach((x) => x.classList.remove("is-active"));
        b.classList.add("is-active");
        const src = b.getAttribute("data-image");
        const alt = b.getAttribute("data-alt") || "";
        if (src) main.setAttribute("src", src);
        main.setAttribute("alt", alt);
      });
    });
  }

  /* ---------- Cart state ---------- */
  const cart = { items: [], total: 0 };
  function renderCart() {
    const list = document.querySelector("[data-cart-items]");
    const count = document.querySelector("[data-cart-count]");
    const subtotal = document.querySelector(".cart-drawer__footer .range-meta strong:last-child");
    if (!list) return;
    if (!cart.items.length) {
      list.innerHTML = '<div class="empty-state">Cart is empty.</div>';
    } else {
      list.innerHTML = cart.items.map((it, idx) => `
        <div class="cart-item">
          <div class="cart-item__name">${escapeHtml(it.name)}</div>
          <div class="cart-item__price">${escapeHtml(it.price)}</div>
          <button class="cart-item__remove" data-cart-remove="${idx}" type="button">Remove</button>
        </div>
      `).join("");
      list.querySelectorAll("[data-cart-remove]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const i = +btn.getAttribute("data-cart-remove");
          cart.items.splice(i, 1);
          renderCart();
        });
      });
    }
    if (count) {
      if (cart.items.length) { count.textContent = cart.items.length; count.removeAttribute("hidden"); }
      else { count.setAttribute("hidden", ""); }
    }
    if (subtotal) {
      const total = cart.items.reduce((s, it) => s + parsePrice(it.price), 0);
      subtotal.textContent = total ? `$${total.toFixed(2)}` : "—";
    }
  }
  function parsePrice(p) { const n = parseFloat(String(p).replace(/[^\d.]/g, "")); return isNaN(n) ? 0 : n; }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  function setupAddToCart() {
    document.querySelectorAll("[data-add-to-cart]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const name = btn.getAttribute("data-product-name") || "Item";
        const price = btn.getAttribute("data-product-price") || "$0.00";
        const qtyInput = btn.closest("section, form, .product-summary, body")?.querySelector("[data-quantity] input");
        const qty = qtyInput ? Math.max(1, +qtyInput.value || 1) : 1;
        for (let i = 0; i < qty; i++) cart.items.push({ name, price });
        renderCart();
        // open drawer
        const drawer = document.querySelector("[data-cart-drawer]");
        const overlay = document.querySelector("[data-site-overlay]");
        if (drawer) {
          drawer.classList.add("is-open");
          drawer.setAttribute("aria-hidden", "false");
          overlay && overlay.classList.add("is-open");
          overlay && overlay.removeAttribute("hidden");
        }
      });
    });
    renderCart();
  }

  /* ---------- Age gate ---------- */
  function setupAgeGate() {
    const gate = document.querySelector("[data-age-gate]");
    if (!gate) return;
    const KEY = "pepcision_age_ok";
    const ok = (() => { try { return localStorage.getItem(KEY) === "1"; } catch (e) { return false; } })();
    if (ok) { gate.setAttribute("hidden", ""); return; }
    gate.removeAttribute("hidden");
    document.body.style.overflow = "hidden";

    const checkbox = gate.querySelector("[data-age-checkbox]");
    const enter = gate.querySelector("[data-age-enter]");
    const leave = gate.querySelector("[data-age-leave]");
    if (checkbox && enter) {
      checkbox.addEventListener("change", () => {
        enter.disabled = !checkbox.checked;
      });
    }
    enter && enter.addEventListener("click", () => {
      try { localStorage.setItem(KEY, "1"); } catch (e) {}
      gate.setAttribute("hidden", "");
      document.body.style.overflow = "";
    });
    leave && leave.addEventListener("click", () => {
      window.location.href = "https://www.google.com";
    });
  }
})();
