(() => {
  if (document.querySelector('pepcision-chat')) return;
  const base = new URL('.', document.currentScript.src);
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
