:root {
  --pc-blue: #0b76e0;
  --pc-blue-dark: #075fb8;
  --pc-soft: #eef6ff;
  --pc-text: #334155;
  --pc-head: #1e2f46;
  --pc-border: #d7e5f5;
  --pc-shadow: 0 10px 28px rgba(15, 23, 42, 0.10);
}

body.page-home {
  background: #fff;
  color: var(--pc-text);
}

.page-home .site-header {
  background: rgba(255,255,255,.96);
  border-bottom: 1px solid var(--pc-border);
  backdrop-filter: blur(8px);
}

.page-home .brand__text strong { color: var(--pc-blue); font-weight: 700; }
.page-home .brand__text p { color: #64748b; }

.page-home .btn {
  border-radius: 999px;
  min-height: 2.9rem;
  padding: .78rem 1.4rem;
  font-weight: 600;
}

.page-home .btn--primary {
  background: var(--pc-blue);
  border-color: var(--pc-blue);
  color: #fff;
}
.page-home .btn--primary:hover { background: var(--pc-blue-dark); border-color: var(--pc-blue-dark); }

.page-home .hero {
  background: linear-gradient(180deg, var(--pc-soft), #f8fbff);
  padding-block: clamp(3rem, 6vw, 5rem);
}
.page-home .hero__headline {
  color: var(--pc-head);
  letter-spacing: -0.03em;
  line-height: .96;
}
.page-home .hero__body p { max-width: 40ch; }

.page-home .hero__sidebar {
  border-radius: 28px;
  overflow: hidden;
  box-shadow: var(--pc-shadow);
}
.page-home .hero__sidebar > div {
  background: rgba(255,255,255,.92);
  border: 1px solid var(--pc-border);
  border-radius: 16px;
  padding: 1rem;
}

.page-home .product-card {
  border: 1px solid var(--pc-border);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 6px 18px rgba(15, 23, 42, .06);
}
.page-home .product-card img { aspect-ratio: 16/10; object-fit: cover; }

.page-home .badge {
  background: #eaf4ff;
  color: #0c5cb1;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
}

.page-home .quality-grid article,
.page-home .faq-list article {
  border: 1px solid var(--pc-border);
  border-radius: 16px;
  background: #fff;
  padding: 1rem;
}

.page-home .site-footer {
  border-top: 1px solid var(--pc-border);
  background: #f8fbff;
}
