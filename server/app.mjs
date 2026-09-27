import http from 'node:http';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { isIP, SocketAddress } from 'node:net';
import { Store } from './store.mjs';
import { classify } from './policy.mjs';
import { POLICY_VERSION, renderDecision } from './knowledge.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

function loadPublicFiles() {
  const files = new Map();
  // Deliberately no generic static middleware over the repository root.
  function add(relative) {
    const filename = path.join(root, relative);
    const type = types[path.extname(relative)];
    if (type) files.set(`/${relative.replaceAll('\\', '/')}`, { bytes: readFileSync(filename), type });
  }
  for (const name of readdirSync(root)) if (name.endsWith('.html') || ['styles.css', 'brand-overrides.css', 'product-data.js'].includes(name)) add(name);
  function walk(directory) {
    for (const entry of readdirSync(path.join(root, directory), { withFileTypes: true })) {
      const relative = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(relative);
      else if (entry.isFile()) add(relative);
    }
  }
  for (const dir of ['assets', 'products', 'chat']) walk(dir);
  files.set('/', files.get('/index.html'));
  return files;
}

function hash(config, value) { return createHmac('sha256', config.hashKey).update(value).digest('hex'); }
function safeEqual(a, b) {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}
function peerAddress(req) { return (req.socket.remoteAddress ?? 'unknown').replace(/^::ffff:/, ''); }
export function clientAddress(req, config) {
  let address = peerAddress(req);
  // Only the rightmost forwarded IP supplied by a known direct proxy is trusted.
  if (config.trustedProxies.includes(address)) {
    const value = req.headers['x-forwarded-for']?.split(',').at(-1)?.trim();
    if (value && isIP(value)) address = value.replace(/^::ffff:/, '');
  }
  if (isIP(address) === 6) {
    const canonical = new SocketAddress({ address, family: 'ipv6' }).address;
    const halves = canonical.split('::');
    const left = halves[0] ? halves[0].split(':') : [];
    const right = halves[1] ? halves[1].split(':') : [];
    const full = halves.length === 2 ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right] : left;
    address = full.slice(0, 4).map(x => parseInt(x, 16).toString(16)).join(':') + '::/64';
  }
  return address;
}
function session(config, provided) {
  const sign = value => createHmac('sha256', config.sessionKey).update(value).digest('hex');
  if (typeof provided === 'string' && provided.length < 150) {
    const [id, expiry, signature, extra] = provided.split('.');
    if (!extra && /^[a-f0-9-]{36}$/.test(id) && /^\d{13}$/.test(expiry) && Number(expiry) > Date.now() && Number(expiry) <= Date.now() + 86400000 && /^[a-f0-9]{64}$/.test(signature) && safeEqual(sign(`${id}.${expiry}`), signature)) return { token: provided, id };
  }
  const id = randomUUID();
  const value = `${id}.${Date.now() + 86400000}`;
  return { token: `${value}.${sign(value)}`, id };
}
async function readBody(req) {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type'] ?? '') || req.headers['content-encoding']) throw { status: 415 };
  if (Number(req.headers['content-length'] ?? 0) > 8192) throw { status: 413 };
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > 8192) throw { status: 413 };
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw { status: 400 }; }
}

export function createApp(config, { store = new Store(config), fetcher = fetch } = {}) {
  const files = loadPublicFiles();
  const inlineHashes = [...files.values()].filter(file => file.type.startsWith('text/html')).flatMap(file => [...file.bytes.toString().matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => `'sha256-${createHash('sha256').update(match[1]).digest('base64')}'`));
  const csp = `default-src 'self'; script-src 'self' ${[...new Set(inlineHashes)].join(' ')}; style-src 'self' 'unsafe-inline'; img-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'self' mailto:`;
  let inFlight = 0;
  const timer = setInterval(() => { try { store.cleanup(); } catch { console.error('chat_retention_failed'); } }, 3600000).unref();
  const server = http.createServer({ maxHeaderSize: 8192, requestTimeout: 10000, headersTimeout: 10000, keepAliveTimeout: 5000 }, async (req, res) => {
    const requestId = randomUUID();
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy', csp);
    res.setHeader('Cache-Control', 'no-store');
    if (config.production) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
    const limited = () => { res.setHeader('Retry-After', '60'); send(429, { error: 'Please wait before trying again.' }); };
    try {
      const url = new URL(req.url, 'http://internal');
      const api = url.pathname.startsWith('/api/');
      const secureTransport = req.socket.encrypted || (config.trustedProxies.includes(peerAddress(req)) && req.headers['x-forwarded-proto'] === 'https');
      if (config.production && url.pathname !== '/healthz' && !secureTransport) return send(426, { error: 'HTTPS is required.' });
      if (!api) {
        if (!['GET', 'HEAD'].includes(req.method)) return send(405, { error: 'Method not allowed.' });
        if (url.pathname === '/healthz') return send(200, { status: 'ok' });
        if (url.pathname === '/admin') { res.writeHead(302, { Location: '/chat/admin.html' }); return res.end(); }
        const file = files.get(url.pathname);
        if (!file) return send(404, { error: 'Not found.' });
        res.writeHead(200, { 'Content-Type': file.type, 'Content-Length': file.bytes.length });
        return res.end(req.method === 'HEAD' ? undefined : file.bytes);
      }
      const origin = req.headers.origin;
      if (origin && !config.origins.includes(origin)) return send(403, { error: 'Origin not allowed.' });
      // Cross-origin access is explicitly allowed only for the public chat route.
      // Admin requests never receive CORS headers, even for an approved widget origin.
      const widgetCors = url.pathname === '/api/chat' && origin && config.widgetOrigins.includes(origin);
      if (req.headers['sec-fetch-site'] === 'cross-site' && !widgetCors) return send(403, { error: 'Origin not allowed.' });
      if (widgetCors) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        if (req.method === 'OPTIONS') {
          const requestedHeaders = (req.headers['access-control-request-headers'] ?? '').toLowerCase().split(',').map(value => value.trim()).filter(Boolean);
          if (req.headers['access-control-request-method'] !== 'POST' || requestedHeaders.some(value => value !== 'content-type')) return send(403, { error: 'Preflight not allowed.' });
          res.setHeader('Access-Control-Allow-Methods', 'POST');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.setHeader('Access-Control-Max-Age', '600');
          res.writeHead(204); return res.end();
        }
      }
      const ip = hash(config, `${new Date().toISOString().slice(0, 10)}:${clientAddress(req, config)}`);
      if (url.pathname.startsWith('/api/admin/')) {
        if (!store.consume('admin-global', 200, 60000) || !store.consume(`admin:${ip}`, 30, 60000)) return limited();
        const token = req.headers.authorization?.replace(/^Bearer /, '') ?? '';
        if (!config.adminToken || !req.headers.authorization?.startsWith('Bearer ') || !safeEqual(token, config.adminToken)) return send(401, { error: 'Admin authentication required.' });
        if (url.pathname === '/api/admin/logs' && req.method === 'GET') {
          const cursor = url.searchParams.get('before');
          if (cursor && !/^\d{13}_[a-f0-9-]{36}$/.test(cursor)) return send(400, { error: 'Invalid cursor.' });
          const parts = cursor?.split('_');
          const events = store.list(parts ? { created: Number(parts[0]), id: parts[1] } : undefined);
          const last = events.at(-1);
          return send(200, { events, nextCursor: events.length === 50 ? `${last.created}_${last.id}` : null, retentionDays: config.retentionDays });
        }
        const match = /^\/api\/admin\/logs\/([a-f0-9-]{36})\/review$/.exec(url.pathname);
        if (match && req.method === 'POST') {
          if (!origin) return send(403, { error: 'Origin required.' });
          const body = await readBody(req);
          if (!body || Object.keys(body).length) return send(400, { error: 'Invalid request.' });
          return send(200, { updated: store.review(match[1]) });
        }
        return send(404, { error: 'Not found.' });
      }
      if (url.pathname !== '/api/chat') return send(404, { error: 'Not found.' });
      if (req.method !== 'POST') return send(405, { error: 'Method not allowed.' });
      if (!origin) return send(403, { error: 'Origin required.' });
      // Global ingress bound prevents unbounded limiter rows from rotating clients.
      if (!store.consume('ingress-global', config.dailyLimit * 10, 86400000) || !store.consume(`ip:${ip}`, config.ipLimit, 60000)) return limited();
      const body = await readBody(req);
      if (!body || Array.isArray(body) || typeof body !== 'object' || Object.keys(body).some(key => !['message', 'session'].includes(key)) || typeof body.message !== 'string' || !body.message.trim() || body.message.length > 1000 || (body.session !== undefined && (typeof body.session !== 'string' || body.session.length > 150))) return send(400, { error: 'Enter a message of 1–1,000 characters.' });
      const current = session(config, body.session);
      const sessionHash = hash(config, current.id);
      if (!store.consume(`session:${sessionHash}`, config.sessionLimit, 60000)) return limited();
      if (!store.consume('chat-global', config.dailyLimit, 86400000)) { res.setHeader('Retry-After', '86400'); return send(429, { error: 'Chat has reached its daily limit. Contact orders@pepcision.com.' }); }
      if (inFlight >= 8) return send(503, { error: 'Chat is busy. Please try again shortly.' });
      inFlight++;
      try {
        const decision = await classify(body.message, config, fetcher);
        const result = renderDecision(decision);
        const event = {
          id: requestId, created: Date.now(), session: sessionHash,
          intent: decision.intent, action: result.action, trigger: result.action !== decision.action ? 'output_guard' : decision.trigger,
          answerId: result.action === 'answered' ? decision.answerId : 'none', classifier: decision.classifier,
          policyVersion: POLICY_VERSION, reviewRequired: result.action !== 'answered'
        };
        // Fail closed: never return a chatbot answer if its decision cannot be recorded.
        store.append(event);
        return send(200, { ...result, session: current.token, requestId, contact: '/contact.html' });
      } finally { inFlight--; }
    } catch (error) {
      const status = [400, 413, 415].includes(error?.status) ? error.status : 503;
      // Do not log exceptions: provider/SQL errors may contain secrets or input.
      if (status === 503) console.error(`chat_request_failed ${requestId}`);
      if (!res.headersSent && !res.destroyed) send(status, { error: status === 503 ? 'Chat is temporarily unavailable. Contact orders@pepcision.com.' : 'Invalid chat request.' });
    }
  });
  server.on('clientError', (_error, socket) => { socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); });
  server.on('close', () => { clearInterval(timer); store.close(); });
  return server;
}
