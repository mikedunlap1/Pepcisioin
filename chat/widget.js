(() => {
  function runAgeGate() {
    const config = {
      brandName: 'Pepcision',
      minAge: 18,
      storageKey: 'pepcision_age_gate_v1',
      expirationDays: 30,
      leaveUrl: 'https://www.google.com/',
      logoUrl: new URL('../assets/pepcision-logo.png', base).href,
      accentColor: '#2dd4bf',
      backgroundColor: '#020617'
    };
    if (document.getElementById('pepcision-age-gate')) return;
    try {
      const saved = JSON.parse(localStorage.getItem(config.storageKey) || 'null');
      const expiresAt = saved?.acceptedAt + config.expirationDays * 24 * 60 * 60 * 1000;
      if (saved?.accepted && Date.now() < expiresAt) return;
    } catch (error) {
      localStorage.removeItem(config.storageKey);
    }
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    const gate = document.createElement('div');
    gate.id = 'pepcision-age-gate';
    gate.innerHTML = `
      <style>
        #pepcision-age-gate{position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;padding:24px;background:radial-gradient(circle at top,rgba(45,212,191,.18),transparent 35%),${config.backgroundColor};font-family:Inter,Arial,sans-serif;color:#fff}
        #pepcision-age-gate *{box-sizing:border-box}
        .pepcision-gate-card{width:100%;max-width:540px;padding:36px;border:1px solid rgba(255,255,255,.14);border-radius:24px;background:rgba(15,23,42,.94);box-shadow:0 24px 80px rgba(0,0,0,.45);text-align:center}
        .pepcision-logo{max-width:190px;max-height:72px;object-fit:contain;margin:0 auto 18px;display:block}
        .pepcision-badge{display:inline-flex;align-items:center;justify-content:center;margin-bottom:18px;padding:6px 12px;border-radius:999px;background:rgba(45,212,191,.12);border:1px solid rgba(45,212,191,.35);color:${config.accentColor};font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}
        .pepcision-brand{margin:0 0 10px;font-size:30px;font-weight:900;letter-spacing:-.03em;color:#fff}
        .pepcision-copy{margin:0 0 22px;color:#cbd5e1;font-size:15px;line-height:1.6}
        .pepcision-confirm{display:flex;gap:10px;align-items:flex-start;margin:22px 0;padding:14px;border-radius:14px;background:rgba(255,255,255,.05);color:#e2e8f0;font-size:14px;line-height:1.45;text-align:left}
        .pepcision-confirm input{margin-top:3px;accent-color:${config.accentColor}}
        .pepcision-actions{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .pepcision-btn{border:0;border-radius:14px;padding:14px 16px;cursor:pointer;font-weight:900;font-size:15px}
        .pepcision-enter{background:${config.accentColor};color:#042f2e}
        .pepcision-enter:disabled{opacity:.45;cursor:not-allowed}
        .pepcision-leave{background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.14)}
        .pepcision-small{margin-top:18px;color:#94a3b8;font-size:12px;line-height:1.5}
        @media(max-width:540px){.pepcision-gate-card{padding:26px}.pepcision-actions{grid-template-columns:1fr}.pepcision-brand{font-size:26px}}
      </style>
      <div class="pepcision-gate-card" role="dialog" aria-modal="true" aria-labelledby="pepcision-gate-title">
        <img class="pepcision-logo" src="${config.logoUrl}" alt="${config.brandName} logo">
        <div class="pepcision-badge">${config.minAge}+ Access Required</div>
        <h1 class="pepcision-brand" id="pepcision-gate-title">Welcome to ${config.brandName}</h1>
        <p class="pepcision-copy">This website is intended for adults ${config.minAge} years of age or older. Products are offered for laboratory research purposes only and are not intended for human consumption, medical use, diagnosis, treatment, or prevention of disease.</p>
        <label class="pepcision-confirm"><input id="pepcision-age-checkbox" type="checkbox"><span>I confirm that I am at least ${config.minAge} years old and understand that these products are for research use only.</span></label>
        <div class="pepcision-actions"><button id="pepcision-enter-site" class="pepcision-btn pepcision-enter" disabled>Enter Site</button><button id="pepcision-leave-site" class="pepcision-btn pepcision-leave">Leave Site</button></div>
        <div class="pepcision-small">By entering, you acknowledge and accept the site terms and research-use disclaimer.</div>
      </div>`;
    document.body.append(gate);
    const checkbox = gate.querySelector('#pepcision-age-checkbox');
    const enter = gate.querySelector('#pepcision-enter-site');
    const leave = gate.querySelector('#pepcision-leave-site');
    checkbox.addEventListener('change', () => { enter.disabled = !checkbox.checked; });
    enter.addEventListener('click', () => {
      localStorage.setItem(config.storageKey, JSON.stringify({ accepted: true, acceptedAt: Date.now() }));
      gate.remove();
      document.documentElement.style.overflow = previousOverflow;
    });
    leave.addEventListener('click', () => { window.location.href = config.leaveUrl; });
  }
  const base = new URL('.', document.currentScript.src);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', runAgeGate, { once: true }); else runAgeGate();
  if (document.querySelector('pepcision-chat')) return;
  const demoMode = document.currentScript.dataset.mode === 'demo';
  const demo = demoMode ? window.PepcisionChatDemo : null;
  if (demoMode && !demo) return; // Never send demo messages to a server.
  // The public endpoint may live on a separate host from GitHub Pages.
  const endpoint = new URL(document.currentScript.dataset.api || '../api/chat', base);
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash || (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)))) return;
  const host = document.createElement('pepcision-chat');
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('link');
  style.rel = 'stylesheet'; style.href = new URL('widget.css', base).href;
  shadow.append(style);
  const launcher = document.createElement('button');
  launcher.className = 'launcher'; launcher.type = 'button';
  launcher.setAttribute('aria-label', 'Chat with us');
  launcher.innerHTML = `<span class="launcher-label" aria-hidden="true">Chat with us</span><svg class="launcher-icon" aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none"><path d="M20 11.5a8 8 0 0 1-8 8H5l-4 3v-11a9.5 9.5 0 0 1 19 0Z" transform="translate(1 -1) scale(.95)" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7" cy="10" r="1" fill="currentColor"/><circle cx="11" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/></svg>`;
  launcher.setAttribute('aria-expanded', 'false'); launcher.setAttribute('aria-controls', 'chat-panel');
  const panel = document.createElement('section');
  panel.id = 'chat-panel'; panel.className = 'panel'; panel.hidden = true;
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Pepcision support chat');
  // This markup is constant. All visitor and server text uses textContent below.
  panel.innerHTML = `<header><div><span class="eyebrow">PEPCISION</span><h2>Research support</h2><span class="subtitle">Documentation. Shipping. Order help.</span></div><button class="close" type="button" aria-label="Close chat">×</button></header>
    <div class="notice">For laboratory research use only. No medical or human-use guidance.</div>
    <div class="messages" role="log" aria-live="polite" aria-relevant="additions" tabindex="0" aria-label="Chat messages"></div>
    <div class="topics" aria-label="Common questions"></div>
    <form><label for="message">How can we help?</label><div class="input-row"><textarea id="message" name="message" maxlength="1000" rows="2" placeholder="Ask about documentation or shipping…" required></textarea><button class="send" type="submit" aria-label="Send message">↑</button></div><div class="status" role="status"></div></form>
    <footer><span>Don’t share personal, payment, or medical details. Questions may be processed by AI. We save decision records for review, without chat text.</span><div><a class="privacy">Chat privacy</a><a class="contact">Contact the team ↗</a><button class="clear" type="button">Clear chat</button></div></footer>`;
  shadow.append(launcher, panel);
  if (demoMode) {
    panel.querySelector('.subtitle').textContent = 'Demo · Preset replies · No live AI';
    panel.querySelector('footer > span').textContent = 'Demo messages stay in this page and are not saved or sent to a chat service. Don’t share personal, payment, or medical details.';
  }
  document.body.append(host);
  const messages = panel.querySelector('.messages');
  const textarea = panel.querySelector('textarea');
  const submit = panel.querySelector('.send');
  const status = panel.querySelector('.status');
  const topics = panel.querySelector('.topics');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  panel.querySelector('.privacy').href = new URL('../chat-privacy.html', base).href;
  panel.querySelector('.contact').href = new URL('../contact.html', base).href;
  let token; let busy = false; let controller;
  function reveal(element, fromStart = false) {
    requestAnimationFrame(() => {
      const top = fromStart ? messages.scrollTop + element.getBoundingClientRect().top - messages.getBoundingClientRect().top - 14 : messages.scrollHeight;
      messages.scrollTo({ top, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    });
  }
  function append(text, role, source) {
    const bubble = document.createElement('div'); bubble.className = `bubble ${role}`;
    const label = document.createElement('span'); label.className = 'speaker'; label.textContent = role === 'user' ? 'You' : 'Pepcision';
    const content = document.createElement('p'); content.textContent = text;
    bubble.append(label, content);
    if (source && ['/faq.html', '/contact.html'].includes(source.path)) {
      const link = document.createElement('a'); link.href = new URL(`..${source.path}`, base).href; link.textContent = source.label; bubble.append(link);
    }
    messages.append(bubble);
    while (messages.children.length > 60) messages.firstElementChild.remove();
    reveal(bubble, role === 'bot' && messages.children.length > 1);
    return bubble;
  }
  function showTyping() {
    const bubble = document.createElement('div');
    bubble.className = 'bubble bot typing';
    bubble.setAttribute('role', 'status');
    bubble.setAttribute('aria-label', 'Pepcision is preparing a reply');
    const label = document.createElement('span'); label.className = 'speaker'; label.textContent = 'Pepcision';
    const row = document.createElement('div'); row.className = 'typing-row'; row.setAttribute('aria-hidden', 'true');
    const dots = document.createElement('span'); dots.className = 'typing-dots';
    for (let i = 0; i < 3; i++) dots.append(document.createElement('span'));
    const text = document.createElement('span'); text.textContent = 'Preparing a reply…';
    row.append(dots, text); bubble.append(label, row); messages.append(bubble); reveal(bubble);
    return bubble;
  }
  function greet() { append('Welcome to Pepcision. I can help with COAs, shipping, product availability, and order support. Choose a topic or ask a question.', 'bot'); }
  function toggle(open) { panel.hidden = !open; launcher.setAttribute('aria-expanded', String(open)); if (open) { if (!matchMedia('(pointer: coarse)').matches) textarea.focus(); } else launcher.focus(); }
  launcher.addEventListener('click', () => toggle(panel.hidden));
  panel.querySelector('.close').addEventListener('click', () => toggle(false));
  panel.addEventListener('keydown', event => { if (event.key === 'Escape') toggle(false); });
  const suggestions = [['COAs & documents', 'Do you provide COAs?'], ['Shipping', 'Where do orders ship from?'], ['Availability', 'Product availability'], ['Order support', 'Order support']];
  for (const [label, message] of suggestions) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
    button.addEventListener('click', () => send(message)); panel.querySelector('.topics').append(button);
  }
  async function send(message) {
    if (busy || !message.trim()) return;
    busy = true; submit.disabled = true; submit.classList.add('waiting');
    submit.setAttribute('aria-label', 'Waiting for reply');
    topics.hidden = true; status.textContent = '';
    const sent = append(message, 'user');
    const delivery = document.createElement('span'); delivery.className = 'delivery'; delivery.textContent = 'Sending…'; sent.append(delivery);
    textarea.value = '';
    const typing = showTyping();
    // Keep very fast replies visually separate from the send action; the request starts immediately.
    const minimumFeedback = new Promise(resolve => setTimeout(resolve, 650));
    controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      let data;
      if (demoMode) {
        data = demo.reply(message);
        delivery.textContent = 'Demo ✓';
      } else {
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', signal: controller.signal, body: JSON.stringify({ message, ...(token ? { session: token } : {}) }) });
        data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Chat is unavailable. Please contact the team.');
        if (typeof data.answer !== 'string' || typeof data.session !== 'string') throw new Error('Chat is unavailable. Please contact the team.');
        token = data.session; delivery.textContent = 'Sent ✓';
      }
      await minimumFeedback;
      typing.remove(); append(data.answer, 'bot', data.source);
    } catch (error) {
      typing.remove(); delivery.textContent = 'No reply received'; sent.classList.add('failed');
      status.textContent = error.name === 'AbortError' ? 'The request timed out. Please try again or contact the team.' : (error instanceof SyntaxError || error instanceof TypeError ? 'Couldn’t get a reply. Please try again or contact the team.' : error.message);
      if (!textarea.value) textarea.value = message;
    } finally {
      clearTimeout(timeout); typing.remove(); busy = false; submit.disabled = false; submit.classList.remove('waiting');
      submit.setAttribute('aria-label', 'Send message');
      if (!panel.hidden && (!shadow.activeElement || shadow.activeElement === submit)) textarea.focus();
    }
  }
  panel.querySelector('form').addEventListener('submit', event => { event.preventDefault(); send(textarea.value.trim()); });
  textarea.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); send(textarea.value.trim()); } });
  panel.querySelector('.clear').addEventListener('click', () => { if (busy) { status.textContent = 'Please wait for the current reply before clearing.'; return; } token = undefined; messages.replaceChildren(); topics.hidden = false; status.textContent = ''; greet(); textarea.focus(); });
  greet();
})();
