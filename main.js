const body = document.body;
const siteShell = document.querySelector("[data-site-shell]");
const overlay = document.querySelector("[data-site-overlay]");
const header = document.querySelector("[data-site-header]");
const mobileMenuButton = document.querySelector("[data-mobile-toggle]");
const mobileNav = document.querySelector("[data-mobile-nav]");
const cartButton = document.querySelector("[data-cart-toggle]");
const cartDrawer = document.querySelector("[data-cart-drawer]");
const cartCloseButton = document.querySelector("[data-cart-close]");
const cartItems = document.querySelector("[data-cart-items]");
const cartCount = document.querySelector("[data-cart-count]");
const ageGate = document.querySelector("[data-age-gate]");
const ageGateCheckbox = document.querySelector("[data-age-checkbox]");
const ageGateEnter = document.querySelector("[data-age-enter]");
const ageGateLeave = document.querySelector("[data-age-leave]");

const state = {
  mobileOpen: false,
  cartOpen: false,
  lastTrigger: null,
  cartTotal: 0
};

function setInert(isInert) {
  if (siteShell && "inert" in siteShell) siteShell.inert = isInert;
}

function lockBody(locked) {
  body.classList.toggle("is-locked", locked);
}

function setOverlayVisible(visible) {
  if (!overlay) return;
  overlay.classList.toggle("is-visible", visible);
  overlay.hidden = !visible;
}

function closeMobileNav() {
  if (!mobileNav || !mobileMenuButton) return;
  state.mobileOpen = false;
  mobileNav.classList.remove("is-open");
  mobileMenuButton.setAttribute("aria-expanded", "false");
  if (!state.cartOpen && !ageGate?.classList.contains("is-visible")) {
    lockBody(false);
    setOverlayVisible(false);
  }
}

function openMobileNav() {
  if (!mobileNav || !mobileMenuButton) return;
  state.mobileOpen = true;
  mobileNav.classList.add("is-open");
  mobileMenuButton.setAttribute("aria-expanded", "true");
  lockBody(true);
  setOverlayVisible(true);
}

function toggleMobileNav() {
  if (state.mobileOpen) closeMobileNav();
  else openMobileNav();
}

function createCartItem(name, price) {
  const item = document.createElement("article");
  item.className = "cart-item";
  item.innerHTML = `
    <strong>${name}</strong>
    <span>Research Use Only</span>
    <span>${price}</span>
  `;
  return item;
}

function updateCartCount() {
  if (!cartCount) return;
  cartCount.textContent = String(state.cartTotal);
  cartCount.hidden = state.cartTotal < 1;
}

function openCartDrawer(trigger) {
  if (!cartDrawer) return;
  state.cartOpen = true;
  state.lastTrigger = trigger || document.activeElement;
  cartDrawer.classList.add("is-open");
  cartDrawer.setAttribute("aria-hidden", "false");
  lockBody(true);
  setOverlayVisible(true);
  if (cartCloseButton) cartCloseButton.focus();
}

function closeCartDrawer() {
  if (!cartDrawer) return;
  state.cartOpen = false;
  cartDrawer.classList.remove("is-open");
  cartDrawer.setAttribute("aria-hidden", "true");
  if (!state.mobileOpen && !ageGate?.classList.contains("is-visible")) {
    lockBody(false);
    setOverlayVisible(false);
  }
  if (state.lastTrigger instanceof HTMLElement) state.lastTrigger.focus();
}

function addToCart(button) {
  if (!cartItems) return;
  const emptyState = cartItems.querySelector(".empty-state");
  if (emptyState) emptyState.remove();

  const name = button.dataset.productName || "Research peptide";
  const price = button.dataset.productPrice || "$0.00";
  cartItems.prepend(createCartItem(name, price));
  state.cartTotal += 1;
  updateCartCount();
  openCartDrawer(button);
}

function initCart() {
  updateCartCount();
  document.querySelectorAll("[data-add-to-cart]").forEach((button) => {
    button.addEventListener("click", () => addToCart(button));
  });
  cartButton?.addEventListener("click", () => openCartDrawer(cartButton));
  cartCloseButton?.addEventListener("click", closeCartDrawer);
}

function initAccordions() {
  document.querySelectorAll("[data-accordion-button]").forEach((button) => {
    button.addEventListener("click", () => {
      const panel = document.getElementById(button.getAttribute("aria-controls"));
      const expanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!expanded));
      if (panel) panel.hidden = expanded;
    });
  });
}

function initTabs() {
  const tabsRoot = document.querySelector("[data-tabs]");
  if (!tabsRoot) return;
  const tabs = tabsRoot.querySelectorAll("[role='tab']");
  const panels = tabsRoot.querySelectorAll("[role='tabpanel']");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.getAttribute("aria-controls");
      tabs.forEach((c) => {
        c.setAttribute("aria-selected", "false");
        c.setAttribute("tabindex", "-1");
      });
      panels.forEach((p) => { p.hidden = p.id !== target; });
      tab.setAttribute("aria-selected", "true");
      tab.setAttribute("tabindex", "0");
      tab.focus();
    });
  });
}

function initProductGallery() {
  const mainImage = document.querySelector("[data-product-main-image]");
  if (!mainImage) return;
  document.querySelectorAll("[data-gallery-button]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextImage = button.dataset.image;
      const nextAlt = button.dataset.alt || mainImage.alt;
      if (!nextImage) return;
      mainImage.src = nextImage;
      mainImage.alt = nextAlt;
      document.querySelectorAll("[data-gallery-button]").forEach((c) => {
        c.classList.toggle("is-active", c === button);
      });
    });
  });
}

function initQuantity() {
  document.querySelectorAll("[data-quantity]").forEach((wrapper) => {
    const input = wrapper.querySelector("input");
    const dec = wrapper.querySelector("[data-quantity-dec]");
    const inc = wrapper.querySelector("[data-quantity-inc]");
    if (!input || !dec || !inc) return;
    dec.addEventListener("click", () => {
      input.value = String(Math.max(1, Number(input.value) - 1));
    });
    inc.addEventListener("click", () => {
      input.value = String(Math.min(99, Number(input.value) + 1));
    });
  });
}

function initRangeOutput() {
  document.querySelectorAll("[data-range-input]").forEach((input) => {
    const output = document.querySelector(`[data-range-output='${input.id}']`);
    if (!output) return;
    const sync = () => { output.textContent = `$${input.value}`; };
    sync();
    input.addEventListener("input", sync);
  });
}

function trapFocus(container, event) {
  const focusable = container.querySelectorAll(
    "a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex='-1'])"
  );
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function initAgeGate() {
  if (!ageGate || !ageGateCheckbox || !ageGateEnter) return;
  const consentKey = "pepcision-age-gate";
  const hasConsent = localStorage.getItem(consentKey) === "true";

  if (hasConsent) {
    ageGate.hidden = true;
    setInert(false);
    return;
  }

  ageGate.hidden = false;
  ageGate.classList.add("is-visible");
  ageGateEnter.disabled = true;
  setInert(true);
  lockBody(true);

  ageGateCheckbox.addEventListener("change", () => {
    ageGateEnter.disabled = !ageGateCheckbox.checked;
  });

  ageGateEnter.addEventListener("click", () => {
    localStorage.setItem(consentKey, "true");
    ageGate.classList.remove("is-visible");
    ageGate.hidden = true;
    setInert(false);
    if (!state.mobileOpen && !state.cartOpen) lockBody(false);
  });

  ageGateLeave?.addEventListener("click", () => {
    window.location.href = "https://www.google.com";
  });

  ageGate.addEventListener("keydown", (event) => {
    if (event.key === "Tab") trapFocus(ageGate, event);
  });

  setTimeout(() => { ageGateCheckbox.focus(); }, 20);
}

function initGlobalKeyboard() {
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (state.cartOpen) closeCartDrawer();
    if (state.mobileOpen) closeMobileNav();
  });
}

function initOverlay() {
  overlay?.addEventListener("click", () => {
    if (state.cartOpen) closeCartDrawer();
    if (state.mobileOpen) closeMobileNav();
  });
}

function initMobileNav() {
  mobileMenuButton?.addEventListener("click", toggleMobileNav);
  mobileNav?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMobileNav);
  });
}

function initNewsletter() {
  document.querySelectorAll("[data-newsletter-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type='submit']");
      if (button) {
        button.textContent = "Subscribed";
        button.disabled = true;
      }
    });
  });
}

initMobileNav();
initOverlay();
initGlobalKeyboard();
initCart();
initAccordions();
initTabs();
initProductGallery();
initQuantity();
initRangeOutput();
initAgeGate();
initNewsletter();
